---
title: 将 agent-guidelines.md 运营指导回传到 CLI/MCP 指令表面的模式
labels: [execution, agent-guidance, docs]
created_date: '2026-07-14 11:20'
updated_date: '2026-07-14 11:20'
---

# 将 agent-guidelines.md 运营指导回传到 CLI/MCP 指令表面的模式

## 场景

项目同时维护：
- `src/guidelines/agent-guidelines.md`（旧的统一代理指南）
- `src/guidelines/cli-instructions/*.md`（CLI 指令表面）
- `src/guidelines/mcp/*.md`（MCP 资源/工具指南）

当旧指南中出现 CLI/MCP 表面尚未覆盖的运营细节时，需要将这些内容回传到新的指令表面，而不是让代理继续依赖旧文件。

## 标准步骤

1. **审计差距**：对比 `agent-guidelines.md` 与 CLI/MCP 各指南，列出缺失的运营主题（目录布局、黄金法则、字段速查、资源处理、常见问题等）。
2. **拆分归属**：
   - 通用原则 → CLI/MCP overview（目录布局、黄金法则、禁止直接编辑、资源路径、常见问题）
   - 创建相关 → `task-creation`（搜索、范围评估、AC/DoD、不要包含 Implementation Plan）
   - 执行相关 → `task-execution`（规划审批、字段编辑速查、AC/DoD 操作、范围控制）
   - 里程碑相关 → `milestones`（新增独立指南）
3. **两边同步**：CLI 和 MCP 版本使用相同语义，但示例分别使用 CLI 命令或 MCP 工具字段。
4. **注册新指南**：在 `src/mcp/workflow-guides.ts` 注册里程碑指南，在 `src/guidelines/cli-instructions/index.ts` 与 `src/guidelines/mcp/index.ts` 导入并导出。
5. **命令暴露**：确保 `backlog instructions milestones` 能输出 CLI 版本；MCP `backlog://workflow/milestones` 资源可用。
6. **更新测试**：
   - CLI：`src/test/cli.test.ts` 中检查 `backlog instructions command` 覆盖 milestones 与迁移后的内容。
   - MCP：`src/test/mcp-server.test.ts` 中检查 workflow resources/tools 包含 milestones 与内容变更。
7. **构建二进制**：重新运行 `bun run build`，确保新指南嵌入 `dist/backlog.exe`。

## 注意事项

- CLI 版本不要引用 MCP 工具或 `backlog://workflow/...` 资源（BACK-521 AC #8）。
- MCP 版本不要引用具体 CLI 命令作为唯一操作方式，应同时给出工具字段。
- 指南中避免硬编码状态名（如 `In Progress`、`Done`），应指向配置中的活跃/终态。
- 常见问题表格在 CLI/MCP overview 中保持一致，解决方式分别对应 CLI 命令或 MCP 工具。

## Related Concepts

- [[concepts/cli-instructions]] — CLI 指令表面
- [[concepts/mcp-workflow]] — MCP 工作流与 AI 集成
- [[concepts/task-lifecycle]] — 任务生命周期
- [[concepts/milestones]] — 里程碑管理

## Related Sources

- [[sources/back-521.14]] — BACK-521.14 Update CLI/MCP instruction guides with missing agent guidance
