---
title: 共享任务身份
created_date: '2026-08-17 23:00'
updated_date: '2026-08-17 23:00'
labels: [concept, core, identity, git]
---

# 共享任务身份

跨分支、已完成、归档等不同来源的任务记录共享一个统一身份：canonical ID + 规范化仓库相对逻辑路径。

## 身份键

- `canonicalTaskId`：零填充不敏感、点前缀/大小写不敏感的分组 ID（如 `BACK-007` 与 `BACK-7` 等价）
- `normalizeRecordPath`：仓库相对的逻辑任务路径（不同 backlog 目录或子目录规范化）

## 解析规则

- **同一 ID + 同一路径** = 同一身份的多版本；工作副本权威
- **不同 live 路径** = 歧义；`Core.getTask` 抛出 `AmbiguousTaskIdError`，浏览器 API 返回 409 并附候选列表
- **任何 live 变体** 占用该 ID；全部归档/完成后 ID 可复用
- 确定性胜出顺序：工作副本 > 最近修改 > 最多完成项

## 用途

- CLI/MCP/浏览器/统计/生命周期/分配全部通过同一身份规则解析
- 修复等时间戳下扫描顺序可能释放 live ID 的竞态
- `ContentStore` 轻量语料快照在身份索引上缓存 active/completed 任务

## Related Sources

- [[sources/back-567-cross-branch-task-identity]] — 身份索引实现
- [[sources/back-568-core-browser-task-boundary]] — 浏览器边界复用身份索引
