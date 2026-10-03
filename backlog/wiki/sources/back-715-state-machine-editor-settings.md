---
title: BACK-715 - Add a state machine editor to the settings page
labels:
  - source
  - feature
  - web-ui
created_date: '2026-10-03 01:10'
updated_date: '2026-10-03 01:14'
source_path: backlog/tasks/back-715 - Add a state machine editor to the settings page.md
---

# BACK-715 - Add a state machine editor to the settings page

本任务按 doc-19 PRD 在 Web 设置页新增"状态机编辑器"，使 `backlog/config.yml` 中对象形式的 `statuses` 配置可以可视化维护（此前只能手工编辑 YAML）。编辑器为左右布局：左侧是状态卡片列表，可增删改状态（name/category/exit）及每个状态的 `next` 迁移边（to/when/ai/if/requires/evidence）；右侧是以 initialStatus 为根、沿 `next` 递归展开的 Mermaid 实时预览树，回边与环降级为虚线回引、不会无限展开。

脏状态恢复提供两个语义严格区分的按钮：Reset 仅在有任何左侧改动后出现，点击丢弃未保存修改并从 config.yml 重新加载当前内容（绝不覆盖）；Default 用 doc-19 内置的七列默认状态机整体替换当前配置（相当于恢复出厂值）。编辑器只声明不强制（M1 原则），可以展示 FR-6 lint 警告但绝不阻止保存。

实现分五块落地：新增 `src/core/state-machine.ts`（对象形式类型、DEFAULT_STATE_MACHINE 七列默认、compileStateMachine()、statusNames() 名称垫片、hiddenStatusNames()）；`src/file-system/operations.ts` 修复旧 serializeConfig 把对象 String() 成 `[object Object]` 的 bug 并支持 display 字段往返；服务器新增 PUT/POST `/api/config/statuses` 并在保存后广播 `config-updated`（修复此前广播 tasks-updated 导致看板列与终态 stale 的 bug）；Web 端新增 StateMachineEditor.tsx、终态多选、可切换 Tab 布局与 display 字段（预设中 Dropped 为 display:false）。

下游对齐是难点：`backlog init` 首次初始化直接写入七列对象形式（重初始化保留现有 statuses）；TUI 看板通过共享 buildColumns 与 dropHiddenTasks 同时过滤列和任务以支持 display:false；CLI/MCP 的终态判定从 statusNames() 改为按 category 判断（修复七列下 Done 任务无法 complete、依赖闭包把 Done 当未完成的缺陷）；help-schema 的同步 YAML 解析器改为只取顶层 `- name:` 项，使 `--help` 输出裸状态名。

## Related Concepts
- [[concepts/web-ui-features]] — 设置页编辑器、看板隐藏列与终态多选属于 Web UI 功能体系
- [[concepts/task-lifecycle]] — 状态机的 category/exit/next 定义了任务生命周期与终态语义
- [[concepts/core-architecture]] — state-machine.ts 编译器与 statusNames() 垫片是 core 层新基础设施
- [[concepts/state-machine]] — 对象形式 statuses 语义、默认七列机器与设置页编辑器所属概念

## Related Sources
- [[sources/back-549-hide-empty-board-columns]] — 隐藏空列逻辑在对象形式下与 display:false 的交互
- [[sources/back-716-state-machine-guidance-overviews]] — 同一状态机的 AI 指引注入与运行时渲染（本任务的下游）
- [[sources/back-717-settings-page-reorder]] — 对设置页状态机卡片位置的后续调整
