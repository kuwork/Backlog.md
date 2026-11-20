---
title: BACK-848 - CI 安装与测试超时治理
labels: [source, ci, testing, bugfix]
created_date: 2026-11-20 11:09
updated_date: 2026-11-20 11:09
source_path: backlog/tasks/back-848 - Fix-CI-install-failures-and-test-timeouts.md
---

# BACK-848 - CI 安装与测试超时治理

修复标准测试工作流多次重跑仍红的问题，把安装竞态、慢测试超时、临时目录并发删除和损坏 JUnit 报告分别处理；真实 Git 验证仍受独立基础设施故障阻塞。

## 问题

四类故障相互叠加：并发 `bun install` 删除彼此的临时目录；Windows EPIPE 泄漏为未捕获异常；未设上限的 `bun install --frozen-lockfile` 在 registry 卡顿时拖垮依赖缓存；CLI 真实构建与无超时模态框测试超过默认 5 秒。附带问题是进程组清理会串掉同名 PowerShell 进程，以及 JUnit 元数据混入 XML 属性值、根节点含非法属性。

## 解决方案

- 安装外层脚本把重试改为外层进程重试；GitHub Actions 再加硬超时，防止内部重试无限延伸。
- CLI 子进程套件一次构建并复用 `BACKLOG_TEST_CLI_BUNDLE`，缺少预构建入口时给出明确错误。
- 两个任务弹窗套件设置文件级 20 秒超时；TUI 与双模态框临时目录按工作进程分桶。
- 进程组终止改用微软 `kill-process-tree`；合并各平台脚本并修正 JUnit 序列化。
- 未扩张平台测试范围，覆盖仍沿用既有平台契约策略。

## 验证

真实 Git 重跑中测试超时与临时目录泄漏已消除，Windows `mcp-server` 与 Linux `cli-startup-config` 不再复现；macOS 两次被 `bun install` 外层重试耗尽 10 分钟。带缓存 Linux 重跑出现无关依赖缓存文件未命中，JSDOM 恢复后 macOS 核心套件全绿，因此不能把安装超时记为已验证关闭。

## Related Concepts

- [[concepts/ci-platform-contracts]] — 平台测试范围与显式超时的既有策略

## Related Sources

- [[sources/back-539-linux-runner-win32-arm64-build]] — 平台 CI 与进程测试基础
- [[sources/back-609-mcp-stdio-test-timeout]] — MCP stdio 超时治理先例
