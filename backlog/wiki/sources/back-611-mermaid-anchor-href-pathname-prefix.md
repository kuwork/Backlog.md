---
title: BACK-611 - MermaidMarkdown 锚点 href 断言同步路径前缀
labels: [source, test, web-ui, bug]
created_date: 2026-09-06 08:11
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-611 - Sync-MermaidMarkdown-heading-anchor-href-assertions-with-pathname-prefixed-hash-links.md
---

# BACK-611 - MermaidMarkdown 锚点 href 断言同步路径前缀

BACK-536 把文档内 hash 链接改为锚点 href 含当前 pathname 与 search（`/#11-section-title` 而非 `#11-section-title`），使 `src/test/mermaid-markdown.test.tsx` 中三个 github-slugger 标题测试仍断言旧的裸 hash 形式。修复在 `beforeEach` 中钉住 JSDOM origin，确定性地断言带路径前缀的 href，未回退组件行为。

- `src/web/components/MermaidMarkdown.tsx` 仅在 `window` 存在时用 `window.location` 前缀 hash href；隔离下 `renderToString` 无 window（裸 `#...`），但其他测试文件泄漏的 JSDOM 全局把它翻成 `/#...`——依赖顺序而非计时抖动。
- 修复：为 github-slugger describe 块在 `beforeEach` 中钉住 JSDOM origin `http://localhost/`；文件级 `afterEach` 已恢复全局。
- `src/test/mermaid-markdown.test.tsx`：三个标题测试现在在钉住的 origin 下期望 `/#...` href。
- 验证：隔离与全量套件（`full-test-609-611.log`）均通过。

## 验收标准

- 三个 github-slugger 标题测试期望 `/#...` href。
- `bun test src/test/mermaid-markdown.test.tsx` 通过。
- `bunx tsc --noEmit` 与 `bun run check` 在改动文件上通过。

## Related Concepts

- [[concepts/markdown-pipeline]] — MermaidMarkdown 标题锚点与 hash 链接解析。
- [[concepts/web-ui-features]] — BACK-536 引入的带路径前缀的文档内导航。

## Related Sources

- [[sources/back-536-in-document-hash-links]] — 这些断言同步所对齐的 BACK-536 行为变更。
