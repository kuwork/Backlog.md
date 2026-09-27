## v1.52.0-CN Release Notes

> 上一个版本：[v1.50.2-CN](https://github.com/kuwork/Backlog.md/releases/tag/v1.50.2-CN)
>
> 这是一个**主线版本**，覆盖 2026-09-13 至 2026-09-26 的 127 个提交、85 个任务（BACK-629 ~ BACK-714，编号 671 空缺），主要由四块内容组成：知识图谱从零建设到可视化（里程碑 `m-9`）、依赖治理闭环、实时同步与就地刷新，以及 Web / TUI / CLI / MCP / JSON / agent 指引各面的缺陷修复与契约补齐。另拣选了 4 个上游 PR，**未跟进项**见文末。

### 🎯 主要亮点

- **知识图谱上线**（里程碑 `m-9`，BACK-702/703/704/705/713/714）：图服务（增量同步 + 指纹冷启动 + 单持有者锁）、`/graph` 力导向图页面、任务弹窗内嵌关系图，并把 wiki / decisions / docs 一并纳入图（`Tag` 节点、`SourcedFrom`、`LinksTo`）。
- **依赖治理成体系**（BACK-664/707/708/709/710/711）：写入侧拒环并报出完整链路；`backlog doctor` 报告环 / 悬空 / 指向草稿 / 仅存于归档 / 歧义五类缺陷；新增依赖传递闭包查询（hop 数与真实阻塞者）；任务弹窗可展开关系图。
- **实时同步**（BACK-694/695/696/698/700）：看板任务弹窗、草稿会话、里程碑弹窗跟随磁盘变化；Web 端广播改为按 ID 就地刷新，替代整页重载。
- **里程碑变成可浏览的界面**（BACK-687/688/706）：`backlog milestone list` 在 TTY 下变为交互式里程碑看板（`--plain` 保留纯文本）；最后一个任务进入终态时自动盖章 `actual_end`。
- **批量状态移动**（BACK-680/681/682）：`task edit` 接受多个 ID，TUI 用 Shift+↑/↓ 多选，Web 端多选拖拽按落点插入。
- **JSON 契约扩展**（BACK-657/658/697）：`isReady`、`source`、`references`、`modifiedFiles` 进入摘要投影；新增 `task list --json --watch` 持续输出。
- **completed 语料可用**（BACK-662/663/665）：CLI / MCP / Web 检索可开关纳入已完成任务，Web 端对应弹窗只读，看板与任务列表新增 completed 复选框。

---

### 🕸️ 知识图谱（里程碑 m-9）

自上而下分三期落地：基础（BACK-702）→ 同步与视图（BACK-703/704/705）→ schema 重构与知识实体入图（BACK-713/714）。

- **基础**（BACK-702）：白名单目录扫描（archive 排除）、严格 fail-closed 的关系解析、指纹冷启动（内容相同则复用）；数据库与锁文件按 (项目, slot) 落在系统缓存目录，不写入仓库。**默认后端是 memory 而非 Kuzu**（kuzu 原生绑定在 Bun 上段错误），Kuzu 需显式开启。
- **同步**（BACK-703）：增量重建只解析受影响文件，同 ID 移动原地更新并保住已有边；Core 在所有变更出口发通知；150ms 去抖 + 单持有者锁，锁冲突交宿主决策。
- **视图**（BACK-704/705）：`/graph` 页面提供力导向图、邻域聚焦、图例过滤与恒定屏幕尺寸渲染；控制面板按键统一中性风格。
- **schema 重构**（BACK-713）：节点改为 `FileNode(path PRIMARY KEY)`，文件路径成为唯一身份，文件移动 / 归档塌缩为删旧建新；schema 自描述（版本不匹配即整体重建，无迁移代码）。
- **知识实体入图**（BACK-714）：`wiki` / `decision` / `document` 三类节点，`Tag` 标签边、`SourcedFrom` 溯源边、`LinksTo` wikilink 边，配套 lint 与图谱视图渲染。一处与设计的偏离：节点类型由白名单目录决定（而非 frontmatter `type`，因序列化会抹掉自定义 frontmatter），设计文档尚未更新，见文末未跟进项。

---

### 🧩 依赖治理

- **写入门禁拒环**（BACK-707）：自我引用与成环硬拒并报出完整链路；悬空引用按「创建严格、编辑宽容」处理；目标只能是 task / completed，draft 永不合法。
- **doctor 报告五类缺陷**（BACK-708）：环、解析不到、指向草稿、仅存于归档、歧义引用；全部为 warning，不改变退出码。
- **闭包与 hop 数**（BACK-709）：一次回答传递依赖、传递阻塞方与链末端真正未完成的任务，出口为 `GET /api/task/:id/dependencies`（走本地语料而非图谱服务）。
- **弹窗关系图**（BACK-710/711）：任务弹窗依赖面板可展开以当前任务为根的力导向图，与 `/graph` 页共用同一份视觉实现；阅读状态按任务保存。
- **依赖输入接受已完成前置任务**（BACK-664）：写入语料扩展为 tasks + drafts + completed，歧义一律 fail-closed；completed 前置任务可打开且只读。

---

### 🔄 实时同步与就地刷新

- **看板任务弹窗跟随实时状态**（BACK-694）：弹窗不再是一次性快照，内容变化时就地重建。
- **草稿会话跟随实时草稿**（BACK-695）：根因是 watcher 只注册在 `backlog/tasks`，补上 `backlog/drafts`。
- **里程碑弹窗跟随**（BACK-696）：正文改写、进度推进、文件被删均能实时反映。
- **Web 端就地刷新替代整壳重读**（BACK-698）：按值比较 + 按 ID reconcile，回声广播变为 state no-op；服务端广播带 scope、75ms 去抖。
- **广播覆盖 documents / decisions / wikis**（BACK-700）：内容类实体各有作用域，新建文档不再要手动刷新。
- **外部编辑到达已打开的文档**（BACK-639）：由按 route id 守卫改为按正文指纹判定。
- **identity 回退不再污染新鲜度**（BACK-699）：重命名回退不再顺带推进分支指纹，避免服务到移动前内容。

---

### 🗓️ 里程碑与日期

- **`backlog milestone list` 变成交互式看板**（BACK-687）：左列里程碑、右列真实看板组件；`--plain` / 非 TTY 保留分组纯文本（BACK-688）。
- **自动盖章 `actual_end`**（BACK-706）：最后一个活动任务进入终态时自动写入；修复了原分支因判定时机错误而永远不可达的问题。
- **TUI 日期字段**（BACK-689）：任务编写器与详情弹窗补齐 Due / Planned / Actual 日期，对齐里程碑表单。
- **日期型 due date 不再偏移一天**（BACK-690）：日期-only 值按本地午夜解析，西半球时区不再显示为前一天。

---

### 📦 批量状态移动

一个原语 `Core.moveTasksToStatus`、三个界面（CLI / TUI / Web），逐任务错误上报，部分失败不影响其余。Web 端多选拖拽按落点插入而非追加到列尾，并修掉原地释放被甩到列底、拖拽计数徽章少算两处缺陷。CLI/TUI 侧来自贡献者 PR #945（janosmiko），本 fork 原地接手以保留署名。

---

### 🧾 CLI 与 JSON 契约

- **`task list --json --watch`**（BACK-657）：复用同一 schema 持续输出完整列表；空结果输出空信封，重复身份检出后 fail-closed。
- **`isReady` 进入 JSON**（BACK-658）：list / search / view 均直接给出就绪判定；`--ready` 与 `--json` 走同一批行，不再可能不一致。
- **`references` / `modifiedFiles` 进入列表 JSON**（BACK-697）：移入摘要投影，详情负载不再重复声明。
- **completed 语料可检索**（BACK-662）：CLI / MCP / `/api/search` 新增 opt-in 开关。**行为变化**：MCP `task_search` 过去总是包含 completed，现在默认仅 active，需显式传 `completed: true`。
- **AC 进度覆盖 MCP 与 plain 列表**（BACK-659）：两处摘要行同样报告 `已完成/总数`。
- **`task list --status` 接受多个状态**（BACK-652）：背后四份实现收敛为共享的 normalize-and-match。
- **`draft edit`**（BACK-683）：与 `task edit` 共用同一份选项链（56 个 flag 逐字节一致），写入走 `core.editTaskOrDraft`。
- **生命周期命令本地优先**（BACK-691）：`archive` / `complete` / `demote` 经工作副本索引解析，并清理 completed 记录里的残留引用。
- **README 看板导出**（BACK-653/654）：去掉固定名临时文件往返，孙级子任务不再被静默丢弃。
- **notes 不再吞掉代码块内的空行**（BACK-643/655）：围栏内原样保留；拒收嵌套 section marker，修掉读取侧截断。

---

### 🖥️ Web 界面

#### 阅读体验

- **全局搜索对话框跟随浅色主题**（BACK-629）：全部 class 改为 light + `dark:` 变体对。
- **锚点在加载 / 重载后仍可跳转**（BACK-637）：每次导航解析 hash，并在目标标题出现时滚动。
- **头部大纲按钮 + 浮动可折叠 TOC**（BACK-638）：页头按钮浮出面板，不再挤占正文宽度。
- **mermaid 三处独立失效修复**（BACK-640）：围栏匹配大小写不敏感、主题跟随、编辑器预览容器塌缩。
- **折叠按钮不再被页头盖住一半**（BACK-641）：修正层叠上下文。
- **本地时间 + hover 给出规范 UTC**（BACK-673）：`title` 用存储原值，与 Markdown 记录及其他面的打印一致。

#### 侧栏、排序与加载指示

- **文档树排序**（BACK-667/674）：新增 `Title` / `ID` 开关，决策区同样补齐。
- **Wiki 树排序**（BACK-672）：新增 `Title` / `File name` 开关，标题由内存语料合并、不重读页面。
- **跨分支索引进度不再每帧重置**（BACK-668）：进度展示不打断已有数据。
- **首屏加载指示修复**（BACK-669/670）：不再渲染成方块；系统关闭动画时仍保持动画。

#### 任务弹窗

- **modified files 可见可编辑**（BACK-666）：References / Documentation / Modified Files 合并为同一区域的三个 tab。
- **completed 弹窗只读**（BACK-663）：completed 直接继承跨分支的锁闭判定，提示按原因选文案（四语言齐备）。
- **completed 复选框**（BACK-665）：看板与任务列表过滤行各加开关，仅开启时才拉语料。
- **降级为草稿变得安全**（BACK-646）：不幂等操作不再走重试，迟到的响应绑定任务身份。
- **深链不再回落到看板**（BACK-661）：等待首次加载完成后再匹配 URL 中的 ID。
- **草稿编辑可用**（BACK-644）：服务端按 `DRAFT-` 前缀路由，修复 404 / 400。
- **评论输入换成富 Markdown 编辑器**（BACK-631）：弹窗内最后一个纯文本输入框统一到 `PasteAwareMDEditor`。
- **AC 进度条统一**（BACK-630/645）：看板卡片与任务列表改用与弹窗相同的圆角轨道样式，列表侧定宽。

#### 决策（Decisions）

- **决策可编辑**（BACK-633）：去掉硬编码的隐藏守卫，修复父级刷新误取消编辑态。
- **可从侧栏创建决策**（BACK-634）：恢复被注释掉的入口，create 分支提交完整字段。
- **三面均可编辑状态**（BACK-635）：CLI / MCP / Web 都能改状态与正文，决策不再永远停在 `proposed`。
- **状态标签本地化**（BACK-636）：中 / 日 / 繁中补齐，预览徽章与下拉选项均本地化。
- **粘贴图片会被提升**（BACK-632）：决策保存与其他 Markdown 面一样先 promote 资源，不再 30 分钟后失效。

---

### 🧭 TUI

- **文本插入 Unicode 安全**（BACK-648）：按码点切分字符串，astral 字符不再切进代理对并持久化坏字符。
- **列表视图排序与看板一致**（BACK-649）：统一走共享的 `compareTaskIds`。
- **AC 进度条改为 ASCII**（BACK-675）：缺字形的终端不再渲染成空白或 `?`。
- **emoji 按双宽计算**（BACK-676）：修在看板依赖的宽度表里，列边框不再错位。
- **帮助弹窗与任务详情弹窗抗 resize**（BACK-677/684）：背景板跟随终端尺寸变化。
- **极端终端尺寸下的可用性**（BACK-678）：8 行 / 80 列等极端尺寸下表单仍可见可用。
- **鼠标点击真正进入 read 状态**（BACK-679）：点击与键盘行为一致。
- **搜索走共享 core 实现**（BACK-685/686）：五份实现收敛到一处，TUI 与里程碑页不再同时跑两个引擎。
- **edit 键按文件位置选 store**（BACK-692）：与其他面一致，不再按 frontmatter status。
- **草稿会话内可创建草稿**（BACK-693）：草稿会话有自己的创建窗口，新建草稿不再被丢弃。
- 实时同步（BACK-694/695/696）、批量移动（BACK-680/681）、日期字段（BACK-689）见上文对应章节。

---

### 🤖 Agent 指引与身份健壮性

- **歧义草稿身份 fail-closed**（BACK-642）：身份在唯一一处规范化，所有面经它解析，歧义直接失败而不是取第一个。
- **init 保留系统前缀**（BACK-647）：拒绝以 `draft` / `doc` / `decision` 作为 `--task-prefix`。
- **纯标点标题回退占位文件名**（BACK-650）：`<id> - ` 前缀不再丢失，ID 恢复不受损。
- **Agent 指南记录行号引用语法**（BACK-651）：references 支持 `src/foo.ts:120` 与 `src/foo.ts:120-140`。
- **修正已发布的 agent 指引**（BACK-656）：overview 不必每个请求重复读；任务创建示例补上 why。
- **wiki lint 要求独立校验 `source_path`**（BACK-712）：指引已加强。
- **强制刷新不再并入在飞的陈旧 fetch**（BACK-660）：避免任务 ID 重发。

---

### 🐛 缺陷修复汇总

除上文已按领域展开的条目外，本期修复均为实测复现而非推测；概要如下：

| 编号 | 症状 → 处置 |
|---|---|
| BACK-629 | 全局搜索对话框不跟随浅色主题 → 全量 class 改为 light + `dark:` 对 |
| BACK-639 | 打开中的文档不感知外部编辑 → 按正文指纹判定 |
| BACK-640 | mermaid 围栏大小写 / 主题 / 编辑器预览三处失效 → 大小写不敏感匹配 + 双渲染入口 |
| BACK-641 | 侧栏折叠按钮被页头盖住一半 → 修正层叠上下文 |
| BACK-643 | `--notes` 折叠围栏代码块内空行 → 围栏内原样保留 |
| BACK-644 | Web 草稿编辑 404 / 400 → 按 `DRAFT-` 前缀路由 |
| BACK-646 | demote 走三次重试（不幂等）→ 不重试 + 身份绑定 |
| BACK-655 | 嵌套 section marker 导致截断 → 拒收嵌套 + 修正读取 |
| BACK-660 | 强制远端刷新并入在飞陈旧 fetch，可能重发 ID → 不再 join |
| BACK-661 | 任务深链回落到看板 → 等待首次加载完成 |
| BACK-669 | 首屏加载指示渲染成方块 → 统一指示 |
| BACK-670 | OS 禁用动画时加载指示静止 → 保持动画 |
| BACK-684 | 任务详情弹窗背景板不跟随 resize → 复用 `reflow` |
| BACK-690 | 西半球时区下 due date 显示为前一天 → 按本地午夜解析 |
| BACK-699 | identity 回退污染分支指纹 → 不再走发布型 loader |
| BACK-706 | 里程碑 `actual_end` 自动盖章分支永远不可达 → 判定前解析为新状态 |

**非产品缺陷（测试基建）**：BACK-701 —— 本机 Bun 1.3.14 在 Windows 上 keep-alive 连接的第二个请求路由错误（服务器本身健康），已定位并在相关测试侧隔离。

---

### 🔀 上游同步状态

实测（2026-09-26）：`upstream/main` 不在本分支上的提交 **489** 个，本分支不在 `upstream/main` 上的提交 **314** 个 —— 本版本**未整体合并**上游 v1.51.0 / v1.52.0 的差异，仅拣选了 4 个上游 PR：

| 上游 | 落到 | 内容 |
|---|---|---|
| PR #945（janosmiko） | BACK-680 | 跨界面批量状态移动（原地接手以保留署名） |
| PR #977 | BACK-669 | Web 首屏加载指示 |
| PR #992（上游 BACK-677） | BACK-673 | Web 本地时间渲染 + hover 显示规范 UTC 值 |
| PR #907 | BACK-648 | TUI 文本字段插入 Unicode 安全 |

其余上游差异仍待逐条评估，未纳入本版本。

---

### ⚙️ 版本与升级说明

**命令面变化**

| 变化 | 说明 |
|---|---|
| `backlog draft edit <id...> [flags]` | 新增；与 `task edit` 共用同一份选项链 |
| `backlog task edit <id...>` | 接受多个 ID 批量改状态 |
| `backlog task list --json --watch` | 新增；需配合 `--json`，不可与 `--plain` 同用 |
| `backlog task list --completed` / `backlog search --completed` | 新增；把 `backlog/completed/` 并入语料 |
| `backlog milestone list` | TTY 下改为交互式里程碑看板；`--plain` / 非 TTY 输出纯文本 |
| `backlog doctor` | 新增依赖缺陷报告（环 / 悬空 / 指向草稿 / 仅存于归档 / 歧义） |

**JSON 契约变化**（`schemaVersion 1` 内的加法，旧字段未动）

| 字段 | 出现位置 |
|---|---|
| `isReady` | task list / search / task view |
| `source` | task list / search（`null` = 活动语料，`"completed"` = 已完成语料） |
| `references`、`modifiedFiles` | task list / search（此前仅详情负载） |

**需要留意的行为变化**

- MCP `task_search` 过去总是包含已完成任务，现在默认仅活动语料，需显式传 `completed: true`。
- `backlog doctor` 的依赖缺陷是 **warning**，不改变退出码（仍 exit 0）。
- 知识图谱**默认使用 memory 后端**（Kuzu 原生绑定在 Bun 下段错误）；数据库与锁文件落在系统缓存目录、按 (项目, slot) 隔离，不在仓库内；首次启动会冷启动建图。
- 升级无需数据迁移；图谱为新增能力，不影响既有任务 / 文档 / 决策数据。

---

### 未迁移 / 未跟进

- **上游差异**：`v1.51.0 .. v1.53.0` 区间 489 个提交未评估（见上文）。
- **设计文档与实现不符**：`backlog/docs/BRDS/doc-15` 仍停留在 frontmatter `file_type` 版本，与 BACK-714 的落地（由白名单目录决定节点类型）相反；尚未更新。
- **过时代码注释 3 处**（仍写 frontmatter 决定类型）：`src/graph/fingerprint.ts:28`、`src/graph/import.ts:21`、`src/graph/incremental.ts:88`。
- 上一版遗留的迁移台账（doc-9 / doc-10 分类中的剩余草稿）未在本期处理。
