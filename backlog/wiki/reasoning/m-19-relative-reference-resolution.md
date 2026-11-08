---
title: m-19 相对引用解析的分解推导链
labels: [reasoning, planning, m-19, markdown, web-ui]
created_date: 2026-11-08 23:05
updated_date: 2026-11-08 23:05
---

# m-19 相对引用解析的分解推导链

> 本页记录「为什么这样拆任务」的推导过程：替代分解、反转检验与支撑证据。具体技术裁决（两阶段解析、摘要算法、`P` 前缀）分别记在 [[decisions/two-stage-reference-resolution]]、[[decisions/corpus-digest-over-event-version]]、[[decisions/p-prefix-for-office-page-ranges]]，两类页面不互相替代。

## 原始需求与现象

Web Markdown 里的本地链接时灵时不灵：同一条 `../wiki/concepts/auto-port.md`，写在文档页和写在决策页结果不同；写到兄弟目录的 Office 文件干脆 404。目标不是「修好某个链接」，而是让所有集合的本地引用遵循一条可推理的规则，并且不破坏既有 `assets/...` 链接。

## 问题分解：按「基准深度」分层，不按「链接类型」分层

第一反应会按链接类型拆（Markdown 链接 / 图片 / Office / wikilink 各一个任务）。从 BACK-835 之前的三套解析器看，真正的变量不是链接类型，而是**渲染基准的来源**：

| 集合 | 存的路径 | 深度 |
|---|---|---|
| doc | 相对 `<data-dir>/docs` | 一层，但不足以爬到兄弟集合 |
| decision | **裸文件名** | 零层，`../` 必然被判逃逸 |
| wiki | 相对 wiki 目录，且需要区分 wiki 内外目标 | 一层 + 需要额外根信息 |

因此拆成「先立通用契约 → 再逐个补集合边界 → 最后补链接形态」三层，而不是四个并列任务。这条分解直接决定了任务顺序不可交换。

## 替代分解方案

| 替代 | 优点 | 缺点 | 结论 |
|---|---|---|---|
| 一个任务同时改 doc/decision/wiki + 全部链接形态 | 表面上一次到位 | 无法定位是哪个基准出错；验收面爆炸，一处回归全批回退 | 拒绝 |
| 按链接类型拆（Markdown / 图片 / Office / wikilink） | 每个任务范围清晰 | 每个任务都要重复改同一套 join / 点击契约，互相冲突 | 拒绝 |
| 只修 doc 页，让其它集合沿用旧行为 | 改动最小 | 三向验证失去意义，规则仍不可推理 | 拒绝 |
| **通用契约 → doc 边界 → decision 边界 → wiki 边界 → 链接形态扩展** | 每层可独立验收，前一层的 helper 直接被后一层复用 | 串行，里程碑周期略长 | **采纳** |

## 反转检验

把关键决定反过来推一遍，确认不是巧合或过度设计：

1. **若先做 wiki 再做 doc**：wiki 需要 `wikiRoot` 才能分流，而 `wikiRoot` 本身是 `collectionRoot` 的一种；没有 doc 先验证过的 `projectPath` 边界转换，wiki 的分流规则无从定义。反过来会得到一个特例实现。
2. **若只用一个全局基准（项目根）而不做集合内 join**：所有 `../` 都会被当成从项目根出发，兄弟目录永远不可达；正文与元数据字段的语义也会被强行统一，破坏 `--ref` 的项目根相对契约。
3. **若把边界设成数据目录**：BACK-827 的旧行为，`quickstart/`、`scripts/` 下的文件永远预览不了，且要迁移既有内容。需求明确否决。
4. **若 `P` 前缀可选**：`:1-4` 在文本与 Office 上含义冲突，解析器不看扩展名就无法判定；doc-35 的裸数字反例正是这条反转的可执行证据。
5. **若只在 `useMarkdownLinkPreview` 里解析 Office 范围**：capture-phase 拦截器绕过整个契约，用户测试会（也确实）报出「全部范围链接 404」。这条反转是 BACK-838 用真实失败验证的，不是推演。
6. **若摘要用事件版本号**：echo 推进、重启归零，客户端会把一次编辑误判为多次变更，或反过来跳过刷新；BACK-840 有 frontmatter-only 回归测试守着相反方向的失败。

## 证据链

| 结论 | 证据 |
|---|---|
| 死 `#` 锚点来自基准深度 | BACK-836 的临时 decision fixture：修复前三条链接全是 `/decisions/999/...#`，修复后 DOM 显示 `/backlog/wiki/...` 与 `/backlog/docs/...` |
| 契约必须单点化 | 删掉 `WikiDetail` 两个 DOM 级 handler 前，`/task/` 双重导航、`/wiki/` 既导航又弹窗、带范围链接丢范围 |
| 三向 fixture 有必要 | doc-34 / decision-2 / wiki test 页的六条链接在 BACK-836 后生成完全一致锚点与点击行为；单一集合测不出边界差异 |
| 兄弟目录可达 | doc-35 用站点根 `/quickstart/` 引用仓库根四个真实 Office 文件，headless Chrome 无 4xx |
| 全角冒号与空格文件名会破坏切分 | `[doc-20 全角冒号]` 与 `Another Page.md` 两个验收目标分别逼出扩展名锚定切分与 `encodePath` 单次编解码修复 |

## 任务拆分与串行依赖

1. **BACK-835** 立通用契约：渲染期 join + 服务端 try_files + 项目根边界 + `collectionProjectPath` helper，并完成 doc 边界。刻意不碰 `backlog/wiki/`，把 wiki 侧文档修正记为单独批准的变更。
2. **BACK-836** 复用 helper 补 decision 边界；验收时发现点击契约漂移，追加「契约单点化 + 空标签高亮」follow-up。
3. **BACK-837** 补 wiki 边界与 `wikiRoot` 分流，落地 stash 的 wikilink 草稿，并用三向 fixture 收口。
4. **BACK-838** 属**同期但独立**的工作线（无 milestone 关联）：在已稳定的契约上扩展 Office 范围链接。把它算进 m-19 会误读里程碑范围。

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| 放宽到项目根会扩大攻击面 | 5MB 上限、扩展名 + MIME 白名单、排除 `.git`/`.env`/`.temp`、realpath 逃逸校验、`nosniff`、svg/html attachment；渲染期与服务端各判一次 |
| 自定义数据目录名被硬编码破坏 | join 与候选表都从 `relative(rootDir, collectionDir)` 派生；测试含自定义目录用例 |
| 旧链接需内容迁移 | 既有 `assets/...`、`/assets/paste/...`、`/documentation/10:55-74` 全部保留通路并纳入回归清单 |
| 任务不改 wiki 导致知识库留下过期契约 | Implementation Notes 点名 5 处待改页面，由 2026-11-08 的单独批准摄取订正（[[sources/back-835-unify-relative-reference-resolution]]） |

## Related Sources

- [[sources/m-19-fix-relative-reference-resolution]] — 里程碑骨架
- [[sources/back-835-unify-relative-reference-resolution]] — 通用契约
- [[sources/back-836-decision-relative-reference-resolution]] — decision 边界与契约单点化
- [[sources/back-837-wiki-relative-references-entity-links]] — wiki 分流与三向验收
- [[sources/back-838-office-page-sheet-ranges]] — 独立工作线
- [[sources/doc-34-relative-link-check]] / [[sources/decision-2-relative-link-check]] / [[sources/doc-35-office-link-check]] — 验收证据
