---
title: 里程碑管理
labels: [concept, milestones, cli, mcp]
created_date: '2026-07-14 11:20'
updated_date: '2026-09-26 14:45'
---

# 里程碑管理

里程碑按迭代、版本或发布周期对任务进行分组，以 Markdown 文件形式存储在 `backlog/milestones/` 中，与 `tasks/` 中的具体工作项相区别。

## 重要区别

给任务指定 `--milestone` 只会在任务文件中记录里程碑名称，**不会创建里程碑文件**。要创建带 ID 和元数据的里程碑，必须显式使用 `milestone add`（或 MCP `milestone_add`），然后再将任务分配给它。

## CLI 用法

```bash
# 创建里程碑
backlog milestone add "Release 2.0" -d "Ship the v2.0 release"

# 编辑里程碑
backlog milestone edit "Release 2.0" -t "Release 2.1" -d "Updated scope"
backlog milestone edit "Release 2.0" --due-date 2026-06-15
backlog milestone edit "Release 2.0" --planned-start 2026-06-01 --planned-end 2026-06-10
backlog milestone edit "Release 2.0" --clear-due-date --clear-planned-start --clear-planned-end

# 列出里程碑
backlog milestone list
backlog milestone list --show-completed
backlog milestone list --plain

# 移除里程碑并处理其任务
backlog milestone remove "Release 2.0"
backlog milestone remove "Release 2.0" --task-handling keep
backlog milestone remove "Release 2.0" --task-handling reassign --reassign-to "Release 3.0"

# 归档里程碑
backlog milestone archive "Release 2.0"

# 看板按里程碑分组
backlog board --milestones
```

## MCP 工具

- `milestone_add` — 创建里程碑，支持标题、描述、actualStart、actualEnd
- `milestone_edit` — 重命名里程碑并更新日期字段
- `milestone_remove` — 移除活动里程碑并可选清空/保留/重新分配任务
- `milestone_archive` — 归档里程碑（移动到 `backlog/archive/milestones`）
- `milestone_list` — 列出活动与已归档里程碑

## 任务分配

CLI：

```bash
backlog task create "Feature X" -m "Release 2.0"
backlog task edit 7 --milestone "Release 2.0"
backlog task edit 7 --clear-milestone
```

MCP：

```
task_create: { title: "Feature X", milestone: "Release 2.0" }
task_edit: { id: "BACK-7", milestone: "Release 2.0" }
```

`-m` / `--milestone` 支持按标题、ID（如 `m-2`）或数字别名（如 `2`）模糊匹配。

## 关键规则

- 里程碑文件位于 `backlog/milestones/`；归档后移动到 `backlog/archive/milestones/`。
- 里程碑 ID 格式为 `m-N`，创建时自动分配。
- 归档会解除任务绑定但不删除任务；任务回到未分配池。
- 优先使用 CLI 或 MCP API 而非临时文件写入，以保证 frontmatter 和元数据有效。
- 里程碑支持 `actualStart` 与 `actualEnd` 字段（datetime UTC），与任务日期字段行为一致（参见 [[concepts/date-fields]]）。

## Web 里程碑卡片任务表

Web 里程碑卡片内的任务表与 All Tasks 对齐（[[sources/back-543-milestone-cards-created-column|BACK-543]]）：
- 默认按序号（ordinal）排序，新增 Created 列（显示 createdDate）
- 表头三击循环：升序 → 降序 → 清除并恢复默认序号排序
- 里程碑卡片本身顺序保持不变

## 里程碑 ID 过滤解析（BACK-560）

任务列表的里程碑过滤现在统一解析：
- 数字 ID（`0`）、规范 ID（`m-0`）、大小写变体
- 标题精确/部分/模糊匹配，保留标点符号语义
- CLI `task list`、交互式任务列表、MCP `task_list` 的 active 与 Draft 路径行为一致

实现核心为 `src/utils/milestone-filter.ts` 的 `MilestoneFilterValueResolver` + `createMilestoneFilterMatcher`，被 Core 查询、task-search、交互式看板/列表和 MCP Draft 过滤复用。

## documentation 字段（BACK-619）

里程碑新增 `documentation` 字段：CLI / MCP / Web 三个 surface 经 `MilestoneHandlers` 一次实现，三端同时获得读写能力，无逐端补丁。

## created_date / updated_date 字段（BACK-618）

里程碑文件新增 `created_date` / `updated_date` 字段，与任务字段语义一致；实质变更时投影自动刷新时间戳，仅序号类无实质变更不刷新。

## archive 与 remove 语义差异（BACK-622）

- **仅 remove 动任务文件**：`milestone remove` 才按 `--task-handling` 处理（清空/保留/重新分配）任务文件；`milestone archive` 只解除绑定并移动里程碑文件本身，不触碰任务文件内容
- **对话框文案澄清**：Web 确认对话框明确写出两者对任务文件的差异后果，避免用户误以为 archive 会删除任务

## actualEnd 自动盖章修复（BACK-706）

里程碑 `actual_end` 自动填充分支此前是死代码：判定任务集合时翻转中的任务在磁盘上仍是保存前状态，`every(isTerminalStatus)` 永假。修复在 `updateTask` 的里程碑自动填充块中先把翻转任务按 ID 解析为新状态再判定；仅在里程碑下最后一个非终态任务落终态且 `actual_end` 为空时盖章，已设置值与非关闭性流转不受影响（[[sources/back-706-milestone-actual-end-stamp]]）。

## 里程碑 board TUI 与 plain 分组输出（BACK-687/688）

- **BACK-687**:`backlog milestone list` 从静态计数输出替换为双 pane 交互 TUI——左侧里程碑列表、右侧按所选里程碑 scope 的真实看板，共享顶部过滤栏;Space 切换 scope、Enter 打开仅元数据的里程碑弹窗、N 新建；内嵌看板经 `BoardEmbedOptions` / `BoardHandle` 由宿主 pane 持有键盘（[[sources/back-687-milestone-board-tui]]）。
- **BACK-688**:`milestones list --plain`(及非 TTY stdout）复用看板渲染器 `generateMilestoneGroupedBoard` 输出按里程碑分组的 markdown(No Milestone 在前，里程碑按文件顺序，任务按状态分节），与 `board -m` 形状一致;`--show-completed` 加载 completed 目录，归档里程碑任务折叠进 No Milestone（[[sources/back-688-milestones-plain-grouped-output]]）。

## 里程碑弹窗 live sync（BACK-696）

里程碑会话此前无 watcher，弹窗/侧栏/列都是定格画面。新增 `watchMilestones`（监听 milestones 与 archive-milestones 目录，`milestoneContentSignature` 单一变更定义）配合既有 task watcher；弹窗经返回的 `update`/`focus` **原地**重渲染而非关闭重开（宿主 await `closed` 决定是否打开编辑表单），离表关闭并提示、签名变化即重渲染（[[sources/back-696-milestone-popup-live-sync]]）。

## Related Concepts

- [[concepts/date-fields]] — 日期字段语义与格式
- [[concepts/cli-instructions]] — CLI 指令表面
- [[concepts/mcp-workflow]] — MCP 工作流与 AI 集成
- [[concepts/task-lifecycle]] — 任务生命周期

## Related Sources

- [[sources/back-521.7]] — BACK-521.7 Milestone CLI parity with MCP operations
- [[sources/back-521.14]] — BACK-521.14 Update CLI/MCP instruction guides with missing agent guidance
- [[sources/milestone-actual-dates-task]] — BACK-493 里程碑 actualStart/actualEnd 支持
- [[sources/back-543-milestone-cards-created-column]] — BACK-543 里程碑 Created 列
- [[sources/back-618-milestone-created-updated-dates]] — BACK-618 里程碑创建/更新时间戳
- [[sources/back-619-milestone-documentation-field]] — BACK-619 documentation 字段
- [[sources/back-622-milestone-archive-remove-dialogs]] — BACK-622 archive/remove 语义与对话框
- [[sources/back-706-milestone-actual-end-stamp]] — BACK-706 actualEnd 自动盖章修复
- [[sources/back-687-milestone-board-tui]] — BACK-687 里程碑 board TUI
- [[sources/back-688-milestones-plain-grouped-output]] — BACK-688 plain 分组输出
- [[sources/back-696-milestone-popup-live-sync]] — BACK-696 里程碑弹窗 live sync
