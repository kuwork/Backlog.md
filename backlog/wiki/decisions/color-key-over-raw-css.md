---
title: 标签颜色使用 key 字符串而非原始 CSS 存储
labels: [decision]
created_date: 2026-05-30 10:25
updated_date: 2026-05-30 10:25
---

# 标签颜色使用 key 字符串而非原始 CSS 存储

**上下文**: BACK-500 看板标签颜色自定义

**决策**: 在 `config.yml` 的 `label_colors` 字段中存储颜色 key 字符串（如 `"red"`、`"blue"`），而非原始 hex/CSS 值。

**理由**:
- **Dark mode 自动支持**：key 字符串通过 `getLabelColorClasses()` 映射到 Tailwind `bg-*-200` / `dark:bg-*-800` 类对，无需在配置中维护两套颜色
- **编译体积控制**：避免将原始 CSS 注入编译后的单文件二进制，保持体积小巧
- **预设一致性**：17 种预设色统一 managed，用户无法输入无效/不安全的颜色值

**拒绝的替代方案**:
- 存储 hex 值并在运行时生成 CSS → 需要额外的 CSS-in-JS 或 style 标签注入，增加复杂度
- 存储 RGB 元组 → 需要手动计算 dark mode 变体，维护成本高

**相关实现**:
- `src/web/utils/labelColors.ts` — 预设调色板与类名映射
- `src/file-system/operations.ts` — `parseConfig`/`serializeConfig` 处理 `label_colors` 为 inline YAML object

## Related Sources
- [[sources/label-color-customization-task]] — BACK-500 标签颜色自定义实现
