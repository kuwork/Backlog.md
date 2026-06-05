---
title: 任务详情钻取导航模式
labels:
  - execution
  - pattern
  - web-ui
created_date: '2026-06-01 22:50'
updated_date: '2026-06-05 15:19'
extracted_from:
  - BACK-505
  - BACK-509
---

## 场景

在任务详情 Modal 中，用户需要进一步查看某个依赖任务或子任务的详情，同时保留返回父任务的能力。关闭 Modal 时应关闭整个浏览堆栈。

## 模式结构

### State 设计

在全局 Modal 管理组件（如 `App.tsx`）中维护导航堆栈。BACK-509 在此基础上增加了 URL 路由层，使每个打开的任务都有可分享的 `/task/:id` 链接。

```
const [taskHistory, setTaskHistory] = useState<Task[]>([]);
```

- `taskHistory` 存储已被"离开但可返回"的任务
- 当前显示的任务仍使用原有的 `editingTask` state
- 新建任务时清空 `taskHistory`，避免创建模式继承导航上下文

### 核心操作

| 操作 | 行为 |
|---|---|
| **打开任务** (`handleEditTask`) | `setTaskHistory([])` + `setEditingTask(task)` + `navigate('/task/' + id, { state: { backgroundLocation } })` |
| **钻取进入** (`handleDrillDown`) | `setTaskHistory(prev => [...prev, editingTask])` + `setEditingTask(childTask)` + `navigate('/task/' + childId)` |
| **返回上级** (`handleBack`) | 从历史尾部取父任务 → `setEditingTask(parent)` + `setTaskHistory(prev.slice(0, -1))` + `navigate('/task/' + parentId, { replace: true })` |
| **关闭 Modal** (`handleCloseModal`) | `setTaskHistory([])` + `setEditingTask(null)` + `setShowModal(false)` + `navigate(backgroundPath, { replace: true })` |

### 返回按钮渲染条件

仅在 `taskHistory.length > 0` 时传递 `onBack` 给 TaskDetailsModal，避免根级任务显示无意义的返回按钮。

## URL 路由层扩展（BACK-509）

### Modal Route pattern (background location)

打开任务时 push `/task/:id` 到历史栈，附带 `state.backgroundLocation` 指向当前页面位置。`Routes` 通过 `location={state.backgroundLocation || location}` 渲染背景页面，模态框在 `Routes` 外部渲染。

### URL Sync Effect

`AppContent` 中 `useEffect` 监听 `useMatch('/task/:id')`：
- URL 任务 ID 变化时自动打开、钻取或返回，无需手动调用 `handleEditTask`
- 直接访问 `/task/:id` 以默认视图（看板）为背景打开模态框

### 关闭行为优化

使用 `navigate(backgroundPath, { replace: true })` 替代 `navigate(-1)`：
- 避免历史残留 `/task/:id` 条目
- 防止 `setShowModal(false)` 在 URL 变更前触发的竞态条件

### Markdown 链接拦截

`MermaidMarkdown` 的 `parseTaskUrl()` 检测同源 `/task/:id` 链接，调用 `onTaskClick` 而非外部 `<a>`。Wiki 页面在 `contentRef` 事件委托中也拦截 `/task/` 点击。

### 前缀无关匹配

客户端 `stripAnyPrefix` 与服务端 `findTaskByLooseId` 支持将 `506` 解析为 `BACK-506`，URL 同时兼容 `/task/BACK-506` 和 `/task/506`。

## 常见陷阱

- **状态同步**：使用 `useRef` 保持 `taskHistoryRef` 与 `taskHistory` state 同步，避免 `handleBack` 闭包中读取到过期的历史数据
- **Modal 重置**：`TaskDetailsModal` 的 `useEffect` 依赖 `[task, isOpen, ...]` 会在 `editingTask` 变化时自动重置表单状态，无需额外处理
- **关闭竞态**：`navigate(-1)` 曾与 `setShowModal(false)` 产生竞态，改用显式 `replace` 导航到背景页面后解决

## 参考来源
- [[sources/back-505]] — 原始实现任务
- [[sources/stable-task-modal-urls-task]] — BACK-509 URL 路由扩展
