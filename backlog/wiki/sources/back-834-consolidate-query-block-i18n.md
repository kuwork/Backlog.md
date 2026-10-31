---
title: BACK-834 - 合并四个查询块 i18n 字典为共享基
labels: [source, web-ui, i18n]
created_date: 2026-10-31 23:53
updated_date: 2026-10-31 23:53
source_path: backlog/tasks/back-834 - Consolidate-the-four-query-block-i18n-dicts-into-a-shared-base.md
---

# BACK-834 - 合并四个查询块 i18n 字典为共享基

把四个近同的查询块 i18n 字典（sqlite/duckdb/cypher/mdb）合并为四个 locale 文件里各自的单一共享基对象 `queryBlock`，并把查询块的 Show/Hide 测试断言对齐用户改过的 capital-Q 文案。

## 要点

- 四个方言字典约有 31 个相同键，仅 title 不同（cypher 另加四个 graph/live 键）。现从模块级 `queryBlock` 基展开并只覆盖 title；cypher 展开后再加 `graphTooLarge`/`live`/`pauseAuto`/`resumeAuto`。
- 保留四把键（sqlite/duckdb/cypher/mdb）而非折叠成单一引用，故无组件或 `QueryBlockDict` 类型改动；合并纯结构性，每个字符串值与之前逐字节一致（git diff 确认）。
- 净减约 355 行重复文案。

## 测试错位属文案改动而非重构 bug

8 个 Show/Hide 断言期待小写 `Show query`/`Hide query`；locale 串实为 `Show Query`/`Hide Query`（大写 Q）——用户有意改过的文案。i18n 合并未动这些串，故测试更新以跟踪已发布文案。

## 边界

其它可见重复（memos/graphView/databases 的多个 Loading 变体）是刻意语境化，非重复，保留；通用动词已在 `common`、预览共享串已在 `preview.shared` 集中。

## 验证

`tsc --noEmit`、locale 文件 `biome` 干净；cypher/duckdb/sqlite 三查询块测试共 55/55。

## Related Concepts

- [[concepts/web-ui-features]] — 国际化体系
- [[concepts/sql-query-blocks]] — 查询块文案单一事实源

## Related Sources

- [[sources/back-831-localize-preview-modals]] — 文档预览本地化（同族 i18n 工作）
- [[sources/back-833-live-query-inline-sql-editor]] — 编辑器新增 edit/save/test/format 键
