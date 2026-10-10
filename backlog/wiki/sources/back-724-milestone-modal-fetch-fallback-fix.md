---
title: BACK-724 - 修复里程碑弹窗 fetch 回退不填充表单
labels: [source, web-ui, bug]
created_date: 2026-10-03 01:10
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-724 - Fix-MilestoneDetailsModal-form-not-populating-on-fetch-fallback.md
---

# BACK-724 - 修复里程碑弹窗 fetch 回退不填充表单

MilestoneDetailsModal 的 reset effect 依赖 `[isOpen, milestoneId]`，当弹窗在 milestone 数据未就绪时打开（走 fallback 的 `fetchMilestone` 异步解析路径），effect 不会重跑，fetch 完成后所有表单字段保持空白。

## 解决方案

为什么不能简单把 `activeMilestone` 加进依赖：那样父数据刷新时会覆盖用户正在编辑的内容。任务采用了 TaskDetailsModal 已有的 dirty-preservation 模式：把 `preserveDirtyRefreshValue` 与 `areJsonEqual` 抽取到共享模块 `src/web/utils/form-refresh.ts`，保留 form baseline ref，让 reset effect 对整个 milestone 对象响应（fallback fetch 晚到也能填充），同记录刷新时只覆盖用户未编辑的字段。依赖变完整后原 biome-ignore（抑制 useExhaustiveDependencies）随之移除，TaskDetailsModal 也改为导入共享 helper。

实现细节：reset effect 复用已有的 baseline useMemo，新增回归测试 `src/test/web-milestone-modal-refresh.test.tsx` 覆盖 fallback 填充与 dirty 保留两条路径；name 输入框获得 `id=milestone-details-modal-name`。biome / tsc / 相关测试全绿。

这个模式的价值在于：BACK-723 审计中恰好在 TaskDetailsModal 发现过同类依赖过期 bug（Cmd+S 保存旧数据），说明"refresh 时保留脏字段"是项目中多个弹窗共享的关切，值得作为通用 helper 维护。

## Related Concepts

- [[concepts/milestones]] — 修复对象是里程碑详情弹窗的表单数据流（fetch fallback 晚到时的填充时机）
- [[concepts/web-ui-features]] — dirty-preservation 刷新模式适用于所有 Web 弹窗表单

## Related Sources

- [[sources/back-580-milestone-detail-view-edit-modal]] — 同一弹窗（MilestoneDetailsModal 的查看/编辑功能）的早前任务
- [[sources/back-696-milestone-popup-live-sync]] — 同一弹窗的 live-sync 行为任务，同属里程碑弹窗数据流演进
