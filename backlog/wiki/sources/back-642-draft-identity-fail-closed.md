---
title: BACK-642 - 草稿身份歧义时按 fail-closed 处理
labels: [source, cli, core, task-identity]
created_date: 2026-09-26 14:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-642 - Fail-closed-on-ambiguous-draft-identities.md
---

# BACK-642 - 草稿身份歧义时按 fail-closed 处理

草稿携带两个相互竞争的身份——文件名派生 id 与 frontmatter id——各消费方归一化方式不同，首个匹配查找可能静默读、提升或归档错误的草稿文件。本任务在一个共享辅助函数中规范化草稿身份，让所有草稿经一个文件名派生查找器解析，身份歧义时以 `AmbiguousIdError` 失败闭合、列出所有候选。移植上游 BACK-636。

- `src/utils/task-path.ts`：新 `draftIdentityKey(id)` 是单一规范化权威（小写前缀、对点分十进制主体不敏感的零填充，建于 `canonicalTaskId`）；`draftIdsEqual`、`draftIdsMatchLoosely` 与 `findDuplicateDraftFilenameGroups` 都经它路由；重复的 `extractDraftBody` 与首个匹配的 `getDraftPath` 被删除，任何界面都无法再猜
- `src/file-system/operations.ts`：新 `resolveDraftFilePath` 查找器抛出 `AmbiguousIdError` 列出每个候选；`loadDraft` 重抛它；`promoteDraft`/`archiveDraft` 按文件名解析并在读-改-写全程持有 `withDraftLock`；`withTaskLock` 拆为共享的 `withEntityFileLock` 加 `withDraftLock`
- `saveDraft` 把同身份文件名收敛进所存文件，从不删除解析失败的文件，且当被取代文件无法移除时中止；`demoteTask` 在草稿分配期预留文件名派生 id
- 界面：CLI `draft view`/`draft [id]`/`draft archive` 报告歧义并退出 1；服务器草稿 GET 与 promote 处理器把 `AmbiguousIdError` 映射为带候选列表的 409；MCP 保留现有 AMBIGUOUS_ID 映射，且因 `loadDraft` 改为重抛而非返回 null，现在能暴露冲突
- `backlog doctor` 经 `src/utils/duplicate-detection.ts` 中新 `DraftIdentityFindings`/`hasDraftIdentityFindings` 打印草稿身份发现（重复数字身份、frontmatter 漂移、不可读文件）并非零退出
- 32 个定向测试通过（draft-identity-fail-closed 15、duplicate-detection 14、server-drafts-endpoint 3）；服务器处理器测试直接调用处理器，因为 Bun 在该环境下对每个 `/api/*` 路由都返回 404
- doctor 与 MCP 草稿套件经人工验证：它们每个测试都初始化一个 git 仓库，在那块盘上约 30s，超过测试钩子超时

## 验收标准

- 一个导出的 `draftIdentityKey` 规范化前缀大小写、零填充与点分段填充；所有分组/匹配经它路由
- `resolveDraftFilePath`、`loadDraft`、`promoteDraft`、`archiveDraft` 共享一个文件名派生查找器；歧义抛 `AmbiguousIdError` 列出每个候选
- 解析或读取歧义草稿不改盘上任何文件；CLI 以歧义信息非零退出
- `saveDraft` 收敛同身份文件名而不删除不可解析候选；文件名派生 id 在分配中计为占用
- doctor 报告草稿身份发现并非零退出；服务器把歧义映射为带候选的 409

## Related Concepts

- [[concepts/task-identity]] — 扩展到草稿的规范化 id 匹配（`canonicalTaskId`）
- [[concepts/task-locking]] — `withEntityFileLock`/`withDraftLock` 守卫草稿读-改-写全程
- [[concepts/upstream-migration]] — 移植上游 BACK-636（提交 7a19e1d、b581cb3、268a6a9）

## Related Sources

- [[sources/back-596-fail-closed-document-decision-identity]] — 更早施加于文档与决策的同一 fail-closed 模式
- [[sources/back-538-duplicate-task-id-recovery]] — 本草稿报告加入的重复检测与 doctor 修复
- [[sources/back-644-web-draft-editing-fix]] — 保留 409 歧义映射的服务器草稿路由
