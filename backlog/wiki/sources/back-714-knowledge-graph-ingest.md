---
title: BACK-714 - wiki/docs/decisions 导入图谱
labels: [source, graph, wiki, web-ui]
created_date: 2026-09-26 14:14
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-714 - Ingest-wiki-docs-decisions-into-the-graph-FileNode-types-tags-provenance-wikilinks.md
---

# BACK-714 - wiki/docs/decisions 导入图谱

知识图谱第 3 阶段（doc-15）：图谱把 `backlog/wiki/`、`backlog/decisions/` 和 `backlog/docs/` 导入与任务同一张 FileNode 表，新增三张机械推导的关系表（TaggedWith、SourcedFrom、LinksTo），并把 UI 拆分为任务图谱（/graph）与知识图谱（/knowledge）。

## 实现要点

- 节点类型只来自白名单目录（`wiki/**` → wiki、`docs/**` → document、`decisions/**` → decision）；frontmatter 从不为类型提供依据，子目录（`wiki/sources/`、`wiki/concepts/`）只是导航范围而非类型；`wiki/index.md` 与 `wiki/log.md` 在扫描时排除
- 标签节点由 frontmatter `labels` 生成，每个 label 一条 `TaggedWith` 边，不设并行的 `tags` 字段；`SourcedFrom` 来自 `source_path`（任务源经 `FileNode.id` 匹配，知识源经路径匹配），候选为 0 或 >1 时不产边并出报告——fail-closed
- `LinksTo` 边解析自正文 `[[wikilinks]]`，以 wiki 根与引用页为基准解析，剥掉 alias/heading 部分，唯一命中才成边；未被链接的提及不是图谱事实；frontmatter `relations` 字段与全部语义边表按设计忽略（推迟）
- 版本：`SCHEMA_VERSION` 2（Tag 表 + 新 rel 表，由 BACK-713 的自描述守卫擦除重建），`PARSER_VERSION` 3；冷启动、增量同步、notify 钩子与 schema 守卫保持第 1 阶段行为
- 同一响应体的两种读法：/graph 只显示 task/completed/draft/milestone，新的 /knowledge 侧栏入口只显示 wiki/decision/document/tag；隐藏的 kind 在力导向布局运行前丢弃，模态框关系子图谱绝不走知识边
- 标题按读者认出节点的方式命名——知识页用 frontmatter title（回退文件名）、工作文件用代码名、标签不带 `tag:` 前缀——按估计宽度截断（CJK 双计）于一个共享的可测模块；悬停显示完整标题
- 点击知识节点经一个可测映射在新标签页打开真实页面（`/wiki/*`、`/documentation/:id`、`/decisions/:id`）；标签或无 id 文件夹 readme 宁可不开也不猜
- 真实语料验证：1155 文件 / 1131 节点 / 216 标签；TaggedWith 2048、LinksTo 1155、SourcedFrom 187；无端点缺失的边，`unresolvedLinks` 0；套件：graph-knowledge 17、graph-caption 8、graph-node-links 5、task-subgraph 9
- 只报告不修复：四个已知 `source_path` 缺口（doc-16 已消失；draft-125/92/96 已晋级）作为 lint 缺陷保持可见；21 个既存不可解析的 `completed/*.md` 文件（未加引号的 `assignee: @MrLesk`）被导入器跳过

## 验收标准

- 类型只来自目录；Tag 表 + TaggedWith 来自 labels；SourcedFrom 与 LinksTo fail-closed 并出报告
- lint 对每条发现分类、一条不丢；已知 source_path 缺口保持被报告
- 版本升级复用现有指纹/notify/schema 擦除机制；同一响应体的两种 kind 过滤读法
- 共享的标题截断与节点链接映射模块，均有测试

## Related Concepts

- [[concepts/wikilink]] — LinksTo 边解析所基于的 `[[path|alias]]` 语法
- [[concepts/markdown-pipeline]] — 喂给图谱的 frontmatter/正文解析
- [[concepts/web-ui-features]] — 两个图谱视图与导航入口

## Related Sources

- [[sources/back-713-filenode-rename]] — 本阶段扩展的 FileNode schema 与版本守卫（同一批）
- [[sources/back-702-kuzu-graph-foundation]] — 第 1 阶段基础（同一批）
- [[sources/back-523-wiki-wikilinks-alias-support-with-markdown-html-labels-and-markdown-it-attrs]] — 解析复用的 wikilink alias 语义
- [[sources/back-712-wiki-lint-source-path-guidance]] — 此处由图谱 lint 强制执行的 source_path 完整性关切（同一批）
- [[sources/wiki-web-ui-task]] — 知识节点外链指向的 wiki web 页面
