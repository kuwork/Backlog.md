## v1.53.1-CN Release Notes

> 上一个版本：[v1.53.0-CN](https://github.com/kuwork/Backlog.md/releases/tag/v1.53.0-CN)
>
> 这是一个**主线版本**，覆盖 2026-10-06 至 2026-10-07 的 11 个提交、10 个任务（BACK-239、BACK-748 ~ BACK-756），主要由三块内容组成：**实体互联与反向链接**（任务 ↔ 文档/决策自动链接的区间与斜杠列表形式、文档/决策页反向链接节）、**Memos 体验打磨**（钉板固定高度、标签历史条与 `#topic#` 话题语法），**任务管理与可视化增强**（重定父、已完成子任务可见、序列 TUI 双面板、图谱高 DPI 渲染优化），外加侧栏拖拽条坍缩修复。

### 🎯 主要亮点

- **实体互联与反向链接**（BACK-239/614/751/753）：任务正文里的 `doc-` / `decision-` / `draft-` ID 自动链接（BACK-614 已落地），区间 `doc-10~12` 与斜杠列表 `doc-10/11/12` 现渲染为单触发器、点击展开 portal 下拉列出每个可解析实体（BACK-751）；文档/决策详情页新增"任务引用"反向链接行，纯客户端扫描计算、不写文件（BACK-753）。
- **Memos 打磨**（BACK-749/750 + BACK-751 折叠项）：钉板便签固定 150px 高度、溢出省略号；标签改为可折叠单行历史条（折叠时 active 置前）+ `#topic#` 闭合话题语法与编辑器自动补全；memos 默认视图（有内容进钉板、空进列表）、侧栏图标替换、便签墨迹溢出修复一并落地。
- **任务管理增强**（BACK-754/755）：`task edit --parent/--clear-parent` 重定父（CLI/MCP 共享、防环校验）；父任务视图纳入已完成子任务（active+completed 合并，跨越 `backlog/completed` 边界，CLI/JSON/MCP/TUI 一致）。
- **序列 TUI 双面板**（BACK-752）：`sequence list` 交互视图重写为里程碑式双面板（序列侧栏 + 任务列表），首屏即高亮、随光标滚动、移动模式自带写入预览；修复 `select item` 递归栈溢出崩溃。
- **图谱高 DPI 渲染优化**（BACK-756）：视口裁剪 + 按批次绘路径 + `MAX_DPR=2` 封顶 + 文本 LOD 三阶段 + 手势快照，帧绘制调用从千级降到个位数，相机移动时保持 60fps。
- **侧栏拖拽条修复**（BACK-748）：BACK-723 语义化把 `<div>` 改 `<hr>` 触发 Tailwind v4 preflight `hr{height:0}` 使拖拽条坍缩，加 `h-full` + `aria-orientation` 修复。

---

### 🔗 实体互联与反向链接

- **区间与斜杠列表自动链接**（BACK-751，依赖 BACK-614）：在已有单 ID 自动链接基础上，新增两类多 ID 模式——区间 `BACK-715~747`（含端点，全端点同类型）与斜杠列表 `BACK-743/744/745`（任意数量、同类型）。匹配到一个 token 即渲染为单个可点击触发器，点击弹出 portal 下拉（`EntityIdRangeDropdown`），逐行列出每个本地可解析实体并跳转到其详情路由。复用 BACK-614 短别名体系（task/document/decision/draft），`[[wikilink]]` 不在范围内。
- **Fail-closed 与边界**：区间两端点须同类型且均可解析，仅列出本地存在的 ID，区间无命中则整 token 保持纯文本；斜杠列表要求全部解析到同一类型，否则整体纯文本；零填充 / 大小写 / 前缀变体按 BACK-614 规范化；行内代码与围栏代码块、已有 markdown 链接均不改写。下拉条目数不限（如 33 项区间仍可用），键盘可达（方向键/Enter/Esc）、外部点击关闭、宿主弹窗有未保存改动时点击条目先确认。
- **文档/决策页反向链接**（BACK-753，父任务 BACK-239）：客户端构建反向索引 `buildBacklinkIndex`，扫描每个任务的**正文**（剥离代码块）与 `documentation:` 前置字段两处来源，复用自动链接器的边界规则与多 ID 解析器，使引用与被引用保持一致。区间/斜杠列表在 span 内每个实体下都展开一条反向链接。
  - 渲染为一行内联 `Referenced by: N tasks (BACK-1/BACK-2/...)`：标签与计数是静态灰字，仅括号内 ID 列表是可点击触发器，复用 BACK-751 的 `EntityIdRangeDropdown`（同一链接色、`ID · 标题` 下拉、应用内导航、点击前即见标题）；多次引用同一实体的任务折叠为一行，计数并入下拉标题；无引用时该行不渲染，文档页不出现第三行。
  - 同一任务引用同一实体多次只出现一次并标注次数；按任务 ID 排序；复用既有未保存编辑导航确认。四语 locale 用 `referencedBy` / `referenceCount` 替代废弃的 `referencedByLine`。
- **BACK-239 决策说明**：原 AC#4（链接含目标标题）按决策放弃——自动链接显示裸 ID，标题改由区间/反向链接下拉触发器呈现；引用语法（单 ID、斜杠列表、区间）已在 CLI 与 MCP 两份 overview 指南中新增"在内容中引用任务与文档"小节并列说明。

---

### 📝 Memos 体验打磨

- **钉板固定高度 + 溢出省略号**（BACK-749）：`/memos?view=board` 的便签纸张由"随内容增长"改为固定 `NOTE_HEIGHT = 150`，溢出时最后一行贪婪截断并追加省略号。新增纯函数 `layoutInkLines`（粗体标题 + 正文落进固定带，注入 `ctx.measureText` 精确测宽），`drawNote` 消费它并保留标题/正文 4px 间隙；`memo-board` 测试套件 19 pass / 0 fail。
- **标签历史条 + 话题语法**（BACK-750，合并 BACK-751）：标签 UI 由下拉 `TagFilter` 重做为可折叠多行"标签历史条" `TagHistory`（`flex-wrap` 流，折叠裁到一行、active 置前、max-height 过渡 + chevron 旋转动画）；每张卡片底部新增可点击标签行，镜像过滤高亮（大小写不敏感）。随后去掉标题行，使条带为单行（chips 在 `flex-1` 容器、切换键 `shrink-0` 行尾），pill 显示裸标签（不带 `#`）。
  - 话题语法收敛为闭合 `#topic#` 形式（`extractInlineTags` 与 `INLINE_TAG_PATTERN` 改 `/#([^\s#`]+)#/g`，渲染 `match[0]`）；孤立 `#tag` 为纯文本，不迁移旧 `#tag` 正文，`# heading` 与 `PR #268` 不再被误提；frontmatter `tags` 从不改写。
  - 编辑器自动补全：新增 `useTopicAutocomplete`（`findOpenTopicAtCaret` / `buildTopicCandidates`）+ `TopicAutocompleteMenu`，复用实体链接的 caret/防抖/IME 机制；`topic-highlight.ts` 在 prism 的 `title` 之前注册 `topic` token（两个 refractor 实例都要），`source.css` 在 `.topic-aware` 作用域内上色，使刚闭合的 `#人类#` 不再被当成标题。
  - 激活态贯通：钉板 note 弹窗（板视图无条带，弹窗是 narrowed 板唯一能显示所筛标签处）经 `MemosPage → MemoBoard → modal MemoCard` 传递 `activeTags`；信息流内 `MermaidMarkdown` 取 `activeTags`，正文 `#topic#` 命中激活过滤的 chip 加 `inline-tag-active`（仅变色，因内联于段落、改盒会重排）；钉板墨迹用 `splitInkRuns`/`inkRunBoxes` 在 topic run 后绘制 chip（常态浅底、选中浅蓝），页脚标签列表不绘底、激活标签仅蓝字（其余灰），`memoStamp` 折叠激活标签键以触发重烘焙。
- **BACK-751 折叠项**：memos 默认视图（首次加载后，裸 `/memos` 有内容 → `view=board`、空 → `view=list`，显式 `view`/日期过滤不被覆盖）；侧栏 memo 图标替换为提供的 1024 栅格两路径字形；便签墨迹溢出修复（`wrapEstimate` 改用 baker 真实 `measure`（含 `bold`），`layoutInkLines` 透传，`clampLine` 兜底硬截断）。

---

### 🛠 任务管理增强

- **重定父**（BACK-754）：新增 `backlog task edit <id> --parent <parentId>`（设 `parent_task_id`）与 `--clear-parent`（移除），CLI 与 MCP 共享同一字段。MCP `task_edit` 新增 `parentTaskId`（字符串设置 / `null` 清除）。核心在 `applyTaskUpdateInput` 校验：目标须解析为唯一现存（或已完成）任务、不可为自身、不可构成环（沿候选父的祖先链 walk，命中编辑中任务即拒，`seen` 集合防既有环死循环）；存储 ID 规范化（裸 `1` 存为 `TASK-1`）。仅改写边、不改名、不重排 ID；`--parent` 与 `--clear-parent` 互斥、空 `--parent` 指向 clear，二者均计入编辑字段标志（但排除出 `PER_TASK_ONLY_EDIT_FLAGS`，一次给多任务定同一父是合法批处理）。两份 Task Field Quick Reference（CLI/MCP）并行更新。测试 `cli-reparent` + `mcp-reparent` 12 pass / 0 fail。
- **已完成子任务纳入父视图**（BACK-755）：子任务进入终态移入 `backlog/completed/` 后，因所有读取路径只扫 `backlog/tasks/`，从父任务视图静默消失（复现：`task view 217 --plain` 列出 .02/.03/.04 但漏掉已完成的 .01）。在唯一汇聚点 `Core.getTaskWithSubtasks` 拓宽语料为 active+completed，复用 `mergeCompletedIntoActive`（canonical id 去重、active 优先），使 CLI（plain/JSON）、MCP、TUI 一致；TUI 复用其已为依赖就绪加载的 completed 记录，不额外扫盘。Web 详情以按需方式通过新增的 `GET /api/tasks?completed=true`（仅层级用、看板/任务列表仍仅 active）只拉取本视图语料缺的亲属，合并去重并按任务 ID 缓存，避免冷开重复与回钻闪烁。回归测试 `completed-subtasks-hierarchy`（3 pass）+ `server-hierarchy-endpoint`（2 pass），回退 Core 改动使其中两项变红。
  - **范围外（已记录）**：本仓库仍约 100 个 backlog 文件用旧 `task-` 前缀写 `parent_task_id` / 依赖（如 BACK-217.01 为 `parent_task_id: task-217`，而 .02/.03/.04 用 `BACK-217`，正是仅已完成子任务消失的根因之一），任何语料拓宽都无法修复，需数据迁移或放宽共享身份语义，留待后续。

---

### 🖥️ 序列 TUI 与图谱可视化

- **序列 TUI 双面板**（BACK-752）：`backlog sequence list`（无 `--plain`）原手写垂直堆叠块，嵌套双框、吃掉两侧两列、光标不滚回视、首屏无高亮、标"read-only"却可用 `m` 重写依赖。改为里程碑列表同形双面板——左 ` Sequences (N) ` 侧栏列 Unsequenced + Sequence 1..N（含任务计数），右主面板列聚焦组的任务；聚焦面板黄框标记，首屏即高亮，`↑/↓` 移光标、`Tab/→/←` 切面板、`Enter` 开共享任务弹窗、`m` 切移动模式、`q` 干净退出（`screen.leave()/destroy()/releaseSharedProgram()`）。
  - 纯函数 `buildSequenceRows` / `buildMoveTargets` / `moveTargetLabel` / `buildMovePreview` 导出，行模型可无终端断言；移动模式在闲置右面板填充 Enter 将写入的预览（来源组、目标、字段改动：`dependencies → 全部 Sequence 1 的 2 个 (BACK-1, BACK-2)`、`ordinal → 未设时 0 (anchor)`、join 语义"替换而非追加"、被阻塞情形），并注明"移动设定的是层而非层内顺序"。
  - 修复崩溃：旧视图 `refresh()` 与 blessed `select item` 事件互相递归至 `RangeError`（外部误导为 `TypeError: RangeError is not a constructor`）；加 `syncingSelection` 守卫 + 每个按键 `safe()` 包裹，后续失败落在页脚而非杀死会话。逐行补齐缩列表残留、缺失终端尺寸回退 80×24、移动处理器同步设目标并先同步绘制（避免快照 await 期间按键被撤销）。`--plain`/非 TTY/CI 文本输出字节不变；新增 `sequences-view.test.ts` 13 pass，序列套件合计 658 pass / 0 fail。
- **图谱高 DPI 渲染优化**（BACK-756，里程碑 `m-9`）：知识/任务图谱在 Retina/4K 上掉帧（每帧 2k+ 边、700+ 节点逐个 draw call，再叠加旋转关系文本，backing store 按 devicePixelRatio 放大 2–3×，且不做视口裁剪）。
  - 裁剪：由实时 zoom 变换反推图空间窗口，跳过窗口外节点与边（CULL_PAD=56 屏 px 保证半出屏节点的标签仍绘出；边用两端 bounding box 测试）。
  - 批绘：边按 `(dash, alpha)`、节点按 `(style, alpha)` 分桶，各桶一次 `stroke`+`fill`，新助手 `strokeEdgeBatch` / `paintNodeBatch`；本仓库语料上边 pass 由 ~2200 stroke/~1650 fill 降到个位数。
  - `MAX_DPR=2` 封顶 backing store，避免 4–9× 像素量；`resize()` 内生效。
  - 文本 LOD 三阶段（单一 `textStage: none | focus | all`）：移动中只保留聚焦节点及其邻居的名字；落定/手势抬起/布局稳定时焦点节点 + 邻居齐亮；其余名字在 `TEXT_CLUSTER_MS`(300ms) 后补出，深缩关系名仅此时且 `k >= RELATION_ZOOM_THRESHOLD` 出现。
  - 手势快照：pan/wheel 拖拽不再全代价重绘，而是对当前帧做一份**全保真、全设备 DPI**（不降 backing scale，`GESTURE_DPR` 已移除）的视口大小快照，每帧一次 `drawImage` 拖动位图，释放时恢复实时场景与全锐度；位图每移动一 pad 或缩放漂移 20% 才重取。
  - 焦点行为：单击钉焦点并飞入至可读；双击开节点但不改焦点；拖节点不改焦点；ESC/点空白退出（`releaseFocus` 同时清 `hoverIdRef` 修掉"ESC 不退出焦点"；d3-zoom end 无条件释放快照、程序化相机移动包 `programmatic()` 守卫修掉"缩放按钮看似冻结"）。测试 `web-graph-canvas.test.tsx` 5 pass。

---

### 🐛 缺陷修复汇总

除上文已按领域展开的条目外，概要如下（均为实测复现）：

| 编号 | 症状 → 处置 |
|---|---|
| BACK-748 | 侧栏右缘 hover 不显示蓝色拖拽条、无法调宽 → BACK-723 把 `<div>` 改 `<hr>` 触发 Tailwind v4 preflight `hr{height:0}` 使 handle 坍缩为 4px×0；加 `h-full` + `aria-orientation`，实测 handle 4×569、拖拽 320→435 持久化 localStorage |
| BACK-755 | 子任务终态移入 `backlog/completed` 后从父视图消失 → `getTaskWithSubtasks` 仅扫 active；拓宽为 active+completed（`mergeCompletedIntoActive`，canonical id 去重、active 优先），CLI/JSON/MCP/TUI 一致 |
| BACK-752 | 序列 TUI 嵌套双框、首屏无高亮、按方向键崩溃（`select`/`select item` 递归栈溢出）→ 重写为双面板 + `syncingSelection` 守卫 / `safe()` 包裹 |
| BACK-751 | 便签墨迹溢出纸张右缘 → `wrapEstimate` 改用 baker 真实 `measure`（含 `bold`），`layoutInkLines` 透传，`clampLine` 兜底硬截断 |
| BACK-756 | ESC 不退出焦点、缩放按钮看似冻结 → `releaseFocus` 同时清 `hoverIdRef`；d3-zoom end 无条件释放快照，程序化相机移动包 `programmatic()` 守卫 |

---

### 🧪 质量基建

- 各任务均补建/扩展针对性测试并全绿：`sequences-view.test.ts`（13）、`cli-reparent.test.ts` + `mcp-reparent.test.ts`（12）、`completed-subtasks-hierarchy.test.ts`（3）+ `server-hierarchy-endpoint.test.ts`（2）、`web-graph-canvas.test.tsx`（5）、`memo-board.test.ts`（溢出/截断/run 拆分回归）、`task-id-links.test.ts` 与 `backlinks.test.ts`（多 ID 解析/反向索引）等。
- 全量改动 `bunx tsc --noEmit` 在 `src/` 下零错误，`bunx biome check` 在各自改动文件上干净；repo-wide `bun run check .` 仅报无关未跟踪 vendored 目录（CRLF 既有问题）。

---

### ⚙️ 版本与升级说明

**命令面变化**

| 变化 | 说明 |
|---|---|
| `backlog task edit <id> --parent <parentId>` | 新增；设置现有任务的 `parent_task_id`（归一化、防环、禁止自身/环） |
| `backlog task edit <id> --clear-parent` | 新增；清除 `parent_task_id`（与 `--parent` 互斥） |
| MCP `task_edit` 新增 `parentTaskId` | string 设置 / `null` 清除，与 CLI 同源校验 |
| Memos 话题语法 `#topic#` | 闭合形式 + 编辑器自动补全；孤立 `#tag` 为纯文本，不迁移旧正文 |
| 实体 ID 区间/斜杠列表自动链接 | `BACK-715~747`、`BACK-743/744/745` 等渲染为单触发器下拉（task/document/decision/draft） |
| REST `GET /api/tasks` 新增 `completed=true` | 仅任务详情层级按需拉取已完成亲属；看板与任务列表仍仅 active |

**JSON / 契约变化**

| 契约 | 变化 |
|---|---|
| Web 层级语料 | `useTaskHierarchyCorpus` 经 `GET /api/tasks?completed=true` 拉取本视图缺失亲属，按 canonical id 与调用方语料合并去重、按任务 ID 缓存 |
| 反向链接索引 | 纯客户端渲染时计算（扫描任务正文 + `documentation:` 字段），无新 API、不写文件 |
| 实体多 ID 链接 | 渲染层以 `entity-range:<kind>:<token>` href 表达，`MermaidMarkdown` 的 `LinkComponent` 拦截并渲染 `EntityIdRangeDropdown`（portal、`position:fixed`、`z-[9999]`、`MutationObserver` 取暗色，外部点击/resize 关闭） |

**需要留意的行为变化**

- 钉板便签固定 150px 高度、溢出省略号（不再随内容增长）。
- 标签历史条可折叠为单行、折叠时 active 置前；卡片底部标签行可点击过滤。
- `#topic#` 为唯一话题语法；旧 `#tag` 正文降级为纯文本，frontmatter `tags` 不改写、无需迁移。
- 文档/决策详情页新增"Referenced by: N tasks (...)"行，无引用时不显示第三行。
- `sequence list` 交互视图改为双面板；`--plain` / 非 TTY / CI 文本输出字节不变。
- 图谱帧在相机移动时降级文本、pan/wheel 拖拽用全保真快照；`devicePixelRatio` 封顶 2；ESC 退出焦点、双击不改焦点。
- memos 默认视图：裸 `/memos` 有内容 → 钉板、空 → 列表；显式 `view`/`日期` 过滤优先。
- 侧栏宽度拖拽已恢复（hover 右缘出现蓝色拖拽条）。
- 升级无需数据迁移；上述均为新增/调整能力，不影响既有任务/文档/决策数据。

---

### 未迁移 / 未跟进

- **旧 `task-` 前缀数据**（BACK-755 范围外）：约 100 个 backlog 文件仍用 `task-XX` 写 `parent_task_id` 与依赖条目，任何语料拓宽都无法修复，需数据迁移或放宽共享身份语义（`taskIdsEqual` 为前缀严格，跨前缀永不匹配），留待后续独立处理。
- **BACK-239 原 AC#4**（链接含目标标题）：按决策放弃；标题改由区间/反向链接下拉触发器呈现。
- **全量 `bun test` 挂死**：本机（Windows）单体 `bun test` 挂死为既有环境问题（BACK-736 记录），本期未解决，测试按仓库惯例分批运行。
