---
title: BACK-819 - 可切换图表引擎：Pele 默认 + Mermaid 回退
labels: [source, web-ui, charts, markdown]
created_date: 2026-10-23 17:20
updated_date: 2026-10-23 17:20
source_path: backlog/tasks/back-819 - Switchable-diagram-engine-Pele-default-with-Mermaid-fallback.md
---

# BACK-819 - 可切换图表引擎：Pele 默认 + Mermaid 回退

把原先硬接线的 Mermaid 渲染器换成**可切换引擎**：Pele（Obsidian 团队开源，把 Mermaid 12.1.0 语法渲染为 SVG、零依赖）成为默认；Mermaid 11.16.1 保留为可选回退。随任务发布 doc-32 Mermaid 图表画廊。

## 引擎核心

| 文件 | 作用 |
|---|---|
| `src/web/charts/pele-engine.ts` | 实现 `ChartEngine`（`languages: ["mermaid"]`），`render()` 经 Pele API 同步产出 SVG 注入容器；`PALETTES` 含亮/暗 token |
| `src/web/charts/diagram-engine.ts` | 基于 `useSyncExternalStore` 的反应式 store：`activeEngine` 默认 `pele`，导出 `get/set/normalize/useDiagramEngine` |
| `src/web/charts/registry.ts` | `getChartEngine("mermaid")` 按当前引擎 id 解析；`pele` 与 `mermaid` 双引擎注册；echarts 仍按语言解析 |
| `src/web/components/ChartBlock.tsx` | 调用 `useDiagramEngine()`，引擎 id 进入渲染 effect 依赖，切换即重渲 |
| `src/web/components/Settings.tsx` | 新增 Diagram Engine 下拉（Pele 默认 / Mermaid） |
| `src/types/index.ts` + `src/file-system/operations.ts` | `BacklogConfig.diagramEngine?: pele | mermaid`；`parse/serializeConfig` 处理 `diagram_engine` 键（`config.yml` 出厂默认 `diagram_engine: pele`） |
| `src/web/locales/{en,zh-CN,zh-TW,ja}.ts` | 新增 `diagramEngine` 系列 i18n 键 |

Mermaid 路径从 git HEAD 恢复文件并重新 `bun add mermaid@11.16.1`，使其再次可选。

## 配套修复

- doc-32 三张此前无法预览的图：XY 图中文 x 轴标签加引号（lexer 错误）、architecture-beta 标签改 ASCII。
- 暗色主题对比度：Pele 将 `--pele-line`/`--pele-border`/`--pele-fg` 映射到内部变量，原先近黑导致暗色下线条不可见；改为亮值（`#c9d1d9` / `#8b949e` / `#e6edf3`）恢复可见。

## 验证

- 无头 Chrome：doc-32 全部 25 个 mermaid 块在 Mermaid 11.16.1 与 Pele 下均 25/25 渲染
- `tsc --noEmit` 干净；biome 干净；相关套件 76/76 通过

## Related Concepts

- [[concepts/chart-block-engine]] — 本任务改写的引擎注册表解析逻辑
- [[concepts/markdown-pipeline]] — 围栏分支挂载点

## Related Sources

- [[sources/doc-32-mermaid-diagram-gallery]] — 同波发布的 Mermaid 画廊
- [[sources/back-812-core-echarts-engine]] — 统一 ChartBlock 底座
- [[sources/back-626-dependabot-mermaid-bump]] — 早期 mermaid 安全升级
