---
title: MCP 工作流与 AI 集成
labels: [concept]
created_date: 2026-05-10 00:00
updated_date: 2026-06-24 00:30
---


# MCP 工作流与 AI 集成

Backlog.md 通过 Model Context Protocol (MCP) 与 AI 编码助手深度集成。

## 什么是 MCP 集成？

MCP 是一种标准化协议，允许 AI 代理（Claude Code、Codex、Gemini CLI、Kiro、Cursor）直接调用 Backlog.md 的功能工具，无需用户手动输入 CLI 命令。

## 推荐 AI 工作流（Spec-Driven）

### 步骤 1：描述想法
告诉 AI 代理你想构建什么，让它拆分为小任务，每个任务包含清晰的描述和验收标准。

### 步骤 2：一次一个任务
每个代理会话只处理一个任务，一个任务一个 PR。确保任务足够小，能在单次对话中完成。

### 步骤 3：编码前写计划
在实施前让代理研究代码库并撰写实现计划（Implementation Plan），放在任务中。这确保了计划反映代码库当前状态。

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
- 序列（Sequences）查看与操作
- 配置读取
- 项目统计与指标

## 资源与提示

- `backlog://docs/task-workflow` — 任务工作流指南
- `backlog://workflow/overview` — 工作流概览
- `backlog://init-required` — 未初始化时的回退资源

## 安全

- stdio-only 传输（无网络暴露）
- localhost-only 运行时验证
- 纯协议包装器，零业务逻辑在 MCP 层

## AI 客户端设置

Backlog.md 提供统一的 MCP 客户端设置辅助函数，供 Claude、Codex、Gemini、Kiro 等 AI 工具使用（BACK-520）：

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
