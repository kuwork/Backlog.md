---
title: Windows 上模拟 bash 双引号转义层
description: BACK-508 选择模拟 bash 行为而非引入新 API 或要求原始换行输入
labels: [decision, cli, cross-platform]
created_date: '2026-06-05 15:19'
updated_date: '2026-06-05 15:19'
---

# Windows 上模拟 bash 双引号转义层

## 背景

CLI `--description` 在 Windows 上无法通过 `\n` 输入换行，因为 Windows shell 不解释转义序列。

## 备选方案

| 方案 | 优点 | 缺点 |
|---|---|---|
| A. 模拟 bash 双引号层 + C-style 转义 | 同一命令跨平台一致；无需新 API | Windows 用户需按 bash 习惯输入反斜杠 |
| B. 引入 `--description-raw` 或文件输入 | 原始换行直接支持 | 增加 API 复杂度；用户需学习新选项 |
| C. 平台差异化文档 | 零代码改动 | 用户体验分裂；同一命令不同结果 |

## 决策

选择 **方案 A**。

理由：
1. 命令可移植性优先 — 同一命令在 Windows / macOS / Linux 产生完全相同的任务文件
2. 不增加 CLI 接口表面积
3. 代价可接受 — 需要字面 `\n` 时 Windows 用户需输入 `\\n`，属于高级用法的边际成本

## 相关来源
- [[sources/back-508-cli-description-escapes]]
