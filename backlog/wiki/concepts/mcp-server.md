---
title: MCP Server 实现
labels: [concept]
created_date: 2026-05-06 00:00
updated_date: 2026-06-24 00:30
---


# MCP Server 实现

Backlog.md 通过 MCP（Model Context Protocol）为 AI 工具提供结构化接口。`src/mcp/server.ts` 中的 `McpServer` 类继承自 `Core`，在领域能力之上添加 MCP 协议层。

## 设计原则

- **本地-only**：通过 stdio 传输，不暴露网络端口
- **无状态请求处理**：每个请求独立，通过 Core 操作文件系统
- **Roots 发现**：支持 MCP roots 机制，自动在 workspace 中查找 backlog 项目
- **Fallback 模式**：未找到项目时降级为最小功能模式，只暴露 `init` 相关工具

## 类结构

```
McpServer extends Core
├── server: MCP SDK Server
├── transport?: StdioServerTransport
├── tools: Map<string, McpToolHandler>
├── resources: Map<string, McpResourceHandler>
├── prompts: Map<string, McpPromptHandler>
├── debugLog: string[]
└── rootsDiscoveryEnabled: boolean
```

## 注册的工具类别

| 类别 | 工具示例 |
|---|---|
| 任务管理 | `create_task`、`update_task`、`list_tasks`、`search_tasks`、`complete_task` |
| 文档管理 | `create_document`、`update_document`、`list_documents` |
| 里程碑 | `create_milestone`、`list_milestones`、`milestone_edit`、`archive_milestone` |
| 决策记录 | `create_decision`、`list_decisions` |
| DoD | `add_definition_of_done`、`check_definition_of_done` |
| 工作流 | `get_workflow_instructions` |

## Roots 发现机制

1. MCP 客户端发送 `roots/list` 请求
2. 对每个 root URI（`file://` 协议），调用 `resolveBacklogDirectory()` 检查是否存在有效配置
3. 找到第一个有效项目后，调用 `upgradeToProject()` 重新初始化 Core 并注册完整工具集
4. 未找到时保持 fallback 模式，只暴露 `init` 和项目发现相关资源

### 正常启动路径也跟随 Roots（BACK-522）

- 从 #608/BACK-434 的 fallback-only roots 发现扩展到**正常（已初始化）启动路径**。
- `pinned` 标志由 `src/commands/mcp.ts` 根据目录来源设置：
  - `--cwd`/`BACKLOG_CWD` → `pinned = true`，固定 project root，不查询 roots。
  - `process.cwd()` → `pinned = false`，启用 request-scoped roots 发现。
- `startupHasProject` 标志保证：正常基线启动已有项目时，即使客户端 workspace 没有 backlog，也保留原项目（只有 fallback 基线才会降级到 init-required）。
- `upgradeToProject` 的 no-op 短路覆盖正常基线，避免客户端 root 与启动目录相同时重复注册。

### 约束

- 每个 root 直接检查，不递归。
- 多 root 时选择**第一个**包含有效 backlog 配置的 root。
- Single-flight：并发请求共享同一次 roots 解析结果。

## 与 CLI 的关系

MCP Server 和 CLI 共享同一个 `Core` 和 `FileSystem`：
- MCP 修改任务 → 文件系统写入 → ContentStore 文件监视器检测到变更 → 内存缓存更新
- Web UI 同时打开时，通过 WebSocket 收到更新推送
- 三者最终都操作同一套 Markdown 文件，天然同步

## 新增工具能力（v1.48.0）

- **document_update**：新增 `appendContent` 字段，追加内容块以空行分隔（[[sources/back-529-doc-update-multiline-append|BACK-529]]）
- **task_edit**：新增 `descriptionAppend`（[[sources/back-530-append-description|BACK-530]]）与 `acceptanceCriteriaClear`（原子清空 AC，[[sources/back-537-deterministic-checklist-serialization|BACK-537]]）
- **task_list / task_search**：`status` 支持字符串或数组（多状态）并新增 `statusExcluded`；新增 `unassigned` 布尔（与 assignee 组合时以 VALIDATION_ERROR 拒绝）；validators 增加 oneOf 支持（[[sources/back-548-status-exclude-filtering|BACK-548]]、[[sources/back-551-unassigned-task-filtering|BACK-551]]）
- **workflow 资源**：注册 `backlog://workflow/drafts` 草稿指南（[[sources/back-532-cli-draft-workflow-guides|BACK-532]]）

## Related Sources
- [[sources/back-529-doc-update-multiline-append]] — document_update appendContent
- [[sources/back-530-append-description]] — task_edit descriptionAppend
- [[sources/back-537-deterministic-checklist-serialization]] — acceptanceCriteriaClear
- [[sources/back-548-status-exclude-filtering]] — statusExcluded
- [[sources/back-551-unassigned-task-filtering]] — unassigned
