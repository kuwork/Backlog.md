---
title: Wiki 相对链接验收页
labels:
  - test
  - markdown
created_date: '2026-11-07 01:05'
---

# Wiki 相对链接验收页

> 本文件是「相对链接解析」功能的 **测试 fixture（验收样例）**，挂在 `m-19` 里程碑下。
> 它从 wiki 集合内部发起对三类目标的相对链接，用来人工或端到端验证 wiki 页面能否正确解析并预览这些链接。覆盖的边界：
> - **含空格的文件名**（如 `doc-26 - DuckDB-Explorer-演示.md`）
> - **CommonMark 尖括号语法** `<...>`（用于文件名里有空格或冒号时）
> - **行号区间后缀** `:行-行`（只加载指定行）
> - **实体短链** `/documentation/:id`、`/decisions/:id`、单数别名 `/decision/:id` 与 `/wiki/...`
>
> 同组还配套下面两个文件，三者互相交叉引用，形成 **wiki ↔ doc ↔ decision 三向验证**：
> - `backlog/docs/PRDS/RelativeLink/doc-34 - Relative-Link-Check.md`（doc 侧验收页）
> - `backlog/decisions/decision-2 - Relative-link-check.md`（decision 侧验收页）
> - `backlog/wiki/test/Another Page.md`（本页 `:3-8` 区间加载的目标兄弟页）
>
> 另有「Wiki 链接（wikilink 弹窗）」一节专门对比两种点击行为：`[[...]]` wikilink **保持弹窗预览**（可选 `:行-行` 区间），而显式 `[文本](/wiki/...)` markdown 链接**切换页面**（SPA 路由）。同节每条 wikilink 都复刻了上方某个显式链接的同一目标，便于直观对照。

## Doc 目标：含空格文件名与尖括号

每组一条，演示同一目标的不同写法：完整页 / 行号区间 / 全角冒号文件名 / 裸空格对照 / 绝对项目路径。

[doc-26 完整页](<../../docs/PRDS/duckdb/doc-26 - DuckDB-Explorer-演示.md>)

[doc-26 局部 10-50](<../../docs/PRDS/duckdb/doc-26 - DuckDB-Explorer-演示.md:10-50>)

[doc-20 全角冒号](<../../docs/memos/doc-20 - 快速笔记：Memos-集成.md:10-20>)

[doc-26 裸空格对照](../../docs/PRDS/duckdb/doc-26 - DuckDB-Explorer-演示.md)

[doc-26 绝对项目路径](</backlog/docs/PRDS/duckdb/doc-26 - DuckDB-Explorer-演示.md:10-50>)

[doc-34 新位置](<../../docs/PRDS/RelativeLink/doc-34 - Relative-Link-Check.md:3-8>)

## Decision 目标：含空格文件名与尖括号

[decision-2 完整页](<../../decisions/decision-2 - Relative-link-check.md>)

[decision-2 局部 1-12](<../../decisions/decision-2 - Relative-link-check.md:1-12>)

[decision-1 完整页](<../../decisions/decision-1 - Use-Tailwind-CSS-v4-for-web-UI-development.md>)

[decision-2 裸空格对照](../../decisions/decision-2 - Relative-link-check.md)

## Wiki 兄弟页：含空格文件名与尖括号

指向同集合的 `Another Page.md`，验证 wiki 内部兄弟页的 `:3-8` 局部加载。

[Another Page 完整](<./Another Page.md>)

[Another Page 局部 3-8](<./Another Page.md:3-8>)

[Another Page 裸空格对照](./Another Page.md)

## 实体短链

验证 `/documentation/:id`、`/decisions/:id`、单数别名 `/decision/:id` 与 `/wiki/...` 的跳转 / 弹窗。

[doc-34 实体页](/documentation/34)

[decision-2 实体页](/decisions/2)

[decision-2 单数别名](/decision/2)

[wiki 概念页](/wiki/concepts/asset-management)

## Wiki 链接（wikilink 弹窗）

`[[...]]` 是真正的 wikilink，渲染时带 `data-wikilink="true"`；它与上方「实体短链」里的显式 `/wiki/...` markdown 链接指向**同一目标**但行为不同：

- **wikilink `[[...]]`** → 点击**保持弹窗预览**，可选 `:行-行` 区间只加载指定行。
- **显式 `[文本](/wiki/...)`** → 点击**切换页面**（SPA 路由，BACK-837 细化行为）。

下面每条都复刻了上方某个显式链接的目标，用来对比两种点击行为。

[[test/Another Page]]

[[test/Another Page|兄弟页（别名）]]

[[test/Another Page:3-8]]

[[concepts/asset-management]]
