---
title: "CLI 列表分页用窗口模型并移除不透明 cursor"
labels: [decision, cli, pagination]
created_date: 2026-10-03 01:25
updated_date: 2026-10-03 01:25
---

# CLI 列表分页用窗口模型并移除不透明 cursor

## 决策内容

BACK-741 为 8 个 CLI 列表命令统一采用 grep/git 风格窗口选项（`--max-count <n>` / `--skip <n>` / `--count`，窗口在过滤、排序、`--limit` 之后按输出顺序应用），并从 `memo list` 移除不透明的 `--cursor` 选项与默认 30 的 `--limit`（core 的 cursor 参数保留给 MCP 和 server API，后续由 BACK-742 迁移到 offset 信封）。

## 背景

Agent 通过 CLI 读列表：既有 `--limit` 在排序后静默截断且不提示遗漏，无法到达后续条目；`draft list`/`milestone list`/`doc list`/`decision list`/`memo list` 完全没有分页选项；`memo list` 的 cursor 是不透明字符串，代理既无法解释也无法续接，出错时无从排查。

## 拒绝方案

- **保留/推广不透明 cursor 续接**：代理无法解释 cursor 内容、构造或调试分页失败；对"人类+代理翻页阅读"场景不如显式 skip 直观
- **`--limit` 静默截断现状**：排序后截断且不提示遗漏，列表长时代理会拿到看似完整的残缺结果
- **为新选项加短 flag**：刻意不加，避免与既有 `-m` 等冲突

## 采纳方案

- 词汇借鉴 `git log --max-count/--skip` 与 `grep --count`，连续窗口不重叠不遗漏
- 截断时文本输出结尾提示 `Showing <first>-<last> of <total> items. Next: backlog <command> --skip <n>`
- `--count` 只输出数字且禁止与 `--json` 组合（非零退出）；JSON 信封仅在窗口截断时附加 `total`/`nextSkip`，未截断时逐字节不变（含 `task list --json --watch` 全量替换帧契约）
- 特例：`milestone list` 窗口单位是 milestone，`--with-no-milestone` 的 `## No Milestone` 段不占配额、不计入 `--count`

## 代价

- 8 个命令的选项面一次性扩大，需要集中文档（CLI 指令面 overview.md 的 List Paging Quick Reference 作为唯一集中解释处）
- MCP/REST 侧需要另一套 offset 信封模型（见 [[concepts/list-paging]]，BACK-742），两套模型并存需维护对照文档

## 相关来源

- [[sources/back-741-cli-list-paging]] — 决策出处任务
- [[sources/back-742-mcp-list-pagination]] — MCP 侧刻意不同的信封模型
- [[concepts/list-paging]] — 两个刻意不同的分页模型
