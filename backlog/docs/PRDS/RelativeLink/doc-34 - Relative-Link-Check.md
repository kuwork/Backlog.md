---
id: doc-34
title: Relative Link Check
type: other
created_date: '2026-11-06 01:34'
updated_date: '2026-11-07 01:51'
---

> 本文件是「相对链接解析」功能的 **doc 侧验收 fixture**，挂在 `m-19` 里程碑下。
> 它与 wiki 验收页（`backlog/wiki/test/back-837 - Link-Check.md`）和 decision 验收页（`backlog/decisions/decision-2 - Relative-link-check.md`）互相交叉引用，形成 wiki ↔ doc ↔ decision 三向验证。
> 本页重点验证：doc 页面对其它集合（doc / wiki / decision）的相对链接、含空格文件名、尖括号语法与行号区间能否正确解析与预览。

## 指向 doc 集合

完整页用相对路径；局部区间用 `路径:行-行`；空标签 `[ ](/documentation/26)` 只渲染实体链接、不显示文字。

[duckdb](../duckdb/doc-26 - DuckDB-Explorer-演示.md)

[](/documentation/26)

[duckdb:10-50](<../duckdb/doc-26 - DuckDB-Explorer-演示.md:10-50>)

[document](/documentation/26:10-50)

## 指向 wiki 集合

[auto-port](../../../wiki/concepts/auto-port.md)

[auto-port:10-50](../../../wiki/concepts/auto-port.md:10-50)

## 含空格文件名与尖括号（跨集合）

以下目标文件名均含空格，必须用尖括号 `<...>` 包裹；行号区间与跨集合 `../` 同样适用。

[decision-2](<../../../decisions/decision-2 - Relative-link-check.md:1-12>)

[wiki 验收页](<../../../wiki/test/back-837 - Link-Check.md:3-8>)

[Another Page](<../../../wiki/test/Another Page.md:3-8>)

[doc-20 全角冒号](<../../../docs/memos/doc-20 - 快速笔记：Memos-集成.md:10-20>)
