---
title: decision-2 - 相对链接解析验收载体
labels: [source, decision, fixture, m-19, markdown]
created_date: 2026-11-08 23:05
updated_date: 2026-11-08 23:05
source_path: backlog/decisions/decision-2 - Relative-link-check.md
---

# decision-2 - 相对链接解析验收载体

挂在 `m-19` 下的 **decision 侧验收 fixture**，状态 `proposed`。文件自己声明「仅作链接解析的验收载体，无实际架构决策内容」—— Decision 段明确留空，Consequences 段为空。把它当作 ADR 读会误判，它是 BACK-836 / BACK-837 的可点击测试面。

## 覆盖形态

- 指向 doc 集合：`../docs/PRDS/duckdb/doc-26 - DuckDB-Explorer-演示.md` 整页与 `<...:10-50>` 区间、空标签 `[ ](/documentation/26)` 与 `/documentation/26:10-50`。
- 指向 wiki 集合：`../wiki/concepts/auto-port.md` 与 `:10-50` 变体 —— 正是 BACK-836 之前因 `decision.path` 为裸文件名而塌成死 `#` 锚点的路径。
- 含空格文件名与尖括号：wiki 验收页、带空格的 `Another Page.md`、带全角冒号的 doc-20、doc-26，全部 `:N-M` 区间。

与 doc-34、wiki 验收页互相引用，构成三向验证：同一个渲染基准 bug 在三种集合上表现不同，需要三个 fixture 才能证明边界转换在每侧都做对了。

## 验证价值

BACK-836 的 CDP 验收以本页六条链接对照 doc-34，要求两页锚点完全一致、四个本地文件链接与带范围实体链接打开同一预览、普通实体链接跳同一规范 URL；编辑态两页都把 `[](/documentation/26)` tokenise 成 `mdlink`。BACK-837 又用它验证 decision → wiki 与 decision → doc 的跨集合 join。

## Related Concepts

- [[concepts/relative-reference-resolution]] — collectionProjectPath 边界转换
- [[concepts/web-ui-features]] — 跨页面统一的 Markdown 点击契约

## Related Sources

- [[sources/back-836-decision-relative-reference-resolution]] — decision 侧修复
- [[sources/back-837-wiki-relative-references-entity-links]] — 三向验证
- [[sources/doc-34-relative-link-check]] — doc 侧 fixture
- [[sources/m-19-fix-relative-reference-resolution]] — 所属里程碑
