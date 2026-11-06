---
id: decision-2
title: Relative link check
date: '2026-11-06 14:44'
status: proposed
---

## Context

> 本文件是「相对链接解析」功能的 **decision 侧验收 fixture**，挂在 `m-19` 里程碑下。
> 它与 wiki 验收页（`backlog/wiki/test/back-837 - Link-Check.md`）和 doc 验收页（`backlog/docs/PRDS/RelativeLink/doc-34 - Relative-Link-Check.md`）互相交叉引用，形成 wiki ↔ doc ↔ decision 三向验证。
> 下面的链接即为验收证据：验证 decision 页面对 doc / wiki 跨集合相对链接、含空格文件名、尖括号语法与行号区间的解析。

指向 doc 集合（完整页与局部区间）：

[duckdb](../docs/PRDS/duckdb/doc-26 - DuckDB-Explorer-演示.md)

[](/documentation/26)

[duckdb:10-50](<../docs/PRDS/duckdb/doc-26 - DuckDB-Explorer-演示.md:10-50>)

[document](/documentation/26:10-50)

指向 wiki 集合：

[auto-port](../wiki/concepts/auto-port.md)

[auto-port:10-50](../wiki/concepts/auto-port.md:10-50)

## 含空格文件名与尖括号

[wiki 验收页](<../wiki/test/back-837 - Link-Check.md:3-8>)

[Another Page](<../wiki/test/Another Page.md:3-8>)

[doc-20 全角冒号](<../docs/memos/doc-20 - 快速笔记：Memos-集成.md:10-20>)

[doc-26](<../docs/PRDS/duckdb/doc-26 - DuckDB-Explorer-演示.md:10-50>)

## Decision

（本 decision 仅作链接解析的验收载体，无实际架构决策内容。）

## Consequences
