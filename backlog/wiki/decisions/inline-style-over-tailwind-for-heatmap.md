---
title: 热力图配色使用 inline style 替代 Tailwind 类
labels: [decision, css, tailwind, heatmap]
created_date: 2026-05-31 01:11
updated_date: 2026-05-31 01:11
---

# 热力图配色使用 inline style 替代 Tailwind 类

## Context

BACK-503 需要为贡献热力图实现 5 级颜色强度（light/dark 各一套）。最初计划使用 Tailwind CSS 类（`bg-green-100`、`bg-green-700` 等）。

## Decision

使用 inline `style={{ backgroundColor: '...' }}` 而非 Tailwind 类。

## Rationale

- **Bun CSS build crash on Windows**: `bun run build:css` 在 Windows 上导致 Stack Overflow。项目的 `style.css` 是预生成的，新 Tailwind 类不会被编译进最终的 CSS。
- **GitHub 官方色值更精确**: 使用 `#ebedf0`→`#216e39`（light）和 `#161b22`→`#39d353`（dark）比近似 Tailwind 绿色更匹配 GitHub 风格。
- **动态计算**: 颜色级别根据 `count` 动态计算，inline style 配合函数映射比类名字符串拼接更直接。

## Rejected Alternative

- **Tailwind arbitrary values** (`bg-[#ebedf0]`): 同样不会被预生成 CSS 捕获。
- **CSS custom properties**: 需要修改 `style.css`，受 Bun build crash 影响。

## Consequences

- 热力图颜色硬编码在 TypeScript 中，修改需要编辑组件代码而非 CSS。
- 其他新增 UI 元素如果也需要新 Tailwind 类，同样需要使用 inline style 或等待 CSS build 修复。

## Related
- [[sources/task-completion-heatmap-task]] — BACK-503 实现任务
- [[execution/statistics-cache-pattern]] — 统计缓存模式
