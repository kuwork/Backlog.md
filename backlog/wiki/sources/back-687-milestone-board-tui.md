---
title: BACK-687 - TUI 里程碑交互式看板视图
labels: [source, cli, tui, milestones]
created_date: 2026-09-26 14:14
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-687 - CLI-TUI-Replace-milestones-list-with-an-interactive-milestone-board-view.md
---

# BACK-687 - TUI 里程碑交互式看板视图

`backlog milestone list` 曾是静态计数转储。本任务把它换成双窗格交互 TUI——左侧里程碑列表，右侧限定到所选里程碑的真实看板，顶部一个共享过滤器栏——`--plain` 与非 TTY 标准输出保留文本输出。经十轮由实际使用驱动的评审发货。

- `src/ui/board.ts`：可选 `BoardEmbedOptions` 嵌入与 `visibleFilters`；一个 `keysActive()` 谓词路由每个看板按键，宿主窗格可持有键盘；宿主侧边栏内边距与看板外观对齐；列框经 `areaLabel`（provider，框标题跟随选择：`Tasks · <name>`）；`BoardHandle`（`focusBoard`、`syncChrome`、`focusFilters`）；无嵌入时看板不变
- `src/ui/milestones.ts`（新）：侧边栏先列未分配桶再按里程碑文件顺序列每个里程碑（已完成的打标，无隐藏）；方向键只移动光标，Space 限定看板（被限定行加 `▶ ` 前缀）；Enter 打开仅元数据的里程碑弹窗（无任务列表）；N 在列表创建里程碑、在看板创建默认落到被限定里程碑的任务
- `src/utils/milestone-search.ts`（新）：一个里程碑搜索契约，TUI 头部与 `MilestonesPage.tsx` 共享（精确 id → 子串 → 共享模糊索引），对整个语料解析并与 scope 求交，列与计数一致
- `src/ui/components/milestone-form.ts`（第 10 轮）：一个表单同时支撑创建与编辑——Title（仅创建）、Description、Due、Planned from/to、Actual from/to；日期按 `YYYY-MM-DD` 或 `YYYY-MM-DD HH:mm` 校验；详情弹窗的 E 以播种状态重新打开表单；标题刻意只读（文件名以它命名）；写经 `createMilestone` / `core.updateMilestone(id, title, options, false)`——显式 `false` 防止就地编辑被提交为 "Rename milestone"
- 评审轮修复：退出释放进程级 blessed program（`releaseSharedProgram`）以恢复 stdin raw 模式；列边框色从 `isScopeActive()` 派生，非键盘窗格不为黄色；里程碑弹窗打开时渲染并画与任务弹窗相同的黑色背景；过滤器栏以 `<shown>/<total> tasks` 结尾，total 为整个语料（`BoardEmbedOptions.summaryTotal`）；行计数经导出的纯 `filterBoardTasks` 拆为过滤显示数与里程碑总数
- 记录的 blessed 怪癖：`textbox.readInput()` 同步设置 `screen.grabKeys` 但在更晚的 nextTick 才挂字符监听（间隙键入的字符被丢——测试重打到值增长为止），拆掉仍在读取的 prompt 会让之后每个按键失效
- 环境注意：本工作区是 admin 目录缺失的 git worktree，因此 git 依赖测试仅因此失败；仓库级 `bun run check .` 保留未动文件中的预先存在错误（DoD #2 未勾选）
- 测试：`src/test/milestones-tui.test.ts` 经各轮增长到 22 用例；board/help/web-milestone/cli-milestone 套件绿；固定 sleep 换成状态等待（`waitUntil`）

## 验收标准

- TTY 启动 TUI；`--plain`/非 TTY 保留文本输出与 `--show-completed` 语义
- 双窗格，选择驱动看板，焦点随方向键/j/k 移动；右窗格复用真实看板，列、快捷键与过滤器与 `task list` 一致；里程碑上 Enter 打开仅元数据详情；任务上 Enter 打开现有任务弹窗
- 过滤器栏跨双窗格（Search/Priority/Labels，无里程碑过滤器），匹配 Web 里程碑页面，选择变化间保持应用；`<shown>/<total>` 摘要对整个任务总数计数
- 列表先未分配桶再按文件顺序；每行显示活跃过滤器下自己的 done/total；N 创建里程碑/任务；只有持有键盘的窗格高亮

## Related Concepts
- [[concepts/milestones]] — 本视图渲染的里程碑模型与桶排序
- [[concepts/cli-tui]] — 看板嵌入、键盘归属与 blessed 拆卸纪律
- [[concepts/date-fields]] — 表单捕获与校验的五个里程碑日期

## Related Sources
- [[sources/back-686-shared-search-consumers]] — 提供头部栏所用共享里程碑搜索契约
- [[sources/back-688-milestones-plain-grouped-output]] — 在同一入口恢复分组纯文本输出的后续
- [[sources/back-575-doc-list-interactive-browser]] — 同拆卸模式的早期交互列表查看器
