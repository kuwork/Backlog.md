---
title: BACK-598 - doc view 支持按路径或标题 slug 消歧
labels: [source, cli, bug]
created_date: 2026-09-08 17:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-598 - Allow-CLI-doc-view-to-disambiguate-by-path-or-title-slug.md
---

# BACK-598 - doc view 支持按路径或标题 slug 消歧

BACK-596 使文档身份 fail-closed，导致两个共享 frontmatter id 的文档（如 `guide/doc-1 - Title.md` 与 `migration/doc-1 - Title.md`）无法再用裸 ID 查看且无路可退。本任务为 `backlog doc view` 扩展三种引用形式——裸 ID（不变）、docs 相对路径（如 `migration/doc-14`）、文件名标题 slug——同时每次查找保持 fail-closed，给出排序候选列表与可直接运行的消歧提示。

- `src/utils/document-id.ts` 新增 `findDocumentByReference`，按三趟有序执行：裸 ID（委托 `findDocumentById`，仍 fail-closed）、docs 相对路径（去 `.md` 的完整路径或 `dir/id-stem`；反斜杠与 `./` 规范化，拒绝 `..` 穿越与盘符前缀），最后文件名标题 slug（大小写不敏感，取首个 `id - ` 分隔符之后的部分）。
- 每趟最多匹配一个文件，否则抛出带排序候选列表的错误；裸 ID 歧义立即抛出，绝不靠后续形式解救。
- `AmbiguousIdError` 新增可选 subject 短语，使非 ID 查找报告 "Document reference ambiguity"，而默认 "Document ID doc-N" 措辞保持字节级不变。
- Core 新增 `getDocumentContentByReference`，基于一次 `listDocuments` 解析；`getDocumentContent` 重构成基于共享 `readDocumentFile` helper，对 MCP/server/TUI 调用方行为不变。
- CLI `doc view` 切换到 `getDocumentContentByReference`；help schema 记录三种接受形式。
- 后续打磨：歧义错误经 `documentReferenceSuggestions` 附加可直接运行的备选（无歧义时给唯一 dir/id stem，否则给去 `.md` 的完整路径，含空格时加引号）。

## 验收标准

- 可按 docs 相对路径（如 `migration/doc-14`）与文件名标题 slug 解析文档。
- 仍匹配多个文档的路径/slug 查找打印候选列表并以 exit code 1 退出。
- 裸 ID 查找保持不变且在歧义时 fail-closed；测试覆盖路径查找、slug 查找与歧义场景。

## Related Concepts

- [[concepts/task-identity]] — 以路径/slug 引用解析与候选列表歧义错误扩展 fail-closed 身份模型。
- [[concepts/cli-entry]] — doc view 命令面、help schema 与退出码语义。

## Related Sources

- [[sources/back-596-fail-closed-document-decision-identity]] — 制造本任务为用户打开逃生口的歧义场景的 fail-closed 身份工作。
- [[sources/back-552-doc-view-plain]] — 本任务以引用形式查找扩展的前序 doc view CLI 工作。
