---
title: BACK-772 - 派生图谱快照复用
labels: [source, cli, graph, performance]
created_date: 2026-10-16 01:00
updated_date: 2026-10-16 01:00
source_path: backlog/tasks/back-772 - Reuse-a-derived-graph-snapshot-instead-of-rebuilding-the-corpus-on-every-CLI-run.md
---

# BACK-772 - 派生图谱快照复用

里程碑 m-13 任务（从 BACK-769 拆出，依赖 BACK-769）：派生 default 图此前每次 CLI 运行都从 markdown 语料全量重建（约 6.0s），因为 ryu WASM 构建把图留在内存、永不落盘（BACK-767）。本任务把它持久化为 OS 缓存目录里的 JSON 快照——它是语料的缓存而非用户数据——语料指纹未变时直接还原，CLI 不再每次付 markdown 解析成本。

## 目标

冷启动时语料指纹、PARSER_VERSION、图 SCHEMA_VERSION 三者与记录快照全匹配则还原快照而非重解析语料；快照放 OS 缓存目录、每次全量构建后写入；任何不匹配（指纹、版本、快照缺失或不可读）一律回退全量重建，store 永远不留空或陈旧。

## 实现要点

- MetaCache（`src/graph/fingerprint.ts`）增加 `snapshotFingerprint` 与 `graphSchemaVersion`，把快照绑定到产出它的确切语料状态（`loadMetaCache` 逐字段重建对象，两个字段都要显式带过）。
- `reconcileGraphStoreOnce`（`src/graph/reconcile-once.ts`）加 `reuseSnapshot` 路径：匹配则 hydrate，否则全量构建后 dump 新快照；与旧指纹路径不同，它永不什么都不做——"跳过加载"正是 BACK-767 被迫引入 `forceBuild` 的原因。CLI 派生分支随之从 `forceBuild` 切到 `reuseSnapshot`。
- `derivedSnapshotPath(paths)` = `<dbPath>.graph.json`，即 OS 缓存目录里 default 库旁边；它是语料缓存，永不写入仓库，删掉只花一次重建。
- fail-safe 方向：服务快照前须过七道检查——meta 缓存存在、后端匹配、PARSER_VERSION 匹配、语料聚合指纹匹配、图 SCHEMA_VERSION 匹配、快照哈希已记录、盘上文件仍哈希为该值；任一失败（含快照不可读或 hydrate 出错）一律落回全量重建。

## 验证

端到端实测：重建 + dump 11042ms vs hydrate 5166-5663ms，查询结果完全一致（FileNode 1390、ParentOf 44），快照 1066051 字节；Description 中另记一组 5985ms vs 1133ms（1039KB 快照、1569 节点/4600 边）。新增三个测试：冷开从快照 hydrate、语料变更触发重建、损坏快照触发重建；tsc、biome 干净；7 个 reconcile-once 测试加图谱套件通过。

## Related Sources

- [[sources/back-767-graph-query-cli-command]] — MEMFS 不持久导致每次全量重建的根源，forceBuild 的引入处
- [[sources/back-769-graph-cli-multi-database]] — 快照 dump/hydrate 基础设施的出处（用户库版）
- [[sources/back-771-graph-cli-followups]] — scoped hydrate 是同一方向的另一优化
