---
title: BACK-555 - TUI 实时刷新适应原子写入
labels: [source, tui, file-watcher, concurrency]
created_date: 2026-08-17 23:00
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-555 - Make-TUI-live-refresh-resilient-to-atomic-writes.md
---

# BACK-555 - TUI 实时刷新适应原子写入

修复 TUI 实时刷新竞态：CLI 原子写入只发出单个文件系统事件，watcher 可能在任务文件稳定可读之前就消费它。

## 实现要点

- 将 `src/utils/task-watcher.ts` 重构为有界调和（reconciliation）模型：按归一化 ID 去抖事件、要求两次稳定可读读取、在有限预算内重试临时的部分/缺失内容、抑制重复发布、取消过期 generation，并在原子写入只暴露临时文件事件时对整个目录做调和
- 将 `src/ui/unified-view.ts` 的内联回调重构为单一的 `applyUnifiedTaskUpdate` 回调管线，向看板与当前任务列表发布刷新后的任务/配置快照，同时保留 fork 的里程碑接线
- 为 `src/ui/task-viewer-with-search.ts` 增加实时更新订阅选项，使任务列表基于调和后状态重建搜索索引与过滤器
- 在 `src/utils/task-path.ts` 导出 `extractTaskIdFromFilename` 供 watcher 复用
- 选中任务变更、移动状态、归档或删除时，选中项保持有效
- 范围仅限当前 checkout；跨分支（cross-branch）与独立 worktree 的刷新不在范围内

## 验证

已通过确定性 watcher 测试、unified-view 回调集成与交互式 PTY 场景验证。

## Related Concepts
- [[concepts/cli-tui]] — TUI 看板与任务列表
- [[concepts/core-architecture]] — ContentStore 与 watcher 数据流

## Related Sources
- [[sources/back-563-tui-intent-first-composer]] — Composer 创建同样刷新看板
