---
title: BACK-664 - 依赖输入接受已完成前置并只读打开
labels: [source, web-ui, core, dependencies, completed-corpus, i18n]
created_date: 2026-09-26 14:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-664 - Let-the-dependency-input-accept-completed-predecessors-and-open-them-read-only.md
---

# BACK-664 - 依赖输入接受已完成前置并只读打开

用户经 BACK-629 报告：其依赖 BACK-624 已移入 `backlog/completed/`，弹窗把该前置显示为一个既无法打开也无法编辑的裸字符串。依赖面在四个地方中断——写入校验、chip 解析、点击穿透和建议——本任务让已完成前置端到端成为一等依赖目标。

- 写入路径（`src/utils/task-builders.ts`）：`validateDependencies` 通过新的 `resolveUniqueDependency` 跨工作副本任务、草稿和已完成记录解析目标；多个匹配绝不静默解析——一个身份被多条记录声称会抛 `AmbiguousTaskIdError`，一个输入命名多个身份会抛 `AmbiguousIdError`；解析出的 id 随后走 `core.loadTaskById(resolved, { includeCrossBranch: false })`，因为 `queryTasks()` 每个身份只报一条记录，看不到 `backlog/tasks/` 中两个文件声称同一 ID
- 归档记录刻意留在语料外：归档会把 ID 释放给下一个任务，残留的归档文件会让对 ID 新持有者的依赖产生歧义——只有归档记录携带的依赖像任何未知 id 一样被拒
- Web：`TaskDetailsModal` 推导一个 `dependencyCorpus`（看板语料加上它已为就绪判定按 ID 拉取的记录）并传给 `DependencyInput`，completed chips 因此解析出标题并链接；`App.handleDrillDown` 现在把 `preloadedTask` 放入导航状态（与搜索对话框相同），点击经 BACK-663 只读打开记录而不是弹回看板
- 建议：`DependencyInput` 增加可选 `searchCompletedTasks` 源（250ms 防抖），复用 BACK-662 的 `/api/search?completed=true`，带 completed 标签；textarea 从 `onChange` 迁到 `onInput`，因为只有 `onInput` 能在 JSDOM 中驱动（milestone 搜索字段先例）
- 评审跟进：`CompletedBadge` 组件在此加入（picker 首次需要它），四种语言都加 `common.completedBadge`，替换一次性灰色 chip，picker、看板卡片和任务列表行共享一套 emerald 配色；行级断言钉住配色，灰色 chip 无法回归
- 回退验证一次一半（每半确认红后恢复）：语料扩大、归档排除、工作副本歧义查找、`dependencyCorpus`、`preloadedTask` 钻取、防抖 completed 搜索；在 BACK-629/BACK-624 上经 headless Chrome + CDP 实测验证

## 验收标准

- 已完成任务的依赖在 CLI、MCP 和 Web 的创建与编辑时被接受；未知 ID 仍被拒；重复身份以 `AmbiguousTaskIdError` fail-closed；归档记录永不是目标
- 保存依赖列表已含已完成前置的任务不再报错或丢条目
- 已完成前置 chip 解析为 `ID - title` 并链接；点击以 completed 归档提示只读打开，不弹回看板
- 输入时下拉提供匹配的已完成任务并带共享 completed 徽标；选择一个保存成功
- 活跃任务行为（建议、chips、钻取、就绪判定）不变

## Related Concepts
- [[concepts/task-identity]] — 规范 ID 去重、歧义 fail-closed、归档时 ID 释放
- [[concepts/web-ui-features]] — 依赖 picker 与钻取约定
- [[concepts/task-lifecycle]] — 已完成与归档状态作为依赖目标（或非目标）

## Related Sources
- [[sources/back-662-completed-corpus-query-search]] — 依赖：picker 复用的 `/api/search?completed=true` 标志
- [[sources/back-663-completed-popup-read-only]] — 依赖：被点击穿透 chips 落入的只读处理
- [[sources/back-615-dependency-readiness-guidance]] — 依赖：其按 ID 拉取供应 chip 语料的就绪判定机制
- [[sources/back-661-deep-link-first-load-guard]] — 被 `preloadedTask` 负载绕过的 App 导航回退
