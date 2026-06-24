---
title: MCP Roots 发现扩展至正常启动路径并保留 Pinned CWD
labels: [decision, mcp, roots, workspace]
created_date: '2026-06-24 00:30'
updated_date: '2026-06-24 00:30'
---

# MCP Roots 发现扩展至正常启动路径并保留 Pinned CWD

## 决策

将 #608/BACK-434 中仅在 fallback 模式下启用的 request-scoped roots discovery 扩展到正常（已初始化）启动路径，同时通过 `pinned` 标志保留 `--cwd`/`BACKLOG_CWD` 的固定行为。

## 背景

- 之前 MCP server 启动时只解析一次 project root，导致共享/用户级服务器或 git worktree 写入错误目录（#558）。
- BACK-434 仅在未找到项目的 fallback 模式下启用了 roots 发现。

## 选择

| 方案 | 说明 | 结果 |
|---|---|---|
| A. 重写 resolver | 为正常路径单独实现 roots 解析逻辑 | 拒绝，重复代码多 |
| B. 复用现有 roots 发现（选中） | `upgradeToProject`/`downgradeToFallback`/`resolveFromRoots` 直接复用到正常路径 | 选中，最小改动 |
| C. 始终查询 roots | 正常路径也查询，但无项目时降级到 init-required | 拒绝，会破坏已有正常项目的体验 |

## 理由

- 复用已有基础设施工具（`upgradeToProject` 等）可避免重复实现和测试。
- `startupHasProject` 标志让正常基线在无可用 roots 时保留原项目，只让 fallback 基线降级，平衡了灵活性和稳定性。
- `pinned` 标志给高级用户明确选择：固定目录或跟随客户端 workspace。

## 相关源码

- `src/commands/mcp.ts` — 传递 `pinned`
- `src/mcp/server.ts` — 启用 roots discovery、维护 `startupHasProject`

## Related Sources

- [[sources/back-522-resolve-mcp-project-root-from-client-workspace-roots]] — BACK-522 从客户端 workspace roots 解析 MCP project root
- [[concepts/mcp-server]] — MCP Server 实现与 Roots 发现机制
