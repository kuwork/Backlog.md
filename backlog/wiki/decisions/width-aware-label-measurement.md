---
title: 使用隐藏测量容器 + ResizeObserver 实现宽度自适应标签
labels: [decision]
created_date: 2026-05-30 10:25
updated_date: 2026-05-30 10:25
---

# 使用隐藏测量容器 + ResizeObserver 实现宽度自适应标签

**上下文**: BACK-500 TaskCard 标签宽度自适应溢出优化

**决策**: 使用隐藏的 DOM 测量容器（`visibility: hidden`）预先渲染所有标签，通过 `getBoundingClientRect()` 获取各标签宽度，再结合 `ResizeObserver` 监听卡片宽度变化，动态计算 `visibleCount`。

**理由**:
- **精确测量**：DOM 实际渲染宽度比字符串长度估算更准确，尤其考虑字体、字重、padding 等因素
- **响应式**：`ResizeObserver` 捕获窗口 resize、列宽变化、侧边栏展开/折叠等所有导致卡片宽度变化的事件
- **无副作用**：测量容器 `visibility: hidden` 不影响布局流，不参与交互

**拒绝的替代方案**:
- 硬编码字符数限制 → 不同字体宽度差异大，中英文混合时尤其不准
- 使用 Canvas `measureText` → 需要匹配页面实际字体栈，且无法考虑 CSS padding/margin

**测试回退**:
- JSDOM 环境中 `ResizeObserver` 不存在，effect 提前退出，安全回退为显示全部标签

## Related Sources
- [[sources/label-color-customization-task]] — BACK-500 标签颜色自定义与宽度自适应
