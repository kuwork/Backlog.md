---
title: 图谱 MCP 工具
labels: [usermanual]
created_date: 2026-10-16 01:00
updated_date: 2026-10-16 01:00
---


# 图谱 MCP 工具

Backlog.md 的 MCP 服务器提供一组 `graph_*` 工具，让 AI 代理直接查询项目的任务/知识图谱与用户数据库，能力与 CLI 的 `backlog graph` 子命令一一对应。配套的 MCP 使用指南可通过 `get_backlog_instructions`（或资源 `backlog://workflow/graph`）获取，内容与 `backlog instructions graph` 的 CLI 指南镜像。

## 六个工具

| 工具 | 用途 | 注解 |
|------|------|------|
| `graph_query` | 对 `default` 或用户数据库运行只读 Cypher，返回列与行 | `readOnlyHint`；写关键字（CREATE/MERGE/SET/DELETE/DROP 等）被拒绝 |
| `graph_schema` | 返回某数据库的 schema：节点表及属性、关系表及两端点 | `readOnlyHint` |
| `graph_list_databases` | 列出 `default` 与所有用户数据库及元数据（名称、类型、大小） | `readOnlyHint`，无必填参数 |
| `graph_describe_database` | 返回单个数据库的描述、时间戳与各表行/边数 | `readOnlyHint` |
| `graph_create_database` | 创建用户数据库（`name` + `description`） | `destructiveHint`；必须显式传 `acknowledged: true` 才会写入 |
| `graph_import_csv` | 把 CSV 导入用户数据库：默认按节点导入（缺表自动按推断类型建表，按主键 upsert），加 `rel`/`from`/`to` 则按边导入（端点只匹配不创建） | `destructiveHint`；文件先完整校验再打开数据库，格式错误不产生副作用 |

查询类工具的数据库不存在时返回清晰错误（并列出可用数据库）；写工具一律拒绝只读的 `default`。

## 一次性开关模型

图谱 MCP 工具**不持有长驻的 GraphService**：每次调用都按「打开 → 准备 → 执行 → 关闭」的一次性流程走完。其中：

- `default` 走派生图谱的快照复用（与 CLI 相同的路径），结果与 Web 界面保持一致；
- 用户数据库从其 JSON 快照水合，写工具在执行后重新落盘快照；
- 因此代理侧不需要关心连接管理，也避免了与 Web 服务器进程争用同一图谱。

## 与 CLI 的关系

工具参数与 CLI 子命令对应：`graph_query(db, statement)` ↔ `backlog graph query <db> [cypher]`，`graph_import_csv(db, csv, …)` ↔ `backlog graph import <db> <csv>`，依此类推。`graph_import_csv` 的相对路径按项目根目录解析，而不是 MCP 进程的当前目录。
