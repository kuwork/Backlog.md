---
title: BACK-725 - 统计新增任务平均完成耗时
labels: [source, statistics, cli, web-ui, gantt]
created_date: 2026-10-03 01:10
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-725 - Add-average-task-completion-time-to-project-statistics.md
---

# BACK-725 - 统计新增任务平均完成耗时

项目统计缺少完成耗时指标，且既有指标存在多处缺陷：`averageTaskAge` 是混合口径（终态任务算 updatedDate-createdDate、开放任务算 now-createdDate），既非交付周期也非在制时长；`getTaskStatistics` 内 6 处硬编码字符串 "Done"，遇到重命名或多终态的项目（本项目已声明 Dropped 列）统计错误；两条统计代码路径读取的语料不一致（缓存路径用仅活跃快照、冷路径用活跃+已完成，数字随缓存状态漂移）；冷路径把原始 statuses 对象喂给 `string[]` 参数，server 重启后首次加载整个状态分布渲染成一行 `[object Object]`。

## 实现要点

核心设计决策（2026-09-30 与用户敲定，不可再翻案）：新指标是 Gantt 解析出的跨度——即 Gantt 左表 Actual Start / Actual End 两列显示值的差，fallback 链为 start = actualStart -> createdDate -> now，end = actualEnd -> updatedDate -> createdDate+1d -> start+1d，end<start 时按 Gantt 一样钳到 start+1d；不加排除规则、不加 flooring、不另设 lead-time 指标。每个规范终态任务都计入样本（样本数=完成数）；完成只认 `getTerminalStatus()` 的规范终态（此处为 Done，Dropped 不算完成）；显示单位固定为分钟；报告语料成为参数，默认仅活跃语料（`backlog/tasks/` 下非空状态），含 `backlog/completed/` 为显式 opt-in，沿用既有 show-completed 机制（API `completed=true`、页面 URL `completed=1`、共享组件 `CompletedFilterToggle`、CLI `--completed`、MCP `task_list({completed:true})`）。

实现：Gantt 时间解析抽成共享 helper `src/utils/task-time-span.ts`，GanttView 与 `core/statistics.ts` 共同消费，配 parity 测试钉死两个面不漂移；统计模块改收原始 statuses 配置，用 `getTerminalStatus` 判定完成，新增 `projectHealth.averageCompletionMinutes` 与 `completionSampleCount`；server 侧收敛为一个 `computeStatistics(includeCompleted)` 同时服务热路径与冷路径，缓存按 scope 分键、整体失效；Web 统计页通过页面 URL 参数拥有 scope，plain 变体的 CompletedFilterToggle 放在贡献热力图卡片右上角，新指标作为顶部指标行第五张卡片（分钟+样本量），en/zh-CN/zh-TW/ja 四个 locale 全部覆盖。

命名收尾：旧 averageTaskAge 标签保持不变，新指标 i18n 键 `avgTimeSpent`，中文标签用较长的「任务平均耗时」以与旧的「平均耗时/平均周期」区分。

遗留：评论中明确记录 wiki 侧需跟进——`concepts/project-health.md`、`usermanual/60-配置与运维/02-项目概览.md`、`sources/back-490-overview-command-task.md` 需补充新指标与语料 scope 参数（wiki 有自己的评审流程，未随任务一并修改）。

## 验证

本仓库实测：默认 scope 411 任务、386 完成、均值 5153 分钟；扩展 scope 715/690/5305 分钟（与实现前探针值 5304.5 吻合）。91 行跨度恰为 0（createdDate 与 updatedDate 同分钟）、3 行真倒挂按钳位计 24 小时，均为有意保留的历史数据；均值强烈右偏（中位数仅 50 分钟），故卡片在均值旁显示样本量。

## Related Concepts

- [[concepts/gantt-view]] — 新指标的跨度定义完全复用 Gantt 的 Actual Start/Actual End 解析链，两边共享同一 helper 保证不漂移
- [[concepts/project-health]] — 新指标进入 projectHealth 输出，且任务评论指出该 concept 页需补充第二指标与语料 scope 说明
- [[concepts/statistics-corpus-scope]] — completed 语料 opt-in、规范终态完成判定与按 scope 分键缓存的统计语料范围约定

## Related Sources

- [[sources/back-490-overview-command-task]] — overview 命令的引入任务，新指标与 --completed 旗标挂在其输出上，评论点名该 source 页需更新
- [[sources/back-662-completed-corpus-query-search]] — 已完成语料查询机制的既有约定，本任务的 scope 参数沿用了同一套 completed 语料机制
- [[sources/back-665-completed-corpus-filter-checkbox]] — 同为 completed 语料开关的 UI 约定来源
