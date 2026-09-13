## v1.50.2-CN Release Notes

> 上一个版本：[v1.50.1-CN](https://github.com/kuwork/Backlog.md/releases/tag/v1.50.1-CN)
>
> 这是一个**增量收尾版本**：上游没有对应的 `v1.50.2` tag，本版本号用于收纳 v1.50.1-CN 之后完成的工作，由三类内容组成 ——
> ① v1.49.3..v1.50.1 差异分类中顺延下来的收尾项（B14 / B15，详见 [doc-9](backlog/docs/migration/doc-9%20-%20Upstream-v1.49.3-to-v1.50.1-Migration-Diff-Classification.md) 与 [doc-10](backlog/docs/migration/doc-10%20-%20v1.49.3-至-v1.50.1-上游任务迁移分析报告（按领域）.md)）；
> ② 新上游范围 `v1.50.1 .. v1.51.0` 的**首个拣选**（上游 BACK-222.1 的模态框父子层级）；
> ③ fork 自研特性与缺陷修复（全局搜索对话框及其暴露出的模态导航历史栈问题）。
> **未迁移 / 未跟进**的条目见文末。

### 🎯 主要亮点

- **全局搜索对话框**（BACK-624）：Web UI 新增 macOS Spotlight 风格居中搜索对话框，`Ctrl+K` / `Cmd+K` 随时唤起，绑定 `/search` 路由，一屏检索任务、草稿、文档、决策与 Wiki 页面；单列分组、关键词与 ID 高亮、手写定高虚拟列表、后退还原滚动位置、窄屏全屏两行布局。取代了此前只能显示 5 条结果的侧边栏内联搜索。
- **任务模态框父子层级**（BACK-628）：任务详情模态框标题下方新增 PARENT 行与可折叠 SUBTASKS 区（完成计数 + 进度条 + 逐行钻取），无需离开模态框即可上下浏览层级。
- **模态导航历史栈修复**（BACK-627）：钻取后点击返回箭头改为 pop 而非 push，历史栈与模态栈严格 1:1 —— 关闭一次即回到背景页，不再需要"每钻一层多按一次关闭"。
- **上游收尾项落地**：任务 JSON 输出补齐验收标准进度（BACK-625 ← 上游 BACK-622，分类项 B14）；mermaid 升级到 `11.16.1` 清除 5 个 GHSA（BACK-626 ← 上游 BACK-598，分类项 B15）。

### 🔍 全局搜索（BACK-624）

- **入口**：`Ctrl+K`（Windows/Linux）/ `Cmd+K`（macOS），或点击侧边栏的搜索触发按钮；侧边栏原有的内联搜索框与结果下拉已移除。
- **路由即状态**：绑定 `/search?q=<关键词>&type=all|task|doc|wiki|decision`。打开用 push、输入与切换过滤用 replace（不增长历史栈）、关闭（Esc / × / 遮罩 / 浏览器后退）统一 `navigate(-1)`；底层页面保持挂载并锁定滚动。
- **结果呈现**：单列分组列表（任务 → 文档 → Wiki → 决策），表头可折叠并显示数量；行内展示类型图标、资源 ID、标题与状态/优先级胶囊；关键词与资源 ID 均按服务端返回的匹配区间高亮；结果数量不设上限。
- **虚拟滚动**：手写定高窗口化列表（无新增依赖），行高按视口模式取常量（桌面 56/28、窄屏 64/32），滚动位置以"首个可见行索引"而非像素写入 `location.state`，后退时稳定还原；`resetKey` 变化时回到顶部。
- **键盘优先**：`↑`/`↓` 移动选中、`Enter` 打开、`Esc` 关闭；焦点陷阱与输入自动聚焦。
- **导航落点**：任务/草稿以 `/task/:id/:slug` 模态打开，关闭后回到对话框且查询、过滤、滚动位置保留；文档/决策/Wiki 作为整页路由 push（可后退回到对话框）——只有模态目标才携带 `backgroundLocation`。
- **视口适配**：宽度 < 640px 时对话框转全屏，结果行改为定高两行（标题 / ID + 标签），虚拟滚动与位置还原行为不变；输入字号 28px（窄屏 32px，且不低于 16px 以避免 iOS 聚焦缩放）。
- **服务端影响**：唯一改动是把 `/search` 与 `/search/*` 加入 SPA 静态路由表（否则刷新或分享链接会 404）。`GET /api/search` 的处理逻辑**未变** —— 它本就支持不设上限、类型过滤、Wiki 内容检索与高亮索引，旧的 5 条上限纯粹是客户端行为。
- **共享化**：状态/优先级胶囊配色抽取为 `src/web/utils/task-badge-colors.ts`，TaskList 与 DraftsList 共用同一实现。
- **国际化**：新增 `searchDialog` 命名空间，四种语言（en / ja / zh-CN / zh-TW）同步。
- **验证**：31 个 `search-results` 单元测试覆盖分组、折叠、高亮区间合并、ID 高亮与索引还原；全量测试 2241+ 通过；真实浏览器逐条走查全部 8 条验收标准。

### 📊 任务数据与 JSON 输出（BACK-625）

- 任务摘要 JSON 新增 `acceptanceCriteriaCompleted` 与 `acceptanceCriteriaCount`，无验收标准的任务返回 `0`/`0`。
- 字段经**同一个** `toTaskSummaryJson` 漏斗产出，因此 `task list`、`task view` 与 `search` 的任务结果三处**同时**获得该字段，无需逐面接线。
- 字段命名刻意与上游保持一致，便于跨 fork 消费方复用。
- 既有的日期字段（`dueDate`、`plannedStart/End`、`actualStart/End`）、`normalizePublicDate` 本地化与详情层清单结构均未改动。
- 验证：聚焦测试 9 通过 / 81 断言，覆盖完整（1/1）、部分（1/2）、空（0/0）三种进度；在本仓库端到端冒烟确认 `task list/view/search --json` 一致输出。

### 🔐 依赖安全（BACK-626）

- **mermaid `11.15.0` → `11.16.1`**（精确固定），一次性清除 5 个已公开公告：

  | GHSA | 类型 |
  |---|---|
  | `GHSA-rhh3-jpg6-66xh` | radar 图 DoS |
  | `GHSA-c4c3-pg64-4m4v` | 配置原型污染 |
  | `GHSA-6x64-9x62-f2gx` | CSS 注入（可影响兄弟元素） |
  | `GHSA-3rrr-jr9j-h3q3` | architecture 图原型污染 |
  | `GHSA-2v8p-3f2j-5mp7` | XY 图死循环 DoS |

- **真实暴露面**：mermaid 不是 dev-only 依赖 —— 预构建的浏览器 bundle 被打进编译后的 CLI 二进制，并在回环 Web UI 中渲染任务与文档的 Markdown；`securityLevel: strict` 能挡住脚本注入，但挡不住 CSS 注入与原型污染两条。
- **版本选择**：当时最新的干净 11.x 是 `11.17.2`，本版本选择 `11.16.1` —— 已清除全部五个公告，且已带公开发布的深度供应链验证与约五周公开暴露。
- **锁文件**：`bun.lock` 中可归因于本次升级的改动仅 7 行，落在 mermaid 子树（mermaid、`@braintree/sanitize-url`、`@mermaid-js/parser`、`cytoscape`、`dayjs`、`katex` 及根 spec）；其余 150 行删除是**未改动树上**执行 `bun i` 也能复现的孤立条目清理。
- **`bun.nix`**：六个条目的 name/url/hash 手工更新（生成器需要 Docker 或 Nix，本环境不可用），每个哈希与 lockfile 记录的 sha512 integrity 逐字节一致。注意本 fork 没有 Nix CI 校验（无 nix job、无 bun2nix 守护），字节级交叉核对是当前唯一保证。
- **验证**：`bunx tsc --noEmit`、`bun run check .`、`src/test/mermaid.test.ts`（3 通过）、`bun run build` 产物含 11.16.1 标记并正常报版本。

### 🖥️ Web 界面

- **父子任务层级区块**（BACK-628）：任务详情模态框标题下方按需渲染层级区块，两种形态：
  - **PARENT 行**：向上箭头图标 + PARENT 标签 + 父任务 ID、标题与右侧状态徽章；点击该行在模态框内打开父任务。
  - **SUBTASKS 区**：图标 + SUBTASKS 标签 + 完成计数（如 `1/6`）+ 进度条 + 折叠箭头；**整行**（不止箭头）可点击展开/折叠；子任务行显示完成指示圆点（已完成/未完成）、ID、标题、状态徽章与钻取箭头，点击即在模态框内打开。
  - 无父任务且无子任务时**不渲染**该区块，模态框的布局、尺寸与展开行为与之前完全一致。
  - 解析全部在客户端基于任务语料完成：父任务查找与子任务筛选均使用前缀无关的规范化 ID，子任务按 ID 排序；模态框新增可选的 `availableTasks` 入参。
- **返回箭头与关闭语义统一**（BACK-627）：钻取返回箭头由"push 父任务 URL"改为 `navigate(-1)`，与浏览器后退、`×` / 遮罩关闭保持同一语义 —— 每次都精确消费一个历史条目。修复前钻取后返回会留下未消费的子任务历史条目，导致后续关闭又落回子模态框。
- **搜索对话框与既有模态共存**（BACK-624）：任务模态框关闭时在有背景页的情况下 pop 而非 replace，避免每次从搜索打开任务都为 `/search` 累积一条历史；文档/决策/Wiki 结果按整页路由打开，不挂背景。

### 🐛 缺陷修复

- **钻取后返回留下过期历史条目**（BACK-627）：`handleBack` 的 push 语义使历史栈与模态栈失去 1:1 对齐；改为 pop 后，"返回箭头 → 关闭"两步即可从子任务回到背景页。
- **浏览器 bundle 被拖入 Core 导致白屏**（BACK-628 执行中发现）：层级区块最初从 `src/utils/task-path.ts` 导入 ID 比较函数，该模块间接依赖 Core，被打包进浏览器 bundle 后 Web UI 直接白屏；改用纯模块 `src/utils/task-id.ts` 的 `canonicalTaskId`。类型检查与 `renderToString` 测试都不会暴露此类问题，只有真实浏览器加载才会 —— 已在 wiki 中固化为"浏览器代码只导入纯模块"的约定。

### ⚙️ 版本与发布

- 本版本不含 CLI 命令面改动，无需迁移步骤；升级后首次启动 `backlog browser` 时 `/search` 路由即生效。

---


> v1.49.3..v1.50.1 的完整差异分类与逐条迁移建议见 [doc-9](backlog/docs/migration/doc-9%20-%20Upstream-v1.49.3-to-v1.50.1-Migration-Diff-Classification.md) 与 [doc-10](backlog/docs/migration/doc-10%20-%20v1.49.3-至-v1.50.1-上游任务迁移分析报告（按领域）.md)；