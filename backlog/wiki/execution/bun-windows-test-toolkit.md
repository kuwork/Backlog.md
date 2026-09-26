---
title: Bun on Windows 测试工具箱
created_date: '2026-09-26 14:45'
updated_date: '2026-09-26 14:45'
labels: [execution, testing, windows, bun]
extracted_from:
  - "[[sources/back-701-fix-server-test-keep-alive-misroute]]"
  - "[[sources/back-690-overview-due-by-timezone-fix]]"
  - "[[sources/back-655-section-marker-safety]]"
  - "[[sources/back-657-task-list-json-watch]]"
  - "[[sources/back-660-forced-refresh-stale-fetch-race]]"
  - "[[sources/back-681-tui-shift-arrow-multi-select]]"
---

# Bun on Windows 测试工具箱

## 适用场景

在 Windows 主机上用 Bun 跑/写本仓库测试时，反复出现的平台级陷阱与对应解法。这些不是产品 bug，先查这张表再怀疑实现。

## 已知陷阱与解法

| 陷阱 | 症状 | 解法 | 出处 |
|---|---|---|---|
| Bun 1.3.14 keep-alive 路由错配 | 本地 server 套件大量 404（33 pass / 78 fail），curl 同连接却正常 | 测试基础设施装 `installCloseConnectionFetch()`：包装 `globalThis.fetch`，规范化 Headers/元组/record 三种头形后注入 `Connection: close`；函数级 `__closeConnectionPatched` 标记保证 14 个文件共享进程时幂等 | [[sources/back-701-fix-server-test-keep-alive-misroute]] |
| Git Bash 前缀 `TZ=...` 不生效 | 时区探针在子进程里仍是机器时区 | 用 `Bun.spawnSync` 的 `env` 传 TZ；注意 `Intl.DateTimeFormat().resolvedOptions().timeZone` 仍报机器时区，**不能**用来判断 pin 是否生效 | [[sources/back-690-overview-due-by-timezone-fix]] |
| 多行 argv 元素被截断到首行 | CLI 测试传多行 `--notes` 只剩第一行，看起来像产品 bug | 经 CLI 文档化的换行转义传多行文本 | [[sources/back-655-section-marker-safety]] |
| 被杀子进程 cwd 在工程目录导致 EBUSY | 信号停止的子进程让项目目录在测试进程寿命内永久不可删 | 从仓库根跑 CLI，用 `BACKLOG_CWD` 指向临时工程；被杀子进程的 stdout/stderr 永远不报 end，读取要 settle 在 `process.exited` | [[sources/back-657-task-list-json-watch]] |
| 沙箱内无法建 `refs/remotes/origin/*`；`git fetch --prune` 向上走查 | 测试在工作区里莫名失败或慢且 flaky | 测试工程建在仓库**外**的 `mkdtemp()` 目录 | [[sources/back-660-forced-refresh-stale-fetch-race]]、[[sources/back-681-tui-shift-arrow-multi-select]] |
| win32 无真 pty | 键盘级 PTY 套件（`expect` 发 `ESC[1;2B`）跑不了 | 记录证据边界，不移植 PTY 套件；用真实 blessed screen 的渲染几何代替（见 [[execution/blessed-tui-test-harness]]） | [[sources/back-681-tui-shift-arrow-multi-select]] |

## 通则

- 平台怪癖由**测试基础设施**吸收，不动产品代码（BACK-701 的代价只是测试内失去连接复用）
- 怀疑平台问题时先在干净 HEAD 复现（参见 [[execution/pre-existing-failure-triage]]），把"运行时 bug"与"我的改动"分开
- 写合并/补丁脚本前先看真实 import 形状——BACK-701 事故：脚本假设无扩展名 import，而代码库写 `./test-utils.ts`，留下悬空行
