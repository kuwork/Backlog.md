---
title: 复用 processCliEscapes 处理 plan、notes 与 finalSummary
description: BACK-527 选择将现有 processCliEscapes 辅助函数扩展到 plan/notes/finalSummary，而非新增独立转义逻辑
labels: [decision, cli, cross-platform, reuse]
created_date: '2026-07-14 07:14'
updated_date: '2026-07-14 07:14'
---

# 复用 processCliEscapes 处理 plan、notes 与 finalSummary

## 背景

BACK-508 为 `--description` 引入了 `processCliEscapes`，实现跨平台一致的 `\n` 换行输入。`--plan`、`--notes`、`--final-summary` 同样需要多行输入，但最初直接保存字面量 `\n`。

## 备选方案

| 方案 | 优点 | 缺点 |
|---|---|---|
| A. 复用 `processCliEscapes` | 行为一致；无需新增辅助函数；维护成本低 | 无显著缺点 |
| B. 为 plan/notes/finalSummary 各自实现独立转义 | 可针对各字段定制 | 重复代码；行为可能不一致 |
| C. 要求用户通过文件或交互式编辑器输入多行 | 避免转义问题 | 增加使用门槛；破坏非交互/自动化场景 |

## 决策

选择 **方案 A**。

理由：
1. 同一转义语义应在所有自由文本 CLI 选项中保持一致
2. `processCliEscapes` 已经过 BACK-508 的跨平台测试验证
3. 只需在 `task create` 和 `task edit` 的对应字段调用同一函数

## 应用范围

- `task create --plan` / `--notes` / `--final-summary`
- `task edit --plan` / `--notes` / `--final-summary`

## 相关来源
- [[sources/back-527-cli-escape-sequences-for-plan-notes-summary]]
- [[sources/back-508-cli-description-escapes]]
