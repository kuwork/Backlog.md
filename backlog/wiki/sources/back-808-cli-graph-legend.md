---
title: BACK-808 - CLI: backlog graph legend get/set/remove
labels: [source, cli, docs, graph]
created_date: 2026-10-18 01:00
updated_date: 2026-10-18 01:00
source_path: backlog/tasks/back-808 - CLI-backlog-graph-legend-get-set-reset.md
---

# BACK-808 - CLI: backlog graph legend get/set/remove

**状态**: Done | **里程碑**: m-16 | **依赖**: BACK-806

在既有 `graph` 命令组（m-13）下新增 `legend` 子命令，直接读写服务端与 Web 面板同一个 `backlog/databases/graph-legends.yaml`——**不经 HTTP，离线可用**。

## 命令

| 命令 | 行为 |
|---|---|
| `graph legend get <database>` | 默认打印人类可读摘要（captions 开关、每类型颜色/caption/规则、每关系线型、隐藏分桶）；`--json` 输出原始 JSON；未配置的库给明确提示且**退出码 0** |
| `graph legend set <database> <file>` | 从 YAML 文件导入；`--stdin` 读标准输入；非法 YAML 或非映射载荷非零退出且不动存储 |
| `graph legend remove <database>` | 删除该库条目，幂等 |

## 设计要点

- **复用而非重建**：直接调用 `src/graph/legend-store.ts` 的 `loadLegendConfig` / `saveLegendConfig`，因此 CLI 改动在 Web 面板刷新后可见，反之亦然。
- **命名沿用 CLI 惯例**：删除用 `remove`（与 `milestone remove` 一致），而非 PRD 草稿里的 `reset`。
- **默认可读而非原始**：默认输出 `formatLegendConfigText` 渲染的摘要，`--json` 才给脚本与管道用的原始 JSON。
- 11 个 CLI 测试覆盖命中/未命中、可读摘要非原始 JSON、规则/关系/隐藏渲染、文件与 stdin 导入、JSON 载荷（YAML 是其超集）同样可解析、非法与非映射拒绝、remove 与幂等、与服务端读取器的往返。

## Related Concepts

- [[concepts/graph-cli]] — 命令所属的 `backlog graph` 家族
- [[concepts/graph-legend-persistence]] — 三写入面共享存储模型的 CLI 面

## Related Sources

- [[sources/doc-29-graph-legend-persistence-prd]] — 设计依据
- [[sources/back-806-legend-persistence-server]] — 前置：共享存储
- [[sources/back-809-mcp-graph-legend-tools]] — 平行面：MCP 三工具
