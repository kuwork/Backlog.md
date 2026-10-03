---
id: doc-22
title: v1.52.0 至 v1.53.0 上游任务迁移分析报告（按领域）
type: guide
created_date: '2026-10-02 05:47'
updated_date: '2026-10-03 05:00'
---
# 上游任务迁移分析报告（v1.52.0 .. v1.53.0，按领域）

本报告对应 `doc-21` 中全部条目（含跳过项），逐项给出上游任务核心目的、变更内容、与当前 fork 的交集风险、适合迁移的部分、需要调整/排除的部分、迁移优先级与迁移建议。所有结论以**上游 merge commit 与 fork 工作树的 file:line 对照**为依据。

> 分析前提：当前 fork 已演进的能力以 `references/current-branch-migration-exclusions.md` 为准，凡与其「不应回退的内容」重合的上游改动一律标为跳过。

> **范围口径**：本次覆盖 `v1.52.0`（不含）至 `v1.53.0`（含）共 8 个提交：BACK-687 独占 3 个（`aded8e25 → 01fadcbf → 26c897d4` 一条线性链），BACK-688 与 BACK-689 各 1 个，其余 3 个是数据维护与版本同步 chore。Release Notes（`gh release view` 未授权，改用 GitHub release 页面）与 commit log、任务文件三方一致。

> **关键血缘**：本范围两个 watch 类条目（BACK-688 / 689）都建立在 **BACK-686（task list --json --watch）** 之上，而 BACK-686 已由本轮之前的 [BACK-657](/task/657) 迁移落地（`doc-12` 的 CORE-38）。因此这两个条目落在**本 fork 自己迁移进来的那条管线上**，不是陌生能力。

# 一、CLI / Core（命令行与核心数据）

## CLI-1：BACK-687 Page long CLI lists with grep-style options（[BACK-741](/task/741)）

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | Agent 通过 CLI 读列表；`task list` / `search` / `doc search` 的 `--limit` 排序后就截断却不告知被截断，也没有通往后续条目的选项，agent 只能在「读超长列表」与「基于静默不完整列表行动」之间二选一。上游借 grep 的 `--max-count` / `--count` 与 `git log --max-count --skip` 的既有词汇补一套分页。 |
| **变更内容摘要** | 三个线性提交 `aded8e25 → 01fadcbf → 26c897d4`，**终态是 `26c897d4`**（不是同标题重复，`git log --parents` 串成一条链）。新增 `src/utils/list-window.ts`（终态 214 行）：`:44` `LIST_WINDOW_OUTPUT_HELP`、`:47` `LIST_WINDOW_HELP_FIELDS`、`:57` `addListWindowOptions`、`:72` `parsePositiveIntegerOption`（由 `src/cli.ts` 迁入）、`:90` `parseListWindow`、`:123` `selectListWindow`、`:141` `milestoneSectionsInWindow`（从回调抽出的纯函数）、`:161` `nextPageCommand`、`:186` `formatListWindowFooter`、`:198` `printListWindow`。接入面：`src/cli.ts` 经统一入口 `resolveListOutput` 串起 `task list` / `search` / `draft list` / `milestone list` / `doc list` / `doc search` / `decision list` 七个命令；`src/formatters/json-output.ts:220-221` 新增 `cutListJson`（被窗口切开时才加 `total` 与 `nextSkip`）；`src/file-system/operations.ts`（同标题文档按 path 稳定排序，使相邻窗口不重叠也不漏项）；`CLI-INSTRUCTIONS.md` 与 `src/guidelines/cli-instructions/{overview,task-creation}.md` 补帮助契约；新增 `src/test/list-window.test.ts` 与 `src/test/cli-list-window.test.ts`。三次提交的 cli.ts 改动量分别为 506 / 72 / 186 行。 |
| **与当前定制代码的交集风险** | 中高 — fork **完全没有这套机制**：无 `src/utils/list-window.ts`，全仓无 `--max-count` / `--skip` / `--count`。但汇入点冲突实际在三处：① `src/cli.ts` 是所有列表命令的汇聚点，fork 6595 行 vs 上游 5934（+661），改动不能用 hunk 对齐、只能逐个命令重接；② `parsePositiveIntegerOption` 在 fork 是 `src/cli.ts:257` 的**模块私有函数**（服务于 `--limit`），而上游在本次把它搬去了 `list-window.ts` 并导出，迁移时要处理这个搬迁关系，不能让两处并存；③ **fork 自研的 `memo list` 另有一套 cursor 分页** —— `src/cli.ts:5318` 的 `-l, --limit`（默认 30）+ `--cursor`，`:5354` 打印 `More memos available. Next page: backlog memo list --limit <n> --cursor <nextCursor>`。它与上游的 offset 窗口是**两套语义**（游标 vs 偏移），不能混为一谈；已决定按**分层并存**接入（与上游 `task list` 同构，见文末决策记录）：`--limit`/`--cursor` 原样保留为第一层，窗口选项叠在其上为第二层，不动 cursor 语义。此外 fork 另有 `config list`（`:6014`）等上游没有的列表命令，接入与否需单独决定。 |
| **适合迁移的内容** | 「截断即告知」这个契约本身：切开的纯文本输出尾部 `Showing <first>-<last> of <total> items. Next: <command>`、`--count` 只打数字、JSON 仅在切开时附 `total` / `nextSkip`、窗口在过滤排序之后再按打印顺序切（相邻窗口能拼回完整输出）。以及「同标题文档按 path 破平」这条稳定排序补丁。这些都是对 agent 读取体验的净增量，且不与排除清单任何一节冲突。 |
| **需要排除/调整的内容** | ① 不改 `memo list` 的 cursor 语义；② 不把 `parsePositiveIntegerOption` 在 fork 的 `src/cli.ts:257` 副本与新位置并存，按 fork 结构选一处；③ milestone 列的「被切开时只打印实际有里程碑的小节」分支需按 fork 的 `milestone list`（`src/cli.ts:4369`）现有打印结构重排，不能照抄 `milestoneSectionsInWindow` 的调用点；④ upstream 选了「长选项、无短标志」的理由是 `-m` 已被 `--milestone` 占用——fork 同样占用，故必须沿用长选项。**占用者是 `task` 主命令**（不是某个冷门子命令）：`task create` `src/cli.ts:1919`、`task list` `:2933`（filter tasks by milestone —— 就在本条要加 `--max-count` 的同一命令上）、`task edit` `:3641` 经共享的 `addEditFieldOptions`（`:3112`，fork 在 `:3136`）也带 `-m`，`draft edit` `:4203` 复用同一辅助函数；此外 `board` 用 `-m, --milestones`（复数，`:4665`）。上游 v1.53.0 同构：`:1955` / `:2971` / `:3794`+`:3576` / `:4478`。上游任务原文 AC #4 的原话是 `No short flags are added because -m already means --milestone.`（现为 fork 任务 [BACK-741](/task/741)，原文见 `git show v1.53.0:backlog/tasks/back-687 - Page-long-CLI-lists-with-grep-style-options.md`）。**最终定案：不动 `-m`** —— `task create` `:1919` / `task list` `:2933` / 共享的 `addEditFieldOptions` `:3136` / `board` `:4665` 全部保持原样（此前 D2 / D3 记录的「放弃 `-m`」「移除 `--milestones`」**已作废**，见第六节）。腾出的说法不再成立，`-m` **不分配给 `--max-count`**：`--max-count` 与 `--skip` 骨架借自 `git log`（git 的 `--max-count` 短称是 `-n` 而非 `-m`，且 `--skip` 在 git 里也无短标志），只有 `--count` 借自 grep（`-c`），故窗口选项一律沿用长选项。**本条不涉及排除清单任何一节**（不碰日期、里程碑 actual 字段、甘特图、统计页、task edit 的 set/add 语义）。 |
| **迁移优先级** | B类（评估合入）。依据：纯新增能力，不是安全修复也不是缺陷纠正，按 `doc-12` 既定的「新增能力即便 fork 净空白也归 B 类」口径判 B。它的价值在 agent 契约（fork 一贯把 `addHelpSchema` 与 `src/guidelines/**` 当作机器可读契约维护），值得合但不是必须。 |
| **迁移建议** | ②参考重写。理由：`src/cli.ts` 是 fork 变更最密集的文件之一，七个命令的落点要逐个按 fork 现状重建，直接套 hunk 必冲突；`list-window.ts` 这个新模块本身反而可以近乎原样引入（它不依赖 fork 定制面），重写的是「接线」而非「窗口逻辑」。 |

### 补充：CLI-1 fork 侧逐个列表命令的现状盘点

上游接的是 **7 个命令**（`resolveListOutput` 调用点即清单），不是只 `task list`。fork 侧的对等现状分**两种缺陷形态**，上游 BACK-687 只治第一种：

| 命令 | 上游 v1.53.0 是否接入 | fork 落点 | fork 现状 | 缺陷形态 |
|------|----------------------|-----------|-----------|----------|
| `search [query]`（顶层） | ✅ `:2177` | `:2076`，`--limit` 在 `:2134` | 有 `--limit`（"limit total results returned"） | **①静默截断**（与上游同一 bug） |
| `task list` | ✅ `:2993` | `:2862`，`--limit` 在 `:2944`，硬切在 `:2643` `narrowed.slice(0, taskLimit)` | 有 `--limit`（"limit tasks displayed after sorting"） | **①静默截断** |
| `draft list` | ✅ `:4065` | `:4087` | 只有 `--sort` / `--plain` | **②全量输出**（72 个 draft 一次灌完） |
| `milestone list` | ✅ `:4294` | `:4369` | 只有 `--show-completed` / `--plain` | **②全量输出** |
| `doc list` | ✅ `:4761` | `:4860` | 只有 `--plain` / `--json` | **②全量输出**（21 个 doc） |
| `doc search <query>` | ✅ `:4814` | `:4911` | 只有 `--limit`（`DOCUMENT_SEARCH_LIMIT_MAX` 上界） | **①静默截断** |
| `decision list` | ✅ `:4940` | `:5053` | 只有 `--plain` / `--json` | **②全量输出** |

fork **独有**、上游没有对应物、需单独决定接不接的列表命令：

| 命令 | fork 落点 | 现状 | 建议 |
|------|-----------|------|------|
| `memo list` | `:5288` | 原有**自研 cursor 分页**：`-l, --limit`（默认 30）+ `--cursor`，`:5354` 打印 `Next page: backlog memo list --limit <n> --cursor <x>` | **接入，且用 `--skip` 取代 `--cursor`** —— 移除 `--cursor` 与默认 30 的 `--limit`，改走统一窗口尾部。`listMemosPage` 的 `cursor` 保留给 MCP 与 server API。无 CLI 测试牵制 |
| `config list` | `:6014` | 无分页 | 视输出规模定，优先级最低 |
| `sequence list` | `:5654` | 只有 `--plain`，无分页 | fork 自研命令，上游无对等物；按需单独评估 |
| `wiki` 子命令 | — | fork 自研子系统 | 同上 |

**结论**：fork 不是「只有 task 有问题」，而是 7 个上游对等命令里 **3 个静默截断 + 4 个完全无分页**，另有 4 条 fork 独有列表命令的洞上游根本没覆盖。合入 `list-window.ts` 时接线清单是「7 个对等命令 + `memo list`（分层并存接入）+ `config list` / `sequence list` / `wiki` 待定」，比原先按单一命令估算的工作量大。

---

# 二、Watch 管线（task list --json --watch）

> 本域两条都建立在 [BACK-657](/task/657) 迁移进来的 watch 管线上。**实测**：fork 的 `src/commands/watch-json.ts` 与上游 `v1.52.0` 版本**逐字节一致**（`diff` 空），`src/test/watch-json.test.ts` 同样逐字节一致 —— 两条修复瞄准的缺陷在 fork 原样存在；需要按 fork 现状改写的是测试脚手架，不是实现本体。

## SRV-1：BACK-688 Stop task list watchers when the process that started them exits（[BACK-743](/task/743)）

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | `backlog task list --json --watch` 由外部程序启动读取 stdout。启动方被关闭或被杀（含 SIGKILL）后，watch 进程变成孤儿（PPID 1）继续跑；只有在发生任务变更、往已关闭的 stdout 写数据时才因 EPIPE 退出，安静仓库里会无限运行下去。2026-09-23 上游在一台 Mac 上发现 6 个这样的 watcher，最老的存活两小时以上。 |
| **变更内容摘要** | 单提交 `2c8183a3`（PR #1037，9 个文件 +236/−32）。`scripts/cli.cjs:90`：spawn 原生二进制时注入一份内部、未文档化的 `BACKLOG_LAUNCHER=<launcher pid>:<launcher parent pid>`，其余命令忽略它。`src/commands/watch-json.ts:8-10`：在 CLI 加载时（解析与工程查找之前）捕获 `const parent = process.ppid`；仅当 env 值的第一段等于自己的 parent 时才把 `launcherParent` 也算进来，从而忽略经其他进程继承来的陈旧值。`:13-15` `starterExited()` = `process.ppid !== parent`（POSIX reparenting）或任一已记录 pid 已不存在。`:18-25` `isRunning()` 用 `process.kill(pid, 0)` 探测，**只有 `ESRCH` 才算结束**，未知 PID 与其他错误永不误杀 watch。`:133` 把原来的 `setInterval(refresh, 1000)` 换成 `starterExited() ? onTerminate() : refresh()`（沿用既有 exit 143 的强退路径）。三处文案：`CLI-INSTRUCTIONS.md`、`src/guidelines/cli-instructions/overview.md`、`task list --help` 的 watch 字段。测试 `src/test/cli-json-watch.test.ts` +91（直接启动与 launcher 启动两个 SIGKILL 用例），`src/test/test-utils.ts` +28 抽出 `createLauncherInstall` fixture。 |
| **与当前定制代码的交集风险** | 低 — 四个接入点逐个核对均在位且形态一致：① `src/commands/watch-json.ts` 与上游 `v1.52.0` **逐字节一致** → `:74` 的 `timer = setInterval(refresh, 1000);` 就是缺陷本体，也没有任何 liveness 守卫；② `scripts/cli.cjs:93-96` 的 spawn 块（`stdio: "inherit"` + `windowsHide: true`）与上游修复前形态一致，插入点完全相同（fork 的 launcher 另有 chmod 兜底、`@scope` 包名识别、两个 helper 内联化，但 spawn 与 exit 语义未变）；③ `src/cli.ts:2961` 的 `watchJson([filesystem.backlogDir, dirname(filesystem.configFilePath)], ...)` 与上游修复前一行不差；④ `src/cli.ts:2906` 的 watch help 字段、`:2948` 的 `--watch` 选项都在。**fork 反而更完善的一处**：`src/test/cli-json-watch.test.ts`（278 行 vs 上游 236）已被改造成 Windows 安全版，`collect()` 用 `Promise.race([drain, until])`，注释明写「On Windows a killed child's stdout and stderr never report end」。上游新用例的判据正是 stdout EOF，长在这套现成脚手架上比照搬上游的 POSIX 假设更稳。 |
| **适合迁移的内容** | 全部：`starterExited()` + `isRunning()` 的自检机制、launcher 的 env 透传、三处文案、两个 SIGKILL 用例。这是一条没有副作用的生命周期补齐 —— 明确论证了为何不用 Bun 的 no-orphans（进程级、会连带杀掉作为服务跑的 `backlog browser`、Windows 上是 no-op、覆盖不到 Node launcher）。 |
| **需要排除/调整的内容** | ① 不回退 fork 的 Windows 收流脚手架，也不要把 `collect()` 换回上游的纯 stream end 写法；② fork 的 `scripts/cli.cjs` 已不再导出 `getSignalExitCode` / `isArchitectureSignal`（内联进了 `child.on("exit")`），若补 launcher 单测，断言要对准 fork 现存分支，不要为了对齐上游而把 helper 导出回去；③ 上游 e2e 表格里的「launcher exit 143 / 137 / 130」是 macOS 手工走查结论，本机 Windows 不能复现，**不要写进 AC**；自动化判据只用 stdout EOF；④ 上游 Notes 承认的两个已知限制要在落地时一并登记：经 launcher 时须等启动方自己的父进程 reap 后才发现（zombie 上 `kill 0` 仍成功）、pid 在一拍内被复用会延迟发现。 |
| **迁移优先级** | A类（必须合入）。理由：孤儿进程永不退出属资源泄漏型缺陷，fork 逐字节复刻了缺陷代码，`task list --json --watch` 在 fork 也是已发布命令（由 [BACK-657](/task/657) 引入），任何把它当订阅源用的外部程序都会踩到。 |
| **迁移建议** | ①直接复用。`watch-json.ts` 的守卫与 `scripts/cli.cjs` 的两行可直接吸收；唯一要按 fork 处理的是测试脚手架（沿用 fork 的 `collect()`）。 |

---

## SRV-2：BACK-689 Keep idle task list watchers from using constant CPU（[BACK-744](/task/744)）

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 展示实时任务列表的程序会让 watch 长时间驻留（常同时好几个）。空闲时它本应不动，却在 groma3 这种较大的仓库上稳定占用约 38% CPU（17 分钟累计 6m23s 的 CPU 时间），小仓库则低于 1% —— 代价随被监视仓库的规模增长。 |
| **变更内容摘要** | 单提交 `1bb3d686`（PR #1036，4 个文件 +257/−16）。根因：`watchJson` 的 `setInterval(refresh, 1000)` 每秒都重跑一次完整的规范任务列表读取（`new Core` → 重复 ID 扫描 → `queryTasks` → readiness 的 completed 语料 → JSON 序列化），而空闲时并没有文件系统通知触发（上游用递归 `fs.watch` 计数器实测 10 秒内 0 事件）。修法保留 BACK-686 的对账保证（不永久漏变更），但把空闲检查变便宜：`src/commands/watch-json.ts:33` 导出 `filesSignature(inputs)`，对每个输入的**一级条目**取「名字 + size + mtimeMs + ctimeMs」拼成签名（`statSync` 跟随符号链接，缺失 / 悬空 / 成环的条目只按名字计数）；`:133` 定时器改为先查 `starterExited()`、否则只在签名变化时 `refresh()`；`:140` 在每次读取**之前**取签名，使读取期间发生的变化会自然排下一次。`src/cli.ts` +12 行构造 `inputs`（`filesystem.tasksDir` / `completedDir` / `milestonesDir` / `archiveMilestonesDir` / `configFilePath`）并作为第二个参数传给 `watchJson`。测试 `src/test/watch-json.test.ts` +104：空闲不重复读取 + 签名覆盖同大小改写 / 新建 / 删除 / 作用域 / 符号链接与两处循环。终态 Notes 记录的上游实测：groma3（645 个条目）60 秒采样从 21.47s CPU（35.8%）降到 0.41s（0.68%）。 |
| **与当前定制代码的交集风险** | 低，但有一条**量级放大**：① 缺陷本体在 fork 原样存在 —— `src/commands/watch-json.ts:74` 的 `timer = setInterval(refresh, 1000);` 每秒无条件全读；② 五个输入 getter 全在：`src/file-system/operations.ts` 的 `tasksDir:404`、`completedDir:410`、`archiveMilestonesDir:417`、`milestonesDir:428`、`configFilePath:432`；③ `src/test/watch-json.test.ts` 与上游 `v1.52.0` 逐字节一致，是新单元用例的现成宿主。**放大项**：上游的性能基线仓库是 groma3 的 645 个条目，而**本 fork 的 `backlog/` 下有 1379 个 md 文件**，是它的两倍多 —— 上游按仓库规模线性增长的结论在本仓意味着更高的空闲占用，修复收益也更大。④ **强依赖 SRV-1**：本条 diff 直接建在 BACK-688 改过的那行 `setInterval` 上（`(() => (starterExited() ? onTerminate() : refresh()), 1000)` → 加 `else if (filesSignature(inputs) !== seen) refresh()`），不先合 SRV-1 就没有插入点。 |
| **适合迁移的内容** | 全部：`filesSignature()` 的签名方式（含 ctime，使 `cp -p` 这类保留 mtime 的拷贝仍能被发现）、定时器改判、`src/cli.ts` 的 inputs 构造、以及「替代那条只在内存里跑的对账测试」的新测试。终态版本（经 Codex review 后）**不再递归遍历 `backlog/`**，只 stat 规范读取真正读到的一级路径 —— 这一版是踩过「递归 readdirSync 跟随符号链接目录、遇环永不返回」的坑后收敛的，fork 应直接采用终态而非首版。 |
| **需要排除/调整的内容** | ① 只 stat 一级、**不要递归**（终态口径），版本 History 里那份递归实现在 `Bun.Glob` 1.3.14 下会走进符号链接循环；② 符号链接相关用例在本机 Windows 需要额外权限，遵循既有惯例 skip，别为它改权限；③ `src/cli.ts` 的 inputs 数组要按 fork 自己的 `FileSystem` getter 写 —— fork 这些 getter 的行号与上游不同，别照抄行号；④ 本条的通知范围不变（`backlog/` 递归 + 配置目录），不要在 fork 上顺手扩大或收窄；⑤ Notes 末尾那条自纠（readiness 调用点是 `src/cli.ts:2717` 而非 2716）属上游行号，落地时按 fork 实际位置取。 |
| **迁移优先级** | A类（必须合入）。理由：这是 fork 已发布命令上的真实资源缺陷，且本仓语料规模是上游基线的两倍，收益更明确；与 SRV-1 同文件、必须连做。 |
| **迁移建议** | ①直接复用（与 SRV-1 合并为连续演进的一次改动）。终态形态明确、依赖面干净，唯一要按 fork 处理的是五个 getter 的行号与 Windows 上符号链接用例的 skip。 |

---

# 三、跳过项（无独立条目的提交）

| 提交 | 摘要 | 跳过理由 |
|------|------|----------|
| `c310b708` | chore: sync package.json version to v1.53.0 | 落在 v1.53.0 tag **之后**，不在本次范围内 |
| `32772f85` | mark tasks as completed | 上游 backlog 数据维护，无代码变更 |
| `fd20f714` | remove legacy skill | 上游删自己的 skill 目录；fork 侧的对应物是 `.codex/skills/task-migration-architect`（自建），同名不等形 |
| `c0ec546a` | chore: sync package.json version to v1.52.0 | fork 版本体系独立（`1.52.0-CN`，包名 `@kuwork/backlog.md`） |

---

# 四、交叉依赖与建议迁移顺序

- **第一波（同文件连续演进，低冲突、缺陷修复）**：SRV-1（BACK-688 启动方退出即停）→ SRV-2（BACK-689 空闲 CPU）。两条落在**同一个 `setInterval` 行**上，后者依赖前者先落地；两者复用的源文件与 `v1.52.0` 逐字节一致，`scripts/cli.cjs` 的插入点也一致，是这个范围内唯一可以「近乎原样吸收」的一组。
- **第二波（改动面大、纯增量）**：CLI-1（BACK-687 列表分页）。独立于第一波，不需要 watch 先行。之所以排后：`src/cli.ts` 七个命令的接线要逐个按 fork 现状重建，另加 `memo list` 的分层并存接入（保留 cursor 语义、只叠窗口层），工作量集中在一个文件不宜与别的事情并行。

---

# 五、重分类与关键发现汇总

| 条目 | 初筛 → 深度分析 | 关键发现 |
|------|----------------|----------|
| CLI-1（BACK-687） | B → B | 新模块可近乎原样引入，重写的是七个命令的接线；`parsePositiveIntegerOption` 在 fork 是 `src/cli.ts:257` 的私有函数，上游把它搬去了 `list-window.ts`，要处理搬迁关系；fork 自研的 `memo list` cursor 分页按**分层并存**接入（保留 `--limit`/`--cursor`，叠加窗口层），不动其语义 |
| SRV-1（BACK-688） | A → A | fork 的 `watch-json.ts` 与上游 `v1.52.0` 逐字节一致，缺陷原样存在；`scripts/cli.cjs:93-96` 插入点一致；fork 的 `cli-json-watch.test.ts` 已有 Windows 安全收流脚手架，比上游更适合承接新用例 |
| SRV-2（BACK-689） | A → A | 同一缺陷文件；本仓 `backlog/` 有 1379 个 md，是上游基线 groma3（645）的两倍多，收益放大；**强依赖 SRV-1**（同一行 `setInterval` 的第二次改写）；须采用「只 stat 一级、不递归」的终态版本 |

---

# 六、实施决策记录（CLI-1）

> 本节记录 fork 侧**相对上游的自主决策**，不是上游既有事实。

| # | 决策 | 内容 | 依据 |
|---|------|------|------|
| D1 | `memo list` 接入方式 | **用 `--skip` 取代 `--cursor`**（已改，原为「分层并存」）：`--cursor <memoId>`（`:5319`）与 `Next page: ... --cursor <x>` 提示（`:5354`）**移除**，`--limit` 的默认值 30（`:5318`）**取消**（否则窗口永远只看得到最新 30 条，`--skip` 取不到后面的），改走与其他 7 条命令相同的窗口尾部 `Showing <first>-<last> of <total> items. Next: backlog memo list --limit <n> --skip <m>`。`listMemosPage` 的 `cursor` 参数保留给 MCP memo 工具与 server API | 与上游 `task list` 同构 —— 上游 v1.53.0 `src/cli.ts:2991` 保留 `--limit`，`:2993` 才追加窗口选项；上游任务原文 Implementation Notes："windows its already filtered, sorted and **--limit-shortened** list"（`git show v1.53.0:backlog/tasks/back-687 - Page-long-CLI-lists-with-grep-style-options.md`；draft-170 已升级为 [BACK-741](/task/741)，正文已按 fork 范围重写，故不再引用草稿行号），测试清单含 `--limit unchanged` |
| D2 | `--milestone` 短称 | ~~放弃 `-m`~~ **已作废** → 现为**不动 `-m`**：`task create` `:1919` / `task list` `:2933` / 共享的 `addEditFieldOptions` `:3136` 全部保持原样 | 消除与 grep `-m`（--max-count）的语义混淆 |
| D3 | `board` 的里程碑选项 | ~~整体移除 `-m, --milestones`~~ **已作废** → 现为**保留** `-m, --milestones`（`:4665`）及其分组分支与 help schema 字段，一行都不动 | 用户最终定案「不修改原有 `-m` 参数」 |
| D4 | 腾出的 `-m` | **不分配给 `--max-count`**；窗口选项一律沿用长选项 | BACK-687 的骨架借自 `git log`（`--max-count` / `--skip`），git 的 `--max-count` 短称是 `-n` 而非 `-m`，`--skip` 在 git 亦无短标志；仅 `--count` 借自 grep（`-c`） |

### grep / git 短称惯例对照

| 选项 | grep 短称 | git 短称 | fork 可用性 |
|------|-----------|----------|-------------|
| `--max-count` | `-m` | `-n` | `-m` 原被 `--milestone`×3 + `--milestones`×1 占用（D2/D3 执行后腾出）；**`-n` 完全空闲** |
| `--skip` | **grep 无此参数** | 无短标志 | `-s` 被 `--status`×5 占用 |
| `--count` | `-c` | — | `-c` 被 `--content`（`:5262`，memo add）占用 |

> grep 的 `-m` 是**早停**语义（取满 N 个匹配即停止扫描），无法跳过前 N 个 —— 要模拟只能靠管道 `grep PATTERN file | tail -n +3`。BACK-687 的 `--skip` 是真正的窗口能力，来自 git log。上游 `src/utils/list-window.ts` 头注释自陈："named after options agents already know: `git log --max-count --skip` and `grep --count`" —— 骨架来自 git，只借了 grep 的 `--count` 一个词。
>
> 因此「把 `-m` 让给 `--max-count`」看似顺 grep 习惯，实则与选项名的来源自相矛盾：这两个长选项名本身是从 git log 搬来的。

### 待办（代码改动尚未执行）

1. 移除 `src/cli.ts:1919` / `:2933` / `:3136` 的 `-m, ` 短称前缀（长选项保留）
2. 移除 `src/cli.ts:4665` 整个 `-m, --milestones` 选项及其按里程碑分组的分支与 help schema 字段
3. 改 `src/test/cli-milestone-filter.test.ts`：`:144` `it("supports -m shorthand and combines milestone with status filter")`、`:145`、`:182` —— 改用 `--milestone`
4. `memo list`（`:5288`）叠加窗口选项层（保留 `--limit` / `--cursor`）
5. 7 个对等命令接入 `list-window`

> **文档侧零改动**：`CLI-INSTRUCTIONS.md`、`src/guidelines/**`、`README.md`、`README.en.md`、`RELEASE-v1.52.0-CN.md` 均无 `-m, --milestone` 引用，无需同步。
>
> `memo list` 的分页**无 CLI 测试**覆盖（memo 相关测试只有 `mcp-memos` / `memo-search` / `memos` / `web-memos-page`），第 4 步不受既有测试牵制。

### 输出语义核对：`--limit` 并未被修复

三条容易误解的事实，均取自上游 `src/utils/list-window.ts` 终态代码：

| # | 事实 | 代码依据 |
|---|------|----------|
| 1 | **`--limit` 保持静默截断**，上游没有修它。窗口选项只是**另一套会告知的写法** | `selectListWindow` 的 `const total = items.length` 取的是「传入时列表」的长度，即已过滤、已排序、**已被 `--limit` 截断**之后的长度。故 `task list --limit 10 --max-count 5` 打印 `Showing 1-5 of 10 items.` —— `of` 后面是 10，不是仓库总数 |
| 2 | **`--count` 打印「这条命令会打印多少条」，不是仓库总数** | `printListWindow`：`if (window.count) { console.log(String(page.items.length)); return; }`。语义同 `grep -c -m` 与 `git rev-list --count`。故 `task list --limit 10 --count` → `10` |
| 3 | **窗口选项强制文本输出，且 `--count` 与 `--json` 互斥** | `forcesText` 为真的条件是 `options.count`、`maxCount !== undefined`、`skip !== undefined` 三者之一成立（原文为 `Boolean(options.count)` 与后两者相或）；`parseListWindow` 首行 `if (options.count && options.json) return reportInvalidOption("--count cannot be combined with --json.")` |

> **对 agent 的实际含义**：想拿到「被截断了、还有多少、怎么取下一页」这三个信息，必须改用 `--max-count` / `--count`；继续用 `--limit` 则一切照旧、仍然静默。这不是 bug 修复，是**新增一套契约** —— 也正因如此它归 B 类（新增能力）而非 A 类（缺陷纠正）。

> **待办中的行号均为改动前基线快照**：上表第 1–3 步的 `src/cli.ts` 与 `src/test/cli-milestone-filter.test.ts` 行号取自本轮改动前的工作树。动手后需按实际落点重算，不要照抄。
