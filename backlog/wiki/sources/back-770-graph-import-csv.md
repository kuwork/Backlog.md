---
title: BACK-770 - graph import CSV 导入
labels: [source, cli, graph, feature]
created_date: 2026-10-16 01:00
updated_date: 2026-10-16 01:00
source_path: backlog/tasks/back-770 - Add-backlog-graph-import-for-CSV-import-into-a-user-database.md
---

# BACK-770 - graph import CSV 导入

里程碑 m-13 任务（从 BACK-769 拆出，依赖 BACK-769）：`backlog graph import <db> <csv>` 把 CSV 文件载入用户数据库。ryu `COPY FROM` 在 WASM 构建下静默导入零行（BACK-766 已证实），故必须 node fs 读文件、分批参数化 `UNWIND` 插入；目标表不存在时按推断类型自动建表。

## 目标

`import <db> <csv> [--node T] [--header] [--map a=b,...]` 载入行并持久化快照；绝不使用 ryu `COPY FROM`；缺表自动建表（类型推断 INT64 / DOUBLE / BOOLEAN / STRING）；畸形文件清晰报错且数据库保持原样。

## 实现要点

- 读写刻意分离：`src/graph/csv-import.ts` 的 `readCsvFile()` 在开 store 前完成全部校验（解析、header、`--map`、列名、类型推断），CLI 先读文件再进 `withGraphDatabase(..., { write: true })`，畸形文件根本到不了 hydrate 步——AC #4 是结构性成立（快照只在 `fn` 成功后才 dump）。
- 参数绑定统一"文本进、Cypher 端 CAST"：Bun embind 下 JS number 传给 INT64/DOUBLE 参数直接抛 `TypeError: Invalid argument type in ToBigInt`（实测 `{d: 1}` 都挂），BigInt 只对 INT64 有效，故一律传文本、目标端 `CAST(row.age AS INT64)`，STRING 列原样；hydrate（`src/graph/snapshot.ts`）同规则。值在 JS 侧校验，绝不信 ryu——`CAST('abc' AS INT64)` 静默得 NULL 不报错；BOOLEAN 接受 true/false/1/0/yes/no/y/n/t/f。
- MERGE 而非 CREATE：初版 `UNWIND $rows AS row CREATE (:T {...})` 实测一条重复键丢掉整批（不报错也不插新行）；改 `MERGE (n:T {key: row.key}) SET n.col = ...`，已有键更新、新键插入；无主键的表无 MERGE 对象，保留 CREATE。CLI 报告 新增/覆盖/文件内重复 计数。
- CSV 首列即主键：自动建表时首列声明 `PRIMARY KEY`（任何类型均可，含 DOUBLE、BOOLEAN），保证 MERGE 有意义、重导入幂等；CSV 出现表未声明的列直接报错（静默丢列即数据丢失）。
- 验证中修掉四个缺陷：①dump 对含逗号/换行的值有损——`RETURN n` 遇 INT64 属性被迫走 `|` 分隔文本回退，"Ann, A" 被切成 "Ann"（修：dump 改为逐声明属性 `RETURN n.\`a\`, n.\`b\``，留在结构化路径）；②NULL 无法往返——空 CSV 单元产出的快照行缺键，hydrate 投影把它当损坏拒载（修：缺失声明属性补 NULL，改为拒绝表从未声明的键；typed 列 dump 写 NULL 而非 ""）；③NULL 主键直接段错误 WASM 后端（修：`bindableRow` 拒空主键并指名行与表）；④合并键含换行把一行劈成两个节点（`MERGE (n:T {k: "a\nb"})` 无报错；修：拒绝并指名行列）。
- 已知限制：STRING 列空单元与 NULL 读出无法区分；导入是按主键 upsert 而非事务；类型推断按整列全文件，混入一个杂词整列落 STRING。

## 验证

tsc、biome 干净；14 个新 csv-import 测试加六个图谱套件（96 例）通过；scratch 项目跨进程端到端验证，含 1200 行约 2.4s。

## Related Sources

- [[sources/back-769-graph-cli-multi-database]] — 提供写路径、快照持久化与本任务复用的基础设施
- [[sources/back-766-ryugraph-wasm-backend-switch]] — `COPY FROM` 静默零行的前车之鉴
- [[sources/back-771-graph-cli-followups]] — 关系 CSV 导入等后续项
