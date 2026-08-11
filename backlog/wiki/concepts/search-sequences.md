---
title: 搜索与序列
labels: [concept]
created_date: 2026-05-06 00:00
---


# 搜索与序列

## 搜索（Search）

Backlog.md 使用 Fuse.js 提供统一的模糊搜索服务，覆盖所有入口点（CLI、TUI、Web）。

### 搜索范围
- 任务（tasks）
- 文档（docs）
- 决策（decisions）
- Wiki 页面（wiki）— 自 BACK-481 起纳入索引，支持 `type:wiki <keyword>` 过滤

### CLI 搜索

```bash
backlog search "关键词"
backlog search "api" --status "In Progress"
backlog search "bug" --priority high
backlog search "feature" --plain
backlog search "api" --status "In Progress" --status "Done"   # 多状态
backlog search "api" --exclude-status "Done"                  # 状态排除
backlog search "api" --unassigned                             # 未指派过滤
```

### 任务过滤模型

`TaskListFilter` 在 `applyTaskFilters` 中统一实现，被 CLI/TUI/Web/MCP/搜索各路径共享：

- **多状态**：`status` 扩展为 `string | string[]`（`--status` 重复/逗号分隔）
- **状态排除**：`statusExcluded`，以 Set 做排除匹配（`--exclude-status`）
- **未指派过滤**：`unassigned`，任务无任何非空 assignee 条目即视为未指派（`--unassigned`，与 `--assignee` 互斥）（BACK-548 / BACK-551）

### TUI 搜索

交互式实时过滤，输入即更新，无需按 Enter。

### Web 搜索

支持命令过滤（command filters）和模糊匹配。

### Wiki 搜索（BACK-481）

Wiki 页面通过 `ContentStore` 的现有快照/事件管道集成到 `SearchService`，与 tasks/documents/decisions 共用同一套缓存失效机制。

- **Wiki 搜索实体** (`WikiSearchEntity`)：
  - `title`：frontmatter.title → 文件名去 `.md` 的降级策略
  - `bodyText`：页面正文内容
  - `fileName`：文件名（weight 0.25），支持按文件名搜索
  - `path`：wiki 相对路径
- **CLI 范围**：`--type wiki` 被识别，但纯文本输出故意跳过（TUI 无 wiki 查看器），Web 独占
- **Web 搜索 UI**：`SideNavigation.tsx` 渲染 wiki 结果时显示书本图标，点击导航到 `/wiki/${path}`

### 里程碑页面搜索

`MilestonesPage.tsx` 使用分层匹配策略避免 Fuse.js 短查询误报：
1. **精确 ID 匹配**：`task.id.toLowerCase() === query`
2. **子串包含匹配**：`task.id.includes(query) || task.title.includes(query)`
3. **Fuse.js 模糊匹配**：仅当前两步无结果时作为 fallback（threshold: 0.35）

此策略解决了搜索短数字 ID（如 `479`）时因编辑距离阈值过宽而误匹配无关任务（如 `BACK-349`）的问题。

## 序列（Sequences）

从任务依赖关系自动计算出的可并行执行的任务组。

### 核心逻辑

`computeSequences(tasks)` 返回 `{ unsequenced: Task[], sequences: Sequence[] }`

- **Unsequenced**：无依赖、无被依赖、无 ordinal 的任务
- **Sequences**：按拓扑排序分层编号的任务组
- 同一 Sequence 中的任务可以并行工作
- 依赖关系形成执行顺序

### 使用场景

- 识别项目中的关键路径
- 发现可并行化的工作包
- 规划冲刺（Sprint）

### CLI/TUI/Web 支持

- `backlog sequence list` — 列出所有序列
- TUI 序列视图（只读 + 移动任务并更新依赖）
- Web UI 序列页面（拖拽重新排序）

## Related Sources
- [[sources/back-548-status-exclude-filtering]] — BACK-548 状态排除与多状态过滤
- [[sources/back-551-unassigned-task-filtering]] — BACK-551 未指派过滤
