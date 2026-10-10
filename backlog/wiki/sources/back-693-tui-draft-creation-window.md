---
title: BACK-693 - TUI 草稿会话新增创建窗口
labels: [source, tui, cli, drafts]
created_date: 2026-09-26 14:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-693 - Add-a-draft-creation-window-to-the-TUI-drafts-session.md
---

# BACK-693 - TUI 草稿会话新增创建窗口

TUI 过去没有创建草稿的入口：看板的创建键打开带工作流状态的任务编辑器，在那里创建的草稿会被丢弃并提示 "Drafts are not shown on the task board"——在一个以草稿为全部目的的会话中这是错的。本任务让草稿会话的创建键打开固定为 Draft 的任务编辑器，为 `draft create` 加上五个日期旗标，并修复一个导致会话崩溃的 resize 问题。

> **Provenance note:** 两个归档文件携带冲突的 ID BACK-694——`backlog/archive/tasks/back-694 - Add-a-draft-creation-window-to-the-TUI-drafts-session.md` 是本任务更早、更窄的切割（同标题，In Progress，仅编辑器固定范围），`backlog/archive/tasks/back-694 - Stop-the-drafts-session-crashing-with-a-popup-open-when-the-terminal-is-resized.md` 是 resize 修复的独立版本，作为"第三部分"落入本任务。活动的 BACK-694 是另一个任务（看板任务弹窗同步）。本文件是这两个被吸收范围的权威已完成记录。

## 实现要点

- 看板创建路径：`UnifiedViewOptions.draftSession`（由 `cli.ts` 中交互式 `draft list` 命令设置）是唯一开关；编辑器接收一个状态选项（`DRAFT_STATUS`，从编辑器导出而非第二个字面量）；`getCreatedTaskBoardOutcome` 让创建的草稿以普通创建提示加入会话，而任务会话保持"草稿不显示"行为
- 窗口就是任务编辑器本身，因此草稿携带与任务相同的字段，含五个日期字段；编辑器接收 `entity` 并询问 `entity-noun.ts`（BACK-692 引入的助手，移动并更名 `entityNoun`），使草稿会话显示 `Create Draft` / `Create draft`
- 移除了早期的行门：两个会话创建时都不读取光标下的行——窗口的状态字段决定列，看板聚焦创建的记录，因此空看板的草稿会话仍可创建
- CLI 一半：五个创建时日期映射抽入一个助手 `buildCreateDateFields`，由 `task create` 与 `draft create` 共同调用，因此 trimming 与 actual start/end 的存储 UTC 转换只存在一份；已发布的草稿指南列出了新选项
- Resize 修复：blessed 为每个屏幕绑定程序级 "resize" 扇出，`screen.destroy()` 从不移除它，因此 Tab 销毁的屏幕持续响应 resize 并把离开视图的过滤器头重建进死容器（"Cannot switch a node's screen."）；`src/ui/tui.ts` 的 `createScreen` 现在按引用丢弃该扇出——仍挂载的屏幕保留自身处理——覆盖每个留下屏幕的视图
- 测试：7 个新看板用例（`board-tui-draft-create`）、3 个新 draft-create 一致性用例（actual 区间经 Asia/Tokyo 子进程时区固定）、新 `tui-screen-teardown` 套件；两个五变体和一个两变体的还原矩阵各自恰好使自己的目标用例变红

## 验收标准

- 草稿会话：创建键打开固定为 Draft 的编辑器，创建的草稿加入会话并可选择；任务会话行为不变
- 窗口外观与帮助列表按会话命名创建动作（`Create draft` vs `Create task`）；创建与行无关
- `backlog draft create` 接受五个日期旗标，与 `task create` 共享映射，并以 stored UTC 形式存储 actual start/end
- Tab 切换后弹窗打开时终端 resize 不再崩溃；仅销毁屏幕的 resize 扇出被丢弃

## Related Concepts

- [[concepts/cli-tui]] — 统一视图、编辑器与屏幕生命周期约定
- [[concepts/task-lifecycle]] — 草稿作为一等会话记录
- [[concepts/date-fields]] — 共享的创建时日期映射

## Related Sources

- [[sources/back-689-tui-task-composer-dates]] — 本窗口继承的编辑器日期字段
- [[sources/back-692-tui-edit-file-location-routing]] — 编辑器复用的 `entityNoun` 助手的来源
- [[sources/back-587-repair-tui-task-composer-ux]] — 被复用为草稿创建窗口的编辑器
