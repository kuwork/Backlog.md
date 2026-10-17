---
title: BACK-811 - 移除查询块 style 字段并为查询源码加语法高亮
labels: [source, web-ui, docs]
created_date: 2026-10-18 01:00
updated_date: 2026-10-18 01:00
source_path: backlog/tasks/back-811 - Remove-the-query-block-style-field-and-highlight-the-query-source.md
---

# BACK-811 - 移除查询块 style 字段并为查询源码加语法高亮

**状态**: Done | **依赖**: BACK-805

两件事合并在一个提交：**移除** BACK-805 的 `style` 字段，并给查询块的「显示查询」面板接上阅读视图自己的代码高亮。同一提交还搭载了本里程碑一直欠着的 `cypher-query` 文档改动。

## 为什么移除 style

2026-10-17 验证发现预设在 Web UI 根本不生效：`@uiw/react-markdown-preview/markdown.css` 在 `src/web/styles/source.css` **未分层**导入，未分层规则压过所有 `@layer utilities` 的 Tailwind 类——`.wmde-markdown table th/td` 的 border/padding、`tr` 背景与 `tr:nth-child(2n)` 斑马条全部胜过块上的类，`borderless` 更是没什么可去掉。jsdom 测试只断言类名不断言级联，所以测试绿而像素没变。用户裁决：**不修级联，直接移除字段**。

移除是 **fail-closed** 而非宽容：`view` / `refresh` 拒未知值，`style` 原本丢弃未知值；移除后若仍宽容，带 `style: compact` 的块会静默按默认外观渲染而无任何信号。现在解析器直接拒绝，并在错误里列出剩余字段（`source / sql / view / refresh / copy_to`），三种语法一致。

## 语法高亮

- 新工具 `src/web/utils/code-highlight.tsx`：`highlightCode(source, language)` 复用 **refractor 的 `all` 实例**（`@uiw/react-md-editor` 已打包的那个，也是 `registerTopicHighlight` 打补丁的那个），经 `hast-util-to-jsx-runtime` 转 React；语法未知或分词抛错则回退纯文本。
- 接线：`QueryEngineConfig` 新增 `highlightLanguage`（Cypher 为 `cypher`，两个 SQL 引擎走默认 `sql`），「显示查询」面板渲染 `<pre><code class="language-*">`；配色交给 `markdown.css` 的 `.wmde-markdown .token.*` → `--color-prettylights-syntax-*`，自动跟随明暗主题。

## 搭载的文档

readme 双语、两份 documents 指南、CLI overview 指引行与 agent nudge 一并补上 `cypher-query`（`query` 字段、`source` 为注册名、`view: graph`、`refresh: auto`、500 行上限）——这些文档是为本里程碑已交付的块写的，没有自己的任务，因此记在这里而非留在未提交状态。

## Related Concepts

- [[concepts/sql-query-blocks]] — 被移除字段影响的共享块模型
- [[concepts/markdown-pipeline]] — 未分层 CSS 压过 Tailwind 工具类的级联根因
- [[concepts/cypher-live-query-block]] — 高亮与文档补缺的对象

## Related Sources

- [[sources/back-805-query-block-style-presets]] — 被移除的字段
- [[sources/back-802-cypher-query-block-core]] — 共享 `QueryBlock` 内核的来源
