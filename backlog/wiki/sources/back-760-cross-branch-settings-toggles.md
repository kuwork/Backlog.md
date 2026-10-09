---
title: 'BACK-760 - Expose cross-branch visibility in the advanced settings page'
labels:
  - source
  - web-ui
  - config
created_date: '2026-10-09 22:00'
updated_date: '2026-10-09 22:00'
source_path: backlog/tasks/back-760 - Expose-cross-branch-visibility-in-the-advanced-settings-page.md
---

# Expose cross-branch visibility in the advanced settings page

BACK-759 把跨分支可见性变成真实配置（`include_cross_branch`，默认 false）后，Web UI 没有开关——唯一渲染相关选项的地方是一次性初始化向导（`InitializationScreen.tsx`），只能手改 yml。本任务在设置页 **Advanced Settings** 卡片的 Task Resolution Strategy 区块下方补齐三个控件（纯前端，5 文件，零后端改动）：

| 控件 | 绑定 | 默认 |
|---|---|---|
| Cross-Branch Tasks | `config.includeCrossBranch` | `?? false`（未设置即关） |
| Check Active Branches | `config.checkActiveBranches` | `!== false`（显式 false 才关） |
| Active Branch Days | `config.activeBranchDays` | `?? 30`，仅扫描开关打开时渲染 |

复用邻居开关的 `sr-only peer` checkbox + `w-11 h-6` slider 模式。四个 locale 文件各加 6 个 `settings` 键；`TranslationDict = DeepString<typeof en>` 使 `tsc` 成为其余三语的完整性检查。保存是显式的：控件只改本地 form state，必须点 **Save Changes** 才到 `config.yml`；保存后无需重启——每请求重读 yml，`handleUpdateConfig` 广播 `config-updated` + `refreshInjectedStateMachine()`。

**关键决策：扫描与展示是两个轴**。`include_cross_branch: false` 时服务器仍日志 "indexing N other local branches" 并非矛盾——扫描由 `check_active_branches` 控制（`getActiveBranchSnapshot` 在 false 时直接返回空 tips），`include_cross_branch` 只决定扫描结果是否进入看板/列表/搜索。若让后者也停扫描，因它默认 false，跨分支加载会被默认禁用：ID 分配候选集退回本地（BACK-759 修复的 705→749 回退、BACK-715 撞号复现）、`task view <id-from-another-branch>` 再次 not found。因此保持分工并同样暴露扫描开关，文案写明代价。

其他记录：`?? false` 对受控 checkbox 必需（缺键项目否则首次渲染变非受控）；实测时 `bun -e` 驱动 `PUT /api/config` 得 404 而 curl 得 200（bun fetch 对该 server 的客户端怪癖，非产品 bug）；CLI 运行再生的 71 行 AGENTS.md 状态机块被回退（与本任务无关）。

## Related Concepts

- [[concepts/web-ui-features]] — 设置页 Advanced Settings 卡片
- [[concepts/core-architecture]] — 配置体系与跨分支行为控制
- [[concepts/web-server]] — /api/config 保存路径与 config-updated 广播

## Related Sources

- [[sources/back-759-cross-branch-prefix-visibility]] — include_cross_branch 配置的引入（依赖前驱）
- [[sources/back-558-browser-server-loopback-only]] — 同一设置页卡片的先例
