---
id: doc-16
title: To-Do 任务与上游迁移(v1.47.1-v1.50.1)对照分析报告
type: other
created_date: '2026-09-07 18:57'
---

# To-Do 任务与上游迁移(v1.47.1-v1.50.1)对照分析报告

## 背景

本仓库最近完成了 3 次上游迁移，差异分类文档：

- doc-4 - Upstream-v1.47.1-to-v1.48.0-Migration-Diff-Classification
- doc-7 - Upstream-v1.48.0-to-v1.49.3-Migration-Diff-Classification
- doc-9 - Upstream-v1.49.3-to-v1.50.1-Migration-Diff-Classification

迁移中上游功能以 BACK-5xx/6xx 迁移任务合入（绝大多数已 Done），而 backlog 中一部分 BACK-4xx 原始功能任务从未被关闭。本报告将当时全部 To Do 任务与迁移实现逐一对照，并在 `src/` 源码中做了实际验证（非仅凭文档判断）。

## 结论总览

- 分析时 To Do 共 42 个任务
- **13 个已归档**（11 个确认已在迁移中实现 + 2 个决策跳过，含 BACK-355 的 6 个子任务共 19 个文件）
- 4 个部分实现，待人工比对验收标准
- 25 个未实现，仍需实施

## 一、已在迁移中实现 —— 已归档

| 任务 | 迁移来源 | 源码证据 |
|---|---|---|
| BACK-430 Create tasks from the TUI board | doc-7 TUI B7/B27 → BACK-563 (Done) | `src/ui/components/task-composer.ts`；`src/ui/board.ts:266,990` 接线；`src/test/tui-task-composer.test.ts` |
| BACK-427 Unassigned task filtering (CLI/MCP) | doc-4 B6 → BACK-551 (Done) | `src/cli.ts:2368` `--unassigned`；`src/mcp/tools/tasks/handlers.ts`；`src/test/mcp-tasks.test.ts` |
| BACK-429 Preserve unsaved Web drafts | doc-4 A8 → BACK-535 (Done) | `src/web/components/TaskDetailsModal.tsx:92` `preserveDirtyRefreshValue`；专项测试 |
| BACK-426 In-document markdown hash links | doc-4 A9 → BACK-536 (Done) | `src/markdown/hash-links.ts` `normalizeMarkdownHashLinks`；被 DocumentationDetail / DecisionDetail 引用 |
| BACK-240 Apple Silicon binary resolution | doc-4 A10 → BACK-550 (Done) | `scripts/resolveBinary.cjs:37-48`（Rosetta 下 arm64 优先候选）；`package.json` darwin optionalDependencies |
| BACK-257 Deep link URLs for tasks | doc-4 C17（fork 已有而跳过） | `src/web/App.tsx` `/task/:id/:title` 路由 |
| BACK-310 Strengthen workflow overview emphasis | doc-4 C6（fork 已有而跳过） | `src/guidelines/cli-instructions/overview.md:37` |
| BACK-424 Multiple status filters in Web task lists | doc-4 B3 → BACK-548 (Done) | `src/web/components/StatusFilterDropdown.tsx`（多选）；`TaskList.tsx` statusFilter: string[] |
| BACK-259 Task list filters (Status/Priority) | fork 自主实现 | `src/ui/task-viewer-with-search.ts` statusFilter/priorityFilter；BACK-399 (Done) |
| BACK-260 Web UI All Tasks filtering | fork 自主实现 | `src/web/components/TaskList.tsx` status/priority/label/milestone 过滤 + URL query 持久化 |
| BACK-415 CLI milestone create command | 已实现 | `src/cli.ts:3975`（命令名为 `milestone add` 而非 create） |

## 二、决策跳过 —— 已归档

| 任务 | 决策内容 |
|---|---|
| BACK-421 dateFormat config 行为 | 迁移时决策维持"配置存在但不生效"（doc-4 C16） |
| BACK-355 任务 type 字段（含 355.01–355.06 共 6 个子任务） | 迁移时决策放弃，避免边缘化 label（doc-4 C18）；`src/types/index.ts` 的 Task 无 type 字段 |

## 三、部分实现 —— 待人工比对验收标准

| 任务 | 已有 | 缺失 |
|---|---|---|
| BACK-218 Sequences 文档与测试 | overview.md Sequences Quick Reference；`src/test/sequences*.test.ts`（5 个文件，BACK-554 Done） | 需对照 AC 逐项确认 |
| BACK-270 任务输入防命令替换 | 指南层面已有（documents.md / decisions.md 反引号安全指引）；`src/cli.ts:550` processCliEscapes | AC#3（核查存量文件）未验证 |
| BACK-222 Web 任务/子任务可视化 | `TaskColumn.tsx` groupSubtasksUnderParents；core 侧 attachSubtaskSummaries | 展开/折叠、进度徽标"3/5"、卡片上直接建子任务等 AC 未见 |
| BACK-239 任务↔文档/决策自动链接 | `src/web/utils/task-id-links.ts:200` web markdown 中 doc-/decision- ID 自动成链 | 文档/决策页的 "Referenced by" 反向链接列表缺失 |

## 四、未实现 —— 仍需实施（25 个）

以下任务经源码验证不存在对应实现，且多数与本次迁移无关，是独立的 fork 需求：

- BACK-24.02 — TUI 交互式看板 milestone swimlanes（milestoneMode 仅作用于 piped 输出）
- BACK-200 — Claude Code init 工作流命令（装的是 project-manager-backlog agent，非 .claude commands）
- BACK-217 / 217.02 / 217.03 / 217.04 — Sequences Web UI（`src/web` 无任何 sequences 组件）
- BACK-349 — 发布为 Agent Skill（仅有 wiki skill 嵌入）
- BACK-368 — TUI section-aware navigation
- BACK-267 / BACK-268 — Agent instruction version metadata / status
- BACK-414 — Web UI 主题定制
- BACK-416 — full-content task view 输出模式
- BACK-417 — Web UI content viewer 尺寸与模式持久化
- BACK-418 — backlog browser 容器运行时（仓库无 Dockerfile）
- BACK-420 — Web UI 内容 TOC + scrollspy
- BACK-422 — XDG_CONFIG_HOME 支持
- BACK-425 — Compact TUI 任务列表视图
- BACK-428 — npx backlog.md 使用文档（draft-34 已有完整文案，可提升合入后关闭）
- BACK-438 — core 级任务漂移自动检测

## 方法说明

1. 通读 3 份迁移差异分类文档，提取已迁移/已应用功能点
2. 将 42 个 To Do 任务逐一对照功能点
3. 每个"疑似已实现"的任务在 `src/` 中 grep 实际实现并定位代码证据
4. 通过 `backlog task archive` 归档已确认的任务（不使用直接文件编辑）

## 后续建议

- 第三节 4 个任务：人工比对 AC 后决定关闭或补做
- BACK-428：提升 draft-34 后关闭
- 第四节任务保持 To Do，按优先级正常排期
