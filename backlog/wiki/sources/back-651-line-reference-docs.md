---
title: BACK-651 - 指南补充行号引用与行区间链接
labels: [source, agent-guidelines, docs, mcp]
created_date: 2026-09-26 14:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-651 - Document-line-numbered-references-and-line-range-links-in-the-agent-guides.md
---

# BACK-651 - 指南补充行号引用与行区间链接

任务创建指南只给出 URL/issue 引用示例，导致 agent 丢掉行号或臆造区间语法；文档指南则压根没提短本地链接上的行号后缀。现在 CLI/MCP 指南、共享 agent 指南与 MCP 工具 schema 按代码实际消费的形式精确记录这些写法。

- 引用文档约定为每条目一个位置，共三种形态：URL、项目相对文件路径、或带行区间的路径——`path:LINE` 单行、`path:START-END` 连续区间；`readProjectFile`（`/^(.+?)(?::(\d+)(?:-(\d+))?)?$/`）是决定接受形态的唯一消费方
- `cli-instructions/task-creation.md` 新增 References 小节，`mcp/task-creation.md` 承载同一约定（宁可两条目也不用一个宽区间），`agent-guidelines.md` 使用带行号的创建/编辑示例，MCP `references`/`addReferences`/`removeReferences` 的 schema 描述点名相同形态（`removeReferences` 按精确存储串匹配，含后缀）
- 文档指南（CLI 与 MCP）现在区分三种链接目的地：外部 URL、backlog 条目短链（`/task/:id`、`/draft/:id`、`/documentation/:id`、`/decisions/:id`、`/wiki/:path`）与项目相对文件路径——后两者接受可选行号后缀；后缀位于 ID 片段上，因此标题 slug 仍可随后跟上、自定义 label 被保留、无 label 的链接渲染为带区间后缀的别名（`DOC#13:319-329`），带后缀的链接点击后打开按这些行定域的预览模态框
- 两类链接到达同一解析器：`MermaidMarkdown` 透传后缀（`parseLineRange`），短链分支在服务端解析实体路径，两者都按区间定域预览；早期一版指南草稿错误地声称相对路径不接受后缀，已更正
- 示例不用占位符：每个写进文档的路径/行号都存在于本仓库，由 `tmp/verify-doc-examples.ts` 通过真实消费方解析全部 24 个引用值和每个链接示例验证；`# Wrong` 反例被删除，因为它们被当作合法语法照抄
- CLI 备注：`--ref` 值经 `parseDelimitedStringList` 处理，逗号总会把一个 flag 拆成两条目——文档写作"每条目一个位置"，而不复述解析器细节
- 测试：`mermaid-markdown.test.tsx` 两个新用例（带后缀 ID 后的标题 slug、代码文件链接点击后行区间仍然存活），加上 cli-refs-docs、cli 与 mcp-server 套件全绿

## 验收标准

- CLI 与 MCP 任务创建指南按每条目一个位置记录 `path:LINE` / `path:START-END`，不再暗示引用只能是 URL
- MCP create/update-task schema 描述相同的三种引用形态
- 每个指南示例都给出存在于本仓库并能经 `readProjectFile` 解析的路径与行号
- CLI 与 MCP 文档指南记录短本地链接的行号后缀、其在 ID 片段上的位置、label/别名渲染与点击定域预览行为

## Related Concepts

- [[concepts/cli-instructions]] — 本次更新的 agent 指令指南
- [[concepts/mcp-workflow]] — 作为公共契约的 MCP 工具 schema 描述
- [[concepts/file-preview]] — 带后缀链接打开的按行定域预览模态框
- [[concepts/wikilink]] — 短本地链接目的地与别名渲染

## Related Sources

- [[sources/back-531-local-link-line-range]] — 本任务所记录之行区间链接的最初实现
- [[sources/back-526-create-task-references-and-backlog-autocomplete]] — 任务引用字段与自动补全
- [[sources/back-572-agent-guides-date-fields-multiline-input]] — 相邻的 agent 指南文档化工作
