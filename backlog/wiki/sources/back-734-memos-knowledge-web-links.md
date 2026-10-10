---
title: BACK-734 - memos 接入知识网链接
labels: [source, feature, web-ui]
created_date: 2026-10-03 01:10
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-734 - Wire-memos-into-the-knowledge-web.md
---

# BACK-734 - memos 接入知识网链接

Memos 用户最尖锐的抱怨是"笔记是死胡同"——记下的东西不与任何实体产生连接。Backlog.md 已有两套独立机制可以自动把裸实体 id（task-123、doc-001）和 [[wiki/path]] 渲染成链接，因此 memo 只需经由同一渲染管线即可获得出站链接。

## 实现要点

本任务最终是"分析 + 测试"而非代码改动：里程碑早期工作（BACK-731 的 MemosPage 与 App.tsx 布局）已经把 memo 正文通过共享的 MermaidMarkdown 渲染器输出，并挂上了 onTaskClick / onDocClick / onDecisionClick / onWikiClick 导航和 wikilinkBasePath="index.md"；App.tsx 把 /memos 路由挂在既有 TaskIdIndexProvider 作用域内，渲染侧自动链接器拿到的任务/文档/决策/草稿/wiki 索引在应用中恒非空，所以链接插件（src/web/utils/task-id-links.ts 的 createEntityLinkPlugin）天然生效。点击行为是 preventDefault + handler 的 SPA 导航，无整页刷新。

关键边界是"只出站、不入站"：按里程碑决策，memos 不是链接目标——没有 /memo/:id 路由、EntityKind 联合类型不含 memo、也不支持 memo-to-memo 链接；AC #6 是结构性保证，通过在 src/web 全量 grep 确认而非单元测试断言。wikilink 断言依赖 MDEditor.Markdown 启用 raw-HTML 渲染，prepareWikiMarkdown 生成的 <a> 才能成为真实锚点，与 wiki 页面其余位置的渲染方式一致。

## 验证

验证交付物是 src/test/web-memos-page.test.tsx 中新增的 "MemoCard knowledge web (BACK-734)" 测试块：在 TaskIdIndexProvider 内渲染 MemoCard，断言裸任务 id 链接到 /task/123、裸 doc/decision id 链接到对应路由、[[wiki/path]] 链接到 /wiki/...、行内代码中的 id 不被改写、点击实体链接以客户端导航跳转。文件共 16 个测试通过，tsc 与 biome 干净。

## Related Concepts

- [[concepts/wikilink]] — [[wiki/path]] 语法的渲染与 wiki 链接机制，memo 正文复用同一管线
- [[concepts/markdown-pipeline]] — MermaidMarkdown 共享渲染器与实体链接插件所在管线
- [[concepts/web-ui-features]] — web UI 的实体路由与 TaskIdIndexProvider 自动链接架构
- [[concepts/memos]] — memo 出站链接"只出站不入站"边界所属的 memos 子系统

## Related Sources

- [[sources/back-733-include-memos-in-global-search]] — 同一里程碑内让 memo 可被全局搜索发现的配套任务
- [[sources/back-714-knowledge-graph-ingest]] — 知识图谱摄取任务，同属"实体互联"主题
- [[sources/doc-15-wiki-knowledge-graph-relation-design]] — wiki 知识图谱关系设计文档，出站链接的设计背景
