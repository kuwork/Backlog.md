---
title: BACK-595 - 修复 content-store 文档 watcher 重试与改名对账
labels: [source, server, web-ui, bug]
created_date: 2026-09-08 16:55
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-595 - Fix-content-store-document-watcher-retry-and-rename-reconciliation.md
---

# BACK-595 - 修复 content-store 文档 watcher 重试与改名对账

ContentStore 文档 watcher 丢失事件并留下陈旧条目：`doc-1.md` 派生出的 id 带 `.md` 扩展名导致校验器永远不匹配；填充零的文件名（doc-0001）原始字符串比较失败；内联重试耗尽迫使全量刷新；存储更新按原始 id 查找；文件夹删除从不刷新存储。全部通过身份感知、基于路径的对账修复。

- `src/core/content-store.ts`：新增 `documentFilenameId()` 从 `doc-N.md` 与 `doc-N - Title.md` 派生 doc-N（不可寻址名返回 null）；`watchedDocumentPath()` 规范化 docs 相对路径；不可寻址名回退到 `refreshDocumentsFromDisk()`。
- 从 `src/utils/document-id.ts` 导入 `documentIdsEqual` 用于 watcher 校验器与刷新中的文件名 vs frontmatter 匹配。
- `removeWatchedDocument()` 仅按规范化相对路径定位条目（移除身份回退）；`publishWatchedDocument()` 返回 `strandedEquivalent`——frontmatter ID 改写时删除被替换路径的条目，另一路径持有等价 ID 时触发全量刷新。
- 版本跟踪改名为 `contentItemGenerations`/`contentItemVersions`，配套 `nextContentItemGeneration`/`nextContentItemVersion` 与 `deletedDocumentGenerations`；`dropWatchedDocument()` 为删除打版本，使并发刷新期间 `mergeDocuments()` 无法复活已丢弃的文档。
- 文档 watcher 切换到 `deferredRechecks`/`reconcileOrSchedule`（延迟重查取代内联 retryRead）；task/decision/wiki watcher 保留 retryRead。
- 存储侧更新基于路径：打过补丁的 `saveDocument` 包装把 `result.relativePath` 经 `handleDocumentWrite` 传给 `updateDocumentFromDisk`，后者按路径读取并注入后再发布。
- 文件夹删除：`createDocumentWatcher` 对非 .md 改名事件触发 `refreshDocumentsFromDisk()`。
- Web 打磨：DocumentationDetail、DecisionDetail、TaskDetailsModal 的标题输入占位符渲染为暗色（gray-400/500），不再与输入文字同色。
- 测试：`src/test/content-store.test.ts` 中先红后绿的回归测试，16/16 通过。

## 验收标准

- doc-1.md 落定且不耗尽重试；填充/未填充身份经 documentIdsEqual 与路径寻址对账；改名+ID 改写不留陈旧等价条目；子文件夹移动按 docs 相对路径对账；并发刷新无法复活已丢弃文档；文件夹删除刷新存储。

## Related Concepts

- [[concepts/core-architecture]] — ContentStore watcher/合并/版本架构
- [[concepts/web-server]] — 文件监视驱动 web UI
- [[concepts/task-identity]] — 与任务身份共享的文档 id/填充身份规则
