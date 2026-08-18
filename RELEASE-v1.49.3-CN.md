## v1.49.3-CN Release Notes

> 上一个版本：[v1.48.0-CN](https://github.com/kuwork/Backlog.md/releases/tag/v1.48.0-CN)
>
> 本版本根据上游 [MrLesk/Backlog.md](https://github.com/MrLesk/Backlog.md) `v1.48.0 .. v1.49.3` 的变更差异（详见 [doc-7](backlog/docs/migration/doc-7%20-%20Upstream-v1.48.0-to-v1.49.3-Migration-Diff-Classification.md) 与 [doc-8](backlog/docs/migration/doc-8%20-%20上游任务迁移分析报告（v1.48.0-..-v1.49.3-按领域）.md)）**有选择地迁移**了适合本项目的部分，并按当前 fork 的定制做了适配。**未迁移**的上游改动见文末。

### 🎯 主要亮点

- **任务身份模型重构**：跨分支、已完成、已归档的同名任务现在按“规范化 ID + 逻辑路径”统一识别，消除等时间戳扫描顺序导致的 ID 释放竞态；歧义 ID 直接 fail-closed 并给出候选列表。
- **浏览器默认更安全**：`backlog browser` 默认仅绑定 `127.0.0.1`，不再意外暴露到 LAN；需要外网访问时显式使用 `--host 0.0.0.0`。
- **TUI 可直接创建任务**：看板内按 `N` 键打开任务创建器，空看板也能用，无需离开终端。
- **只读命令支持 JSON**：`task list/view/search`、`doc list` 等命令新增 `--json`，输出结构化、版本化的机器可读结果。
- **浏览器加载体验升级**：服务器 bind-first 启动，Web 界面先出骨架屏与加载阶段提示，初始化完成后再渲染真实内容；出错时可重试。

### 📝 任务创建与编辑

- **`task edit --append-plan`**（BACK-556）：实现计划现在可以像 `--append-notes`、`--append-final-summary` 一样多次追加，而不用每次都覆盖整个计划。
- **稳定 JSON 输出**（BACK-562）：以下只读命令支持 `--json`：
  - `backlog task list --json`
  - `backlog task view <id> --json`
  - `backlog task <id> --json`
  - `backlog search "..." --json`
  - `backlog doc list --json`
  - JSON 统一信封 `{ schemaVersion: 1, kind: "..." }`，只写 stdout，与 `--plain` 互斥。

### 🔍 筛选、搜索与排序

- **搜索分数阈值统一**（BACK-564）：TUI / CLI / MCP 的模糊搜索统一使用 0.45 的 Fuse.js 分数阈值，结果更一致。
- **sequences 命令补全 CLI 文档**（BACK-554）：`backlog instructions overview` 的 Quick Reference 中补充了 `backlog sequence list` 的用法说明。

### 🖥️ Web 界面

- **浏览器默认仅回环**（BACK-558）：`backlog browser` 默认绑定 `127.0.0.1`，避免开发机意外暴露到局域网。
- **`--host` 显式开放 LAN**（BACK-558）：需要外部访问时使用 `--host 0.0.0.0`。
- **`BROWSER` 环境变量**（BACK-559）：在 devcontainer 等无默认浏览器环境中，可指定启动命令：`BROWSER=/usr/bin/chromium backlog browser`。
- **异步加载与真实骨架屏**（BACK-566）：Web 启动时先显示加载阶段文案与骨架屏，待 Core 语料初始化完成后再渲染看板；失败时提供重试面板。
- **任务卡片显示 AC 进度**（BACK-569）：状态为 **In Progress** 且含验收标准的任务，卡片上会显示 `[██████░░░░] 4/7` 式进度。
- **任务详情快捷键不拦截内联输入**（BACK-557）：当焦点在 `input` / `textarea` / `select` / `contenteditable` 中时，预览态快捷键 `e/c/d/p` 被抑制，避免打断文字输入。

### 🖥️ TUI 看板

- **`N` 键任务创建器**（BACK-563）：按 `N` 可直接在看板中创建任务，支持 Title、Description、Status、Priority、Draft；空看板也能打开。
- **实时刷新对原子写入稳健**（BACK-555）：文件写入触发的事件可能包含短暂的部分内容，TUI 会等待文件稳定后再刷新，避免读取到不完整的任务内容。
- **主题自适应与滚动改进**（BACK-565）：移除硬编码 ANSI 颜色，采用 inverse+bold 高亮以兼容任意终端主题；新增 PageUp/PageDown/Home/End、滚动条、稳定的 Tab 视图切换。
- **验收标准进度指示**（BACK-569）：TUI 看板卡片与任务列表同样显示 AC 进度 `[██████░░░░] 4/7`。

### ⚙️ 配置与数据一致性

- **autoCommit 精确到触碰文件**（BACK-561）：`autoCommit: true` 时，仅提交本次操作实际修改过的文件，不再整目录暂存，保留用户已有的 staged/untracked 工作。

### 🤖 Agent 与 CLI 工作流

- **Cursor AGENTS.md 清理**（BACK-410）：`backlog init` 现在统一把 Cursor 代理指南写入 `AGENTS.md`，不再生成单独的 `.cursorrules` 文件；移除了相关的死代码与旧文案。

### 🏗️ 架构基石

- **跨分支任务统一身份**（BACK-567）：新增 `TaskIdentityIndex`，以 `canonicalTaskId + normalizeRecordPath` 作为身份键，合并跨分支、已完成、已归档记录；工作副本优先、其次最近修改、再次最多完成项；同一身份存在多个 live 路径时抛 `AmbiguousTaskIdError`，Web 返回 409 与候选列表。
- **Core 作为浏览器任务边界**（BACK-568）：浏览器任务读写统一经 Core + 单一语料快照，消除重复全量扫描；`server/index.ts` 的 reorder 原子应用 `changedTasks` 并广播 75ms 防抖更新。

---

### 未迁移的上游改动（本次评估后跳过）

| 上游功能 | 原因 |
|---|---|
| 任务 `type` 类型字段 | 本项目已用 `label` 承担分类职责，引入单选 `type` 会与现有设计冲突 |
| 任务深链接 `/board/*`、`/tasks/*` | 与现有 `/task/:id/:title`、`/draft/:id/:title` 路由冲突 |
| 自定义优先级值 | 改动面大、风险高于收益；三档优先级已够用 |
| `dateFormat` 配置统一生效 | 上游实现基于 UTC 显示，与本项目「本地时区显示」策略冲突 |
| 移除 sequences 功能 | 本项目仍在使用 `src/core/sequences.ts` 及相关功能 |
| README 重构 / manifesto | 偏品牌和文档方向，与本项目文档策略无关 |
| 双向依赖图、可导航任务依赖图 | 上游当时仍为 To Do 无代码；fork 已用 Gantt 箭头与任务钻取实现类似能力 |
| bun2nix v2 打包 | fork 明确锁 V1，升级会与不兼容的 `mkBunDerivation` 冲突 |

> 完整的差异分类与逐条迁移建议见 [doc-7](backlog/docs/migration/doc-7%20-%20Upstream-v1.48.0-to-v1.49.3-Migration-Diff-Classification.md) 与 [doc-8](backlog/docs/migration/doc-8%20-%20上游任务迁移分析报告（v1.48.0-..-v1.49.3-按领域）.md)。
