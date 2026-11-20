---
title: Mermaid 以渲染代数防止过期覆盖
labels: [decision, web-ui, mermaid, async]
created_date: 2026-11-20 11:09
updated_date: 2026-11-20 11:09
---

# Mermaid 以渲染代数防止过期覆盖

## 背景

BACK-849 发现 Mermaid 12 的共享 `run()` 与组件自管 `innerHTML` 冲突，快速切换主题时旧异步结果可能晚于新结果完成。简单清空容器还会带来闪烁，不能解决乱序提交。

## 决定

Classic 引擎显式完成配置切换后逐块 `render(text)`，统一组件为每次渲染分配递增代数；只有最新代数允许提交 SVG。新结果成功前保留旧图，失败显示错误而非先清空。

## 理由

组件本地状态不依赖 Mermaid 的 `data-processed`，可以把 Classic、Pele 和编辑器预览放进同一生命周期。代数守卫直接约束「谁有权提交」，比只取消部分异步工作更覆盖实际竞态。

## 被否方案

- 继续共享 `run()`：节点处理标记与 React 状态分裂。
- 渲染前清空容器：仍无法阻止旧 Promise 后写入，并产生空白闪烁。
- 只按主题字符串比较：同一主题反复重渲仍可能乱序，必须使用单调代数。

## Related Concepts

- [[concepts/chart-block-engine]] — 统一渲染入口与主题生命周期
- [[concepts/chart-fullscreen-overlay]] — 干净容器重渲的相邻策略

## Related Sources

- [[sources/back-849-mermaid-theme-render-race]] — 决定产生与实测任务
