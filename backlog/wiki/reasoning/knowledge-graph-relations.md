---
title: 知识图谱关系模型的设计推理（doc-15 / BACK-714）
created_date: '2026-09-26 22:25'
updated_date: '2026-09-26 22:25'
labels: [reasoning, graph, knowledge, dependencies]
---

# 知识图谱关系模型的设计推理（doc-15 / BACK-714）

把 `backlog/wiki/`、`backlog/decisions/`、`backlog/docs/` 拉进与任务同一张 `FileNode` 表时，要决定的不是"加几种节点"，而是**什么才算图事实**：节点类型由谁声明、哪些关系可以机械派生、以及在渲染层如何把两种读法压在同一份 payload 上。设计见 doc-15，落地在 BACK-714，依赖 BACK-713 的 `FileNode(path PK)` 前提。

## 原始需求

- 知识文件要与 working files 共存于一张表、一套 payload，而不是第二个图
- 三种关系要能自动建立：标签（`labels`）、溯源（`source_path`）、正文链接（`[[wikilink]]`）
- 任何解析不出来的目标都必须**报出来**，不许静默丢弃
- `/graph` 与 `/knowledge` 是两个视图，不是两个数据库

## 问题分解

1. 节点类型从哪来：frontmatter 声明、还是所在目录？
2. 若用 frontmatter，字段名用哪个（`type` 还是新键）？
3. 标签是"节点 + 边"还是再加一列属性？
4. `source_path` 指向任务、指向知识文件时分别怎么解析？
5. 正文 wikilink 按什么基准解析，alias/heading 怎么处理？
6. 语义关系（`relations` 字段与 8 张语义边表）本期做不做？
7. UI 层：同一份 payload 怎么切成两个视图，caption 如何截断？

## 备选方案对比

| 议题 | 方案 A | 方案 B | 选择与理由 |
|---|---|---|---|
| 节点类型来源 | 读 frontmatter 的显式类型字段（计划形态，BACK-714 Description 原文："the parser reads the explicit frontmatter 'type' and NEVER infers type from the folder"，缺失或非法即校验错误，并为存量文件迁移写入该字段） | **由白名单目录决定**（落地形态：`wiki/**`→wiki、`docs/**`→document、`decisions/**`→decision；子目录不构成类型） | **B**。A 被一个硬事实否决：`src/markdown/serializer.ts` 的 `serializeDocument`/`serializeDecision`（:134/:153）只序列化 `id/title/type/created_date/updated_date/tags`，**任何自定义 frontmatter 键会在下一次 `doc update` 或 Web 端编辑时被静默抹掉**。对 docs/decisions 而言，依赖 frontmatter 的类型声明根本不可能持久。目录本身就是声明：一个顶层目录只对应一种类型，也不需要为几百个文件做迁移 |
| 类型字段名 | 复用已有 `type` | 新键 `file_type` | **两者都被上一条作废**。但转折过程中的理由仍成立且被 doc-15 记录：docs 的 `type` 已被 Backlog 文档类型占用（受控值 `readme`/`guide`/`specification`/`other`，见 `normalizeDocumentTypeInput`，非法值直接报错），与 `wiki`/`decision`/`document` 值域不相交；同一字段无法承载两种语义 |
| Tag 表示 | 给 FileNode 加一列并行的 `tags` 字段 | **Tag 节点表 + `TaggedWith` 边** | **B**。标签要能被统计、能被过滤、能作为图上的实体出现；并行字段等于把同一事实存两份。每个 `labels` 值生成一个 Tag 节点与一条边 |
| `source_path` 解析 | 统一按路径匹配 | **分两类**：任务源经 `FileNode.id` 属性匹配，知识源经路径主键匹配 | **B**。两类事实的身份不同（ID 会撞号、路径唯一）；命中 0 条或 >1 条一律不建边并进报告 |
| `[[wikilink]]` 基准 | 只按 `wiki/` 根相对解析 | **两级**：先按 `wiki/` 根相对，再按引用页相对（`../`） | **B**。既有 wikilink 语义本身就是两级的（见 [[concepts/wikilink]]），只认一种基准会把现存的页面相对链接全部判成悬空 |
| 链接如何成边 | 命中即成边 / 多个命中取第一个 | **剥离 alias 与 heading 后唯一命中才成边** | **B**。歧义不是"挑一个"，而是"这条不是图事实"，必须报出来。未被 `[[ ]]` 包裹的纯文本提及永远不是图事实 |
| 语义关系 | 本期实现 `relations` 字段与 8 张语义边表 | **解析器遇到 `relations` 直接忽略，整体暂缓** | **B**。doc-15 §7 给出的判据是"当前没有任何文件使用 `relations`，也没有消费语义边的查询"。为一个不存在的消费者建表，等于造一堆无人校验的数据 |
| 视图切分 | 一个图 + 前端隐藏/淡出 | **同一 payload 两种读法，隐藏 kind 在 force 布局运行前剔除** | **B**。前者的"隐藏"节点仍参与布局计算，link force 成本按全量计；后者 `/graph` 与 `/knowledge` 各自只看得见自己的语料 |
| caption 截断 | 按字符数截断 | **按估算宽度截断**（`CAPTION_BUDGET` 120px、西文 6.1px/字、CJK 11px/字、padding 14px，省略号自身也占预算） | **B**。知识标题实测量级：最短 4、中位 28、最长 98 字符，近七成超过 20 字符，且 CJK 字形约两倍宽 —— 按字符数截出来的标牌宽度会横跨数倍，按宽度截能让所有标牌落在同一条带内 |

## 计划形态与落地形态的差异清单

这两者不一致是有意为之的交付差，不是缺陷，但读者容易踩坑：

| 描述来源 | 说法 | 实际 |
|---|---|---|
| doc-15 正文、BACK-714 Description | 类型读 frontmatter、禁止按目录推断、缺失即校验错误、为存量文件迁移写类型 | 类型由白名单目录给出；frontmatter 完全不参与类型判定；无需迁移 |
| doc-15 §1 | 存在 `missingFileType`/`invalidFileType` 报告桶 | 类型不可能缺失或非法，两个桶已删除 |
| doc-15 / 描述里的浮层字眼 | `file_type` 键名 | 键名已不存在，存储层列名仍是 `FileNode.type`，承载目录推出的节点类型 |
| BACK-703 Description | 变更经 SSE `broadcastGraphChanged()` | 走既有 WebSocket 推 `graph-updated`（`src/server/index.ts`） |

> 待办：doc-15 尚未同步到目录决定这一版（改动 `backlog/docs/` 须经 Core/CLI，不由 wiki 直接编辑）。

## 实测与验证

- 真实语料：**1155 文件 / 1131 FileNode / 216 Tag**；`TaggedWith` 2048、`LinksTo` 1155、`SourcedFrom` 187、一期边 132
- 悬空与歧义：解析不到唯一目标的 wikilink 全部进报告而非被丢弃；`source_path` 的三类判定（池内解析不出 = defect、白名单外 = informational、无扩展名表达式 = informational）
- 套件：graph-knowledge 17、graph-caption 8、graph-node-links 5；`tsc --noEmit` 与 `Biome` 干净
- UI：374/376 个知识节点可点击跳转到真实页面（tag 与无 id 的目录 `readme.md` 除外）

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| 依赖 frontmatter 的声明方案会被序列化器抹掉 | 类型改由目录给出，与写回路径彻底解耦 |
| 目录结构变化导致类型漂移 | 白名单只有三个顶层目录，子目录不参与判定；`wiki/index.md`/`wiki/log.md` 扫描时排除 |
| 标签爆炸（每个 label 一个节点） | Tag 名字自身作主键；`SCHEMA_VERSION` 2 引入该表，版本不符整库重建 |
| 语义关系被永久搁置 | 设计留在 doc-15，出现真实消费者（决策影响分析、模式复用检索）时照旧启用 |
| 两视图布局互相拖累 | 隐藏 kind 在布局前剔除 —— 看不见的节点不参与力学计算 |
| 知识 caption 溢出或过短 | 按估算宽度 + CJK 双宽把标牌宽度收敛到同一条带，完整标题留给 hover |

## Related Concepts

- [[concepts/kuzu-graph]] — FileNode 模型、三种机械派生边与 fail-closed 拦截
- [[concepts/wikilink]] — wikilink 两级解析与 alias/heading 规则，即 `LinksTo` 的输入口径
- [[concepts/web-ui-features]] — /graph 与 /knowledge 两视图的交互口径
- [[concepts/task-identity]] — 路径主键与任务 ID 的属性化，是知识文件能与任务同表的前提

## Related Sources

- [[sources/doc-15-wiki-knowledge-graph-relation-design]] — 关系模型设计（注意：尚未同步到目录决定版）
- [[sources/back-714-knowledge-graph-ingest]] — 三期落地与验收数据
- [[sources/back-713-filenode-rename]] — FileNode(path PK) 前提
- [[sources/back-523-wiki-wikilinks-alias-support-with-markdown-html-labels-and-markdown-it-attrs]] — alias 形式的 wikilink 支持
- [[sources/back-524-add-media-wikilink-support-for-images-video-and-audio]] — 媒体 wikilink 的解析口径

## Related Decisions

- [[decisions/local-corpus-closure-over-graph-service]] — 与之相关的遍历不使用默认后端做多跳
