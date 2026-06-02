---
type: concept
title: 搜索与序列
updated: 2026-05-06
---

# 搜索与序列

## 搜索（Search）

Backlog.md 使用 Fuse.js 提供统一的模糊搜索服务，覆盖所有入口点（CLI、TUI、Web）。

### 搜索范围
- 任务（tasks）
- 文档（docs）
- 决策（decisions）

### CLI 搜索

```bash
backlog search "关键词"
backlog search "api" --status "In Progress"
backlog search "bug" --priority high
backlog search "feature" --plain
```

### TUI 搜索

交互式实时过滤，输入即更新，无需按 Enter。

### Web 搜索

支持命令过滤（command filters）和模糊匹配。

## 序列（Sequences）

从任务依赖关系自动计算出的可并行执行的任务组。

### 核心逻辑

`computeSequences(tasks)` 返回 `{ unsequenced: Task[], sequences: Sequence[] }`

- **Unsequenced**：无依赖、无被依赖、无 ordinal 的任务
- **Sequences**：按拓扑排序分层编号的任务组
- 同一 Sequence 中的任务可以并行工作
- 依赖关系形成执行顺序

### 使用场景

- 识别项目中的关键路径
- 发现可并行化的工作包
- 规划冲刺（Sprint）

### CLI/TUI/Web 支持

- `backlog sequence list` — 列出所有序列
- TUI 序列视图（只读 + 移动任务并更新依赖）
- Web UI 序列页面（拖拽重新排序）
