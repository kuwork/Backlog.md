---
title: BACK-741 - CLI 长列表 grep 风格分页
labels: [source, cli]
created_date: 2026-10-03 01:10
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-741 - Page-long-CLI-lists-with-grep-style-options.md
---

# BACK-741 - CLI 长列表 grep 风格分页

## 问题

agent 通过 CLI 读取 Backlog.md 列表。`task list`、`search`、`doc search` 的 `--limit` 在排序后静默截断且不提示遗漏，也无法到达后续条目；`draft list`、`milestone list`、`doc list`、`decision list`、`memo list` 则完全没有分页选项，永远打印全部匹配。

## 解决方案

借鉴 `git log --max-count/--skip` 与 `grep --count` 的既有词汇，为 8 个列表命令（search、task list、draft list、milestone list、doc list、doc search、decision list、memo list）统一增加 `--max-count <n>`、`--skip <n>`、`--count`，并给缺 `--limit` 的四个命令补上同名同语义选项。窗口在过滤、排序、`--limit` 之后按输出顺序应用，连续窗口不重叠不遗漏；被截断的文本输出以 `Showing <first>-<last> of <total> items. Next: backlog <command> --skip <n>` 结尾，`--count` 只输出数字且禁止与 `--json` 组合（非零退出）；JSON 信封仅在窗口截断时附加 `total`/`nextSkip`，未截断时逐字节不变（含 `task list --json --watch`）。

关键实现点：`src/utils/list-window.ts` 是唯一共享分页模块（addListWindowOptions / parseListWindow / selectListWindow / printListWindow / formatListWindowFooter / nextPageCommand / parsePositiveIntegerOption / LIST_WINDOW_HELP_FIELDS / LIST_WINDOW_OUTPUT_HELP）；`src/cli.ts` 以 `resolveListOutput` 统一接线八个命令；不给任何新选项加短 flag、不动既有 `-m`。特例：`memo list` 移除 `--cursor` 和 `--limit` 默认 30，改用共享窗口 footer（core 的 cursor 参数保留给 MCP 和 server API）；`milestone list` 窗口单位是 milestone，`--with-no-milestone` 将无 milestone 任务作为固定 `## No Milestone` 头前置（不占配额、不计入 --count），`generateMilestoneGroupedBoard` 默认 `includeNoMilestone: false`。

文档与迁移账本：overview.md 新增 `## List Paging Quick Reference` 作为四选项的唯一集中解释处，各命令指南各自覆盖本分页；`searchJson` 保留 fork 特有的 `isLocalEditableTask` 本地可编辑过滤。migration 账本 doc-21/doc-22 指向本任务（doc-22 的 D2/D3 撤回）。

## 验证

list-window 43 + board 17 通过，tsc/biome 干净。

## Related Concepts
- [[concepts/cli-instructions]] — 分页语义集中文档化在 CLI 指令面的 List Paging Quick Reference
- [[concepts/list-paging]] — CLI 窗口模型与 MCP offset 信封模型两个刻意不同的分页模型

## Related Sources
- [[sources/back-742-mcp-list-pagination]] — 依赖本任务：把 offset+limit 分页和统一信封带到 MCP 列表工具与 decision_list
