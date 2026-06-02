---
title: 源代码架构总览
labels: [source]
source_path: src/
created_date: 2026-05-06 00:00
---


# 源代码架构总览

Backlog.md CLI 工具的完整 TypeScript 源码位于 `src/` 目录，基于 Bun 运行时构建。代码采用模块化分层架构，核心逻辑、协议适配层和界面层清晰分离。

## 模块结构

```
src/
├── index.ts              # 公共 API 导出门面
├── cli.ts                # CLI 入口（~3919 行，Commander.js）
├── agent-instructions.ts # AI 代理指令文件管理
├── board.ts              # 看板导出
├── readme.ts             # README 集成
├── commands/             # CLI 命令辅助（wizard、completion、MCP 命令注册）
├── completions/          # Shell 补全脚本
├── constants/            # 常量定义（目录、文件、默认状态）
├── core/                 # 核心领域逻辑
│   ├── backlog.ts        # Core 类：任务 CRUD、查询、ID 生成、配置迁移
│   ├── content-store.ts  # ContentStore：内存缓存 + 文件系统监视器
│   ├── search-service.ts # SearchService：基于 Fuse.js 的模糊搜索
│   ├── task-loader.ts    # 跨分支任务加载（本地/远程分支状态合并）
│   ├── init.ts           # 项目初始化向导
│   ├── sequences.ts      # 依赖序列计算
│   ├── statistics.ts     # 统计聚合
│   ├── milestones.ts     # 里程碑管理
│   ├── reorder.ts        # 任务排序与序号冲突解决
│   ├── config-migration.ts      # 配置格式迁移
│   └── prefix-migration.ts      # Draft 前缀迁移
├── file-system/
│   └── operations.ts     # FileSystem：直接的文件系统操作（~1618 行）
├── git/
│   └── operations.ts     # GitOperations：Git 封装
├── markdown/
│   ├── parser.ts         # Markdown 解析（gray-matter + 结构化章节）
│   ├── serializer.ts     # Markdown 序列化
│   ├── structured-sections.ts   # 结构化章节提取（AC、DoD、描述等）
│   └── section-titles.ts # 章节标题本地化
├── types/
│   └── index.ts          # 领域类型定义（Task、Decision、Document、Milestone 等）
├── mcp/
│   ├── server.ts         # McpServer 类：继承 Core，stdio 传输
│   ├── types.ts          # MCP 类型定义
│   ├── tools/            # MCP Tool 实现（任务、文档、里程碑、工作流）
│   ├── resources/        # MCP Resource 实现（工作流指南、初始化指引）
│   └── errors/           # MCP 错误类型
├── server/
│   └── index.ts          # BacklogServer：HTTP API + WebSocket + SPA（~1766 行）
├── web/                  # 浏览器前端（React/TypeScript SPA）
│   ├── index.html
│   ├── main.tsx
│   └── App.tsx
├── ui/                   # TUI 组件（终端交互界面）
├── formatters/           # 输出格式化（表格、纯文本、Markdown）
├── guidelines/           # AI 代理指令模板
└── utils/                # 工具函数（50+ 个工具模块）
```

## 关键架构模式

1. **Core 为中心的领域类**：`Core` 聚合 `FileSystem` 和 `GitOperations`，暴露所有领域操作（CRUD、查询、搜索、序列计算）。
2. **ContentStore 内存缓存**：在 `Core` 之上提供内存缓存层，通过 `node:fs` watch 实现文件变更实时同步，避免每次操作都读盘。
3. **SearchService 基于 Fuse.js**：订阅 `ContentStore` 的变更事件，增量重建搜索索引，支持标题、正文、ID、标签、修改文件的全文模糊搜索。
4. **McpServer 继承 Core**：在 Core 能力之上添加 MCP 协议层（tools/resources/prompts），通过 stdio 与桌面编辑器通信。
5. **BacklogServer 独立 HTTP 服务**：使用 `Bun.serve()` 提供 REST API、WebSocket 实时推送和 React SPA 托管，完全依赖 Core 和 ContentStore。
6. **Markdown 解析流水线**：`parseMarkdown`（gray-matter）→ `parseTask`/`parseDocument`/`parseDecision`（结构化章节提取）→ 领域对象。
7. **跨分支任务感知**：`task-loader.ts` 扫描本地和远程 Git 分支中的 backlog 文件，将分支上的任务状态合并到查询结果中。

## 数据流

```
Markdown 文件 → FileSystem → ContentStore → SearchService
                                    ↓
                              CLI / Web UI / MCP
```

- **写入**：CLI/Web/MCP → Core → FileSystem → Markdown 文件
- **读取**：ContentStore 初始化时从 FileSystem 批量加载，后续通过文件监视器增量更新
- **搜索**：SearchService 订阅 ContentStore 事件，自动重建 Fuse.js 索引
