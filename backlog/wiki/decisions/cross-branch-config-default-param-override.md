---
title: 跨分支可见性：配置为默认、URL 参数为覆盖
labels: [decision, config, web-ui, cli, core]
created_date: 2026-10-09 22:00
updated_date: 2026-10-09 23:30
---

# 跨分支可见性：配置为默认、URL 参数为覆盖

## 背景

`includeCrossBranch` 此前无配置键，是每个调用点上的字面量：Web 前端 `api.ts` 无条件加参、CLI 写查找点恒 `false`、core 默认值 `true` 永远到不了任何表面。修复跨分支加载（前缀转发）后可见性轴仍不可配置，需要一条明确的优先级规则。

## 决定

BACK-759：`include_cross_branch` 配置值是 `task list` / `board` / `/api/tasks` / `/api/search` 的默认值；`crossBranch` HTTP 参数只在显式出现时覆盖配置。前端不再无条件附加 `crossBranch=true`（此前 Web 恒跨分支、CLI 恒本地，两个表面方向相反且都不可调）。

采纳要点：

- 规则收敛到导出的纯函数 `resolveCrossBranchVisibility(param, config)`，两个 HTTP 面共用、可脱离 server 单测
- 未设置配置 = local-first：历史 CLI 行为即默认值，升级无感
- 搜索语料始终跨分支构建，关闭可见性只在查询路径过滤（`isLocalEditableTask`）——开关零重载成本
- 配置键入 `BOOLEAN_CONFIG_KEYS` 热生效；yml snake_case + camelCase 别名双写兼容（沿 `filesystemOnly` / `backlogDirectory` 先例）

## 被否方案

- **前端继续强制参数、配置只约束 CLI**：Web 与 CLI 行为继续分叉，"配置"名不副实
- **配置存在时忽略参数**：参数失去应急覆盖能力（如某次请求临时要看全部分支）
- **把裁决逻辑写在 server handler 里**：`/api/tasks` 与 `/api/search` 两个面必然漂移

## Related Sources

- [[sources/back-759-cross-branch-prefix-visibility]] — 本决策的实现任务
- [[sources/back-760-cross-branch-settings-toggles]] — 配置在设置页的开关面
