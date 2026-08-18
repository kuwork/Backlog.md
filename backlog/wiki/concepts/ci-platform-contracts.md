---
title: CI 平台契约测试策略
created_date: '2026-08-17 23:00'
updated_date: '2026-08-17 23:00'
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

## Related Sources

- [[sources/draft-89-windows-ci-under-three-minutes]] — draft-89 CI 优化
