---
title: GitHub CI 发布注意事项
created_date: '2026-10-09 21:40'
updated_date: '2026-10-09 21:40'
labels: [developer-note, ci, release, github-actions, npm]
---

# GitHub CI 发布注意事项

`.github/workflows/release.yml` 是全自动发布流水线：推标签即发版。本文记录它的触发机制、作业依赖、以及出问题时唯一可行的处置路径。**所有条目来自真实事故，不是理论推演。**

---

## 1. 触发机制

```yaml
on:
  push:
    tags: ['v*.*.*']
```

- 标签名必须匹配 `v*.*.*`；`v1.53.4-CN` 这类带后缀的预发布版本号**同样匹配**（GitHub glob 的 `*` 匹配任意字符，只排除 `/`）。
- **版本号完全由标签名决定**。CI 里的 "Sync version to tag" 步骤会把 `package.json` 的 version 覆盖成标签名，因此**不需要、也不应该**手工改版本号——改了也没用，而且会掩盖 `sync-version` 的自动化是否正常工作。
- 流水线末尾的 `sync-version` job 会把版本号自动提交回 `main`（`chore: sync package.json version to vX [skip ci]`）。看到这个提交被推到远端，就是整条流水线跑完的信号；本地记得 `git pull`。

## 2. 作业链路：一次失败会连带跳过多少

```
build ×6 ──> publish-binaries ×6 ──> verify-platform-packages ×3 ──> npm-publish（主包）
                    │                                                      │
                    └──> github-release                          install-sanity ×3
                                                                           │
                                                                      sync-version
```

**`npm-publish` 依赖 `publish-binaries` 全部成功**。平台包任一失败，主包就发不出去，`install-sanity`、`sync-version` 一并 skipped。也就是说：平台包没发完 = 这一版等于没发，主包版本号会停在上一版。

排查时先看 job 列表里谁是 `failure`、谁是 `skipped`——`skipped` 是受害者，根因在 `failure` 那一个。

## 3. 三条硬规则

### 3.1 npm 版本号发布过即永久烧掉

`npm unpublish` **只是下架，不释放版本号**。发布失败但已部分发布的版本，其版本号在 npm 上已被占用，之后无论 unpublish 与否都再发不出去：

```
E403 - You cannot publish over the previously published versions: 1.53.3-CN
E400 - Cannot publish over previously published version "1.53.3-CN"   # unpublish 之后仍报
```

**结论：发废的版本号只能换号重发，别指望 unpublish 回收。** 换号时主包与 6 个平台包必须同号（主包发布时 `optionalDependencies` 被钉死在标签版本上）。

### 3.2 发布是"部分成功"的：job 被取消 ≠ 没发布

矩阵里一个 job 失败导致其他 job 被取消时，**被取消的 job 可能已经把包发出去了**（npm 的 PUT 先落库，随后 job 才被 cancel）。表现是：CI 一片红，但 npm 上已经躺着几个孤儿版本。

判断真实状态只能查 registry，不能看 job 颜色：

```bash
npm view @kuwork/backlog.md version          # 主包
for p in darwin-arm64 darwin-x64 linux-x64 linux-arm64 windows-x64 windows-arm64; do
  echo -n "$p: "; npm view "@kuwork/backlog.md-$p" version
done
```

### 3.3 OIDC 下 `npm dist-tag` 需要单独授权

流水线用 npm trusted publishing（OIDC，无 token）。`npm publish` 有权限不代表 `npm dist-tag` 有权限——后者需要在 npm 网站的 trusted publisher 配置里单独开 **"Allow npm dist-tag"**：

```
E400 Bad Request - PUT .../dist-tags/cn - Dist-tag request rejected
```

未开时只有 `cn` 别名指不上去，`latest` 依然正确，**不影响用户安装**。因此这两个步骤写了 `continue-on-error: true`，让运行保持全绿。

### 3.4 workflow 的自我保护约定（不要回退）

- `publish-binaries` 矩阵 **`fail-fast: false`**：单平台失败不连坐其他五个。缺了它，一个平台失败会把其余 5 个 cancelled，丢掉 5 次真实发布机会。
- 两处 dist-tag 步骤 **`continue-on-error: true`**：非关键步骤不该炸掉整条流水线。

## 4. 打标签前检查

- [ ] **HEAD 在 `main`**。发布说明走独立的 `release` 分支（`RELEASE-vX.md` 提交链），两者解耦；在 `release` 分支上打标签会把发布说明提交当成发布对象。
- [ ] 待发布内容已推到远端（标签指到的 commit 远端必须有）。
- [ ] 工作区干净或已知晓脏文件不进本次发布。
- [ ] 版本号没有在 npm 上被占用过（含历史失败运行留下的半发布版本）。

```bash
git tag v1.53.4-CN
git push origin v1.53.4-CN
```

## 5. 观察与诊断

```bash
gh run list --repo kuwork/Backlog.md --workflow release.yml --limit 3   # 看状态与 run ID
gh run watch --repo kuwork/Backlog.md <run-id>                          # 阻塞盯到结束
gh run view --repo kuwork/Backlog.md <run-id> --json jobs \
  --jq '.jobs[] | "\(.conclusion // .status)\t\(.name)"'                # 各 job 结论
gh api repos/kuwork/Backlog.md/actions/jobs/<job-id>/logs               # 单 job 日志
```

坑位：

- **MinTTY（Git Bash）里 `gh run view` 的交互式选择器不可用**（`could not prompt: Incorrect function`），必须显式带 run ID。
- `gh` 与 git 的 HTTPS 连接偶发 `EOF` / `Bad Gateway` / `schannel: failed to receive handshake`，**重试即可**，不是凭据或权限问题。同样的抖动也会让 `git push` 失败，循环重试 3 次通常能通。
- `npm view` 有 CDN 缓存滞后，发布后几分钟内可能仍显示旧值。以 registry 端点为准：
  ```bash
  curl -s "https://registry.npmjs.org/-/package/@kuwork%2fbacklog.md/dist-tags"
  ```

## 6. 失败后的处置决策表

| 现象 | 处置 |
|---|---|
| dist-tag 步骤 400（其余全绿） | 不用管，`latest` 已正确；回 npm 开 "Allow npm dist-tag" 或手动 `npm dist-tag add @kuwork/backlog.md@<ver> cn` |
| 平台包 E403 版本已存在 | **换号重发**，unpublish 无效（见 3.1）。打新标签推即可，无需改代码 |
| 主包没发出去、平台包已发 | 主包不能单独补发同号（同号已在平台包上烧掉）；换号重发，或手动 publish 主包（需本地 npm 凭据） |
| workflow 本身有 bug | 修完必须**打新标签**——`gh run rerun --failed` 用的是同一 commit 的旧 workflow，改动不生效 |

`gh run rerun <id> --failed` 只补失败 job 及其下游，已成功的 job（build、github-release）不会重跑。

## 7. Checklist

**发版前**：内容已推 main · HEAD 在 main · 版本号未被占用 · 工作区状态已知

**发版后**：`latest` 指到新版本（主包 + 6 平台包） · `install-sanity` 三平台通过 · GitHub Release 挂了 6 个二进制 · 远端 main 出现 `chore: sync package.json version` 提交 · 本地 `git pull`

## Related

- [[developer-notes/npm-publish-guide]] — npm 手动发布流程与版本号陷阱（CI 之外的兜底路径）
- [[developer-notes/ci-testing-gotchas]] — CI 与测试的其他踩坑条目
- [[concepts/ci-platform-contracts]] — CI 平台契约测试策略
