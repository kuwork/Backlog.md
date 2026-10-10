---
title: BACK-576 - 去重 decision ID 生成函数
labels: [source, migration, cli, core, refactoring]
created_date: 2026-09-08 16:55
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-576 - Deduplicate-generateNextDecisionId-and-remove-the-core-to-CLI-dynamic-import.md
---

# BACK-576 - 去重 decision ID 生成函数

删除一个逐字节重复的 `generateNextDecisionId` 和围绕它的别扭动态导入环 workaround。`src/utils/id-generators.ts` 中已有该 helper 且零引用方，而 `src/cli.ts` 携带着被 `decision create` 使用的 67 行本地副本，`src/core/backlog.ts:createDecisionWithTitle` 则动态导入 `../cli.js` 来拿到 CLI 副本。上游 BACK-612 / draft-115 的后续。

## 实现要点

- `src/core/backlog.ts`：从 `../utils/id-generators.ts` 静态导入 `generateNextDecisionId`（与 `generateNextDocId` 一起）；`createDecisionWithTitle` 直接调用；删除 `await import("../cli.js")` workaround 及其注释。
- `src/cli.ts`：从 `./utils/id-generators.ts` 导入 `generateNextDecisionId`；删除 67 行本地副本。Grep 确认只剩一个定义，且 `src/` 中不再存在 `../cli.js` 动态导入。
- 顺序验证：CLI `decision create` 产出 decision-1 和 decision-2；构建后的二进制 Web 服务器 `POST /api/decisions` 产出 decision-3 和 decision-4——两种界面的顺序 ID 分配均保持。
- `bunx tsc --noEmit`、`bun run check .`（仅既有 `src/core/assets.ts` 警告）、限定的 `cli-doc-decision-board.test.ts` 和 `bun run build` 全部通过。

## 验收标准

- 只剩一个 `generateNextDecisionId`，位于 `src/utils/id-generators.ts`，两个原调用方都重定向到它。
- `src/core/backlog.ts` 中动态的 `await import("../cli.js")` 已消失。
- CLI `decision create` 和 Web `POST /api/decisions` 仍分配顺序决策 ID。

## Related Concepts

- [[concepts/core-architecture]] — 依赖方向：core 绝不从 CLI 层导入
- [[concepts/cli-entry]] — CLI 现在像其他调用方一样消费共享 util

## Related Sources

- [[sources/back-574-decision-list-view-update-commands]] — 本次清理支撑的决策面扩展
- [[sources/doc-9-upstream-v1-49-3-to-v1-50-1-migration-diff-classification]] — 条目 B6（上游 BACK-612）
