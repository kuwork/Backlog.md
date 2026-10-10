---
title: BACK-596 - 文档与决策身份歧义时 fail-closed
labels: [source, cli, server, web-ui, mcp, bug]
created_date: 2026-09-08 17:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-596 - Fail-closed-on-ambiguous-document-and-decision-identity.md
---

# BACK-596 - 文档与决策身份歧义时 fail-closed

文档与决策身份解析曾是静默 fail-open：文件名前缀匹配、首个匹配查找、被吞掉的 CLI 兜底 catch，使歧义或缺失的 ID 解析到任意文件。本任务把身份解析统一到共享模块 `src/utils/entity-id.ts`，把歧义视为携带全部候选路径的硬错误，并把 fail-closed 行为接入 CLI、TUI、server(409)、MCP(AMBIGUOUS_ID)与 web 各界面。还把决策切换到 backlog 相对的 `path` 字段（取代绝对 `filePath`），并修复 markdown 解析器中的 gray-matter 缓存污染。

- 新共享模块 `src/utils/entity-id.ts`：`entityIdKey`（剥离 `doc-`/`decision-` 前缀，空主体返回 null，数字零填充规范化）、`normalizeEntityId`、`entityIdsEqual`、`AmbiguousIdError`（携带候选相对路径）、`findUniqueEntityById`。
- `src/utils/document-id.ts` 重建为薄包装（`findDocumentById`）；新增 `src/utils/decision-id.ts` 提供决策侧等价物；`AmbiguousTaskIdError` 移到 `src/utils/task-path.ts` 并改继承 `AmbiguousIdError`，保留上游 `(taskId, candidates)` 签名及 doctor 预览指引。
- `Decision` 类型新增 backlog 相对的 `path?: string` 并移除 `filePath?: string`；`operations.listDecisions` 附加路径并捕获逐文件解析失败（新增 `unreadable?: string[]` 出参及 `recordUnreadableDirectory`）；content-store 决策 watcher 在其唯一解析点注入 `path`。
- fail-closed 查找：`loadDocument`/`core.getDocument` 经由 `findDocumentById` 路由；空字符串 ID 在任何地方都不匹配；无 `id` frontmatter 的实体保留列出但不可寻址。
- 各界面接线：server 文档 GET/PUT 返回 409 并带消息与候选；MCP 在 `structuredContent` 中映射为 `AMBIGUOUS_ID`（handler 直接重抛而非包装成 `OPERATION_FAILED`）；CLI doc view 在 not-found 吞错之前先分支处理歧义，decision view/update 打印候选并以 exit code 1 退出。
- Web：`api.ts` 抛出保留全部十个文档/决策端点 status/message 的 `ApiError`，并导出 `isAmbiguousIdConflict`；新增 `web/components/AmbiguousIdNotice.tsx`；`DocumentationDetail` 错误态真正渲染，`DecisionDetail` 新增一个；409 时不回退到缓存的 props 条目。
- `src/markdown/parser.ts` 用 `matter(toParse, {})` 解析以绕过 gray-matter 内容缓存，使畸形 frontmatter 每次解析都确定性地失败（后由 [[sources/back-599-gray-matter-no-cache-parse-wrapper]] 泛化）。

## 验收标准

- 等价的零填充 ID 解析到唯一规范键；匹配多个文件的 ID 抛出列出每个候选相对路径的歧义错误。
- 空字符串 ID 不匹配任何内容；缺 `id` frontmatter 的文档/决策保留列出但不可寻址。
- 决策端到端携带 backlog 相对的可选 `path`；不再使用 `Decision.filePath`（Task.filePath 不动）。
- 歧义 CLI 查找打印候选列表并以 exit code 1 退出；唯一 ID 行为不变。
- Server GET/PUT 返回 409 并带候选与字节级相同文件证明；MCP 返回显式 `AMBIGUOUS_ID` 并带候选。
- Web 详情视图渲染共享歧义提示且不回退缓存条目；gray-matter 缓存已绕过。

## Related Concepts

- [[concepts/task-identity]] — 应用于文档与决策的共享实体 ID 键规范化（剥前缀、零填充折叠、空主体拒绝），扩展任务侧身份模型。
- [[concepts/core-architecture]] — ContentStore 决策 watcher 路径注入与 listDecisions/listDocuments 的逐文件错误隔离。
- [[concepts/mcp-server]] — `AMBIGUOUS_ID` 错误映射，候选置于 structuredContent。
- [[concepts/markdown-pipeline]] — markdown 解析器中 matter(选项对象) 缓存绕过。

## Related Sources

- [[sources/back-552-doc-view-plain]] — 本任务以其兜底吞错替换为歧义优先分支的前序 doc view CLI 工作。
- [[sources/back-568-core-browser-task-boundary]] — 本任务为文档/决策镜像的相关 fail-closed 409 任务身份边界。
