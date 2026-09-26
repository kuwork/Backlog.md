---
title: 图节点以文件路径为主键（FileNode）+ SCHEMA_VERSION 自描述
description: BACK-713 将 Task(id) 表改为 FileNode(path PK)，schema 版本写进图自身的 Meta 表
labels: [decision, graph, kuzu, refactor]
created_date: '2026-09-26 14:45'
updated_date: '2026-09-26 14:45'
---

# 图节点以文件路径为主键（FileNode）+ SCHEMA_VERSION 自描述

## Context

原 schema 以 `Task(id)` 为节点表，文件移动/重命名/归档在图里变成多步操作；同时 kuzu 实测行为与假设不符（`CREATE TABLE IF NOT EXISTS` 对过期文件静默 no-op、`COPY` 不报错），手写迁移代码既脆弱又无止境。

## Decision

- 节点表改为 `FileNode(path PRIMARY KEY, id, type, title, status, updatedDate)`：文件路径是唯一节点身份，任务 ID 降级为属性；rename/complete/demote/promote/archive 全部坍缩为"同 id 迁移 = 删旧路径 + 建新路径 + 重建受影响边"一种操作
- 导入两阶段：先解析全部文件建 id→path 映射，再按路径建节点并把 ID 引用翻译成边（fail-closed 报告保留）
- Schema 版本自描述：`SCHEMA_VERSION` 写入图自己的 `Meta` 表；`init()` 遇到任何其他版本直接清空重建，`clear()` 通过 `CALL show_tables()` 发现表名（先 rel 后 node）。未来任何 DDL 变更只是 bump 一个常量，没有迁移代码、没有退役表名清单

外部 API 不变：`getPayload` 把路径翻译回任务 id，`/api/graph` 与前端零改动；`PARSER_VERSION` bump 到 2 强制旧缓存重建。

## Rejected alternatives

- 保留 id 主键 + 迁移代码——每次 DDL 变更都要维护退役表名清单，且 kuzu 的静默 no-op 行为让"IF NOT EXISTS 式升级"不可靠
- 节点同时以 id 和 path 为身份——同一实体两个主键只会制造不一致

## Related Sources

- [[sources/back-713-filenode-rename]] — 本决策的落地与 kuzu 行为实测
- [[sources/back-702-kuzu-graph-foundation]] — 被改名的原 Task(id) schema
- [[sources/back-703-graph-incremental-sync]] — 适配路径键迁移的增量引擎
