---
title: BACK-610 - 提高 CLI 优先级过滤测试的 bun 超时
labels: [source, test, ci, cli]
created_date: 2026-09-06 08:10
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-610 - Raise-bun-test-timeouts-for-CLI-priority-filtering-tests.md
---

# BACK-610 - 提高 CLI 优先级过滤测试的 bun 超时

`src/test/cli-priority-filtering.test.ts` 的每个测试都会 spawn 一个或多个真实 `bun run cli` 子进程，全量套件并行负载下其墙钟时间超过 Bun 默认 5000ms 单测超时（在一次性 spawn 三个 CLI 的大小写不敏感过滤测试上观察到）。文件顶部 `setDefaultTimeout(20000)` 使套件只在真实缺陷时失败，而非调度噪声。

- `src/test/cli-priority-filtering.test.ts`：文件顶部 `setDefaultTimeout(20000)`，与 `cli-dependency.test.ts` 既有模式一致。
- 取值 20000ms，远高于单次 CLI 调用开销；scoped 运行 13/13 通过。
- 全量套件（`full-test-609-611.log`）：无 CLI 优先级超时失败。
- 与 BACK-609、BACK-611 属同一稳定化波次（共享全量测试日志）。

## 验收标准

- 每个 spawn CLI 的测试都带显式单测超时，远高于单次调用开销。
- `bun test src/test/cli-priority-filtering.test.ts` 重复运行通过。
- `bunx tsc --noEmit` 与 `bun run check` 在改动文件上通过。

## Related Concepts

- [[concepts/ci-platform-contracts]] — spawn 子进程测试的 setDefaultTimeout 模式。
