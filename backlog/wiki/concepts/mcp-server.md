---
title: MCP Server 实现
labels: [concept]
created_date: 2026-05-06 00:00
updated_date: 2026-05-25 23:45
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

## 与 CLI 的关系

MCP Server 和 CLI 共享同一个 `Core` 和 `FileSystem`：
- MCP 修改任务 → 文件系统写入 → ContentStore 文件监视器检测到变更 → 内存缓存更新
- Web UI 同时打开时，通过 WebSocket 收到更新推送
- 三者最终都操作同一套 Markdown 文件，天然同步
