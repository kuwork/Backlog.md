---
title: BACK-673 - Web 显示本地时间并悬浮展示 UTC
labels: [source, web-ui, dates]
created_date: 2026-09-26 14:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-673 - Show-local-time-in-the-web-UI-with-the-UTC-value-on-hover.md
---

# BACK-673 - Web 显示本地时间并悬浮展示 UTC

Web 面已按查看者本地时区渲染存储时间戳，但没有任何面暴露渲染背后的规范存储值。本任务补上上游 BACK-677 缺失的另一半：每个 Web 日期渲染的元素 `title` 属性中带 `(UTC)` 标记的存储 UTC 值。

- 扩展一个共享辅助函数而非平行模块：`src/web/utils/date-display.ts` 新增 `storedUtcHoverTitle(value)`，两个显示辅助函数现在都返回 `StoredDateDisplay`（`{ text, title? }`）；`text` 与之前输出逐字节一致，屏幕上无任何变化
- 悬浮标题是原始存储字符串加 `(UTC)`——绝不从解析后的 `Date` 重格式化——因此与 Markdown 记录及 CLI/TUI/MCP 输出逐字一致
- 处理了正确性陷阱：纯日期值（`yyyy-mm-dd`）、空与不可解析值完全不带 title，悬浮不会声称记录中没有的时间
- 新 `StoredDate.tsx` 为每个调用点渲染 `{ text, title }`：任务详情模态框、任务列表、任务卡片、milestones 页面/行/模态框、草稿列表、cleanup 预览、统计；documentation/decision 详情与甘特 actual start/end 保留自己的文本但悬浮取自同一辅助函数
- 两个带重复本地日期格式化器的组件（CleanupModal、Statistics）把它们交给共享辅助函数，统一为共享 medium-date/short-time 形态
- 范围刻意限于悬浮：无可见文案改标签，CLI/TUI/MCP/`--plain` 不动（它们从不带 UTC 标记），`src/utils/date-utc.ts` API 不变；纯日期 dueDate/planned 列有意保持无悬浮
- 测试从运行时时区推导期望而非钉死 `process.env.TZ`（bun 跨文件共享一个进程）；对丢 title、纯日期守卫与解析检查的回退探针红

## 验收标准

- 每个 Web 日期时间渲染在 `title` 中带 `(UTC)` 标记暴露存储值；可见文本仍为查看者本地时区不变
- 纯日期、空与不可解析值不带 title
- 文本与 title 经 `StoredDate` 走同一共享路径；重复的每组件格式化器已移除
- 紧凑/相对标签保留措辞，值有时间时带同样悬浮
- CLI、TUI、MCP 与 plain output 不动；时区无关测试带回退探针

## Related Concepts
- [[concepts/date-fields]] — 本悬浮编码的存储 UTC/显示本地约定与纯日期值
- [[concepts/web-ui-features]] — 经共享 `StoredDate` 组件路由的面
- [[concepts/upstream-migration]] — 上游 BACK-677 的部分移植，限于缺失的一半

## Related Sources
- [[sources/timezone-handling-fix]] — 本任务所构建的早期时区渲染工作
- [[sources/back-506-cli-utc-conversion-fix]] — 被刻意不动的 CLI 侧 UTC 处理
- [[sources/milestone-actual-dates-task]] — 被路由面之一的 milestone 日期字段
