---
title: 两套列表分页模型的接线约定
labels: [execution, cli, mcp, pagination]
created_date: 2026-10-03 01:25
updated_date: 2026-10-09 23:30
extracted_from:
  - BACK-741
  - BACK-742
---

# 两套列表分页模型的接线约定

Backlog.md 有两套列表分页模型，**故意不统一**（`ListPage` 类型重名是设计决策，两个文件内有对照文档）。

## 标准步骤

### CLI 窗口模型（人类/代理翻页阅读）— `src/utils/list-window.ts`

1. 唯一共享模块承载全部词汇：`addListWindowOptions` / `parseListWindow` / `selectListWindow` / `printListWindow` / `formatListWindowFooter` / `nextPageCommand` / `LIST_WINDOW_HELP_FIELDS`
2. `src/cli.ts` 用 `resolveListOutput` 统一接线所有列表命令，不在各命令内手写分页
3. 窗口在过滤、排序、`--limit` 之后按输出顺序应用，连续窗口不重叠不遗漏
4. 截断时文本输出以 `Showing <first>-<last> of <total> items. Next: backlog <command> --skip <n>` 结尾
5. `--count` 只输出数字且禁止与 `--json` 组合（非零退出）；JSON 信封仅在窗口截断时附加 `total`/`nextSkip`，未截断时逐字节不变（含 `task list --json --watch` 全量替换帧契约）

### MCP/REST 偏移信封模型（程序化遍历）— `src/utils/list-page.ts`

1. 共享 `ListPage<T>` + `selectListPage`，core 与 MCP 层共用一份实现；MCP 侧仅保留需要 CallToolResult 的 `buildListResult`
2. 统一 structuredContent 信封 `{ items, total, offset, limit, hasMore }`，文本输出附加 CLI 风格 `Showing X-Y of N items` 提示
3. `task_list` 先把各状态桶按 `orderedStatuses` 展平为一个有序序列再分页、再按桶重组渲染（桶顺序不变）
4. 诊断/警告段（如 `milestone_list` 的 unconfigured/archived）不分页，保证警告不消失
5. REST 对废弃参数明确拒绝（`GET /api/memos` 的 `cursor` 返回 400），web 侧迁移到 hasMore 驱动并用既有 id 去重吸收 offset 漂移的重复行

## 常见陷阱

- 为 CLI 发明不透明 cursor，或为 MCP 发明窗口 footer——两种消费者的心智模型不同，混用必坏
- 让 JSON 信封在"未截断"时也变化——会破坏 `task list --json --watch` 的逐字节替换帧契约（见 [[concepts/json-watch]]）
- 分页单位搞错（`milestone list` 窗口单位是 milestone 而非任务；`--with-no-milestone` 段不占配额、不计入 `--count`）

## Related Concepts

- [[concepts/list-paging]] — 两个模型的概念页

## Related Sources

- [[sources/back-741-cli-list-paging]] — CLI 窗口模型与 memo list 的 --cursor 移除
- [[sources/back-742-mcp-list-pagination]] — MCP/REST 偏移信封模型全栈贯通
