---
title: CI 平台契约测试策略
created_date: '2026-08-17 23:00'
updated_date: '2026-09-08 17:00'
labels: [concept, ci, testing]
---

# CI 平台契约测试策略

将慢速、全量 OS 套件拆分为 Ubuntu 行为套件 + Windows/macOS 平台契约子集，以压减 CI 时间而不削弱关键保证。

## 核心原则

- **Ubuntu 负责完整行为**：运行全部行为测试
- **Windows/macOS 负责平台契约**：只跑与 OS/文件系统/进程/网络相关的测试
- **文件系统优先**：默认使用 filesystem-only fixtures，只在真正需要 Git 边界时初始化 Git
- **预构建 CLI**：子进程测试复用一次构建的 `BACKLOG_TEST_CLI_BUNDLE`
- **有界并发**：完整套件 2 worker，平台契约 4 worker

## 平台契约覆盖范围

- 文件系统/路径/锁
- 真实 Git/worktrees
- 已发布 CLI/进程/编辑器边界
- MCP stdio 生命周期
- 网络生命周期
- Unicode/非 ASCII 文件名

## 结果

- Windows 平台契约：~2m17s（原 ~16m22s）
- Ubuntu 完整行为：~2m57s
- macOS 平台契约：~35s

## 显式 per-test 超时模式（BACK-609/610/612）

Bun 测试运行器默认 5000ms 超时，在并行负载下会误杀慢速但健康的测试（MCP stdio 生命周期、优先级筛选、ContentStore 初始化等）。修复模式：

- `bun test` 第三参数显式声明超时：`test("...", async () => {...}, 20000)`
- 或文件级 `setDefaultTimeout(20000)` 覆盖默认 5000ms

显式超时不放宽断言，只消除并行误杀的不稳定。

## Windows 符号链接 checkout 隐性环境契约（BACK-605）

`core.symlinks=true` 使符号链接成为检出内容的一部分，这成为 Windows 上的隐性环境契约：

- checkout 仓库需要开发者模式或提权克隆，否则 symlink 检出失败
- 影响 Claude agent 指南等依赖 symlink 分发的功能，需在文档中向开发者明示前置条件

## Related Sources

- [[sources/back-609-mcp-stdio-test-timeout]] — BACK-609 MCP stdio 测试超时
- [[sources/back-610-cli-priority-filtering-test-timeouts]] — BACK-610 优先级筛选测试超时
- [[sources/back-612-content-store-test-stabilization]] — BACK-612 ContentStore 测试稳定化
- [[sources/back-605-claude-agent-guideline-symlink-windows]] — BACK-605 Windows symlink checkout 契约
