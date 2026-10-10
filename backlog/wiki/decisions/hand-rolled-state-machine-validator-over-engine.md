---
title: 自研零依赖状态机校验器而非引入引擎
labels: [decision, state-machine, dependencies, core]
created_date: 2026-10-03 01:25
updated_date: 2026-10-09 23:30
---

# 自研零依赖状态机校验器而非引入引擎

## 背景

doc-17 诊断：`statuses` 只是显示层列定义，终态靠"数组最后一个元素"、进行中靠硬编码 `"inprogress"` 推断，自定义状态列下两条约定静默失效。方案需要六类 `category`（initial/active/wip/blocked/done/dropped）、挂 `when/requires/ai/evidence` 的转换边、四档 AI 权限（allowed/allowed_if/propose/forbidden），以及 AI 可读的机器指引资源。

## 决定

状态机语义层（doc-17 方案 B/C）采用自研约 150 行零依赖实现（`src/core/state-machine.ts`），不引入 XState 等现成状态机引擎。条件是"校验器 + 解释器"：校验转换合法性、列出出边条件与 AI 权限、产出教学式报错——而不是驱动流程执行的引擎。

- 自研 ~150 行、零依赖，落在 core 层（`src/core/state-machine.ts`）
- 条件求值用声明式子集而非表达式引擎
- 由 doc-19 PRD 落地默认七列状态机（三审查点落位、可重置、指引优先），BACK-715~721 完成编辑器与指引注入

## 被否方案

- **XState 等现成引擎**：只覆盖需求的前 30%（A–C 档）；核心的"列出出边条件权限"（E）与"教学式报错"（F）没有任何引擎提供，为 30% 的需求背上表达式引擎和运行时依赖不划算
- **表达式引擎求值转换条件**：改用声明式子集（when/requires 字段），避免引入表达式解析与求值的攻击面与复杂度

## 代价

- 自行承担状态机语义的全部维护责任（转换校验、报错文案、指引生成）
- 与生态（可视化、测试工具）不互通

## Related Concepts

- [[concepts/state-machine]] — 状态机语义与校验概念页

## Related Sources

- [[sources/doc-17-state-machine-semantics-diagnosis]] — 引擎选型结论的出处（"要的是校验器+解释器而非执行引擎"）
- [[sources/doc-19-default-state-machine-prd]] — 自研引擎上的默认状态机 PRD
- [[sources/back-715-state-machine-editor-settings]] — 状态机编辑器落地
