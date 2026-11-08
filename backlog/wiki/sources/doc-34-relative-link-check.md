---
title: doc-34 - 相对链接解析验收页
labels: [source, doc, fixture, m-19, markdown]
created_date: 2026-11-08 23:05
updated_date: 2026-11-08 23:05
source_path: backlog/docs/PRDS/RelativeLink/doc-34 - Relative-Link-Check.md
---

# doc-34 - 相对链接解析验收页

挂在 `m-19` 下的 **doc 侧验收 fixture**，与 wiki 验收页（`backlog/wiki/test/back-837 - Link-Check.md`）、decision 验收页（`decision-2`）互相引用，形成 wiki ↔ doc ↔ decision 三向验证。它本身不含需求描述，价值在于把 BACK-835~837 的解析契约变成可复现的点击清单。

## 覆盖的链接形态

- **doc 集合内**：相对路径整页 `../duckdb/doc-26 - ...md`、`路径:10-50` 局部区间、空标签 `[ ](/documentation/26)` 只渲染实体链接不显文字、`/documentation/26:10-50` 实体短链带范围。
- **跨集合到 wiki**：`../../../wiki/concepts/auto-port.md` 及 `:10-50` 变体 —— 这是 BACK-835 join 基准深度不足时最先塌成 `#` 的路径。
- **含空格文件名 + 尖括号**：指向 decision-2、wiki 验收页、带空格的 `Another Page.md`、带**全角冒号**的 `doc-20 - 快速笔记：...md`，全部用 `<...>` 包裹并带 `:N-M` 行区间，同时验证 BACK-837 的扩展名锚定范围切分与 `encodePath` 单次编解码。

## 判定意义

BACK-835 的端到端验收记录：新鲜 Web 构建里这四条相对链接在查看态解析到真实项目路径，编辑态四条全部渲染为蓝色（`mdlink` overlay）。BACK-836 / BACK-837 的 CDP 点击验收也以本页六条链接为基准，要求 doc 与 decision 两页产生完全一致的锚点与预览行为。

## Related Concepts

- [[concepts/relative-reference-resolution]] — 被验证的两阶段解析契约
- [[concepts/markdown-pipeline]] — 尖括号目标与编辑态高亮

## Related Sources

- [[sources/back-835-unify-relative-reference-resolution]] — 主实现
- [[sources/back-837-wiki-relative-references-entity-links]] — 三向验证的 wiki 侧
- [[sources/decision-2-relative-link-check]] — decision 侧 fixture
- [[sources/m-19-fix-relative-reference-resolution]] — 所属里程碑
