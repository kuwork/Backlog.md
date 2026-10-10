---
title: BACK-633 - 启用 Web 决策编辑
labels: [source, web-ui, decisions]
created_date: 2026-09-26 14:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-633 - Enable-decision-editing-in-the-Web-UI.md
---

# BACK-633 - 启用 Web 决策编辑

决策正文无法从 Web UI 编辑：Edit 按钮被 `{false ? ... : null}` 守卫硬渲染禁用，另一入口 `?edit=true` 因 `[id, decisions]` effect 在每次父组件刷新时重置编辑模式，在挂载约 1.3 秒后被取消。本任务修复两处，并让 BACK-632 的图片提升路径可达。

- 仅 `DecisionDetail.tsx`（+`useRef` 导入）：Edit 按钮现在仅在页面非编辑态时渲染，编辑态由取消/保存按钮对替换
- 按路由重置的 effect 由 `handledRouteIdRef` 守卫：重置（及 `loadDecisionContent`）现在仅在决策 id 实际变化时运行，父组件决策数组刷新不再取消编辑模式，也不再把进行中的编辑用重载内容覆盖
- 深链不受影响：`loadDecisionContent` 总是从 API 拉取，所以丢掉刷新触发重跑没有任何损失
- 保存仍走 `apiClient.updateDecision` 并带 BACK-632 临时图片提升；取消恢复 `originalContent`
- 在真实浏览器中用一次性决策验证：编辑器越过旧的约 1.3s 重置窗口保持打开（4 秒时检查），编辑持久化到文件，`?edit=true` 持续有效，导航到另一决策返回预览态
- 记录后续：该界面的创建半边仍不可达（侧边栏加号按钮被注释）——在 BACK-634 单独启用

## 验收标准

- Edit 按钮出现在预览模式并打开 markdown 编辑器；编辑时由取消/保存替换
- 编辑模式在父组件决策刷新下存活，不在挂载约 1 秒后重置
- 真实路由变化仍重置按决策状态并以预览态加载另一决策
- 保存经现有 updateDecision 路径持久化；取消恢复原内容

## Related Concepts

- [[concepts/web-ui-features]] — 详情页编辑模式约定
- [[concepts/browser-loading]] — Web 详情页中的 effect 依赖与刷新守卫陷阱

## Related Sources

- [[sources/back-632-decision-image-promotion]] — 本任务使其可达的潜在保存路径修复
- [[sources/back-634-decision-creation-sidebar]] — 启用同一界面创建半边的下一任务
- [[sources/back-635-decision-status-editing]] — 在此启用的编辑器之上构建状态编辑
