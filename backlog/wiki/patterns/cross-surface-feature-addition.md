---
title: 跨表面功能添加模式
labels: [pattern, architecture, implementation]
created_date: 2026-05-27 00:00
updated_date: 2026-05-27 00:00
---

# 跨表面功能添加模式

当需要为 Backlog.md 添加一个跨 CLI、TUI、Web、MCP 的新任务字段或功能时，遵循固定的 12 层遍历顺序，可显著降低遗漏表面的概率。

## 适用场景

- 新增任务字段（如 `dueDate`、`type`、`finalSummary`）
- 新增里程碑字段或配置项
- 新增任务元数据（如 `ordinal`、`references`、`modifiedFile`）
- 任何需要同时影响「数据模型 → 持久化 → 展示 → AI 接口」的功能

## 标准步骤

| 顺序 | 层级 | 典型文件 | 关键检查点 |
|---|---|---|---|
| 1 | **Types / 领域模型** | `src/types/index.ts` | 字段是否加入 `Task`、`TaskCreateInput`、`TaskUpdateInput`、`Milestone`、`BacklogConfig` |
| 2 | **Markdown 持久化** | `src/markdown/parser.ts`、`serializer.ts`、`section-titles.ts`、`structured-sections.ts` | 新字段是 frontmatter 还是结构化章节？frontmatter 用 snake_case，章节需更新 `section-titles.ts` |
| 3 | **文件系统层** | `src/file-system/operations.ts` | 创建/更新/加载时是否传递新字段 |
| 4 | **Core 业务逻辑** | `src/core/backlog.ts` | `createTaskFromInput`、`applyTaskUpdateInput` 是否正确传递；是否需处理空值/清除逻辑 |
| 5 | **CLI / TUI** | `src/cli.ts`、`src/commands/task-wizard.ts`、`src/types/task-edit-args.ts`、`src/utils/task-edit-builder.ts` | 新增 flags 是否注册到 Commander；交互向导是否提示；`--clear-*` 是否支持 |
| 6 | **Plain Text Formatter** | `src/formatters/task-plain-text.ts` | `--plain` 输出是否展示新字段 |
| 7 | **Server API** | `src/server/index.ts` | `handleCreateTask`、`handleUpdateTask` 是否转发新字段 |
| 8 | **Web UI** | `src/web/components/*.tsx` | 弹窗表单、卡片、设置页是否展示和编辑 |
| 9 | **MCP Tools** | `src/mcp/tools/*/handlers.ts`、`src/mcp/utils/schema-generators.ts` | JSON Schema 是否包含；handlers 是否透传 |
| 10 | **i18n** | `src/web/locales/{en,ja,zh-CN,zh-TW}.ts` | 4 语言键是否完整；tooltip 是否单语言 |
| 11 | **测试** | 各层对应测试文件 | 解析/序列化 round-trip、CLI 集成、MCP 工具、Web 端点 |
| 12 | **文档 / Agent 指南** | `src/guidelines/agent-guidelines.md`、MCP guides、README | Agent 是否知道新字段存在；CLI 命令参考是否更新 |

## 常见陷阱

| 陷阱 | 示例 | 预防 |
|---|---|---|
| **遗漏 TUI 或 MCP** | BACK-367 初始遗漏 TUI，后续补了 `.04`；BACK-355 遗漏 MCP，补了 `.03` | 按 checklist 逐层勾选，不把「最后两个表面」留到事后 |
| **大小写敏感 ID 比较蔓延** | BACK-490 发现 `task-1` vs `TASK-1` 导致阻塞任务检测失效 | 任何涉及 ID 比较的代码路径优先使用 `taskIdsEqual()` |
| **i18n tooltip 混排** | 中文 tooltip 里夹杂英文短语 | 每种语言的 tooltip 必须是完整单语句子 |
| **React stale state 覆盖未保存编辑** | BACK-357 Web UI 保存后 `editingTask` 未同步刷新数据 | 使用 `pendingEditingTaskSyncRef`，仅在显式保存后同步，非后台刷新 |
| **Section overwrite** | BACK-108 更新 description 时误覆盖整个 AC 区块 | 为每个结构化章节创建独立的 `updateXxxSection()` serializer 辅助函数 |
| **硬编码默认值绕过配置** | BACK-187 `core.createDocument(document, true, ...)` 中硬编码 `true` 覆盖了用户 `autoCommit` 配置 | 传 `undefined` 让 Core 层读取配置决定 |

## 参考任务

- [[sources/due-date-fields-task]] — BACK-401，最完整的 12 层全遍历示例（含里程碑序列化与 Agent 指南）
- [[sources/back-489-health-indicators-task]] — BACK-489，基于已有字段构建派生统计的变体
- [[sources/back-490-overview-command-task]] — BACK-490，纯 read-only 跨表面消费的示例
