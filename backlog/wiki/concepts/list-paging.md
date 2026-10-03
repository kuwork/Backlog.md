---
title: 两个刻意不同的列表分页模型
labels:
  - concept
  - cli
  - api
  - mcp
created_date: '2026-10-03 01:13'
updated_date: '2026-10-03 01:13'
---

# 两个刻意不同的列表分页模型

Backlog.md 有两套列表分页模型，**故意不统一**（`ListPage` 类型重名是设计决策，两个文件内有对照文档）：CLI 的窗口模型面向人类/代理翻页阅读，MCP/REST 的偏移信封模型面向程序化遍历。

## CLI 窗口模型（list-window.ts）

借鉴 `git log --max-count/--skip` 与 `grep --count` 的既有词汇（[[sources/back-741-cli-list-paging]]）：

- 8 个列表命令（search、task list、draft list、milestone list、doc list、doc search、decision list、memo list）统一增加 `--max-count <n>`、`--skip <n>`、`--count`。
- 窗口在过滤、排序、`--limit` 之后按输出顺序应用，连续窗口不重叠不遗漏。
- 被截断的文本输出以 `Showing <first>-<last> of <total> items. Next: backlog <command> --skip <n>` 结尾；`--count` 只输出数字且禁止与 `--json` 组合。
- JSON 信封仅在窗口截断时附加 `total` / `nextSkip`，未截断时逐字节不变。
- 唯一共享模块 `src/utils/list-window.ts`（addListWindowOptions / selectListWindow / formatListWindowFooter 等）；`src/cli.ts` 以 `resolveListOutput` 统一接线。
- 类型形状：`{ items, skip, total, nextSkip, cut }`。

## MCP / REST 偏移信封模型（list-page.ts）

offset + limit 的统一信封，贯通 core / MCP / REST 三层（[[sources/back-742-mcp-list-pagination]]）：

- 所有 MCP 列表工具统一 `{ items, total, offset, limit, hasMore }` structuredContent 信封；文本输出附 CLI 风格 `Showing X-Y of N` 提示。
- `src/utils/list-page.ts` 承载共享的 `ListPage<T>` + `selectListPage`，core 与 MCP 层共用一份实现。
- 贯通全栈：core `listMemosPage` 改为 offset 窗口；REST `GET /api/memos` 接受 offset、`cursor` 参数以 400 明确拒绝；web `fetchMemosPage` / MemosPage 迁移到 hasMore 驱动，feed 的 id 去重吸收 offset 漂移产生的重复行。
- 新增 `decision_list` 工具补齐 decisions 的 MCP 列表缺口。

## 为什么不统一

两个模型的消费方式本质不同：CLI 窗口给出"下一条命令"的可复制提示（nextSkip → 下一次 `--skip`），适合代理逐窗口阅读；MCP 信封给出 `hasMore`/`total`，适合代码循环遍历直到取完。把 memo_list 从 cursor 迁到 offset（BACK-740 → BACK-742 的演进）正是为了让 agent 能判断"拿到的是否完整列表"——不透明 cursor 做不到这一点。

CLI `backlog memo list` 不传 cursor，行为在两个模型间保持不变；core 的 cursor 参数曾保留给 server/MCP，后被 offset 取代。

## Related Concepts

- [[concepts/memos]] — memo_list 是两套分页模型演进的交汇点
- [[concepts/mcp-server]] — MCP 列表工具的信封契约与 decision_list 注册
- [[concepts/json-output]] — CLI JSON 信封只在截断时附加 total/nextSkip 的兼容性约定
- [[concepts/cli-instructions]] — List Paging Quick Reference 的集中文档化位置

## Related Sources

- [[sources/back-741-cli-list-paging]] — CLI 八命令 --max-count/--skip/--count 窗口分页
- [[sources/back-742-mcp-list-pagination]] — MCP/REST offset 信封与全栈贯通
- [[sources/back-740-memo-mcp-tools]] — memo_list 的 cursor 初版（后被 offset 取代）
