---
title: 使用 Duck-typing 替代 instanceof 以保证可测试性
created_date: 2026-05-29 22:36
updated_date: 2026-05-29 22:36
labels: [decision, testing, web-ui, typescript]
---

# 使用 Duck-typing 替代 instanceof 以保证可测试性

## 决策

`isTypingTarget` helper 使用 duck-typing（检查 `.tagName` 和 `.isContentEditable`）而非 `instanceof HTMLElement`，确保在 Bun/Node 测试运行器中可测试。

## 背景

BACK-494 需要检测键盘事件目标是否为文本输入元素（input、textarea、contenteditable）。第一反应是使用 `target instanceof HTMLElement` 或 `target instanceof HTMLInputElement`。

## 问题

Bun 的测试运行器不提供 `HTMLElement` 全局对象，使用 `instanceof` 会导致运行时错误：`ReferenceError: HTMLElement is not defined`。

## 方案对比

| 方案 | 优点 | 缺点 |
|---|---|---|
| `instanceof HTMLElement` | 类型安全，语义清晰 | 测试运行器不可用 |
| **Duck-typing（选择）** | 测试运行器可用，零依赖 | 类型上稍弱（需 `as` 断言） |
| 条件全局检测 | 保留 instanceof | 代码冗余，测试仍需 mock |

## 实现

```ts
export function isTypingTarget(target: unknown): boolean {
	if (typeof target !== "object" || target === null) return false;
	const el = target as { tagName?: string; isContentEditable?: boolean };
	const tag = el.tagName?.toLowerCase();
	return tag === "input" || tag === "textarea" || el.isContentEditable === true;
}
```

## 影响

- 所有 Web UI 工具函数若需在 Bun/Node 中测试，优先采用 duck-typing
- 测试覆盖 input、textarea、contenteditable、普通 div、null target、非 HTMLElement 对象

## Related Sources
- [[sources/task-edit-modal-keyboard-fix]] — BACK-494 实现
