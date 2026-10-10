---
title: BACK-701 - Connection: close 修复服务端测试误失败
labels: [source, test, infrastructure]
created_date: 2026-09-26 14:14
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-701 - Fix-local-server-suite-false-failures-with-Connection-close-Bun-1.3.14-keep-alive-misroute.md
---

# BACK-701 - Connection: close 修复服务端测试误失败

Windows 上 Bun 1.3.14 在 keep-alive 连接上只对带路由的第一个请求作答；第二个请求会落到 404 回退。复用裸 `fetch` 连接的服务端测试套件在本地大面积失败（33 通过 / 78 失败），而服务端本身健康。本任务在测试基础设施中用共享的全局 fetch 包装器一次性修复。

## 解决方案

- 根因被隔离并证明是既有问题：stash 掉 BACK-700 变更后的基线重跑出现同样的失败集合；同一连接上 curl 连续两次都得到 200，因此只有 Bun 的 keep-alive 路由损坏
- `src/test/test-utils.ts` 中新增 `installCloseConnectionFetch()`：包装 `globalThis.fetch`，在规范化 Headers / 元组数组 / 记录三种头形式后向每个请求注入 `Connection: close`；函数级标记 `__closeConnectionPatched` 使安装在共享同一 `bun test` 进程的 14 个文件间幂等
- 14 个服务端测试文件各增加一次 import 和一次顶层调用；两个手工修复的文件保留其逐请求头；产品代码未改动——唯一代价是测试内失去连接复用
- `web-content-in-place-refresh.test.tsx` 的 Document mock 补上了现在必需的 `createdDate`
- 验证：服务端套件 111 通过 / 0 失败（原 33/78）；web 套件 293 通过 / 0 失败；`tsc` 与 biome 无告警
- 事故教训：补丁脚本假设了无扩展名 import，而代码库 import 的是 `./test-utils.ts`，留下一行悬空代码——脚本化合并之前应先检查实际 import 形态

## 验收标准

- 共享幂等辅助函数在规范化所有 HeadersInit 形态后注入 `Connection: close`
- 每个与本地启动的 BacklogServer 通信的服务端测试文件都安装该辅助函数或保留显式的逐请求头
- 批量运行的 `src/test/server-*.test.ts` 报告 111 通过 / 0 失败，且 web 套件无回归
- Bun 1.3.14 keep-alive 误路由已在辅助函数注释中记录

## Related Concepts

- [[concepts/web-server]] — 本地测试套件被误路由的 BacklogServer
- [[concepts/ci-platform-contracts]] — 测试必须吸收而非产品吸收的平台/运行时怪癖

## Related Sources

- [[sources/back-595-content-store-watcher-retry-rename]] — 同一服务端测试区域早期的监视器/测试稳定性工作
