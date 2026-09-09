---
title: 共享任务身份
created_date: '2026-08-17 23:00'
updated_date: '2026-09-08 17:00'
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

## 身份规范扩展到文档与决策（BACK-596/598）

身份规范从任务扩展到文档/决策，统一走共享 entity-id 模块：

- `entityIdKey` 统一身份键生成
- 零填充归一（`doc-7` ≡ `doc-007`）
- 空 ID 不可寻址，直接报错
- path/slug/标题引用解析三趟：文档视图可分别按路径、标题、slug 消歧（[[sources/back-598-doc-view-disambiguate-path-title-slug]]）

## fail-closed 语义（BACK-596）

解析歧义或身份缺失时不猜测，各 surface 统一 fail-closed：

| 表面 | 行为 |
|---|---|
| CLI | 退出码 1 |
| 服务器 | HTTP 409 |
| MCP | `AMBIGUOUS_ID` |
| Web | 共享通知提示 |

## Related Sources

- [[sources/back-567-cross-branch-task-identity]] — 身份索引实现
- [[sources/back-568-core-browser-task-boundary]] — 浏览器边界复用身份索引
- [[sources/back-596-fail-closed-document-decision-identity]] — BACK-596 文档/决策 fail-closed 身份
- [[sources/back-598-doc-view-disambiguate-path-title-slug]] — BACK-598 三趟引用解析
