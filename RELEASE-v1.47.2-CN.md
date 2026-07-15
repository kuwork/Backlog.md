## v1.47.2-CN Release Notes

> 上一个版本：[v1.47.1-CN](https://github.com/kuwork/Backlog.md/releases/tag/v1.47.1-CN)

### 🤖 Agent 与 CLI 工作流

- **CLI/MCP 指令指南补齐** — 将 `agent-guidelines.md` 中缺失的运营指导回传到 CLI/MCP 指令表面：新增 `backlog instructions milestones` / `backlog://workflow/milestones` 里程碑指南，CLI 与 MCP overview 补充目录结构、黄金法则、禁止直接编辑任务文件、任务图片/本地资源、搜索速查、常用命令与常见问题（含文档引用路径示例）
- **任务字段与 AC/DoD 操作归位** — 把「Task Field Quick Reference」和 Acceptance Criteria / Definition of Done 操作说明从 overview 移到 `task-execution` 指南，方便执行时代查
- **任务创建指南明确不写 Implementation Plan** — `task-creation` 指南进一步强调：创建任务时不应携带 Implementation Plan，由实际执行任务的 Agent 后续设定进行中、分配给自己、起草计划并经用户确认后再编码
- **执行前必须获得用户确认** — `task-execution` 指南强化：Agent 完成计划后必须向用户展示并等待批准，未获批准不得开始编码
- **测试与二进制更新** — 更新 `cli.test.ts` 与 `mcp-server.test.ts` 覆盖新指南，重建 `dist/backlog.exe`

### 📝 任务创建与编辑

- **创建任务引用输入修复** — `backlog task create --references` 支持正确接收逗号分隔的引用，并修复 `--documentation` 路径在交互式输入下的解析
- **`.backlog` 路径自动补全** — 文件选择器自动补全现在允许选择 `.backlog` 目录（同时继续隐藏其他点目录），便于将配置目录加入文档或引用
- **`\n` 转义序列支持** — `backlog task create` / `backlog task edit` 的 `--plan`、`--notes`、`--final-summary` 参数现在解释 `\n` 为真实换行，与交互式多行编辑行为一致

### 🌐 Web UI 修复

- **任务详情日期清除持久化** — 修复 Web 任务详情面板中清空开始/截止日期后未正确保存的问题，空值现在以空字符串而非 `undefined` 提交，确保后端正确清除字段

### 📚 Wiki 与知识库

- **增量摄取 BACK-521.x** — Wiki 已摄取 `BACK-521.14` 及依赖的 `BACK-521.1/2/6/7`，新增 `cli-instructions`、`milestones` 概念页，并更新 `mcp-workflow`、`cli-entry`、`task-lifecycle` 等交叉引用
