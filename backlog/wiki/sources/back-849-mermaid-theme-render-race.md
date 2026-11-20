---
title: BACK-849 - Mermaid 主题重渲竞态修复
labels: [source, web-ui, mermaid, theme, bugfix]
created_date: 2026-11-20 11:09
updated_date: 2026-11-20 11:09
source_path: backlog/tasks/back-849 - Fix-Mermaid-theme-re-render-and-treeView-dark-colors.md
---

# BACK-849 - Mermaid 主题重渲竞态修复

统一 Mermaid 块为异步 `render(text)` + 本地元素状态，用渲染代数丢弃过期结果；切换 light/dark 不再留下旧浅色图，treeView 暗色文字也恢复可读。

## 问题

Mermaid 12 的 `run()` 会在自身节点上设置 `data-processed`，而共享组件又自行管理 `innerHTML`，两套状态相互冲突。快速连切主题时，较早发起的渲染可能较晚完成并覆盖新主题结果。Classic 引擎主题配置没有可选更新入口，暗色 treeView 的变量还混入定义图未包含的 `labelBackground`。

## 解决方案

- 增加可取消的 Mermaid SVG 渲染适配器，Classic 引擎显式完成 `initialize()` 配置切换，再对每个块调用 `render(text)`。
- Pele 与 MarkdownEditor 复用统一块组件；旧后处理式 DOM 替换只留命名兼容引用。
- 块维护渲染代数，过时 resolve 不得替换当前内容；旧 SVG 在新渲染成功前保留，失败时只显示错误而不制造空白闪烁。
- treeView 暗色改用实际生效的 `nodeBackground`、`labelColor` 与 edge token；`*Color` token 走原始 SVG 变量，`node` 用带 `labelBackground` 的 palette token。

## 验证

新适配器测试、Classic/Pele 引擎测试与 treeView 回归共 20 项通过；真实页面截屏确认双引擎、双主题与查询引擎路径均无残留错误。TypeScript、Biome、45 项相关引擎测试和全屏矩阵通过。

## Related Concepts

- [[concepts/chart-block-engine]] — 统一引擎注册表与主题生命周期
- [[concepts/chart-fullscreen-overlay]] — 新渲染与全屏重渲的交互

## Related Sources

- [[sources/back-819-switchable-diagram-engine]] — Classic/Pele 可切换引擎来源
- [[sources/back-846-mermaid-css-fullscreen]] — 全屏干净容器重渲策略
- [[decisions/mermaid-render-generation-guard]] — 以代数守卫解决异步覆盖
