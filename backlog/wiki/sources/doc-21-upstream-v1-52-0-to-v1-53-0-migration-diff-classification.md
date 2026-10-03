---
title: doc-21 - Upstream v1.52.0 to v1.53.0 Migration Diff Classification
labels:
  - source
  - migration
  - cli
created_date: '2026-10-03 01:10'
updated_date: '2026-10-03 01:10'
source_path: backlog/docs/migration/doc-21 - Upstream-v1.52.0-to-v1.53.0-Migration-Diff-Classification.md
---

# doc-21 Upstream v1.52.0 to v1.53.0 Migration Diff Classification

上游 `MrLesk/Backlog.md` `v1.52.0..v1.53.0` 范围（8 commits）的差异分类报告，沿用 doc-12 的分类口径（A 类仅限安全漏洞/严重性能/共用模块关键缺陷，新增能力归 B 类）。初筛与深度分析之间无升降档。范围之外：tag 之后 upstream/main 又前进 11 个提交，按定案留待下一波。

范围仅 3 条真实条目：CLI-1（BACK-687 给 7 个列表命令加 grep 风格 `--max-count/--skip/--count` 分页窗口，新增 `src/utils/list-window.ts` 214 行，终态是三条线性提交 `26c897d4`）判 **B 类**（agent 契约净增量，非缺陷修复）；SRV-1（BACK-688 启动方退出即停 watcher，孤儿进程无限运行）与 SRV-2（BACK-689 空闲 watcher 降 CPU，签名 stat 替代每秒全读，645 条目仓库 35.8%→0.68%）判 **A 类**。关键血缘：两条 watch 修复都建立在 BACK-686 watch 管线上，该管线已由 fork 的 BACK-657 迁移落地，且 fork 的 `watch-json.ts` 与上游逐字节一致——缺陷原样存在，两条 A 类可近乎直接复用（SRV-2 强依赖 SRV-1，同一行 setInterval 的连续演进）。

数据质量备注：BACK-687 的三个提交是一条线性链非重复；已追窗口内后续提交确认每条描述的都是终态形态。迁移任务已全部升级完成：CLI-1 → BACK-741、SRV-1 → BACK-743、SRV-2 → BACK-744（三条上游 draft 随 promote 删除），状态均 Done。另有 4 个 chore/数据维护提交跳过（版本同步在 tag 后、上游数据维护、删 legacy skill 与 fork 自建同名不等形）。

## Related Concepts
- [[concepts/upstream-migration]] — 本报告是 fork 持续跟踪上游发布序列的一轮分类
- [[concepts/cli-entry]] — CLI-1 的七个列表命令与 `--limit` 静默截断问题属 CLI 契约层
- [[concepts/json-output]] — watch 管线输出 JSON 流，SRV-1/2 修复的是其进程生命周期与空闲开销

## Related Sources
- [[sources/doc-22-upstream-v1-52-0-to-v1-53-0-migration-analysis-by-domain]] — 本报告全部条目的逐条深度分析（按领域）
- [[sources/doc-12-upstream-v1-50-1-to-v1-52-0-migration-diff-classification]] — 上一轮（v1.50.1..v1.52.0）分类，口径与本报告一致
- [[sources/back-657-task-list-json-watch]] — BACK-686 watch 管线在 fork 侧的落地任务，SRV-1/2 的依赖基础
