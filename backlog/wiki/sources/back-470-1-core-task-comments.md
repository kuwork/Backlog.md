---
title: BACK-470.1 核心任务评论模型与 Markdown 持久化
created_date: '2026-06-09 00:40'
updated_date: '2026-06-09 00:40'
labels: [source, feature, comments, core, markdown, search]
source_path: backlog/tasks/back-470.1 - Core-task-comment-model-and-markdown-persistence.md
---

# BACK-470.1 核心任务评论模型与 Markdown 持久化

在所有公共界面之下添加共享的任务评论能力。

## 模型

任务评论是一个有序的任务级条目，包含：
- `body`：Markdown 文本
- `created`：时间戳
- `author`：可选字符串
- 稳定的显示索引

## Markdown 持久化

以结构化 `## Comments` 区域存储，单个评论块使用**哨兵定界**（sentinel-delimited），以防止评论正文中的 Markdown 标题破坏解析。

- 没有 Comments 区域的现有任务保持原有解析行为不变
- 不相关的任务编辑保留评论，不会重复或重新排序
- 验证会拒绝保留的评论标记，以防止区域损坏

## 集成点

- `src/types/index.ts` — 领域类型
- `src/markdown/structured-sections.ts` — 区域提取
- `src/markdown/parser.ts` / `src/markdown/serializer.ts` — 解析/序列化
- `src/core/backlog.ts` — 核心追加处理
- `src/core/search-service.ts` / `src/utils/task-search.ts` — 搜索索引

## 相关概念
- [[concepts/task-comments]] — 评论模型、持久化与搜索行为
- [[concepts/markdown-pipeline]] — gray-matter + 结构化区域
- [[concepts/core-architecture]] — Core 层与 SearchService

## 相关来源
- [[sources/back-470-task-comments]] — 父功能任务
- [[sources/back-470-2-cli-mcp-task-comments]] — CLI/MCP 界面
- [[sources/back-470-3-server-web-task-comments]] — Server/Web 界面
