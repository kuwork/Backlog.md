---
title: MCP 客户端设置共享 Helper 模式
labels: [execution, mcp, cli, codex]
created_date: '2026-06-24 00:30'
updated_date: '2026-06-24 00:30'
extracted_from:
  - [[sources/back-520-fix-codex-mcp-connection-failure]]
---

# MCP 客户端设置共享 Helper 模式

将各 AI 客户端（Claude、Codex、Gemini、Kiro）的 MCP 设置命令统一到一个共享 helper 中，避免 CLI 和 core init 中重复实现。

## 适用场景

- 新增或修改 AI 客户端的 MCP 注册命令
- 需要确保设置命令行为一致（参数模板、错误处理、输出格式）

## 标准步骤

1. 在 `src/utils/mcp-client-setup.ts` 实现平台/客户端无关的注册逻辑。
2. CLI 设置命令和 `src/core/init.ts` 中的引导流程都调用该 helper。
3. 使用当前 stdio 分隔符格式（如 Codex 的 `codex mcp add backlog -- backlog mcp start`）。
4. 执行客户端 CLI 命令后检查退出码，非零时抛出错误而不是打印成功。
5. 为编译后的二进制添加 MCP stdio smoke 测试，覆盖 AI 实际启动路径。

## 常见陷阱

- 源码路径 `bun src/cli.ts mcp start` 正常不代表打包后的 `dist/backlog` 也正常；必须测试二进制路径。
- 客户端命令格式会变化（如 Codex 的 `--` 分隔符），需随官方文档同步。
- 忽略客户端设置命令的非零退出会掩盖安装失败。

## Related Sources

- [[sources/back-520-fix-codex-mcp-connection-failure]] — BACK-520 修复 Codex MCP 连接失败
