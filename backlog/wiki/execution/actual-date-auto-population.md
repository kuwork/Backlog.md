---
title: 实际时间字段自动填充模式
labels: [execution, pattern, dates, core]
created_date: 2026-05-29 22:36
updated_date: 2026-05-29 22:36
extracted_from:
  - sources/actual-start-end-fields-task
  - sources/actual-dates-auto-create-task
  - sources/milestone-actual-dates-task
---

# 实际时间字段自动填充模式

跨 `createTaskFromInput` 和 `updateTask` 两个入口统一实现 `actualStart` / `actualEnd` 的自动填充，避免遗漏。

## 标准步骤

1. **确定触发状态**
   - 进行中状态：`isInProgressStatus()`，大小写不敏感匹配 "inprogress"
   - 终态：`isTerminalStatus()`，即配置状态列表的最后一项

2. **在创建入口填充**（`createTaskFromInput`）
   - 若 resolvedStatus 为进行中且无 actualStart → actualStart = createdDate
   - 若 resolvedStatus 为终态且无 actualEnd → actualEnd = createdDate

3. **在更新入口填充**（`updateTask`）
   - 检测旧状态→新状态的迁移
   - 迁移到进行中且无 actualStart → 设为当前日期时间
   - 迁移到终态且无 actualEnd → 设为当前日期时间

4. **里程碑级联**（可选）
   - 任务保存后，检查所属里程碑下所有任务状态
   - 任一任务进行中 → 里程碑 actualStart（若空）
   - 最后一个非终态任务变为终态 → 里程碑 actualEnd（若空）

5. **守卫条件**
   - 仅字段为空时填充
   - 手动传入的 `--actual-start` / `--actual-end` 始终优先

## 常见陷阱

- 只在 `updateTask` 实现而忘记 `createTaskFromInput` → BACK-498 修复的正是此问题
- 使用 `new Date()` 本地时间而非 UTC 统一存储 → 需配合 `date-utc.ts` 工具

## Related Sources
- [[sources/actual-start-end-fields-task]] — BACK-492 任务级实现
- [[sources/actual-dates-auto-create-task]] — BACK-498 创建入口补充
- [[sources/milestone-actual-dates-task]] — BACK-493 里程碑级联
