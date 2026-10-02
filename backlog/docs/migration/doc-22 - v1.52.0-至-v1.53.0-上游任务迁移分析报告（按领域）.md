---
id: doc-22
title: v1.52.0 至 v1.53.0 上游任务迁移分析报告（按领域）
type: guide
created_date: '2026-10-02 05:47'
updated_date: '2026-10-02 05:55'
---
# 上游任务迁移分析报告（v1.52.0 .. v1.53.0，按领域）

本报告对应 `doc-21` 中全部条目（含跳过项），逐项给出上游任务核心目的、变更内容、与当前 fork 的交集风险、适合迁移的部分、需要调整/排除的部分、迁移优先级与迁移建议。所有结论以**上游 merge commit 与 fork 工作树的 file:line 对照**为依据。

> 分析前提：当前 fork 已演进的能力以 `references/current-branch-migration-exclusions.md` 为准，凡与其「不应回退的内容」重合的上游改动一律标为跳过。

> **范围口径**：本次覆盖 `v1.52.0`（不含）至 `v1.53.0`（含）共 8 个提交：BACK-687 独占 3 个（`aded8e25 → 01fadcbf → 26c897d4` 一条线性链），BACK-688 与 BACK-689 各 1 个，其余 3 个是数据维护与版本同步 chore。Release Notes（`gh release view` 未授权，改用 GitHub release 页面）与 commit log、任务文件三方一致。

> **关键血缘**：本范围两个 watch 类条目（BACK-688 / 689）都建立在 **BACK-686（task list --json --watch）** 之上，而 BACK-686 已由本轮之前的 [BACK-657](/task/657) 迁移落地（`doc-12` 的 CORE-38）。因此这两个条目落在**本 fork 自己迁移进来的那条管线上**，不是陌生能力。

# 一、CLI / Core（命令行与核心数据）

## CLI-1：BACK-687 Page long CLI lists with grep-style options（draft-170）

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | Agent 通过 CLI 读列表；`task list` / `search` / `doc search` 的 `--limit` 排序后就截断却不告知被截断，也没有通往后续条目的选项，agent 只能在「读超长列表」与「基于静默不完整列表行动」之间二选一。上游借 grep 的 `--max-count` / `--count` 与 `git log --max-count --skip` 的既有词汇补一套分页。 |
| **变更内容摘要** | 三个线性提交 `aded8e25 → 01fadcbf → 26c897d4`，**终态是 `26c897d4`**（不是同标题重复，`git log --parents` 串成一条链）。新增 `src/utils/list-window.ts`（终态 214 行）：`:44` `LIST_WINDOW_OUTPUT_HELP`、`:47` `LIST_WINDOW_HELP_FIELDS`、`:57` `addListWindowOptions`、`:72` `parsePositiveIntegerOption`（由 `src/cli.ts` 迁入）、`:90` `parseListWindow`、`:123` `selectListWindow`、`:141` `milestoneSectionsInWindow`（从回调抽出的纯函数）、`:161` `nextPageCommand`、`:186` `formatListWindowFooter`、`:198` `printListWindow`。接入面：`src/cli.ts` 经统一入口 `resolveListOutput` 串起 `task list` / `search` / `draft list` / `milestone list` / `doc list` / `doc search` / `decision list` 七个命令；`src/formatters/json-output.ts:220-221` 新增 `cutListJson`（被窗口切开时才加 `total` 与 `nextSkip`）；`src/file-system/operations.ts`（同标题文档按 path 稳定排序，使相邻窗口不重叠也不漏项）；`CLI-INSTRUCTIONS.md` 与 `src/guidelines/cli-instructions/{overview,task-creation}.md` 补帮助契约；新增 `src/test/list-window.test.ts` 与 `src/test/cli-list-window.test.ts`。三次提交的 cli.ts 改动量分别为 506 / 72 / 186 行。 |
| **与当前定制代码的交集风险** | 中高 — fork **完全没有这套机制**：无 `src/utils/list-window.ts`，全仓无 `--max-count` / `--skip` / `--count`。但汇入点冲突实际在三处：① `src/cli.ts` 是所有列表命令的汇聚点，fork 6595 行 vs 上游 5934（+661），改动不能用 hunk 对齐、只能逐个命令重接；② `parsePositiveIntegerOption` 在 fork 是 `src/cli.ts:257` 的**模块私有函数**（服务于 `--limit`），而上游在本次把它搬去了 `list-window.ts` 并导出，迁移时要处理这个搬迁关系，不能让两处并存；③ **fork 自研的 `memo list` 另有一套 cursor 分页** —— `src/cli.ts:5318` 的 `-l, --limit`（默认 30）+ `--cursor`，`:5354` 打印 `More memos available. Next page: backlog memo list --limit <n> --cursor <nextCursor>`。它与上游的 offset 窗口是**两套语义**（游标 vs 偏移），不能在同一份概念里混谈，也不要为了「统一」去改 `memo list`。此外 fork 另有 `config list`（`:6014`）等上游没有的列表命令，接入与否需单独决定。 |
| **适合迁移的内容** | 「截断即告知」这个契约本身：切开的纯文本输出尾部 `Showing <first>-<last> of <total> items. Next: <command>`、`--count` 只打数字、JSON 仅在切开时附 `total` / `nextSkip`、窗口在过滤排序之后再按打印顺序切（相邻窗口能拼回完整输出）。以及「同标题文档按 path 破平」这条稳定排序补丁。这些都是对 agent 读取体验的净增量，且不与排除清单任何一节冲突。 |
| **需要排除/调整的内容** | ① 不改 `memo list` 的 cursor 语义；② 不把 `parsePositiveIntegerOption` 在 fork 的 `src/cli.ts:257` 副本与新位置并存，按 fork 结构选一处；③ milestone 列的「被切开时只打印实际有里程碑的小节」分支需按 fork 的 `milestone list`（`src/cli.ts:4369`）现有打印结构重排，不能照抄 `milestoneSectionsInWindow` 的调用点；④ upstream 选了「长选项、无短标志」的理由是 `-m` 已被 `--milestone` 占用——fork 同样占用（`src/cli.ts` 的 task list 有 `-m, --milestone`），故必须沿用长选项。**本条不涉及排除清单任何一节**（不碰日期、里程碑 actual 字段、甘特图、统计页、task edit 的 set/add 语义）。 |
| **迁移优先级** | B类（评估合入）。依据：纯新增能力，不是安全修复也不是缺陷纠正，按 `doc-12` 既定的「新增能力即便 fork 净空白也归 B 类」口径判 B。它的价值在 agent 契约（fork 一贯把 `addHelpSchema` 与 `src/guidelines/**` 当作机器可读契约维护），值得合但不是必须。 |
| **迁移建议** | ②参考重写。理由：`src/cli.ts` 是 fork 变更最密集的文件之一，七个命令的落点要逐个按 fork 现状重建，直接套 hunk 必冲突；`list-window.ts` 这个新模块本身反而可以近乎原样引入（它不依赖 fork 定制面），重写的是「接线」而非「窗口逻辑」。 |

---

# 二、Watch 管线（task list --json --watch）

> 本域两条都建立在 [BACK-657](/task/657) 迁移进来的 watch 管线上。**实测**：fork 的 `src/commands/watch-json.ts` 与上游 `v1.52.0` 版本**逐字节一致**（`diff` 空），`src/test/watch-json.test.ts` 同样逐字节一致 —— 两条修复瞄准的缺陷在 fork 原样存在；需要按 fork 现状改写的是测试脚手架，不是实现本体。

## SRV-1：BACK-688 Stop task list watchers when the process that started them exits（draft-171）

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

## SRV-2：BACK-689 Keep idle task list watchers from using constant CPU（draft-172）

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
- **第二波（改动面大、纯增量）**：CLI-1（BACK-687 列表分页）。独立于第一波，不需要 watch 先行。之所以排后：`src/cli.ts` 七个命令的接线要逐个按 fork 现状重建，且要与 fork 自研的 `memo list` cursor 分页划清边界（两套语义，不得混改），工作量集中在一个文件不宜与别的事情并行。

---

# 五、重分类与关键发现汇总

| 条目 | 初筛 → 深度分析 | 关键发现 |
|------|----------------|----------|
| CLI-1（BACK-687） | B → B | 新模块可近乎原样引入，重写的是七个命令的接线；`parsePositiveIntegerOption` 在 fork 是 `src/cli.ts:257` 的私有函数，上游把它搬去了 `list-window.ts`，要处理搬迁关系；fork 自研的 `memo list` cursor 分页是另一套语义，不得并入本条 |
| SRV-1（BACK-688） | A → A | fork 的 `watch-json.ts` 与上游 `v1.52.0` 逐字节一致，缺陷原样存在；`scripts/cli.cjs:93-96` 插入点一致；fork 的 `cli-json-watch.test.ts` 已有 Windows 安全收流脚手架，比上游更适合承接新用例 |
| SRV-2（BACK-689） | A → A | 同一缺陷文件；本仓 `backlog/` 有 1379 个 md，是上游基线 groma3（645）的两倍多，收益放大；**强依赖 SRV-1**（同一行 `setInterval` 的第二次改写）；须采用「只 stat 一级、不递归」的终态版本 |
