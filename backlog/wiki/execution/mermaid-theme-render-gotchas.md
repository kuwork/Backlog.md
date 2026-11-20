---
title: Mermaid 主题异步渲染陷阱
labels: [execution, web-ui, mermaid, async]
created_date: 2026-11-20 11:09
updated_date: 2026-11-20 11:09
extracted_from:
  - BACK-849
---

# Mermaid 主题异步渲染陷阱

## 适用场景

修改 Mermaid 主题、升级 Mermaid、排查快速切换 light/dark 后颜色错误、旧图闪烁或 treeView 暗色文字不可读。

## 标准步骤

1. 通过共享块适配器调用 `render(text)`，Classic 引擎先完成 `initialize()` 配置切换，再渲染每个块。
2. 每次渲染递增代数；Promise resolve 后先检查代数，过期结果直接丢弃，不触碰当前 SVG。
3. 新结果成功前保留旧 SVG；失败显示错误并保留可诊断状态，不在 await 前清空容器。
4. 用真实浏览器分别验证 Classic/Pele、light/dark、任务/文档/查询引擎与全屏路径，不能只依赖 jsdom。
5. treeView 对 `*Color`、`node`、edge token 分属性断言，避免定义图没有覆盖实际使用的 SVG 变量。

## 常见陷阱

- **`data-processed` 与 React 双状态**：共享 `run()` 会留下处理标记，和组件 `innerHTML` 管理冲突。
- **只取消部分任务**：任何旧异步分支都可能晚完成，提交点必须再验渲染代数。
- **提前清空容器**：既不防旧结果覆盖，也制造闪烁。
- **只看页面首帧**：主题切换需要快速连切并观察最终稳定状态，单次截图不足以发现竞态。
- **按 token 名称猜效果**：`labelBackground` 等变量只在定义图包含对应语法时可见，必须核对真实 SVG 属性。

## Related Sources

- [[sources/back-849-mermaid-theme-render-race]] — 完整实现与双引擎实测

## Related Decisions

- [[decisions/mermaid-render-generation-guard]] — 过期结果提交规则
