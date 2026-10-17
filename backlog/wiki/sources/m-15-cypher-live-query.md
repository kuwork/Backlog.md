---
title: m-15 - Cypher Live Query 里程碑
labels: [source, milestone, cypher, graph, web-ui]
created_date: 2026-10-18 01:00
updated_date: 2026-10-18 01:00
source_path: backlog/milestones/m-15 - cypher-live-query.md
---

# m-15 - Cypher Live Query 里程碑

**周期**: 2026-10-16 16:17 → 2026-10-17 00:09 | **设计文档**: doc-27

交付 `cypher-query` 围栏代码块：在任意文档的阅读视图执行只读 Cypher，支持 `table` / `list` / `value` / `graph` 四视图、`refresh: auto` 真实时刷新与块级 `style` 预设。行数上限来自 `queryMaxRows` 配置键，而非硬编码常量。

## 任务分解

| 任务 | 内容 |
|---|---|
| BACK-802 | 块解析 + 服务端路由 + 文本三视图 + `QueryBlock` 泛化 |
| BACK-803 | `view: graph` 与图例配置集成 |
| BACK-804 | `refresh: auto` 订阅 `graph-updated` |
| BACK-805 | `style` 三预设并回灌 SQL 块 |

## 标志性结论

- 共享内核泛化成功：`QueryEngineConfig` 以五个差异项（引擎 id / i18n 命名空间 / api 方法 / 动作按钮 / 可用视图集合）吸收引擎差异，SQL 两块既有 27 个测试**未改一字通过**，逐字节不变。
- `refresh: auto` 是 Cypher 相对 SQL 的**唯一差异化能力**——图库有 `graph-updated` 热更新广播，磁盘文件没有。
- `style` 字段在里程碑内交付、里程碑后被推翻（BACK-811）：预览 CSS 未分层导入压过所有 Tailwind 工具类，预设在像素上不生效，jsdom 测试只断言类名所以测试绿而效果无——用户裁决直接移除而非修级联。

## Related Concepts

- [[concepts/cypher-live-query-block]] — 里程碑交付的能力本体
- [[concepts/sql-query-blocks]] — 被镜像与共享的 SQL 查询块

## Related Sources

- [[sources/doc-27-cypher-live-query-prd]] — 里程碑设计稿
- [[sources/doc-28-cypher-live-query-demo]] — 里程碑验收演示
- [[sources/back-802-cypher-query-block-core]] — 首个任务
- [[sources/back-805-query-block-style-presets]] — 收尾任务（style 字段）
- [[sources/back-811-remove-style-field-add-highlight]] — 里程碑后推翻 style 并补语法高亮
