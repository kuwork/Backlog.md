---
title: BACK-761 - 终态看板卡片显示 actualEnd
labels: [source, web-ui, dates]
created_date: 2026-10-09 22:00
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-761 - Show-the-actual-end-time-on-terminal-board-cards.md
---

# BACK-761 - 终态看板卡片显示 actualEnd

看板卡片已有计划区间与 due date，但终态列（Done）卡片不回答"何时完成的"——`actualEnd` 在进入终态时已盖章（BACK-492）却从不渲染。本任务在卡片 footer 把 actualEnd 时间戳加到 assignee 右侧（无 assignee 仍右对齐）：存储 UTC 转本地时间，格式 `M/D HH:mm`（10/9 09:45），本地年 ≠ 当前年显全年（2025/12/31 09:45），hover 显示规范 UTC 值（沿用 BACK-673 约定）；date-only 值（创建自动填充路径写的是 createdDate）按自身数字读、无时钟分量也不做时区位移。新 helper `formatStoredUtcShortStamp(value, now?)` 在 `src/web/utils/date-display.ts`，复用 `parseStoredUtcDate` / `DATE_TIME_REGEX`，有单测覆盖。

## 实现要点

**终态集合来自配置而非硬编码名**：`Board.tsx` 计算 `terminalStatuses = getTerminalStatuses(statusesConfig ?? statuses)`，`TaskColumn` 的 prop 从单数 `terminalStatus` 改为复数 `terminalStatuses` 转发；同一 `isTerminalStatusName` 判定同时接管 due-date 风险边框与逾期红（替代旧硬编码 `task.status !== "Done"`）。

**踩坑记录（双重推导）**：`isTerminalStatus(status, statuses)` 期望的是**原始 statuses 配置**并自行推导终态集；TaskCard 把已推导的 `["Done","Dropped"]` 再传进去，被当作普通名字表二次推导——两机回退名只取末位列，得到 `["Dropped"]`，全部 Done 卡片（含 BACK-239）静默不显示时间戳。修复：新增 `isTerminalStatusName(status, terminalNames)`（`src/utils/terminal-status.ts`）对已解析名字集合做纯比较、零推导，回归测试钉住。定位手段值得一提：用 `react-dom/server` 在 jsdom 里渲染真实 BACK-239 payload，区分了"bundle 过期"与"谓词错误"（server 启动时打包前端，旧进程 serving 旧 bundle，重启 browser 命令才生效）。

## Related Concepts
- [[concepts/web-ui-features]] — 看板卡片 footer 与日期呈现
- [[concepts/date-fields]] — actualEnd 语义与 UTC 存储/本地显示约定
- [[concepts/state-machine]] — 终态集由 status category 派生

## Related Sources
- [[sources/actual-start-end-fields-task]] — BACK-492 actualEnd 盖章机制（本任务消费的数据）
- [[sources/back-673-utc-hover-titles]] — hover UTC 标题约定
- [[sources/back-762-terminal-statuses-readonly]] — 终态集显式化的读取路径面（同批）
