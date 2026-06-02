---
title: 任务详情钻取导航模式
labels:
  - execution
  - pattern
  - web-ui
created_date: '2026-06-01 22:50'
updated_date: '2026-06-01 22:50'
extracted_from:
  - BACK-505
---

## 场景

在任务详情 Modal 中，用户需要进一步查看某个依赖任务或子任务的详情，同时保留返回父任务的能力。关闭 Modal 时应关闭整个浏览堆栈。

## 模式结构

### State 设计

在全局 Modal 管理组件（如 `App.tsx`）中维护导航堆栈：

```
const [taskHistory, setTaskHistory] = useState<Task[]>([]);
```

- `taskHistory` 存储已被"离开但可返回"的任务
- 当前显示的任务仍使用原有的 `editingTask` state
- 新建任务时清空 `taskHistory`，避免创建模式继承导航上下文

### 核心操作

| 操作 | 行为 |
|---|---|
| **打开任务** (`handleEditTask`) | `setTaskHistory([])` + `setEditingTask(task)` |
| **钻取进入** (`handleDrillDown`) | `setTaskHistory(prev => [...prev, editingTask])` + `setEditingTask(childTask)` |
| **返回上级** (`handleBack`) | 从历史尾部取父任务 → `setEditingTask(parent)` + `setTaskHistory(prev.slice(0, -1))` |
| **关闭 Modal** (`handleCloseModal`) | `setTaskHistory([])` + `setEditingTask(null)` + `setShowModal(false)` |

### 返回按钮渲染条件

仅在 `taskHistory.length > 0` 时传递 `onBack` 给 TaskDetailsModal，避免根级任务显示无意义的返回按钮。

## 常见陷阱

- **状态同步**：使用 `useRef` 保持 `taskHistoryRef` 与 `taskHistory` state 同步，避免 `handleBack` 闭包中读取到过期的历史数据
- **Modal 重置**：`TaskDetailsModal` 的 `useEffect` 依赖 `[task, isOpen, ...]` 会在 `editingTask` 变化时自动重置表单状态，无需额外处理

## 参考来源
- [[sources/back-505]] — 原始实现任务
