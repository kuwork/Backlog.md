---
title: 'BACK-759 - Cross-branch task loading ignores the configured task prefix'
labels:
  - source
  - core
  - cli
  - web-ui
  - config
created_date: '2026-10-09 22:00'
updated_date: '2026-10-09 22:00'
source_path: backlog/tasks/back-759 - Cross-branch-task-loading-ignores-the-configured-task-prefix.md
---

# Cross-branch task loading ignores the configured task prefix

**自定义 `task_prefix` 的项目跨分支任务加载整体静默失效**。`BranchTaskLoader` 的 `extractConfiguredTaskId`（`src/core/task-loader.ts:53`）调用 `extractTaskIdFromFilename(filename)` 时没有转发 `prefix`，文件名匹配器按硬编码默认前缀 `"task"` 构建（`^task-(\d+)`），`back-*.md` 全部解析为 `null`，每个分支的 commit index 恒为空。本仓实测：分支索引 0 → 2418（main/release/wiki-tmp），queryTasks 语料 400 → 444，BACK-758 可从 capped 分支读取，`backlog task view BACK-758` 从 not found 到完整输出。旧 fixture 用默认前缀 `task-1 - Feature.md` 配置，正是缺陷存活的原因。修复一行：`extractTaskIdFromFilename(filename, prefix)`；尾随的前缀相等守卫从死代码变为真正拒绝异前缀文件的门禁。调用点审计：`task-watcher.ts:67` 已转发、`cross-branch-tasks.ts` 用 `buildPathIdRegex(prefix)` 不受影响，全仓仅 task-loader 一处遗漏。

**第二范围：跨分支可见性配置化**。`includeCrossBranch` 原本无配置键、是两个表面上方向相反的字面量（Web 前端无条件加 `crossBranch=true`；CLI `task list`/`board` 为 `false`、9 个写查找点恒 `false`）。落地语义：**配置为默认、URL 参数为覆盖**——

- yml 键 `include_cross_branch`（snake_case，兼容 camelCase 别名），config 字段 `includeCrossBranch`；未设置 = local-first（历史 CLI 行为）
- 两个 HTTP 面共用纯函数 `resolveCrossBranchVisibility(param, config)`（`src/server/index.ts` 导出），`/api/tasks` 与 `/api/search` 一致
- SearchService 语料始终跨分支构建，关闭时在查询路径用 `isLocalEditableTask` 组合过滤（no-query 与 fuse 两条路径都应用），开启无需重载
- 前端 `fetchTasks()` / `search()` 仅显式传参才附加 `crossBranch`（board 主数据源是 `search()`，因此 search 半侧才是实际生效面）
- CLI `task list` / `board` 改读配置；9 个写查找点与 milestone list 保持 local-first
- `config-watcher` 的 `BOOLEAN_CONFIG_KEYS` 收录新键，外部编辑热生效

**连带发现**：任务 ID 分配（`generateNextId` → `getActiveAndCompletedTaskIds`，本就跨分支设计）因同一空索引把 BACK-715 分配给 main 已占用的号——修复后候选集 705 → 749。本任务因此手工编号为 BACK-759。

## Related Concepts

- [[concepts/core-architecture]] — 增量跨分支加载体系与 TaskIdentityIndex
- [[concepts/task-identity]] — 跨分支任务身份
- [[concepts/search-sequences]] — SearchService 过滤与 /api/search
- [[concepts/web-server]] — resolveCrossBranchVisibility 与 /api/tasks

## Related Sources

- [[sources/back-760-cross-branch-settings-toggles]] — 本配置在设置页的开关（依赖后继）
- [[sources/back-602-incremental-cross-branch-task-loading]] — 跨分支增量加载地基
- [[sources/back-761-terminal-card-actual-end]] — 同批任务
