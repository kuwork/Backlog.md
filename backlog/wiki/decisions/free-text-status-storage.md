---
title: 决策状态值自由文本存储，不做固定集校验
description: BACK-635 让 status 原样落盘，canonical 值只是文档与 UI 默认
labels: [decision, decisions, cli, mcp, web-ui]
created_date: '2026-09-26 14:45'
updated_date: '2026-09-26 14:45'
---

# 决策状态值自由文本存储，不做固定集校验

## Context

BACK-635 把 decision 状态编辑铺到 CLI/MCP/Web 三个面。需要决定状态值是否限定在 proposed/accepted/rejected/superseded 的固定集合内。

## Decision

状态值**自由文本、原样存储**，不做固定集校验。canonical 四值只作为文档记录与 UI 默认值存在：web 的状态下拉列出 canonical 值**外加**记录里已存的任何非 canonical 值；CLI 的 `--status` 是 free-form（文档列出建议值）。理由与任务状态一致——本仓库允许自定义状态工作流，校验只会让旧记录和非标准流程不可写。

## Rejected alternatives

- 固定集校验——与任务状态的既有自由语义矛盾，且会把已有非 canonical 值的记录变成不可保存
- 写入时规范化大小写/映射——静默改写用户输入，违背"原样存储"

## Related Sources

- [[sources/back-635-decision-status-editing]] — 本决策的落地
- [[sources/back-636-decision-status-i18n]] — 非 canonical 值在 UI 的回退渲染（首字母大写原样）
- [[sources/back-633-decision-editing-web-ui]] — 使编辑可达的前置任务
