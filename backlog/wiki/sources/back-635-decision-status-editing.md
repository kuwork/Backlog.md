---
title: BACK-635 - 决策状态编辑打通 CLI/MCP/Web
labels: [source, cli, mcp, web-ui, decisions]
created_date: 2026-09-26 14:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-635 - Add-decision-status-editing-across-CLI-MCP-and-Web-UI.md
---

# BACK-635 - 决策状态编辑打通 CLI/MCP/Web

决策只能在创建时获得状态（`decision create -s`，默认 proposed），MCP 完全没有决策工具，Web 编辑器也没有状态控件——accepted/rejected/superseded 都不可达。本任务通过一条核心路径让三个界面都能编辑状态（和正文），并修复一个每次保存都重复标题的小节解析 bug。

- Core：`updateDecisionFromContent` 现接受 `{ status?, autoCommit? }` 选项对象，显式状态优先于内容 frontmatter；新增 `updateDecisionStatus` 只写状态、不回写正文
- CLI：`decision update --status <status>`（自由文本，文档值 proposed/accepted/rejected/superseded），可单独或与 `--content`/`--append-content` 连用；无选项守卫列出三个选项
- 服务器/API：`PUT /api/decisions/:id` 接受 JSON `{ content?, status? }`；缺 content 键表示仅状态；纯文本正文仍可用；`apiClient.updateDecision` 发 JSON
- Web：决策编辑头部的状态下拉（规范值加任何已存的非规范值）；仅正文变化时才发送正文；组件在保存后重新读取决策，因为没有别的东西刷新预览（BACK-633 effect 守卫带来的潜在问题）
- MCP：新决策工具组（`src/mcp/tools/decisions/`），暴露 `decision_update`（id + content/appendContent/status），注册进 `createMcpServer`；新增 5 用例 `mcp-decisions.test.ts`
- 根因修复：`parser.ts extractSection` 的 `## Title\s*\n` 模式吞掉了分隔换行，迫使空小节消费下一个标题，每次读后再写都重复 `## Decision`/`## Consequences`；模式现在两端都锚定到行首行尾，core 直接复用它而不是自带一份拷贝
- 指南更新：`cli-instructions/decisions.md`、`mcp/decisions.md`（删除三个文档化但从不存在的幻影决策工具）、`mcp/overview-tools.md`、`mcp/overview.md`，以及一条用三条真实状态变更路径重写的 wiki 手册页
- 验证：CLI 仅状态操作使正文逐字节不变；追加不再重复标题；真实浏览器中仅状态与正文+状态保存均持久化且徽标刷新；预存在的全量套件 CLI 子进程超时在改动暂存时同样复现

## 验收标准

- Core 接受与内容单次写入一起应用的显式状态覆盖
- CLI、MCP 与 Web 各自都能设置状态，可单独或随正文；未知 MCP id 报清晰错误
- 状态值保持自由文本、原样存储（无固定集合校验）
- 使用指南记录 `--status` 与 `decision_update` MCP 工具

## Related Concepts

- [[concepts/mcp-server]] — 决策工具组遵循的工具组注册模式
- [[concepts/mcp-workflow]] — 暴露给 agent 的决策工具
- [[concepts/markdown-pipeline]] — 小节提取 bug 与行锚定修复
- [[concepts/cli-instructions]] — 随 CLI 界面一起更新的指南

## Related Sources

- [[sources/back-633-decision-editing-web-ui]] — 使 Web 编辑表单可达的前置任务
- [[sources/back-574-decision-list-view-update-commands]] — 早期的决策 CLI 界面工作
- [[sources/back-576-dedupe-generate-next-decision-id]] — 同一核心区域的决策 ID 处理
