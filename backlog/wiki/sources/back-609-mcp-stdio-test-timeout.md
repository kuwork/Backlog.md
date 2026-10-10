---
title: BACK-609 - 提高 MCP stdio 会话测试的 bun 超时
labels: [source, test, ci]
created_date: 2026-09-06 08:10
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-609 - Raise-bun-test-timeout-for-MCP-stdio-session-test.md
---

# BACK-609 - 提高 MCP stdio 会话测试的 bun 超时

MCP stdio 会话测试（'keeps stdio sessions alive after listing tools so document calls can respond'）在全量套件并行负载下被 Bun 默认的 5000ms 单测超时杀掉，其自身的平台缩放内部等待还没来得及完成。修复传入显式 30000ms 单测超时，使内部 `withTimeout` 守卫仍是真正的挂死保护，同时测试在负载机器上有足够墙钟时间。

- `src/test/mcp-stdio-exit.test.ts`：超时作为 `test()` 第三个参数传入（bun:test 选项属于末尾——options 对象居中形式无法通过类型检查）。
- 内部 `getPlatformTimeout` 等待（Windows 已加倍）仍是实际的挂死保护；bun 超时只覆盖调度噪声。
- 取值 30000ms，远高于 Windows 加倍后的内部超时。
- 验证：scoped 测试通过；全量套件（`full-test-609-611.log`）2051 pass / 7 fail，stdio 关闭 5s 超时失败消失。

## 验收标准

- stdio 会话测试带显式 bun 测试超时，高于其 Windows 内部超时。
- `bun test src/test/mcp-stdio-exit.test.ts` 通过。
- `bunx tsc --noEmit` 与 `bun run check` 在改动文件上通过。

## Related Concepts

- [[concepts/ci-platform-contracts]] — 针对并行负载下 Bun 5000ms 默认值的显式单测超时。
