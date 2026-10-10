---
title: BACK-702 - Kuzu 图谱基础与指纹冷启动
labels: [source, graph, kuzu]
created_date: 2026-09-26 14:14
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-702 - Kuzu-graph-foundation-schema-fail-closed-parser-and-fingerprint-cold-start.md
---

# BACK-702 - Kuzu 图谱基础与指纹冷启动

doc-014 设计的第 1 阶段：在 backlog 语料之上搭建依赖图谱。本任务构建了 `src/graph/` 模块——schema、白名单扫描器、fail-closed 关系解析、批量导入，以及基于指纹的冷启动快速路径，无变化时跳过全部解析。

## 实现要点

- schema 按 doc-014 §1.2：一张 `Task` 节点表（id、title、kind、status、filePath）、三张 REL 表（`ParentOf`、`BelongsToMilestone`、`DependsOn`）和一张 `Meta` 表；数据文件位于 `backlog/` 下（`graph.kuzu` + `graph.kuzu.meta.json` sidecar）
- 白名单扫描器只覆盖 `backlog/tasks`、`drafts`、`milestones`、`completed`——排除 archive，不用 `**/*.md` glob；逐文件 gray-matter 解析，缺少 id 的文件带警告跳过
- fail-closed 关系：悬空/歧义的 `parentTaskId`/`milestone`/依赖引用生成 `missingDependencies`/`ambiguousIds`/`invalidRelations` 报告而非被丢弃；节点总是进入图谱；跨 kind 的 `ParentOf` 合法，milestone 层级和非 task 的依赖目标被拒绝
- 全量导入批量插入节点（多值参数化 CREATE，按 100 行分块；REL 表用 COPY FROM），在所有节点就位后才构建全部边
- 冷启动：仅 stat 扫描，size+mtime 匹配时复用缓存的逐文件哈希，聚合指纹 = sha256(PARSER_VERSION + 排序后的 relPath|hash)；指纹匹配则零解析复用图谱，不匹配/缓存损坏则重建；混入 PARSER_VERSION 使解析器升级强制重建
- 关键决策：kuzu 0.11.3 原生绑定在 Windows 的 Bun 1.3.14 下会 SEGFAULT（doc-014 §5 的风险），因此 `GraphStore` 是抽象层、双后端——可选的原生 `KuzuGraphStore`（`BACKLOG_GRAPH_BACKEND=kuzu`）和默认的纯 JS `MemoryGraphStore`（文档中的降级模式），按项目根目录建立进程级单例
- `src/test/graph-foundation.test.ts` 中 18 个测试；由于 Bun 无法加载该绑定，Kuzu SQL 形态通过 Node 冒烟运行端到端验证
- 任务已关闭为 Done（实际 2026-09-24 07:01→14:25，milestone m-9）；按计划全套运行推迟到 BACK-703 之后的关卡

## 验收标准

- schema DDL 符合 doc-014 §1.2；白名单扫描只触碰四个目录
- 悬空/歧义引用被报告，节点仍进入图谱
- 冷启动快速路径仅 stat，指纹匹配时复用图谱
- size+mtime 联合比较，使未改动文件 `git checkout` 后缓存保持温热

## Related Concepts

- [[concepts/task-identity]] — fail-closed 关系解析所依赖的规范 id
- [[concepts/markdown-pipeline]] — 扫描器所基于的 gray-matter frontmatter 解析

## Related Sources

- [[sources/back-599-gray-matter-no-cache-parse-wrapper]] — 解析器复用的无缓存 gray-matter 包装器
- [[sources/back-596-fail-closed-document-decision-identity]] — 本图谱沿袭的早期 fail-closed 标识先例
- [[sources/back-703-graph-incremental-sync]] — 直接建基于此基础的第 1 阶段同步引擎（同一批）
