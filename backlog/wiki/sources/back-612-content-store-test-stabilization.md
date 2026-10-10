---
title: BACK-612 - 稳定其余 ContentStore 与编辑器子进程测试失败
labels: [source, test, core, ci, bug]
created_date: 2026-09-06 19:47
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-612 - Stabilize-remaining-ContentStore-and-editor-subprocess-test-failures.md
---

# BACK-612 - 稳定其余 ContentStore 与编辑器子进程测试失败

修复最后 7 个全量套件失败：BACK-602 的 publication-owner 门控使三个 ContentStore 陈旧刷新测试的合成 upsert 被静默忽略，导致其确定性失败；另两个测试文件在 Windows 上死于 Bun 5000ms 默认超时。根因定位还发现一个真实 store bug——identity-index 重建分支从陈旧的 `activeTasks` 语料重建，驱逐了更早的内存 upsert——已改为从 `cachedTasks` 重建修复。

- 真实 bug 修复：`src/core/content-store.ts` 的 `upsertTask` identity-index 分支改从 `this.cachedTasks` 而非 `this.activeTasks` 重建，连续内存 upsert 不再互相驱逐。
- `src/test/content-store.test.ts`：陈旧刷新测试传入以测试 backlog 目录为根的 publication owner，并用真实 filePath upsert 磁盘快照任务（无 filePath 的合成 upsert 被 BACK-602 替换过滤器丢弃）；loader ID 经 `normalizeTaskId` 规范化为 store 的规范大写 ID。
- `src/test/tui-edit-session.test.ts` 与 `src/test/task-watcher.test.ts`：`setDefaultTimeout(20000)`（cli-dependency.test.ts 模式），容纳真实编辑器子进程/watcher 等待。
- BACK-602 publication 门控有意保留为预期行为。
- 验证：scoped 29/29；全量 bun test 2071 pass / 0 fail / 13 skip（`full-test-612.log`）。

## 验收标准

- 三个陈旧刷新 ContentStore 测试在提供 publication 所有权后通过。
- tui-edit-session 与 task-watcher 测试在负载下不再死于 Bun 5000ms 默认值。
- 三个文件的 `bun test` 通过。
- `bunx tsc --noEmit` 与 `bun run check` 在改动文件上通过。

## Related Concepts

- [[concepts/core-architecture]] — ContentStore upsert/identity-index 内部机制与 publication-owner 门控。
- [[concepts/task-identity]] — 与 store 规范大写身份匹配的 normalizeTaskId。

## Related Sources

- [[sources/back-561-autocommit-exact-files]] — 同一测试可靠性波次的邻近稳定化任务。
