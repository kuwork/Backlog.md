---
title: CLI 与 TUI 界面
labels: [concept]
created_date: 2026-05-06 00:00
updated_date: '2026-09-08 17:00'
---


# CLI 与 TUI 界面

Backlog.md 提供命令行界面（CLI）和终端用户界面（TUI）两种交互方式。

## CLI 命令结构

```
backlog <command> <subcommand> [options]
```

主要命令组：
- `task` — 任务 CRUD
- `draft` — 草稿管理
- `board` — 看板查看与导出
- `search` — 模糊搜索
- `browser` — 启动 Web UI
- `doc` / `decision` — 文档与决策
- `milestone` — 里程碑管理
- `config` — 配置管理
- `cleanup` — 清理已完成任务
- `overview` — 统计概览
- `completion` — Shell 补全安装
- `mcp` — MCP 服务器管理
- `agents` — 代理指令更新

## TUI 看板（`backlog board`）

基于 bblessed 的交互式终端看板：
- 按状态分栏显示任务
- 键盘导航：方向键移动，Enter 打开任务详情
- 按 `E` 在编辑器中打开任务（自动挂起 TUI）
- Tab 键在看板与任务列表间切换
- 支持看板移动模式（move mode）
- 实时文件监控（Bun.watch）

## TUI 任务列表

- 可筛选：状态、负责人、标签、里程碑
- 紧凑视图支持
- 循环导航（首尾相连）

## 纯文本输出（`--plain`）

所有查看类命令支持 `--plain` 标志，输出结构化纯文本而非交互式 UI，便于 AI 代理解析和脚本处理。

## 看板实时刷新（BACK-555）

TUI 看板对单事件原子写入进行了稳健处理：
- `src/utils/task-watcher.ts` 使用有界对账模型：按规范化 ID 防抖、两次稳定可读读取、有限重试、抑制重复发布、取消过期世代、临时文件事件触发目录对账
- `src/ui/unified-view.ts` 通过单一 `applyUnifiedTaskUpdate` 回调管线统一处理 add/change/archive/delete，保持选中任务有效并在删除后选择相邻任务
- `src/ui/task-viewer-with-search.ts` 订阅对账后的状态并重建搜索索引

## 意图优先任务创建器（BACK-563）

按 `N` 键在看板上直接打开任务创建器：
- 字段：Title、Description、Status（Draft + workflow statuses）、Priority
- 空间方向键导航、caret-aware 删除、inert Tab/Shift+Tab 字段切换
- 非 Draft 任务创建后立即插入看板并聚焦；Draft 任务报告为未在看板显示
- 空看板保持可打开，创建器可达
- 创建失败由调用方 try/catch 处理，不使用上游的 core 快照/rollback 或 git CAS 管线

## 主题自适应、滚动与 Tab 切换（BACK-565）

- `src/ui/tui.ts` 新增 `addScrollKeys` 助手，为 scrollable viewer 提供 PageUp/PageDown/Home/End 和滚动条指示器
- `src/ui/components/generic-list.ts` 增加 pageup/C-u、pagedown/C-d、home、end 导航，默认边框颜色从蓝色改为默认色
- `src/ui/loading.ts` 加载框边框从青色改为默认色
- 保留看板移动态的青色高亮（fork 有意定制）
- Tab 在看板与任务列表间切换通过复用单一 blessed `program` 并清理旧屏幕的 key/keypress 监听器实现稳定双向切换

## 验收标准进度指示（BACK-569）

TUI 看板卡片、任务列表和任务详情对 In Progress 任务显示 `[██████░░░░] 4/7` 式进度：
- 从验收标准实时派生，不持久化为单独状态
- 无 AC 任务不显示任何值
- 全部勾选的 In Progress 任务仍显示 In Progress 状态
- 10 格条（终端宽度 <32 时回退到 5 格）

## 按键族边界导航架构（BACK-588/589）

列表组件支持 arrow / vim 两套按键族（h/j/k/l 与方向键并存）的边界导航：

- `BoundaryNavigationKey` 类型 + `resolveListBoundaryNavigation` 解析助手统一判定按键在列表边界的语义（停在边界 / 越界切换 / 翻页）
- `GenericList` 把按键族信息携带到边界回调，由调用方决定越界后的行为（如跳转到相邻面板）
- vim 键在筛选弹窗等复合组件中同样生效（[[sources/back-589-vi-navigation-filter-popups]]）

## footer / help 提示契约（BACK-590/594）

- 大写按键指示器约定：footer 与帮助面板中的按键提示统一用大写字母指示可按键
- `footer-content.ts` 常量模式：footer 文案集中为常量，避免散落字符串漂移

## TUI 窗口标题（BACK-591）

- `formatTuiTitle` 共享助手统一生成窗口标题格式
- 终端标题 push/pop 配对：进入 TUI 压入标题，退出时弹出恢复原标题
- tmux 环境通过 DCS 序列透传标题，嵌套终端中也能正确显示

## 双 pane 交互浏览器模式（BACK-574/575）

task → decision → doc 三类列表**三次复用同一交互模型**（双 pane 浏览器）：

- 决策列表视图更新命令（[[sources/back-574-decision-list-view-update-commands]]）与文档列表交互浏览器（[[sources/back-575-doc-list-interactive-browser]]）共享同一套 pane 布局与导航逻辑
- `releaseSharedProgram` 加固共享 blessed program 的释放，防止多次进入/退出后按键泄漏或屏幕错乱

## 隐藏空列（BACK-590）

看板隐藏空状态列：

- 持久化共享 `hide_empty_columns` 配置键
- 乐观翻转：UI 立即反映切换，写入异步落盘
- 退出时 `await` 挂起的写入，避免配置丢失

## Shell 补全

内置 bash/zsh/fish/PowerShell 补全脚本：
- 动态补全实际任务 ID
- 动态补全配置中的状态值、标签、负责人
- `backlog completion install` 一键安装
