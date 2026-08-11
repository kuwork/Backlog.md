---
title: doc-5 A 类上游任务迁移分析报告
labels: [source, doc, migration]
created_date: '2026-08-09 00:00'
updated_date: '2026-08-09 00:00'
source_path: backlog/docs/migration/doc-5 - A类上游任务迁移分析报告.md
---

# doc-5 A 类上游任务迁移分析报告

对 doc-4 中 A 类（必须合入）各项做逐项迁移深析。

## 核心内容

逐项给出「核心目的 / 变更 / 交集风险 / 适合迁移 / 排除调整 / 优先级 / 建议」。

**可直接复用**：A4（config block-style YAML list）、A7（ordinal-only 重排）、A8（保留 Web draft）、A9（文档 hash 链接）。

**需参考重写**：A2、A3、A5、A10（因当前 fork 有自定义前缀、零填充、跨分支解析、本地时区等结构）。

## 关键决策

- **A1（BACK-355 类型字段）**：用户决策放弃（2026-08-09）——单选 type 会边缘化 label 分类
- **A2（重复 ID）与 A5（ContentStore 守卫）**：最高优先级数据完整性短板
- **A3**：与上游语义偏离——fork 保持 `--ac`/`--acceptance-criteria` 别名累加，仅引入 `--clear-ac` 与 MCP `acceptanceCriteriaClear`（对应 BACK-537）

## 迁移任务映射

A2→BACK-538、A3→BACK-537、A4→BACK-533、A5→BACK-540、A7→BACK-534、A8→BACK-535、A9→BACK-536、A10→BACK-550。

## Related Concepts
- [[concepts/core-architecture]] — fork 定制结构
- [[concepts/cli-entry]] — 迁移涉及 CLI

## Related Sources
- [[sources/doc-4-upstream-migration-classification]] — 分类入口
- [[sources/back-538-duplicate-task-id-recovery]] — A2
- [[sources/back-540-content-store-stale-refresh-guard]] — A5
