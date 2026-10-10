---
title: BACK-653 - README 看板导出去除临时文件中转
labels: [source, cli, board-export, upstream-migration]
created_date: 2026-09-26 14:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-653 - Remove-the-temp-file-roundtrip-in-README-board-export.md
---

# BACK-653 - README 看板导出去除临时文件中转

`updateReadmeWithBoard` 把生成的看板写入工作目录里固定的 `.temp-board.md`，随即读回，再 shell 出去删除——纯属运输，而且确实有害：同一目录两次导出互相覆盖，崩溃会留下文件，清理还会删掉任何恰好同名的用户文件。本任务改为在内存中生成看板；产出的 README 小节逐字节一致。

- `src/readme.ts` 现在直接 import `generateKanbanBoardWithMetadata` 并赋值其返回值；临时写入、读回与 shell 清理代码块全部删除，看板导出不再触碰除 README 之外的任何文件系统路径
- README 小节组装未动：BOARD_START/BOARD_END 标记、License 锚点、追加回退、标题、副标题与 `Generated on` 时间戳行为与之前完全一致；`src/readme.ts` 与上游版本逐字节一致（blob a01bd028a）
- 误删用户文件的风险真实存在：修复前的清理曾删除一个无关的 `.temp-board.md`，新回归用例在旧代码上以 ENOENT 失败
- 刻意不做：`src/board.ts:101` 处让 `items.sort()` 不变更原数组——该数组在同一次 `generateKanbanBoardWithMetadata` 调用内构建并丢弃，没有调用方能观察到这次变更，防御性拷贝纯属浪费
- 测试：新的 `src/test/readme-board.test.ts`（5 个用例）——标记替换、幂等重跑、无标记时带版本后缀追加、README 创建、以及误留 `.temp-board.md` 用例；经 tsc、Biome 验证，并用回退检查确认误留文件用例恢复变红

## 验收标准

- `updateReadmeWithBoard` 在内存中构建看板字符串，绝不写入、读取、清空或删除 `.temp-board.md`
- 看板导出后工作目录只剩下原本的文件，预先存在的 `.temp-board.md` 内容保持不变
- README 看板小节不变：重跑时标记替换、License 锚点、追加回退、标题/副标题/时间戳
- 回归测试覆盖标记替换、幂等重跑、追加回退、README 创建与误留文件用例（修复前变红）

## Related Concepts

- [[concepts/upstream-migration]] — 移植自上游 BACK-651（commit 135bafd76），来自 v1.50.1..v1.52.0 波次
- [[concepts/core-architecture]] — 看板生成在 `src/board.ts`；README 导出在 `src/readme.ts`

## Related Sources

- [[sources/back-654-board-export-grandchild-subtasks]] — 同一上游波次的兄弟看板导出修复
