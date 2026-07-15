---
title: MCP 工作流与 AI 集成
labels: [concept]
created_date: '2026-05-10 00:00'
updated_date: '2026-07-14 11:20'
---

# MCP 工作流与 AI 集成

Backlog.md 通过 Model Context Protocol (MCP) 与 AI 编码助手深度集成。MCP 是 AI 代理（Claude Code、Codex、Gemini CLI、Kiro、Cursor）直接调用 Backlog.md 功能工具的标准化协议。

> 注意：CLI instructions 是 `backlog init` 默认推荐的 AI 集成路径；MCP 作为可选连接器保留（[[sources/back-521.2|BACK-521.2]]）。

## 推荐 AI 工作流（Spec-Driven）

### 步骤 1：描述想法
告诉 AI 代理你想构建什么，让它拆分为小任务，每个任务包含清晰的描述和验收标准。

### 步骤 2：一次一个任务
每个代理会话只处理一个任务，一个任务一个 PR。确保任务足够小，能在单次对话中完成。

### 步骤 3：编码前写计划
在实施前让代理研究代码库并撰写 Implementation Plan，放在任务中。计划必须经用户批准或显式跳过审查后才能开始编码。

### 步骤 4：实施与验证
让代理实施任务。完成后审查代码、运行测试、检查 lint，验证结果。

### 不满意时的重启循环
清除计划/备注/最终总结，细化任务描述和验收标准，然后在新的会话中重新运行。

## MCP 工具能力

AI 代理可通过 MCP 执行：
- 任务全生命周期管理（创建、编辑、查看、归档、搜索）
- 草稿管理（创建、提升、降级）
- 文档管理（创建、更新、查看、列出）
- 决策记录管理
- 里程碑管理（列出、创建、重命名、归档、任务分配）
- 看板状态读取
- 依赖管理
- 序列查看与操作
- 配置读取
- 项目统计与指标

## 工作流指南资源

MCP 客户端通过 `get_backlog_instructions` 工具或 `backlog://workflow/...` 资源读取指南：

| 指南 | 资源 URI | 用途 |
|---|---|---|
| 概览 | `backlog://workflow/overview` | 何时创建任务、基本工作流 |
| 任务创建 | `backlog://workflow/task-creation` | 搜索、范围评估、创建任务 |
| 任务执行 | `backlog://workflow/task-execution` | 规划、字段编辑、进度记录 |
| 任务完结 | `backlog://workflow/task-finalization` | 验证、总结、收尾 |
| 里程碑 | `backlog://workflow/milestones` | 里程碑创建、编辑、移除、归档 |

## 安全

- stdio-only 传输（无网络暴露）
- localhost-only 运行时验证
- 纯协议包装器，零业务逻辑在 MCP 层

## AI 客户端设置

Backlog.md 提供统一的 MCP 客户端设置辅助函数，供 Claude、Codex、Gemini、Kiro 等 AI 工具使用（[[sources/back-520-fix-codex-mcp-connection-failure|BACK-520]]）：

- `src/utils/mcp-client-setup.ts` 中的共享 helper 统一了 CLI 和 `core/init.ts` 中的客户端注册逻辑。
- Codex 设置命令使用当前 stdio 分隔符格式：
  ```bash
  codex mcp add backlog -- backlog mcp start
  ```
- 设置命令非零退出时现在会正确报错，而不是被忽略为成功。
- README 中的 Codex 手动安装说明已同步更新。

## 已知问题与修复

**Codex MCP 连接失败**
- **现象**: Codex 无法连接 Backlog.md MCP 服务器
- **根因**: 本地 `backlog` 命令解析到了陈旧/损坏的 `dist/backlog` 二进制；源码路径启动正常，但打包路径在 MCP 初始化期间退出
- **修复**:
  - 添加共享 MCP 客户端设置 helper
  - 更新 Codex 设置使用 `--` stdio 分隔符
  - 设置命令正确报告非零退出
  - 新增编译二进制 MCP stdio smoke 测试

**Windows MCP document tool 挂起（#640）**
- **现象**: `backlog.cmd mcp start --cwd <project>` 在 Windows 上调用 `document_create` 时无限挂起
- **根因**: CLI `mcp start` 将 stdin 'close' 误作为关闭信号；`isGitRepository` 继承 MCP stdio 管道导致阻塞
- **修复**: 
  - Windows 上忽略 stdin 'close' 作为关闭信号
  - `isGitRepository` 通过 `Bun.spawn` 运行并忽略 stdin

## Related Concepts

- [[concepts/cli-instructions]] — CLI 指令表面
- [[concepts/cli-entry]] — CLI 入口与命令体系
- [[concepts/mcp-server]] — MCP Server 实现
- [[concepts/task-lifecycle]] — 任务生命周期
- [[concepts/milestones]] — 里程碑管理

## Related Entities

- [[entities/ai-agents]] — AI 代理与集成
- [[entities/backlog-cli]] — Backlog.md CLI 工具

## Related Sources

- [[sources/back-520-fix-codex-mcp-connection-failure]] — BACK-520 修复 Codex MCP 连接失败
- [[sources/back-522-resolve-mcp-project-root-from-client-workspace-roots]] — BACK-522 MCP project root 从客户端 workspace roots 解析
- [[sources/back-521]] — BACK-521 CLI-first agent workflow refactor
- [[sources/back-521.14]] — BACK-521.14 Update CLI/MCP instruction guides with missing agent guidance
