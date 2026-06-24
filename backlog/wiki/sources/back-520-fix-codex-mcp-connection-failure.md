---
title: BACK-520 修复 Codex MCP 连接失败
labels: [source, mcp, codex, bug]
source_path: backlog/tasks/back-520 - Fix-Codex-MCP-connection-failure.md
created_date: '2026-06-24 00:30'
updated_date: '2026-06-24 00:30'
---

# BACK-520 修复 Codex MCP 连接失败

**状态**: Done | **标签**: mcp, codex | **负责人**: @codex | **优先级**: high

调查并修复 Codex 无法连接 Backlog.md MCP 服务器的问题，确保公共 CLI/MCP 表面的兼容性。

## 根因

- SDK 版本 `@modelcontextprotocol/sdk 1.29.0` 本身已是最新，无需升级。
- 源码路径 `bun src/cli.ts mcp start --debug` 启动正常，能通过 SDK 客户端暴露工具/资源。
- 复现的失败发生在 Codex 实际调用的打包路径：本地 `backlog` 命令解析到了一个陈旧/损坏的 `dist/backlog` 二进制文件，该二进制在 MCP 初始化期间退出。
- 缺失的回归覆盖：编译后的二进制只 smoke 测试了 `--help`/`--version`，未测试 MCP stdio 初始化路径。

## 修复内容

1. **统一 MCP 客户端设置辅助函数** — 提取共享 helper，供 Claude、Codex、Gemini、Kiro 的设置命令复用。
2. **更新 Codex 设置命令** — 使用当前 stdio 分隔符格式 `codex mcp add backlog -- backlog mcp start`。
3. **修复设置命令执行** — 客户端设置命令非零退出时现在会报错，而不是被当作成功。
4. **新增编译二进制 MCP stdio smoke 测试** — 覆盖 Codex 实际启动的二进制路径。
5. **更新 README** — 同步 Codex 手动安装说明。

## 验证

- `bun test src/test/mcp-client-setup.test.ts src/test/build.test.ts src/test/mcp-stdio-exit.test.ts`
- `bunx tsc --noEmit`
- `bun run check .`

## Related Concepts

- [[concepts/mcp-server]] — MCP Server 实现与 Roots 发现机制
- [[concepts/mcp-workflow]] — MCP 工作流与 AI 集成

## Related Sources

- [[sources/windows-mcp-fix-task]] — BACK-465 Windows MCP document tool 挂起修复
- [[sources/back-522-resolve-mcp-project-root-from-client-workspace-roots]] — BACK-522 MCP project root 从客户端 workspace roots 解析
