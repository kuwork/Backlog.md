---
id: doc-21
title: Upstream v1.52.0 to v1.53.0 Migration Diff Classification
type: guide
created_date: '2026-10-02 05:47'
updated_date: '2026-10-03 05:00'
---
# 上游变更差异分类（v1.52.0 .. v1.53.0）

## 概述

- **上游分支**：`upstream/main`
- **范围**：`v1.52.0 .. v1.53.0`（8 commits = 3 组真实条目占 5 个提交 + 3 个维护 / chore 提交）
- **上游仓库**：`MrLesk/Backlog.md`
- **当前工作分支**：`1.52.1`（fork 版本 `1.52.0-CN`；上游 `v1.53.0` 尚未合入）
- **分析依据**：上游 `v1.53.0` Release Notes（本机 `gh` 未授权、用 GitHub release 页面取得）+ `git log --oneline v1.52.0..v1.53.0` + 当前分支排除清单 `references/current-branch-migration-exclusions.md` + fork 工作树探针（逐文件 diff 与行号核对）
- **范围口径**：语义为 `v1.52.0`（不含）至 `v1.53.0`（含）。注意 `v1.53.0` tag 打在 `fd20f714`，而 `upstream/main` 在此之后又前进了 11 个提交（`BACK-690 / 691×2 / 692 / 696 / 697 / 698 / 700 / 702 / 706` + 版本同步，HEAD `69e7b153`）；按用户定案，**本轮不覆盖这 11 个**，留待下一波（v1.53.0 .. 未来版本）。本地 `v1.53.0` tag 原不存在，已按远端 `fd20f714` 补建，便于本报告所有范围命令可执行。
- **组织方式**：按**领域分组**（CLI / Core、Watch 管线），组内按最终优先级（A→B）排序；编号沿用初筛编号（CLI-n / SRV-n）便于追溯。

## 分类说明

| 分类 | 含义 | 处理建议 |
|------|------|----------|
| **A类** | 必须合入 | 安全漏洞、关键 bug 修复、数据丢失或内容损坏修复、与当前 fork 共用核心路径的回归修复 |
| **B类** | 评估合入 | 新功能、非核心优化，需确认是否与当前 fork 定制冲突 |
| **C类** | 跳过 | 上游特有方向、纯跟踪 / 无代码、本范围未实现、或当前 fork 已覆盖 |

> ⚠️ **深度分析已执行**（2026-10-01）：下表为深度分析的**最终分类**，逐条以上游 merge commit 与当前 fork 工作树的 file:line 对照为依据。
> **分类口径**（沿用 `doc-12`）：A 类仅限安全漏洞、严重性能瓶颈、与当前 fork 共用模块的关键缺陷；新增能力、展示优化归 B 类评估。**初筛 → 深度分析 = CLI-1 B→B、SRV-1 A→A、SRV-2 A→A，无升降档。**
> **「原始/迁移任务」列**：上游任务文件已按技能「原始任务文件导入规范」导入为 draft —— 3 条分别为 `draft-170` / `draft-171` / `draft-172`。其中 **CLI-1 的 `draft-170` 已升级为 fork 任务 [BACK-741](/task/741)**（正文按 fork 范围用英文重写，12 条 AC 全部未勾选），**SRV-1 的 `draft-171` 已升级为 fork 任务 [BACK-743](/task/743)**（同样按 fork 范围重写，7 条 AC 全部未勾选），故该列分别改为 `[BACK-741](/task/741)` / `[BACK-743](/task/743)`；`draft-172`（SRV-2）已升级为 fork 任务 [BACK-744](/task/744)（同样按 fork 范围重写，6 条 AC 全部未勾选），故该列分别改为 `[BACK-741](/task/741)` / `[BACK-743](/task/743)` / `[BACK-744](/task/744)`。**「分析报告」列**指向 `doc-22` 的对应小节。
> **表内两类 `BACK-nnn` 含义不同**：「标题」列的是上游任务，「原始/迁移任务」列的 `[BACK-nnn](/task/nnn)` 是 fork 迁移任务。fork 任务号按 fork 自己的分配器给号，与上游编号体系无关，可能同号不同事；判断以链接指向为准。

## 清单口径与数据质量备注

1. **BACK-687 的三个提交不是重复，是一条线性链**：`aded8e25`（09-17）→ `01fadcbf`（09-18）→ `26c897d4`（09-19），`git log --parents` 三者首尾相接。**终态是 `26c897d4`**，前两个是历经 Codex / Grok 冷审与简化轮的中间形态。只看 `--grep BACK-687` 的任一个会拿到过期形态（比较对象：`src/utils/list-window.ts` 由 154 → 195 → 214 行）。
2. **本轮未发现 commit 前缀误标**：三个条目各自的改动文件与任务文件 `modified_files` 一致，未仅凭 `--grep` 归类。
3. **已追窗口内后续提交**（同一源文件是否还被其他提交改动）：`src/utils/list-window.ts` 在本次范围内只被 BACK-687 的三个提交触碰；`src/commands/watch-json.ts` 只被 BACK-688 与 BACK-689 触碰，无第四条。因此每条描述的都是终态形态，不存在「被后续提交悄悄改写」的偏差。
4. **`c310b708`（sync to v1.53.0）落在 tag 之后**：该 chore 提交脱离 `v1.53.0` tag（`fd20f714`），属下一波范围，本轮不计。
5. **关键血缘**：BACK-688 / 689 都建立在 **BACK-686（`task list --json --watch`）** 之上，而 BACK-686 已由本 fork 的 [BACK-657](/task/657) 迁移落地（见 `doc-12` 的 CORE-38）。实测 `src/commands/watch-json.ts` 与上游 `v1.52.0` 版本**逐字节一致**，说明这条管线是原样继承过来的、没有 fork 侧分叉 —— 这是两条 A 类可以近乎直接落地的根因。

---

## 一、CLI / Core（命令行与核心数据）

| # | 标题 | 描述摘要 | 理由 | 潜在冲突 | 优先级 | 迁移建议 | 原始/迁移任务 | 分析报告 |
|---|------|----------|------|----------|--------|----------|----------|----------|
| CLI-1 | **BACK-687 Page long CLI lists with grep-style options** | 给 `task list` / `search` / `draft list` / `milestone list` / `doc list` / `doc search` / `decision list` 七个列表命令加 grep 风格的 `--max-count <n>` / `--skip <n>` / `--count`；切开的纯文本尾部打印 `Showing <first>-<last> of <total> items. Next: <command>`，JSON 仅在切开时附 `total` 与 `nextSkip` | 解决 `--limit` 静默截断、agent 读到不完整列表也不自知的问题，是 agent 契约层的净增量；新增 `src/utils/list-window.ts`（214 行）+ 统一入口 `resolveListOutput`，并从 `src/cli.ts` 把 `parsePositiveIntegerOption` 迁出导出 | 中高 | B | ②参考重写 | [BACK-741](/task/741) | [doc-22 CLI-1 主段+盘点](/documentation/22:20-55) · [实施决策记录](/documentation/22:119-166) · [输出语义核对](/documentation/22:154-166) |

---

## 二、Watch 管线（task list --json --watch）

> 本域两条都建立在 [BACK-657](/task/657) 迁移进来的 watch 管线上（上游 BACK-686）。fork 的 `src/commands/watch-json.ts` 与上游 `v1.52.0` **逐字节一致**，因此上游这两条修复瞄准的缺陷在 fork 原样存在。

| # | 标题 | 描述摘要 | 理由 | 潜在冲突 | 优先级 | 迁移建议 | 原始/迁移任务 | 分析报告 |
|---|------|----------|------|----------|--------|----------|----------|----------|
| SRV-1 | **BACK-688 Stop task list watchers when the process that started them exits（#1037）** | npm launcher 向原生二进制注入内部 env `BACKLOG_LAUNCHER=<pid>:<ppid>`；watch 在 CLI 加载时记录启动进程，在既有 1 秒对账 tick 上以 `ppid` 变化或 `kill(pid, 0)` 返回 `ESRCH` 判定启动方已死，随即按 exit 143 强退 | 资源泄漏型缺陷：启动方被杀后 watcher 变孤儿（PPID 1）无限运行，安静仓库里永不退出。fork 逐字节复刻了该缺陷代码，`task list --json --watch` 也是 fork 的已发布命令 | 低 | **A** | ①直接复用 | [BACK-743](/task/743) | [doc-22 SRV-1](/documentation/22:63-73) |
| SRV-2 | **BACK-689 Keep idle task list watchers from using constant CPU（#1036）** | 空闲时不再每秒重跑完整任务列表读取；改为对「规范读取真正读到的一级路径」取 stat 签名（名字 + size + mtime + ctime），签名变了才触发读；通知路径不变，仍 1 秒内修复被漏掉的通知 | 严重性能瓶颈：上游实测 645 条目的仓库上空闲占用 35.8%，修复后 0.68%。**fork 的 `backlog/` 下有 1379 个 md 文件，是上游基线的两倍多**，收益更大 | 低 | **A** | ①直接复用 | [BACK-744](/task/744) | [doc-22 SRV-2](/documentation/22:77-87) |

---

## 三、跳过项（数据维护 / chore，无独立分析价值）

| 提交 | 摘要 | 跳过理由 |
|------|------|----------|
| `c310b708` | chore: sync package.json version to v1.53.0 | 落在 `v1.53.0` tag **之后**，按用户定案属下一波 |
| `32772f85` | mark tasks as completed | 上游 backlog 数据维护，无代码变更 |
| `fd20f714` | remove legacy skill | 上游删自己的 skill 目录；fork 侧的对应物是 `.codex/skills/task-migration-architect`（自建），同名不等形 |
| `c0ec546a` | chore: sync package.json version to v1.52.0 | fork 版本体系独立（`1.52.0-CN`，包名 `@kuwork/backlog.md`） |

---

## 交叉依赖与建议迁移顺序

- **第一波（连续演进，同文件、低冲突、缺陷修复）**：~~SRV-1~~（BACK-688 启动方退出即停，已由 [BACK-743](/task/743) 落地）→ ~~SRV-2~~（BACK-689 空闲 CPU，已由 [BACK-744](/task/744) 落地）。**强依赖**：SRV-2 的 diff 直接建在 SRV-1 改过的那行 `setInterval` 上，不先合 SRV-1 就没有插入点。两者依赖的源文件与 `v1.52.0` 逐字节一致，`scripts/cli.cjs` 的插入点也一致，是本范围唯一可以「近乎原样吸收」的一组。
- **第二波（改动面大、纯增量）**：CLI-1（BACK-687 列表分页）。独立于第一波。排后的理由是 `src/cli.ts` 七个命令的接线要逐个按 fork 现状重建，另加 `memo list` 的分层并存接入（保留 `--limit` / `--cursor`，只叠窗口层，不动其语义），工作量集中在一个文件，不宜并行。
- **CLI-1 的覆盖面不是「只 task」**：上游 `resolveListOutput` 串起 7 个命令（`search` / `task list` / `draft list` / `milestone list` / `doc list` / `doc search` / `decision list`）。fork 侧逐个现状见 [doc-22 CLI-1 补充盘点](/documentation/22:32-55) —— 7 个对等命令里 3 个是「有 `--limit` 但静默截断」，4 个是「完全无分页、全量输出」；另有 `memo list` / `config list` / `sequence list` / `wiki` 四条 fork 独有列表命令上游未覆盖（`memo list` 按**分层并存**接入，其余单独评估）。
- **fork 相对上游的四条自主决策**（D1 `memo list` 分层并存 / D2 `--milestone` 放弃 `-m` / D3 `board` 整体移除 `-m, --milestones` / D4 腾出的 `-m` 不分配给 `--max-count`）见 [doc-22 CLI-1 实施决策记录](/documentation/22:119-166)。

---

## 迁移任务状态

CLI-1、SRV-1、SRV-2 已分别升级为 [BACK-741](/task/741)、[BACK-743](/task/743) 与 [BACK-744](/task/744)，三条上游 draft 均已随 promote 删除。

| 迁移任务 | 对应条目 | 状态 |
|----------|----------|------|
| [BACK-741](/task/741) | CLI-1 | Done |
| [BACK-743](/task/743) | SRV-1 | Done |
| [BACK-744](/task/744) | SRV-2 | Done |
