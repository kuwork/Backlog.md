---
title: doc-4 上游 v1.47.1→v1.48.0 迁移差异分类
labels: [source, doc, migration]
created_date: '2026-08-09 00:00'
updated_date: '2026-08-09 00:00'
source_path: backlog/docs/migration/doc-4 - Upstream-v1.47.1-to-v1.48.0-Migration-Diff-Classification.md
---

# doc-4 上游变更差异分类（v1.47.1 .. v1.48.0）

上游 `MrLesk/Backlog.md` v1.47.1..v1.48.0 变更的 A/B/C 差异分类文档，是 fork 迁移决策的入口。

## 分类框架

- **A类（必须合入）**：安全漏洞、关键 bug 修复、当前 fork 已规划但尚未实现的核心功能
- **B类（评估合入）**：新功能、非核心优化，需用户确认是否与当前 fork 定制冲突
- **C类（跳过）**：与当前 fork 演进方向冲突、上游特有方向、或无关的改动

## A类（必须合入，9 项有效）

| 条目 | 上游任务 | 描述 | 迁移任务 |
|---|---|---|---|
| A2 | BACK-516 | 重复任务 ID 检测与修复 | BACK-538 |
| A3 | BACK-537 | AC/DoD 确定性编辑 | BACK-537 |
| A4 | BACK-540 | 修复 config.yml block-style YAML list | BACK-533 |
| A5 | BACK-533 | 防止陈旧 ContentStore 刷新覆盖 | BACK-540 |
| A7 | BACK-518 | ordinal-only 重排不更新 updated_date | BACK-534 |
| A8 | BACK-429 | 保留未保存 Web draft 跨刷新 | BACK-535 |
| A9 | BACK-426 | 修复文档内 markdown hash 链接 | BACK-536 |
| A10 | BACK-240 | 修复 Apple Silicon 二进制解析 | BACK-550 |

（原 A1 类型字段、原 A5/A7/A11 已移入 C 类）

## B类（评估合入，12 项）

| 条目 | 上游任务 | 描述 | 迁移任务 |
|---|---|---|---|
| B3 | BACK-532 | --exclude-status 过滤 | BACK-548 |
| B4 | BACK-531 | 看板创建日期排序 | BACK-541 |
| B5 | BACK-527 | 任务列表 ordinal 排序 | BACK-542 |
| B6 | BACK-427 | 未分配任务过滤 | BACK-551 |
| B7 | BACK-523 | doc view --plain | BACK-552 |
| B8 | BACK-466 | 隐藏空状态列 | BACK-549 |
| B10 | BACK-525 | Browser UI 构建现代化 | BACK-553 |
| B11 | BACK-529 | 标签过滤字母排序 | BACK-546 |
| B12 | BACK-526 | 里程碑列表 Created 列 | BACK-543 |
| B13 | BACK-517 | 任务详情显示 AC 序号 | BACK-544 |

（原 B1/B2/B8/B9 已移入 C 类）

## C类（跳过，18 项）

移除 sequences、README landing、测试可靠性、CI 加速、agent 指南、npx 文档、反引号转义、issue-first PR、UTC 日期显示、自定义优先级、dateFormat、深度链接、类型字段等——均因"fork 已含该能力、与定制冲突或方向无关"而跳过。

## Related Concepts
- [[concepts/core-architecture]] — fork 定制结构
- [[concepts/mcp-server]] — fork MCP 演进

## Related Sources
- [[sources/doc-5-a-class-migration-analysis]] — A 类深析
- [[sources/doc-6-b-class-migration-analysis]] — B 类深析
- [[sources/back-538-duplicate-task-id-recovery]] — A2
- [[sources/back-553-modernize-browser-bundling]] — B10
