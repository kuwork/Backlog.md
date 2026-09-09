---
title: 测试用显式超时而非放宽内部守卫
created_date: 2026-09-08 17:02
updated_date: 2026-09-08 17:02
labels: [decision]
---

# 测试用显式超时而非放宽内部守卫

## 背景

BACK-609/610/612 处理 CI 上间歇性挂起的测试。部分挂起来自并行调度噪声（bun test 并行跑多个文件时个别测试被长时间让出 CPU），而非代码真正死锁。

## 决定

测试侧采用显式超时：

- 单个测试用 bun test 第三参数 `30000ms`。
- 文件顶部 `setDefaultTimeout(20000)`。

沿用 `cli-dependency.test.ts` 既有模式。内部 `withTimeout` 守卫保持不变——它仍是真正的挂起保护，显式超时只覆盖并行调度噪声。

## 理由

- 放宽内部守卫会削弱生产路径的保护力度；显式测试超时不影响产品代码。
- 20–30 秒的量级足以吸收并行调度抖动，又能在真挂起时快速失败。

## 被否方案

- **内部 Windows 翻倍超时继续顶**：已被实践证明不够，且是在用生产代码为测试噪声买单。

## Related

- [[sources/back-609-mcp-stdio-test-timeout]]
- [[sources/back-610-cli-priority-filtering-test-timeouts]]
- [[sources/back-612-content-store-test-stabilization]]
- [[concepts/ci-platform-contracts]]
