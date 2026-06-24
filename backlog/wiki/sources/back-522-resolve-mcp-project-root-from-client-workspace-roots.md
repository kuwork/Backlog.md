---
title: BACK-522 从客户端 workspace roots 解析 MCP project root
labels: [source, mcp, bug, roots, workspace]
source_path: backlog/tasks/back-522 - Resolve-MCP-project-root-from-client-workspace-roots.md
created_date: '2026-06-24 00:30'
updated_date: '2026-06-24 00:30'
---

# BACK-522 从客户端 workspace roots 解析 MCP project root

**状态**: Done | **标签**: mcp, bug | **负责人**: @ycaptain | **优先级**: high

解决 MCP 服务器在启动时一次性解析 project root，导致共享/用户级服务器或 git worktree 场景下写入错误 backlog 目录的问题（#558）。

## 问题

- MCP 服务器启动时只解析一次 project root，仅在 fallback 模式下才会查询 MCP roots。
- 当共享/用户级服务器启动后，客户端切换 workspace 时，服务器仍把任务写到启动目录，而非客户端当前 workspace。
- git worktree 场景同样受影响。

## 修复内容

1. **启动路径也启用 request-scoped roots discovery** — 将 #608（BACK-434）引入的 roots 发现扩展到正常（已初始化）启动路径，复用 `upgradeToProject`/`downgradeToFallback`/`resolveFromRoots`。
2. **pinned 标志** — `src/commands/mcp.ts` 根据目录来源（`--cwd`/`BACKLOG_CWD` 或 `process.cwd()`）向 `createMcpServer` 传递 `pinned` 标志；pinned 时完全跳过 roots 查询。
3. **startupHasProject 标志** — 正常基线启动已有项目时，若客户端 workspace 没有 backlog，也保留原项目（只有 fallback 基线才会降级到 init-required）。
4. **upgradeToProject 短路** — 客户端 root 与启动目录相同时不重复注册。
5. **约束保持** — 每个 root 直接检查、多 root 选第一个含 backlog 配置的 root、单飞行（single-flight）。

## 行为变更

- 正常/已初始化路径现在会发出一次 `roots/list` 请求来跟随客户端 workspace（#608 在正常模式下不发出）。
- 使用 `--cwd`/`BACKLOG_CWD` 可完全禁用 roots 发现，固定全局 backlog。
- 无 roots capability 的客户端保持原有 `process.cwd()` 行为。

## 验证

- 覆盖 git worktree、共享服务器、pin 优先级、嵌套 monorepo、无 roots fallback 等场景
- `bun run check .` 与 `bunx tsc --noEmit` 通过

## Related Concepts

- [[concepts/mcp-server]] — MCP Server 实现与 Roots 发现机制

## Related Sources

- [[sources/back-520-fix-codex-mcp-connection-failure]] — BACK-520 修复 Codex MCP 连接失败
