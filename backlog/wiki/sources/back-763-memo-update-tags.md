---
title: BACK-763 - memo update 支持 --tags
labels: [source, cli, memos, feature]
created_date: 2026-10-16 01:00
updated_date: 2026-10-16 01:00
source_path: backlog/tasks/back-763 - CLI-add-tags-to-memo-update.md
---

# BACK-763 - memo update 支持 --tags

memo 的标签此前只能在创建时设置：core 层 `updateMemo` 已接受 `{ content?, tags? }` 补丁，MCP `memo_update` 与 REST `PATCH /api/memos/:id` 也都暴露了 tags，唯独 CLI 的 `backlog memo update` 只有 `--content` 和 `--append`，改标签只能删了重建或手改 markdown。本任务补齐 CLI 这一面（范围仅限 `src/cli.ts` 命令层），与其他表面对齐。

## 目标

`backlog memo update <id> --tags meeting,important` 整体替换标签集并更新 updated_date；`--tags` 可与 `--content`/`--append` 同用；仅传 `--tags` 是合法更新而非 "No update options provided." 报错；传空值清空全部标签。

## 实现要点

- `src/cli.ts` 为 memo update 加 `-t, --tags`，沿用 memo create 的多值累加器（支持逗号分隔或重复 flag）。
- 解析走 `parseClearableStringList`，对齐 REST `parseTagList` 规则：trim、丢弃空项、trim 后精确去重；缺省（undefined）表示不动标签，显式空值（[]）表示清空。
- 放宽 no-options 守卫使 tags-only 调用合法；此时 content 保持 undefined，`updateMemo` 保留原正文。
- 更新命令 help schema 与指南 `src/guidelines/cli-instructions/memos.md:68-72`；核心、MCP、REST 三层是基线，不在改动范围内。

## 验证

新增 `src/test/cli-memo-tags.test.ts` 覆盖四条路径（替换、清空、tags+content、tags 单独），8/8 通过；memos、memo-local-day-timezone、mcp-memos、memo-search 共 48/48 通过；tsc 与 biome 干净。注意：显式指定测试文件路径时 bun 会忽略 bunfig 的 `timeout = 10000` 而回落到 5s 默认值，CLI 子进程测试需加 `--timeout 60000`。

## Related Concepts

- [[concepts/memos]] — memo 子系统，core 层 `updateMemo` 是各表面共享的更新入口

## Related Sources

- [[sources/back-730-cli-memo-subcommand]] — CLI memo 子命令本体，本任务补齐其 update 命令的标签能力
- [[sources/back-740-memo-mcp-tools]] — MCP memo 工具组，tags 更新的既有基线之一
