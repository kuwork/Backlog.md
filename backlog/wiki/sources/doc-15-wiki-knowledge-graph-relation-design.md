---
title: doc-15 - Wiki 知识图谱关系设计
labels: [source, graph, wiki, kuzu, design]
created_date: 2026-09-26 14:15
updated_date: 2026-10-09 23:30
source_path: backlog/docs/PRDS/kuzu/doc-15 - Wiki-知识图谱关系设计（doc-14-第三期）.md
---

# doc-15 - Wiki 知识图谱关系设计

doc-14 Kuzu 任务图谱的第三期详细设计，将知识文件（`wiki/`、`decisions/`、`docs/`）纳入图谱。核心决定：项目相对文件路径是唯一的节点身份——不引入人造 wiki 页面 ID——图谱是 Markdown + frontmatter 的纯投影，保留 Obsidian「文件即节点、wikilink 即导航」的模型。

设计要点：

- 范围刻意收窄：当前只落地四条机械图谱事实——带 frontmatter `file_type` 的 `FileNode`、由 `labels` 生成的 `TaggedWith` 边、由 `source_path` 生成的 `SourcedFrom` 边、由正文 `[[wikilink]]` 生成的 `LinksTo` 边；**全部语义关系（`relations` 字段与七张语义边表）仅完成设计、推迟实现**，因为没有文件使用 `relations`，也没有查询消费语义边。
- 知识节点的类型来自显式 frontmatter `file_type`（`wiki`/`decision`/`document`），绝不从目录推断；不复用 `type` 是因为 `backlog/docs/` 已用它承载 Backlog 文档类型（`normalizeDocumentTypeInput` 对外来值报错）——不相交的值域迫使另设字段。
- 只有知识文件的 `labels` 成为 `Tag` 节点：任务/草稿/里程碑的标签是另一套词汇，合并后在真实仓库测量中留下 216 个 Tag 节点里 79 个孤儿（无边）；收窄后全部 137 个标签都有 wiki 支撑、零孤儿。
- `source_path` 解析是 fail-closed 的：先按路径匹配，再按稳定 ID 回退（任务 ID 走 `FileNode.id` 索引）；候选为零或多个 → 不建边，记入 `invalidRelations`/`unresolvedSources`；来源被删则保留 wiki 页并加备注，绝不伪造路径。
- 关系的两级门禁：形式校验（受控 `type` 值、可解析的白名单目标）完全自动化，**不得被 LLM 覆盖**；语义校验默认由人负责，LLM 授权需要提议者/校验者分离加逐关系证据引用。
- Wikilink 解析不带 `.md`、相对 `backlog/wiki/` 根、支持 `[[path|alias]]`；只生成普通 `LinksTo` 引用边——无语义解释，未链接的提及绝不进入图谱。
- 保留的推迟设计待激活：七张语义 REL 表带 `evidence STRING[]`（已验证项目所用 Kuzu 版本支持）、命名空间化的受控标签词汇（`domain/`、`topic/`、`origin/`、`lifecycle/`）、不可解析 wikilink/缺失 `file_type` 的 lint 规则、兼容 Obsidian 的图谱视图与标签过滤。

## 验证

不适用（设计文档）；迁移顺序保持既有 wiki 可用，同时新增 `file_type` 声明、标签规范化、机械边生成与 lint 检查（本文档交付机制与报告，不交付数据迁移）。

## 更新记录（2026-10-03 同步源文档）

- 源文档已从 `backlog/docs/BRDS/` 移至 `backlog/docs/PRDS/kuzu/`（本页 `source_path` 已修正），`updated_date` 已推进至 2026-09-30。
- **标签剔除规则变更（BACK-720，2026-09-29 修订）**：§4 的「隐藏载体则 Tag 一并剔除」规则作废。现行规则：Tag 只有在整个语料中没有任何 `TaggedWith` 边时才被剔除（真孤儿）；载体仅被图例隐藏时 Tag 保留显示——图例亮着即节点可见，边仍只在两端都可见时绘制。实现见 `src/web/components/GraphLegend.tsx` 的 `selectVisibleGraph`。

## Related Concepts

- [[concepts/wikilink]] — 供 `LinksTo` 使用的正文 `[[wikilink]]` 解析规则（不带 `.md`、别名形式、wiki 根相对）
- [[concepts/task-identity]] — 继承自 doc-14 的基于路径的节点身份与 fail-closed 解析
- [[concepts/markdown-pipeline]] — frontmatter 字段（`file_type`、`labels`、`source_path`）是唯一的图谱事实来源

## Related Sources

- [[sources/doc-14-kuzu-task-graph-cold-start-hot-update-design]] — 本设计所扩展的第一/二期设计；Graph Service、指纹、notify/watch 与 fail-closed 原则不变
- [[sources/back-523-wiki-wikilinks-alias-support-with-markdown-html-labels-and-markdown-it-attrs]] — `[[path|alias]]` 解析规则对齐的既有 wikilink 别名支持
- [[sources/back-524-add-media-wikilink-support-for-images-video-and-audio]] — 本文档 lint 规则中分类为信息性的媒体 `![[...]]` 嵌入
