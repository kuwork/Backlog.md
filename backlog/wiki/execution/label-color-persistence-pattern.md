---
title: 标签颜色持久化模式
labels: [execution]
created_date: 2026-05-30 10:25
updated_date: 2026-05-30 10:25
---

# 标签颜色持久化模式

从 BACK-500 提取的可复用模式：将 UI 自定义样式映射持久化到项目配置中，同时保持配置整洁（仅存储非默认值）。

## 模式结构

1. **配置类型扩展**：在 `BacklogConfig` 中添加可选的 `Record<string, string>` 字段
2. **序列化/反序列化**：YAML inline object 格式（如 `label_colors: { bug: red, feature: blue }`）
3. **清理默认**：保存时过滤掉默认/空值，避免污染配置文件
4. **组件透传**：通过 props 层层传递，或使用 Context 减少 plumbing

## 代码示例

```ts
// 类型定义
interface BacklogConfig {
  labelColors?: Record<string, string>;
}

// 序列化：清理默认颜色
const nextColors = { ...currentColors };
if (nextColors[label] === 'default') {
  delete nextColors[label];
}
await apiClient.updateConfig({ ...config, labelColors: nextColors });
```

## 适用场景

- 用户自定义颜色、主题、显示偏好
- 任何需要按名称/ID 映射到样式配置的 UI 自定义

## Related Sources
- [[sources/label-color-customization-task]] — BACK-500 标签颜色自定义实现
