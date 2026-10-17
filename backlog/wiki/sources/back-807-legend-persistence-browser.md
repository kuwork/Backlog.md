---
title: BACK-807 - 图例持久化：浏览器启动恢复与 write-through 保存
labels: [source, web-ui, graph, config]
created_date: 2026-10-18 01:00
updated_date: 2026-10-18 01:00
source_path: backlog/tasks/back-807 - Graph-legend-persistence-browser-boot-restore-write-through-saves.md
---

# BACK-807 - 图例持久化：浏览器启动恢复与 write-through 保存

**状态**: Done | **里程碑**: m-16 | **依赖**: BACK-806

`CypherResultGraph`（图例的唯一消费方）在挂载时从项目存储恢复配置、把仅存在于 localStorage 的老配置迁移一次，并把保存写穿到服务端，同时保留 localStorage 作为即时/离线缓存。

## 恢复与保存链路

- **首帧**：`useState` 初始化仍用 `loadLegendConfig`，零延迟、离线可用。
- **恢复**：服务器有配置且不同 → 应用并回写本地缓存；服务器没有而本地有 → **PUT 一次完成迁移**；两边都无 → 维持默认。
- **保存**：写 localStorage（即时生效）+ PUT（write-through）；PUT 失败不阻断，本地副本保留，下次启动重试迁移兜底。
- **广播**：`graph-legend-updated` 由 `App.tsx` 转发为 window 事件，库名匹配则重新 GET 并应用。

## 为真实用法而非 happy path 设计的三道防线

1. **localActivity 计数器**：每次服务器读都携带本地活动计数，若响应回来时本地已有新编辑（开面板、保存、切换图例点），该响应**丢弃**而非应用——在途恢复永远不能回滚更新的编辑。
2. **pending 标记**：保存时在 localStorage 标记待写入，成功清除、失败保留；下次挂载把 pending 的本地副本推上去，而不是让较旧的服务器配置获胜。
3. **失败可见**：write-through 失败时面板保持打开并在 footer 显示原因（新 i18n 键 `legendSaveFailed`，`role=alert`），而不是像成功一样关闭。

## 附带产出

- **自动配色钉住**（`pinAutomaticTypeColors`）：保存时为没有显式颜色的类型写入它实际被绘制的填充色（`hueNodeColors(labelHue(label), theme).fill`），使 YAML 记录读者看到的完整画面而非每次按类型名重新推导；显式颜色、规则明度梯度与兜底色仍按设计保持派生。钉住幂等，面板的 × 仍可退回自动。
- 修掉两个既有基建 bug：`fetchGraphLegend` / `saveGraphLegend` 里 `throwResponseError` 漏 `return`（吞掉服务端错误）；`cypher-query-block.test.tsx` 的 catch-all mock 对 `/api/graph/legend` 回 `200 {}`（真实服务器回 204），静默覆盖了已存的 localStorage 配置。

## Related Concepts

- [[concepts/graph-legend-persistence]] — 浏览器侧恢复/迁移/写穿语义

## Related Sources

- [[sources/back-806-legend-persistence-server]] — 前置：存储与端点
- [[sources/back-810-graph-legend-watcher]] — 后继：带外写入也能热更新
