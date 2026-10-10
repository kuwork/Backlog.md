---
title: BACK-592 - doc create 支持 --plain
labels: [source, cli]
created_date: 2026-09-08 16:55
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-592 - Accept-plain-on-doc-create.md
---

# BACK-592 - doc create 支持 --plain

`doc create` 子命令从未注册 `--plain`，commander 以 'unknown option' 拒绝——导致每条命令都传 `--plain` 的 agent 指引无法使用。该 flag 现在被接受并有文档，遵循 decision create --plain 先例。

- `src/cli.ts`：在 doc create help schema 中新增 `{ name: 'plain', type: 'Boolean', description: 'Use plain text output' }`，并在子命令注册 `--plain`，与 decision create 对齐。
- Create 输出本身就是纯文本，因此该 flag 仅被接受，不做格式切换。
- `src/test/cli-doc-decision-board.test.ts` 中的测试断言 exit 0、stderr 无 'unknown option'、打印创建的 id/path（12 pass）；临时项目冒烟验证通过。

## 验收标准

- doc create 接受 --plain；help schema 有文档；exit 0 并打印创建的 id/path；测试覆盖该 flag。

## Related Concepts

- [[concepts/cli-entry]] — CLI help schema 与选项注册约定
- [[concepts/cli-instructions]] — agent 指引每条命令都传 --plain
