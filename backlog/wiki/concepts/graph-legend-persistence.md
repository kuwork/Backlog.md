---
title: 图例配置持久化
labels: [concept, graph, web-ui, config, realtime]
created_date: 2026-10-18 01:00
updated_date: 2026-10-18 01:00
---

# 图例配置持久化

图视图的图例配置（per-type 颜色、caption 模板、配色规则、关系线样式与箭头，BACK-794 引入）曾只存在浏览器 localStorage（键 `backlog.graph.<database>.legend`，按库隔离），由此产生三个问题：**易丢**（换浏览器/设备/清缓存即消失）、**不可共享**（同库在不同人屏幕上长得不一样）、**文档渲染不确定**（`cypher-query` 块的 `view: graph` 取决于读者浏览器而非项目本身）。里程碑 m-16（BACK-806~810，PRD doc-29）把它搬到版本化的项目文件 `backlog/databases/graph-legends.yaml`。

## 存储

单文件、库名 → 配置映射，块状 YAML + LF 行尾（便于 review、diff 与手改）。缺字段与坏规则由客户端 `normalizeLegendConfig` 降级，服务端不做深度校验。冲突策略 **last-writer-wins**（低频单人配置，不引入版本向量或合并）。

## 四个写入面，一份存储

| 面 | 入口 | 特点 |
|---|---|---|
| 服务端 API | `GET/PUT /api/graph/legend` | 原子写（临时文件 + rename），成功广播 `graph-legend-updated` |
| 浏览器 | `CypherResultGraph`（唯一消费方） | 启动恢复 + localStorage 迁移 + write-through 保存 |
| CLI | `backlog graph legend get/set/remove` | 直接读写 YAML，不经 HTTP，离线可用 |
| MCP | `graph_legend_get/set/remove` | 复用同一 `legend-store`，无第二存储路径 |

四者全部走 `src/graph/legend-store.ts`，因此任一面的改动在其他面都可见。

## 恢复 / 迁移 / 写穿

1. 首帧仍用 localStorage（零延迟、离线可用）。
2. 服务器有配置且不同 → 应用并回写本地缓存；服务器没有而本地有 → **PUT 一次完成迁移**；两边都无 → 维持默认。
3. 保存 = 写 localStorage（即时生效）+ PUT（write-through）；PUT 失败不阻断，保留本地副本，下次启动重试迁移兜底。

为真实用法加的三道防线：**localActivity 计数器**丢弃「回来时本地已有新编辑」的在途恢复响应；**pending 标记**让失败的本地副本在下一次挂载推上去而不是被较旧的服务器配置覆盖；失败时面板保持打开并在 footer 显示原因（`legendSaveFailed`，`role=alert`）而非假装成功。保存还会**钉住自动配色**（`pinAutomaticTypeColors`），把没有显式颜色的类型实际绘制的填充色写入文件，使 YAML 记录读者看到的完整画面。

## 带外写入与三层「无变化不刷新」

`backlog/databases/` 是唯一没有 watcher 的内容目录，而广播起初只由服务端自己的 PUT 路由发出——CLI / MCP / 编辑器手改都要刷新页面才可见。`src/utils/graph-legend-watcher.ts` 补上这一环：**监听目录而非文件**（存储用临时文件 + rename，文件 inode 会变）、50ms 沉降 + 双读求稳、按库做深度且键序不敏感的基线比对；全新项目先监听父目录，等 `databases/` 出现再迁移。

三层合力保证「一次真正的变化只刷新一次」：

- **路由层**：只在 `saveLegendConfig` 报告 `changed` 时广播，并在请求内同步把结果设为 watcher 基线，抢在文件事件之前，避免 API 写入被 watcher 回声。
- **watcher 层**：键序整理、内容相同的重写不算变化。
- **浏览器层**：广播只是提示（需重新 GET），取回后与屏上配置比对（`legendConfigsEqual`），相同则不重绘。

## Related Concepts

- [[concepts/cypher-live-query-block]] — `view: graph` 消费图例，是持久化的动因之一
- [[concepts/kuzu-graph]] — 图例所服务的图谱渲染与 RyuGraph 后端
- [[concepts/live-sync-pattern]] — watcher + 广播 + 幂等刷新在本处的第四个落地面
- [[concepts/graph-cli]] — `graph legend` 命令组所在的命令家族

## Related Sources

- [[sources/doc-29-graph-legend-persistence-prd]] — 设计稿
- [[sources/m-16-graph-legend-persistence]] — 交付里程碑
- [[sources/back-806-legend-persistence-server]] — 存储模块与端点
- [[sources/back-807-legend-persistence-browser]] — 恢复 / 迁移 / 写穿
- [[sources/back-808-cli-graph-legend]] — CLI 面
- [[sources/back-809-mcp-graph-legend-tools]] — MCP 面
- [[sources/back-810-graph-legend-watcher]] — 带外写入 watcher
- [[sources/back-794-cypher-graph-configurable-legend]] — 被持久化的 localStorage 版图例
