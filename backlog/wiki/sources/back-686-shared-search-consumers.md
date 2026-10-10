---
title: BACK-686 - TUI 与 milestone 页面接入共享 Core 搜索
labels: [source, tui, web-ui, search]
created_date: 2026-09-26 14:14
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-686 - Route-TUI-and-milestone-page-task-search-through-the-shared-core-search.md
---

# BACK-686 - TUI 与 milestone 页面接入共享 Core 搜索

TUI 任务查看器用两个引擎解析同一个过滤器（内存索引加带约 50 行手搓后过滤的 SearchService 回退），Web milestones 页面跑第三个私有 Fuse 配置、只覆盖 id/title。本任务把两者合并到 BACK-685 共享搜索路径，并修复暴露该问题的事故：服务器 Core 泄漏进浏览器 bundle。

- `src/ui/task-viewer-with-search.ts`：SearchService 回退引擎整体删除（声明、创建、回退分支、四个 dispose 调用点）；一个语料级索引经 `createTaskSearchIndex(allTasks)`；所有过滤器（query、status/statusExcluded、priority、labels + labelMatch、milestone + resolver、scoreThreshold 0.45、ready）走一次 `applyTaskFilters` 调用——一次渲染不再可能走两个引擎
- `src/web/components/MilestonesPage.tsx`：私有 Fuse 配置删除；一个共享 `createTaskSearchIndex` 经 `useMemo` 覆盖 bucket 任务；精确 id/子串预匹配保留为模糊索引前的短路，label/body/assignee 查询现在在那里解析
- 事故与修复：把 milestones 页面接到共享索引经 `task-path.ts` 的 `taskIdsEqual` 把 `node:path` 与 `core/backlog.ts` 拖进客户端 bundle，Web UI 白屏——修复是把 `taskIdsEqual` 移入纯模块 `src/utils/task-id.ts`（task-path 重导出），即仓库现有的纯辅助函数模式；经 `bun build src/web/index.html` 验证（客户端 bundle 无服务器侧标记）
- fork 就绪引擎（`buildReadinessGraph`/`getTaskReadiness`）、跨分支语料拆分与自定义渲染不动
- 新 `src/test/web-milestones-page-search.test.tsx`（6 用例）加变异矩阵；TUI 合并由 BACK-685 一致性套件间接守卫——查看器没有自动化测试架，笔记中记录的预先存在缺口

## 验收标准

- 查看器的 SearchService 回退分支与手搓后过滤器消失；过滤经共享谓词与其他面一致（milestone 含 NO_MILESTONE、labelMatch、就绪、score 截断）
- milestones 页面不带私有 Fuse 配置；label/body 查询在那里能找到任务；精确 id/子串预匹配作为短路存活
- 合并或接线被回退时新用例变红；无仅服务器模块进入客户端图

## Related Concepts
- [[concepts/search-sequences]] — 扩展到两个新消费方的单一搜索管道
- [[concepts/milestones]] — milestones 页面搜索面
- [[concepts/browser-loading]] — 白屏 bundle 事故及其纯模块修复

## Related Sources
- [[sources/back-685-single-source-task-search]] — 本任务把消费方接入的单一所有者搜索
- [[sources/back-628-task-hierarchy-section]] — 早前命中同款纯 task-id 模块模式（`canonicalTaskId` vs Core 进 bundle）
- [[sources/back-568-core-browser-task-boundary]] — 本次事故重申的 Core/浏览器边界纪律
