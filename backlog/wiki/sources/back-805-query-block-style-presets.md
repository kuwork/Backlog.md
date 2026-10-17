---
title: BACK-805 - 查询块 style 字段三预设并回灌 SQL 块
labels: [source, web-ui, docs]
created_date: 2026-10-18 01:00
updated_date: 2026-10-18 01:00
source_path: backlog/tasks/back-805 - Query-block-style-field-three-presets-backfilled-to-SQL-blocks.md
---

# BACK-805 - 查询块 style 字段三预设并回灌 SQL 块

**状态**: Done（字段后被 BACK-811 移除） | **里程碑**: m-15 | **依赖**: BACK-802

引入 `style` 字段（`compact` / `striped` / `borderless`，空格分隔可组合）作为样式通用化的开端，并回灌给 `sqlite-query` / `duckdb-query`，使其成为三块共享能力而非 Cypher 私有。

## 关键实现

- **解析**：`parseQueryBlock` 新增 `QueryBlockStyle` 与 `style` 字段，多值小写去重；非法 token **静默丢弃**（装饰性字段，与 fail-closed 的 `view`/`refresh` 刻意不同），全非法则不产生 style 键。`KNOWN_STYLES` 放在共享解析器里，三个薄壳零改动继承。
- **渲染**：`SqlQueryBlock` 把 style 映射为既有 Tailwind 组合（compact 收紧字号内边距、striped 斑马行、borderless 去边框），全部带 `dark:` 变体；`view=graph` 忽略；默认（不写 style）类名与改动前逐字节一致。

## 踩到的构建坑（对后续有长期影响）

`bun-plugin-tailwind@0.1.2` 的 dev-server 路径（`bunfig [serve.static]`）会**静默丢弃所有含 `:` 或 `.` 的 Tailwind 候选**，因此变体类与分数值在 `bun run src/cli.ts browser` 下没有规则，而生产 `Bun.build` 不受影响。

- 直接后果：预设改为裸工具类 + JS 行奇偶/末行条件，取代 `odd:` / `last:` 变体与 `py-0.5`。
- 连带放弃：斑马纹的 `dark:` 孪生色（`dark:bg-blue-950/40`）——插件已 sunset，追它超出范围。
- 更远的后果：该字段后来被证明在真实级联下根本不生效，见 BACK-811。

## Related Concepts

- [[concepts/sql-query-blocks]] — 被回灌的 SQL 块
- [[concepts/markdown-pipeline]] — 未分层 CSS 压过 Tailwind 工具类的级联问题（BACK-811 的根因）

## Related Sources

- [[sources/back-802-cypher-query-block-core]] — 前置：块核心
- [[sources/back-811-remove-style-field-add-highlight]] — 本字段的移除（含级联根因）
