## v1.53.0-CN Release Notes

> 上一个版本：[v1.52.0-CN](https://github.com/kuwork/Backlog.md/releases/tag/v1.52.0-CN)
>
> 这是一个**主线版本**，覆盖 2026-10-03 至 2026-10-05 的 37 个提交、34 个任务（BACK-715 ~ BACK-747 与 BACK-420），主要由四块内容组成：**Memos 快速笔记子系统从零到全栈**（里程碑 `m-10`）、**项目状态机可视化与 AI 指引**、**CLI/MCP 列表分页统一**、**watch 常驻进程治理**，外加 Web 大纲抽屉、图谱 Canvas 化渲染、统计新指标与各面缺陷修复。

### 🎯 主要亮点

- **Memos 快速笔记上线**（里程碑 `m-10`，BACK-728 ~ 740、745 ~ 747）：第五种文件实体 `backlog/memos/`，日期+序号 ID（`YYYYMMDD-N`）、无标题 frontmatter；存储层 → HTTP API → CLI → MCP → Web 信息流/日历/钉板全链路贯通，并接入全局搜索、知识网自动链接与实时同步，支持归档到 `backlog/archive/memos/`。
- **状态机成为一等配置**（BACK-715/716/718/721）：设置页新增可视化状态机编辑器（含 Mermaid 实时预览树），AI 三份 overview 文本注入动态机器渲染，默认七列机器按 en/zh-CN/zh-TW/ja 四语本地化，`task create/edit --help` 指向 workflow 教程。
- **列表分页统一**（BACK-741/742）：8 个 CLI 列表命令获得 grep 风格的 `--max-count`/`--skip`/`--count`；全部 MCP 列表工具改走 `offset`+`limit` 与统一信封，新增 `decision_list`。
- **watch 常驻进程治理**（BACK-743/744）：`task list --json --watch` 不再在启动方退出后沦为孤儿进程；空转 CPU 从 35-42% 降到 0.68%（macOS 645 条目仓库实测）。
- **图谱迁移 Canvas 2D**（BACK-720/727）：`/graph` 与任务弹窗关系图从 D3+SVG 迁到 Canvas 2D，悬停加 300ms 延迟消闪烁；浅色主题可读性修复。

---

### 📝 Memos 快速笔记（里程碑 m-10）

自上而下分层落地：存储 → API → 三个界面 → 发现与互联 → 实时同步 → 视图与归档。

- **存储层**（BACK-728）：新模块 `src/core/memos.ts` 独占 memo 文件格式与全部 IO，`backlog/memos/` 下 `YYYYMMDD-N` 日期+序号 ID（当日最大序号 +1，跨天重置），frontmatter 仅 id/created_date/updated_date/tags，显示标题由正文首个非空行派生；LF 行尾、游标分页、目录不存在时读路径不产生副作用。
- **HTTP API**（BACK-729）：`GET/POST /api/memos`、`GET /api/memos/calendar`（按月每日计数）、`GET/PUT/DELETE /api/memos/:id`；server 层零文件写入逻辑，只校验、委托 core、广播 `memos-updated`；memo id 白名单正则校验，路径穿越返回 400。
- **CLI**（BACK-730）：新命令组 `backlog memo create/list/view/update/delete`，与 decision 命令组同风格；create 支持 `--content` 内联或 stdin 多行、`--tags` 逗号分隔；list 输出一行预览（前 20 字符），支持 `--date`/`--tags`/`--plain`/`--limit`；配套使用指南 `backlog instructions memos`。
- **MCP 工具**（BACK-740）：`memo_create` / `memo_list` / `memo_view` / `memo_update`（content 与 append 恰好二选一）/ `memo_delete`，全部委托同一 core 模块，未知 ID 统一报 `MEMO_NOT_FOUND`；工作流指南注册为 `backlog://workflow/memos`。
- **Web 信息流**（BACK-731）：`/memos` 页面——顶部 quick-capture 撰写器（Cmd/Ctrl+Enter 保存、新 memo 置顶、失败保留草稿并显示错误横幅）、倒序卡片流（MermaidMarkdown 渲染、游标 + IntersectionObserver 无限滚动、按请求 epoch 去重）、标签过滤、`?view=` 深链；粘贴图片保存前提升为正式资源。
- **日历模式**（BACK-732）：feed 与 CSS grid 月历共存于同一页面、共享单一选中日期；按每日 memo 数强度渐变着色，点选某天就地展开 DayPanel，支持**补录历史日期**（`createMemo` 接受钉住的 `createdDate`，API 只接受 `YYYY-MM-DD` 或 `YYYY-MM-DD HH:mm`）。
- **全局搜索**（BACK-733）：memo 成为第五种搜索结果类型，Web 搜索对话框有独立筛选 tab 与 `/memos?date=<day>` 链接；CLI JSON 输出新增 memo 形状，纯文本输出跳过（与 wiki 一致视为 web-only）；`/api/search` 的 type 白名单补 memo。
- **知识网链接**（BACK-734）：memo 正文经共享渲染管线自动把裸任务/文档/决策 ID 和 `[[wiki/path]]` 渲染成链接，SPA 导航无整页刷新；边界是"只出站、不入站"——memo 不是链接目标。
- **实时同步**（BACK-735）：memos 刻意在 ContentStore 之外，因此服务端为 `backlog/memos/` 单独挂 `fs.watch`（75ms 防抖广播），外部编辑器/脚本改动约一秒内反映到页面；客户端复刻 drafts-updated 模式做原地刷新，视图、选中日期、已加载页全部保留。
- **里程碑验收**（BACK-736）：发布前唯一门禁——全量测试分批全绿、live 服务器按设计文档逐项走查（含"外部编辑经 websocket 广播"这一标志性承诺 2/2 观察到）；顺带为 memo watcher 补挂 `error` 监听器（目录被删时无监听器会击垮进程）。
- **UI 打磨与日期归属修复**（BACK-737）：日历改为撰写器弹层、笔记散文排版、正文可勾选清单（勾选直接回写文件）、行内 `#tag` chips；修复本地 23:00 写的 memo 被计到次日的 bug——所有按天读取的表面统一走 `localDateKeyFromStoredUtc`，并在子进程中钉住真实时区加回归测试。
- **卡片菜单与模态返回**（BACK-738）：kebab 菜单新增"复制 ID"（含不安全上下文回退与 1.2s 确认反馈）；修复点击 memo 正文实体链接打开任务弹窗后，关闭落到看板而非回到 /memos 的 backgroundLocation bug。
- **搜索刷新门控**（BACK-745）：memo 语料刷新加 stat 签名门控（name+size+mtime+ctime 一层扫描），签名未变跳过重读与 Fuse 索引重建；修复 `dispose()` 后状态残留导致 memo 从索引静默消失的问题。
- **WebGL 钉板视图**（BACK-746）：`?view=board` 进入便利贴钉板——每张便签完整外观烘焙进离屏 2D canvas、裸 WebGL 一便签一 textured quad（零新依赖），FNV-1a(memo id) 驱动确定性布局重载不重洗，hover 抬起、点击打开 MemoCard 弹窗，全屏可用，WebGL 不可用时显示本地化回退。
- **归档**（BACK-747）：卡片菜单（Copy ID 与 Delete 之间）与钉板便签 hover 归档按钮（canvas 上方 HTML overlay）把 memo **原样 rename** 到 `backlog/archive/memos/`——id/frontmatter/正文逐字节不动，天然可逆；REST `POST /api/memos/:id/archive`（404 未知 id / 409 冲突）；`backlog init` 对称补建 `backlog/memos` 与 `backlog/archive/memos`。有意不做取消归档。

---

### 🎛️ 状态机与 AI 指引

- **设置页编辑器**（BACK-715）：`config.yml` 对象形式 `statuses` 可视化维护——左侧状态卡片（name/category/exit + next 迁移边的 to/when/ai/if/requires/evidence），右侧 Mermaid 实时预览树（回边降级虚线）；Reset（丢弃未保存改动）与 Default（载入默认七列机器）语义严格区分，编辑器只声明不强制；配套修复 serializeConfig 把对象序列化成 `[object Object]` 的 bug、保存后广播 `config-updated`、`backlog init` 首写七列对象形式、TUI 看板 `display:false` 隐藏列、CLI/MCP 终态判定改按 category。
- **AI 指引注入**（BACK-716）：`StateMachine.describe()` 运行时渲染本项目的机器（状态表、ai 四层权限、next 边、终态表、"停下等人工"清单），注入 CLI overview、MCP overview 资源与 `get_backlog_instructions` 三处；坏配置有诊断块兜底，overview 永不丢失；任务执行指南改为"跟随本项目状态机"而非固定序列。
- **--help 指路**（BACK-718）：`task create/edit --help` 末尾新增 Note 行指向 `backlog instructions overview`，共享常量保证两命令措辞不漂移。
- **四语本地化与可读性**（BACK-721）：默认机器 when/if/requires/evidence 散文按 en/zh-CN/zh-TW/ja 变体，locale 检测走 LC_ALL/LC_MESSAGES/LANG 并在 Windows 经 `Intl` 回退到系统区域；计划批准与最终验收两条边改 `ai: allowed_if`，默认机器无 forbidden 边；渲染从约 80 行压到约 55 行；编辑器 Default 按钮改为草稿载入而非自动保存。
- **设置页重排**（BACK-717）：状态机卡片移到 Workflow Settings 正上方，Hide empty columns 开关归入 Workflow Settings 卡（纯位置调整，零行为变化）。

---

### 📄 列表分页统一

- **CLI 窗口模型**（BACK-741）：8 个列表命令（`search`、`task list`、`draft list`、`milestone list`、`doc list`、`doc search`、`decision list`、`memo list`）统一增加 `--max-count <n>` / `--skip <n>` / `--count`，词汇对齐 `git log`/`grep`；窗口在过滤、排序、`--limit` 之后应用，截断输出附 `Showing <first>-<last> of <total> items. Next: backlog <command> --skip <n>` 页脚；`--count` 只输出数字且禁止与 `--json` 组合；`milestone list` 新增 `--with-no-milestone`（无里程碑任务作为 `## No Milestone` 固定头前置，不占配额、不计入 `--count`，默认不包含）；语义集中文档化在 overview 的 List Paging Quick Reference。
- **MCP offset 模型**（BACK-742）：全部 MCP 列表工具（`task_list`、`task_search`、`document_list`、`document_search`、`memo_list`、`milestone_list`）改走 `offset`+`limit`，structuredContent 统一信封 `{ items, total, offset, limit, hasMore }`，文本输出附 `Showing X-Y of N` 提示；新增 `decision_list`（limit/offset/status/search）；同一 offset 方案贯通 core（`listMemosPage`）与 REST（`GET /api/memos` 接受 offset，`cursor` 参数 400 明确拒绝）、Web 无限滚动迁移到 hasMore 驱动。CLI 窗口与 MCP offset 是**两个刻意不同的模型**（`list-window.ts` vs `list-page.ts`），文件内有对照文档。

### 👁 watch 常驻进程治理

- **启动方存活性**（BACK-743）：`task list --json --watch` 的 1s tick 增加 starter-exited 检查——启动器注入 `BACKLOG_LAUNCHER` 环境变量标记，watch 判定启动方进程消失即走既有 exit-143 退出路径；终端关闭或读取方被 kill 后，watch 不再作为孤儿进程无限驻留。
- **空转 stat 签名**（BACK-744）：tick 从"每秒全量重建读取"降为"比较一层深的 stat 签名（name+size+mtime+ctime），不同才重读"；macOS 645 条目仓库 60s 空转 CPU 实测 21.47s（35.8%）→ 0.41s（0.68%），外部编辑期间的输出字节与延迟不变。

---

### 🖥️ Web 界面

#### 大纲（TOC）

- **弹窗大纲抽屉**（BACK-726）：任务详情、wiki 预览、文件预览三类弹窗获得书签式大纲——窄标签从弹窗左缘探出，点击展开与弹窗等高的浮动面板，弹窗宽度永不改变；Modal 新增 `toc` 布尔 prop 即启用；FilePreviewModal 宽度 max-w-4xl → max-w-6xl。
- **任务内容 TOC 与 scrollspy**（BACK-420，对应 GitHub issue #405）：任务模态框大纲按分区组织（Description / References / Documentation / Modified Files / AC / DoD / Plan / Notes / Comments / Final Summary 各为一级条目），scrollspy 高亮、点击平滑滚动、滚动到底部激活末条；修复 `findScrollContainer` 从父节点而非自身查找导致模态框 scrollspy 永远不高亮的 bug。
- **窄屏悬浮模式**（BACK-739）：面板左缘与视口间距 <300px 时抽屉从"外侧停靠"切换为"悬浮在模态上方"（带滑入动画与 backdrop），间距 <36px 时书签页签移入面板内侧，窗口再窄大纲也可用。

#### 图谱

- **Canvas 2D 迁移**（BACK-720）：任务图与知识图从 D3+SVG 迁到 Canvas 2D 渲染器，布局缓存键不变、缩放/拖拽/焦点淡化/相机飞入全部保留；悬停 tooltip 与高亮加 300ms 延迟，指针快速划过不再闪烁；修复 dblclick 被 d3-zoom 吞掉、图例全隐藏时画布冻结、暗色画布上标签不可见三处回归；`/knowledge-canvas` 评估页删除，只留一套实现。
- **浅色主题可读性**（BACK-727）：浅色主题下节点边框换同色相 700 阶深色、边加深为 slate-500，图例采样线与画布共用同一主题 helper，永不不一致；深色主题零改动。

#### 统计与设置

- **任务平均耗时**（BACK-725）：项目统计新增 `averageCompletionMinutes` + `completionSampleCount`——跨度定义与 Gantt 的 Actual Start/Actual End 完全同源（共享 `src/utils/task-time-span.ts`，parity 测试钉死不漂移），完成只认规范终态（Done，Dropped 不算），显示单位分钟并附样本量；顺手修复 `averageTaskAge` 混合口径、6 处硬编码 `"Done"`、缓存/冷路径语料不一致、对象形式 statuses 被喂给 string[] 参数导致分布渲染成 `[object Object]` 四处旧缺陷；统计语料 scope 沿用既有 show-completed 机制（默认仅活跃，opt-in 含已完成）。
- **里程碑弹窗填充**（BACK-724）：MilestoneDetailsModal 在数据未就绪时打开（fetch fallback 路径）表单字段保持空白的问题，复用 TaskDetailsModal 的 dirty-preservation 模式修复——fetch 晚到也填充，同记录刷新只覆盖未编辑字段；helper 抽取为共享模块 `src/web/utils/form-refresh.ts`。

---

### 🧪 质量基建

- **测试全绿**（BACK-722）：修掉两类确定性失败（search meta 的 `completed` 字段断言未同步、TUI 编辑器极端尺寸几何断言过期）与一批负载敏感的随机超时（7 个文件 23 个测试显式 20s 预算；探明 Bun 1.3.14 静默忽略 bunfig 的 `[test]` timeout，只能靠第三参）；graph 同步对扫描窗口内被删文件容错（ENOENT 跳过）；连续两次全量运行 0 失败（3098 与 3119 通过）。
- **Biome 覆盖 .tsx**（BACK-723）：100+ 个 .tsx 文件纳入格式化/lint/import 整理，约 400 条诊断逐条审计清零（不留裸规则豁免）；50 处 useExhaustiveDependencies 压制注释逐条审计修掉两个真 bug（文档改回原名被静默丢弃、Cmd+S 可能保存旧的 milestone/dates）；语义化标签重构的教训：div→button 等改动需视觉验证，测试抓不到布局回归。

---

### 🐛 缺陷修复汇总

除上文已按领域展开的条目外，概要如下（均为实测复现）：

| 编号 | 症状 → 处置 |
|---|---|
| BACK-715 | serializeConfig 把对象形式 statuses 序列化成 `[object Object]` → 支持 display 字段往返；保存后广播 tasks-updated 导致看板列 stale → 改广播 config-updated |
| BACK-420 | 模态框 scrollspy 监听 window 滚动永远不高亮 → findScrollContainer 从元素自身开始查找 |
| BACK-719 | overview 指引要求 `config list --plain` 但命令未声明该 flag → 补上（对 15 个文档命令全量审计确认唯一缺口） |
| BACK-722 | `bun test` 一批预存在/随机失败 → 断言同步 + 显式超时预算 + graph ENOENT 容错，全量 0 失败 |
| BACK-723 | Biome 审计中的两个真 bug（文档改名被丢弃、Cmd+S 保存旧数据）→ 补依赖 / latest-ref 模式；Modal 点击触发立即关闭的回归 → 只在点击落在遮罩本身时关闭 |
| BACK-724 | 里程碑弹窗 fetch fallback 晚到表单全空 → dirty-preservation 共享模式 |
| BACK-725 | 统计分布渲染成一行 `[object Object]`、缓存与冷路径数字漂移等四处旧缺陷 → 收敛单一路径、按 scope 分键缓存 |
| BACK-736 | memo watcher 对目录被删异步抛 error 击垮进程 → 补挂 error 监听器 |
| BACK-737 | 本地 23:00 写的 memo 被计到次日 → 所有按天表面统一走 localDateKeyFromStoredUtc，磁盘数据不变 |
| BACK-738 | memo 实体链接打开任务弹窗后关闭落到看板 → 补 backgroundLocation，滚动位置与选中日期存活 |
| BACK-745 | 任何 store 变更都无条件全量重载 memo 语料并重建 Fuse 索引 → stat 签名门控 |

**非产品缺陷（环境/基建）**：BACK-736 记录——单体 `bun test` 在本机（Windows）会挂死，属仓库文档已记载的既有环境问题，非本版本引入；测试按仓库惯例分批运行。

---

### 🔀 上游同步状态

本版本**移植了上游 v1.52.0..v1.53.0 区间 2 个 A 类修复**（与上游修复 byte-identical）：

| 上游 | 落到 | 内容 |
|---|---|---|
| 上游 BACK-688 | BACK-743 | watch 启动方存活性检查，孤儿 watcher 自动退出 |
| 上游 BACK-689 | BACK-744 | watch 空转 stat 签名，闲置 CPU 35.8% → 0.68% |

该区间其余上游差异已经 doc-21 / doc-22 逐条分类评估：B 类能力以 fork 自有方案落地（CLI 分页走 BACK-741 的 `--skip/--max-count` 窗口模型而非上游方案，MCP 侧为 BACK-742 的 offset 信封），C 类（上游特有方向、纯跟踪、本范围未实现或 fork 已覆盖）跳过。**注意**：上游 `v1.53.0` tag 之后又前进了 11 个提交（BACK-690/691/692/696/697/698/700/702/706 等），按既定口径留待下一波评估，未纳入本版本。

---

### ⚙️ 版本与升级说明

**命令面变化**

| 变化 | 说明 |
|---|---|
| `backlog memo create/list/view/update/delete` | 新增命令组（`backlog instructions memos` 有专门指南） |
| 8 个列表命令新增 `--max-count` / `--skip` / `--count` | search、task list、draft list、milestone list、doc list、doc search、decision list、memo list |
| `backlog milestone list --with-no-milestone` | 新增；无里程碑任务作为固定头前置（不占配额、不计入 `--count`，默认不包含） |
| `backlog config list --plain` | 新增；与 overview 指引对齐，输出不变 |
| MCP 新增 `memo_create` / `memo_list` / `memo_view` / `memo_update` / `memo_delete` | 委托 core/memos.ts，与 CLI/REST 同一 ID 方案与文件格式 |
| MCP 新增 `decision_list` | limit/offset/status/search 过滤 |
| REST 新增 `/api/memos` 六端点 + `POST /api/memos/:id/archive` | 见上文 Memos 章节 |
| REST 新增 `PUT/POST /api/config/statuses` | 设置页状态机编辑器的保存通道 |

**JSON / 契约变化**

| 契约 | 变化 |
|---|---|
| MCP 列表工具 structuredContent | 统一信封 `{ items, total, offset, limit, hasMore }`（task_list / task_search / document_list / document_search / memo_list / milestone_list） |
| CLI 列表 JSON | 窗口截断时信封附加 `total` / `nextSkip`，未截断逐字节不变（含 `task list --json --watch`） |
| 搜索 JSON | 新增 memo 结果形状（`MemoSummaryJson`） |
| 统计输出 | `projectHealth` 新增 `averageCompletionMinutes` 与 `completionSampleCount` |
| REST `GET /api/memos` | cursor 参数 400 明确拒绝，改用 `offset` |

**需要留意的行为变化**

- `backlog init` 现在对称创建 `backlog/memos` 与 `backlog/archive/memos`，且首次初始化直接写入七列对象形式的默认状态机（重初始化保留现有 statuses）。
- `task list --json --watch`：每秒 reconcile 改为 stat 签名比较，输出字节、过滤、scope 不变；启动方进程退出后 watch 自行结束（exit 143），依赖"watch 比启动方长寿"的脚本需要重审。
- MCP `memo_list` 与 REST `/api/memos` 从 cursor 分页迁移到 `offset`+`limit`；CLI `memo list` 移除 `--cursor` 并取消 `--limit` 默认 30，改与其他列表命令一致的窗口页脚。
- memo 归档是原样 rename，取消归档本期有意不做；memo 文件亦可用文件管理器直接从 `backlog/archive/memos/` 挪回。
- memo 按**本地日**分桶（日历/日期过滤/深链），修复了此前跨时区错日；但 memo id 的 `YYYYMMDD` 前缀保留存储 UTC 日期（文件名必须稳定），深夜写的笔记 id 数字可能比归档本地日早一天——此为评审明确接受的取舍。
- 升级无需数据迁移；memos 为新增实体，不影响既有任务/文档/决策数据。

---

### 未迁移 / 未跟进

- **上游差异**：`v1.53.0` tag 之后的 11 个上游提交（BACK-690/691×2/692/696/697/698/700/702/706 + 版本同步）未评估，见上文。
- **memo 提升为 task**（doc-20 §9.7）按设计文档声明属范围外，未实现。
- **取消归档**：有意不做（rename 归档天然可逆，文件挪回即恢复），亦无归档视图。
- **BACK-725 遗留**：wiki 侧 `concepts/project-health.md` 等概念页对新指标与语料 scope 的补充未随任务落地（wiki 走独立评审流程）。
- 单体 `bun test` 在本机挂死为既有环境问题（BACK-736 记录），未在本期解决。
