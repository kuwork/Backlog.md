---
title: BACK-678 - 极端终端尺寸下的 composer 可用性
labels: [source, tui]
created_date: 2026-09-26 14:14
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-678 - Improve-composer-usability-at-extreme-terminal-sizes.md
---

# BACK-678 - 极端终端尺寸下的 composer 可用性

8 行终端下，任务 composer 的带边框输入框渲染成只有边框、没有可编辑行或光标；80/100 列下，30%-of-form 的选择器截断了最长状态值的尾部 ▼ 提示，因为几何来自固定断点。本任务让 composer 几何从内容派生：弹窗高度取外壳加一个完整的带边框输入框，弹窗宽度与紧凑布局判定来自以显示单元格实测的最长已配置选择器内容。

- `src/ui/components/task-composer.ts`：弹窗高度预留弹窗外壳加一个三行带边框输入框，8 行起聚焦字段保有可编辑行与绘制出的光标
- 弹窗宽度与紧凑/堆叠判定来自最长已配置选择器内容（状态/优先级值加尾部提示），用 `Bun.stringWidth` 实测，替换固定 64 列断点与固定 72/96% 宽度；正常选择器列保持表单的 30%，弹窗增长（受终端与外壳四列背景边距封顶）直到放下
- fork 适配：上游独立的 `stackSelectors` 标志未移植——fork 没有 Type 选择器，其紧凑布局已把两个选择器全宽堆叠，第二个标志会是死状态
- 在真实 blessed 屏上实测：80x8 可滚动表单 1 → 3 行；80x24/100x24 下状态选择器为 21 格的 `Status: In Progress ▼` 从 20 → 21 格（弹窗 72 → 74 列）；37 格已配置状态切换为堆叠紧凑布局
- 新 `src/test/tui-task-composer-layout.test.ts`（4 测试 / 72 断言）在 80x8–10、80x24、100x24、140x24 与 50x18 驱动真实 composer；整改动与逐条回退恰好使六个新断言变红
- 证据边界已记录：win32 上没有真 PTY 运行（仓库 PTY 测试架自跳过），因此证据是真实 blessed 屏的渲染部件几何
- ID 注：BACK-678 与无关的迁移台账条目重复；保留编号，台账留给单独簿记

## 验收标准

- 终端高度 8–10 时，聚焦的 composer 字段总显示至少一行可编辑并有可见光标
- 80 与 100 列下最长内置状态值（含尾部提示）渲染无截断
- 最长已配置选择器内容放不进正常选择器列时即启用紧凑布局，而非仅低于固定阈值
- 字段导航、picker 流程、focus graph 与持久化不变；现有 composer 套件仍通过

## Related Concepts
- [[concepts/cli-tui]] — TUI composer 面与 blessed 屏幕测试

## Related Sources
- [[sources/back-677-help-popup-resize-robustness]] — composer 经其 reflow 的同款 resize 感知弹窗外壳（`createPopupChrome`）
- [[sources/back-563-tui-intent-first-composer]] — 同一组件上的早期 composer UX 工作
- [[sources/back-587-repair-tui-task-composer-ux]] — 前一波 composer 修复
