---
type: source
title: BACK-465 Windows MCP document tool 挂起修复
source_path: backlog/tasks/back-465 - Fix-Windows-MCP-document-tool-hangs.md
updated: 2026-05-10
---

# BACK-465 Windows MCP document tool 挂起修复

**状态**: Done | **标签**: 无 | **负责人**: @codex | **优先级**: high

修复 GitHub issue #640：backlog.md 1.45.0 在 Windows 上 MCP 客户端调用 `document_create` 时通过 `'backlog.cmd mcp start --cwd <project>'` 启动会无限挂起。1.44.0 在同一项目中正常返回。

## 根因

在 Windows 上使用真实 StdioClientTransport 客户端复现：connect 和 listTools 成功，然后服务器日志显示 "Received stdio, shutting down MCP server..."，随后 `document_create` 超时。问题指向 CLI `mcp start` 的 stdin close 处理程序，而非 document handler 本身。

## 修复内容

1. **忽略 Windows 上的 stdin 'close' 作为关闭信号** — `mcp start` 不再在 Windows 上将 stdin 'close' 视为关闭 MCP 服务器的信号，保持 stdio 会话存活。
2. **`isGitRepository` 使用 Bun.spawn 并忽略 stdin** — 运行 `git rev-parse` 时通过 `Bun.spawn` 并将 stdin 设为忽略，防止仓库检测在 document ID 生成期间继承 MCP stdio 管道。

## 验证

- `bun test src/test/mcp-stdio-exit.test.ts --timeout=15000` passed
- `bun test src/test/mcp-documents.test.ts src/test/mcp-roots-discovery.test.ts --timeout=15000` passed
- `bun test src/test/git.test.ts src/test/no-remote-preflight.test.ts --timeout=15000` passed
- `bunx tsc --noEmit` passed
- `bunx biome check src/commands/mcp.ts src/git/operations.ts src/test/mcp-stdio-exit.test.ts` passed

## Review 跟进

PR #641 的 review 指出：将旧 try/catch 替换为直接 `Bun.spawn` 后，`isGitRepository` 在子进程无法创建时（如缺少 git 或无效 cwd）会 reject。已修复：将 `Bun.spawn` 和 `exited` await 包裹在 try/catch 中，任何失败时返回 false，并添加了对缺失工作目录的回归测试。
