---
title: BACK-599 - 共享 no-cache 解析包装根除 gray-matter 缓存污染
labels: [source, bug, markdown]
created_date: 2026-09-08 17:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-599 - Remove-gray-matter-cache-poisoning-with-a-shared-no-cache-parse-wrapper.md
---

# BACK-599 - 共享 no-cache 解析包装根除 gray-matter 缓存污染

gray-matter 以输入字符串为键缓存解析结果并返回同一 data 对象，因此修改结果的调用方会污染之后所有相同内容的解析，且畸形文档只在首次解析时抛错（后续解析静默退化为空 frontmatter）。本任务引入单一共享 no-cache 包装并迁移全部直接 gray-matter 调用点，整个缺陷类被消除。

- 新 `src/markdown/frontmatter.ts` 成为唯一 import gray-matter 的模块：`parseFrontmatter(content)` 调用 `matter(content, {})`，`stringifyFrontmatter(content, data)` 调用 `matter.stringify(content, data, {})`，模块级缓存永不读写，序列化保持字节级一致。
- 迁移的调用点：`src/markdown/parser.ts` 的 `parseMarkdown`（弃用其本地 options 对象变通）、`src/markdown/serializer.ts` 中全部 `matter.stringify` 调用（serializeTask/Decision/Document/Milestone）、`src/file-system/operations.ts` 中配置列表值与 DoD 解析、`src/core/backlog.ts` `updateDecisionFromContent` 中的动态 gray-matter import（现为静态包装 import）、`src/commands/wiki-install.ts` 的 `parseSkillMeta`。
- `parseAssigneeConfigValue` 有意保留 `Bun.YAML.parse`。
- `src/test/markdown.test.ts` 中的回归测试证明原污染场景（修改返回结果、重解析相同内容、断言结果纯净），并在 helper 临时改回裸 `matter()` 调用时失败。
- 建议绕过解析缓存的陈旧测试注释已刷新（`src/test/content-identity.test.ts`）。

## 验收标准

- `src/markdown/frontmatter.ts` 是唯一 gray-matter import 点；解析缓存永不读写；序列化输出字节级一致。
- 每个直接调用点（parser、serializer、operations 配置/DoD、core 动态 import、wiki-install）均迁移到包装。
- 回归测试证明缓存污染场景现在解析正确。

## Related Concepts

- [[concepts/markdown-pipeline]] — 整个 markdown 流水线现在都经其路由的集中 frontmatter 解析/序列化包装。
- [[concepts/core-architecture]] — 消除共享库缓存这一跨模块正确性隐患。

## Related Sources

- [[sources/back-596-fail-closed-document-decision-identity]] — 先在 parser.ts 本地修复同一 gray-matter 缓存污染，本任务将其泛化为共享包装。
