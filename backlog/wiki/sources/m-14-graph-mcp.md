---
title: m-14 - Graph MCP 里程碑
labels: [source, milestone, graph, mcp]
created_date: 2026-10-16 01:00
updated_date: 2026-10-16 01:00
source_path: backlog/milestones/m-14 - graph-mcp.md
---

# m-14 - Graph MCP 里程碑

把 CLI 的 `graph` 子命令暴露给 AI 代理为 MCP 工具的里程碑，actual_start 2026-10-13 06:11 → actual_end 2026-10-13 07:56（约两小时内完成）。源文件仅一段描述，无独立设计文档引用。

范围：六个 MCP 工具——query / schema / list_databases / describe_database / create_database / import_csv。关键设计约束：工具镜像 CLI 的一次性（one-shot）模型——打开、准备、执行、关闭——而非持有长驻 `GraphService`，因此 MCP 启动永远不会触发全量语料重建。

## 验收标准

不适用（里程碑记录）；源文件未列任务分解，完成定义以 actual_end 盖印为准。

## Related Concepts

- [[concepts/mcp-server]] — 工具暴露所在的 MCP 服务面
- [[concepts/kuzu-graph]] — 被暴露的图谱基础设施与一次性生命周期取舍

## Related Sources

- [[sources/m-13-graph-cli]] — 被镜像为 MCP 工具的 CLI 子命令里程碑
- [[sources/m-9-kuzu-task-graph-phase-1]] — 图谱一期里程碑
