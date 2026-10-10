---
title: BACK-652 - task list --status 支持多状态
labels: [source, cli, tui, search]
created_date: 2026-09-26 14:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-652 - Allow-task-list-status-to-accept-several-statuses.md
---

# BACK-652 - task list --status 支持多状态

CLI flag 其实已经接受多个状态（实测：重复传 `--status` 和逗号分隔 `--status` 都返回并集），但它背后的路径彼此不一致——四份 normalize-and-match 代码的 trim 和空选择语义各不相同，`search` 在种子化 TUI 之前还把选择压平成第一个值。现在一个共享 helper 支撑全部四条路径，选择以列表形式完整传进交互视图。移植自上游 BACK-638。

- 新的 `src/utils/status-filter.ts`（`normalizeStatusSet` + `statusMatchesSet`：小写化、trim、丢弃空串；空集合时调用方跳过过滤）替换 `Core.applyTaskFilters`（include + exclude）、`ContentStore.getTasks`、`FileSystem.listTasks` 和 Fuse `createTaskSearchIndex` 中的四份内联副本——索引那份以前不做 trim，且把空选择当作"什么都不匹配"，而各存储把它当作"不过滤"
- `TaskFilterOptions.status` 放宽为 `string | string[]`，让 CLI 已构建的列表有类型保障而不是被静默忽略
- `cli.ts` 在给统一视图播种时不再把 `filters.status` 归约为 `filters.status[0]`，并在过滤器描述中把列表拼接起来；`UnifiedViewFilters.statusFilter`、`ViewState.filter.status` 与 `FilterState.status` 都改为列表，在初始化/合并处做拷贝
- TUI：每个选中的状态对照配置列表规范化（未知值照旧丢弃），状态弹窗像 labels 一样使用 `openMultiSelectFilterPopup`，过滤器头部按钮汇总显示 All / 单值 / "N selected"，选择上的所有真值判断都改为 `.length` 判断，空列表保持"不过滤"含义
- 刻意不动：CLI 累加器与帮助文本（已记录重复/逗号用法）、`search-service.ts`（其 `normalizeStringArray` 已与该 helper 一致）、Web 任务列表（本就发送状态数组）
- 测试：新的 `status-filter.test.ts` 覆盖 helper 契约与 search 路径，`unified-view-filters.test.ts` 增加多状态用例（34 通过；恢复旧索引代码块后有 4 个变红）；五个相关文件共 50 通过；9 个 CLI 状态过滤用例通过
- 未在真实终端中演练：因 bblessed 需要 TTY，TUI 弹窗/头部改动只做类型检查与过滤器状态层单元测试；CLI 到视图的播种通过阅读数据流验证

## 验收标准

- 一个共享状态过滤 helper 支撑全部四条路径，它们在 trim 与空选择语义上不再产生分歧
- 重复或逗号分隔的 `search --status` 把完整选择带入交互视图、头部与底部
- TUI 状态弹窗像 labels 一样多选；头部汇总 All / 单值 / "N selected"
- 未配置的状态从交互选择中丢弃；单一状态行为与之前一致

## Related Concepts

- [[concepts/cli-tui]] — 统一视图与过滤器状态管线
- [[concepts/search-sequences]] — 与存储对齐的 Fuse 任务搜索索引语义
- [[concepts/upstream-migration]] — 移植自上游 BACK-638（commit 05fbbdd39）

## Related Sources

- [[sources/back-548-status-exclude-filtering]] — 与同一 helper 组合的排除状态过滤
- [[sources/back-649-shared-subtask-sorting]] — 用共享实现替换另一处重复比较器的兄弟修复
