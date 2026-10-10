---
title: BACK-728 - Memo 存储层
labels: [source, feature, cli, web-ui]
created_date: 2026-10-03 01:07
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-728 - Memo-storage-layer-src-core-memos.ts.md
---

# BACK-728 - Memo 存储层

需求背景：Backlog.md 能捕获任务、文档和决策，但没有地方放一次性随手记——任何值得记住的东西都必须变成任务或文档，迫使单行会议记录也要套用 ID 方案、标题和段落结构。Memos 通过在 backlog/memos/ 下新增第五种文件实体解决这个问题。本任务只交付存储层：独立模块 src/core/memos.ts，独占 memo 文件格式与全部 memo IO，对外暴露 list / read / create / update / delete 加游标分页。HTTP API、CLI、Web UI 和搜索集成均为后续任务。

## 实现要点

关键设计点：ID 为日期+序号格式 YYYYMMDD-N（取当日已有最大序号 +1，跨天重置为 1）；frontmatter 只含 id、created_date、updated_date、tags，没有 title 字段（tag 为空数组时省略，遵循 serializeDocument 惯例）；displayTitle 由正文首个非空行派生，正文以空行开头时回退到前 40 字符；文件以 LF 行尾、恰好一个尾部换行写入。刻意排除：不接入 ContentStore / 快照机制、不改 EntityKind、不做路由、无 pinned/promote 字段。

实现注意：doc-20 中引用的 helper 名（readFileUtf8 等）在本仓库不存在，实际采用 src/file-system/operations.ts 的既有惯用法——Bun.file().text() 读、Bun.write() 写、Bun.Glob scan 列目录、mkdir({recursive}) + try/catch 镜像 ensureDirectoryExists；序列化只走 src/markdown/frontmatter.ts，禁止直接引入 gray-matter；日期戳用仓库通用惯用法 `new Date().toISOString().slice(0, 16).replace("T", " ")` 保证与任务/文档日期可字节比较。自评审中发现并修复一个 bug：listMemos / nextMemoId 在 backlog/memos/ 不存在时抛 ENOENT，改用 directoryExists 守卫，读路径不再产生建目录副作用。DEFAULT_DIRECTORIES 新增 MEMOS: "memos"。

## 验证

结果：src/core/memos.ts（Memo 类型 + memoDir / nextMemoId / listMemos / listMemosPage / getMemo / createMemo / updateMemo / deleteMemo），src/test/memos.test.ts 15 个测试全部通过（ID 序号与跨天、分页边界、日期过滤、LF 回环等），tsc 与 biome 干净。

## Related Concepts

- [[concepts/core-architecture]] — src/core 模块边界与存储层归属
- [[concepts/date-fields]] — createdDate/updatedDate 的日期戳惯用法
- [[concepts/memos]] — memo 存储格式与 YYYYMMDD-N ID 方案所属的快速笔记子系统

## Related Sources

- [[sources/back-729-memo-http-api]] — 消费本存储层的 HTTP API 后续任务（依赖 BACK-728）
- [[sources/back-730-cli-memo-subcommand]] — 共享同一存储模块的 CLI 子命令后续任务
