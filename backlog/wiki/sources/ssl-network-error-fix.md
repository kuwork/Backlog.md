---
title: BACK-487 修复 GitOperations.fetch SSL 网络错误未优雅处理
labels: [source, bug, git, network, ssl, error-handling]
source_path: backlog/tasks/back-487 - Fix-SSL-network-error-not-gracefully-handled-in-GitOperations-fetch.md
created_date: 2026-05-25 00:45
---

# BACK-487 修复 GitOperations.fetch SSL 网络错误未优雅处理

**状态**: Done | **标签**: bug, git, network, ssl, error-handling | **优先级**: high

## 问题

`git fetch` 遇到 SSL 连接错误（如 `SSL_ERROR_SYSCALL`）时，`GitOperations.fetch()` 未将其识别为网络错误，导致异常向上传播并崩溃整个 backlog 初始化流程。

## 根因

1. **环境不匹配**：`Bun.spawn` 继承父进程（MCP/IDE）的 `process.env`，可能缺失用户在交互式 shell 中设置的代理变量（`HTTPS_PROXY`、SSL 配置）
2. **错误模式缺失**：`containsNetworkErrorPattern()` 仅检查经典网络错误（`timeout`、`could not resolve host` 等），未包含 SSL 相关模式

## 修复方案

- **文件**: `src/git/operations.ts`
- 在 `containsNetworkErrorPattern()` 的 `networkErrorPatterns` 数组中追加 4 个模式：
  - `ssl_error_syscall`
  - `ssl_connect`
  - `ssl handshake failed`
  - `tls handshake timeout`
- 当 `fetch()` 遇到 SSL 错误时，`isNetworkError()` 返回 `true`，`fetch()` 静默返回，调用方继续使用本地数据

## 测试

- `src/test/git.test.ts` 新增 `describe("isNetworkError")` 测试套件，覆盖：
  - 经典网络错误（回归检查）
  - SSL 特定错误（新行为）
  - 非网络错误（确保无假阳性）
  - 字符串类型错误（兼容性）
- 结果：144 pass / 0 fail

## 变通方案

- 设置 `git config --global http.proxy` 替代 shell 环境变量
- 使用 `backlog config set remoteOperations false` 完全禁用远程操作

## Related Concepts
- [[concepts/core-architecture]] — Core 层中 GitOperations 的协作关系
