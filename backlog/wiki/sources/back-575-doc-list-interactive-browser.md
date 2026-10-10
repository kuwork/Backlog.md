---
title: BACK-575 - doc list 双栏交互浏览器
labels: [source, cli, tui, docs]
created_date: 2026-09-08 16:55
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-575 - Add-task-list-style-interactive-browser-for-doc-list.md
---

# BACK-575 - doc list 双栏交互浏览器

让 `backlog doc list` 拥有决策和任务列表已有的同款双栏交互浏览器：左侧文档列表（`Documents (N)`），右侧原始 markdown 详情，Enter 打开完整查看器，`?` 打开帮助弹窗，`q` 退出。`--plain` 和 `--json` 模式及所有回退不变，只有交互分支被替换。

## 实现要点

- 直接改编自 `src/ui/decision-list-viewer.ts`（BACK-574）创建 `src/ui/document-list-viewer.ts`——相同的栏模型：`←/→` 切换栏，`↑/↓/j/k` 导航或滚动，活动栏边框高亮黄色、失焦恢复，底部帮助栏。
- 复用 BACK-574 的共享 `releaseSharedProgram()` 和终端状态恢复逻辑，保持 PowerShell/VS Code 行为一致。
- `src/cli.ts` 中 `backlog doc list` 在 TTY 模式接 `runDocumentListViewer`，`TerminalSizeError` 时回退 plain 输出；移除不再使用的 `genericSelectList` 导入。
- `src/ui/components/help-popup.ts` 新增 `document-list` 上下文。
- 更新 `src/guidelines/cli-instructions/documents.md` 和 `src/guidelines/mcp/documents.md`，描述交互列表行为。
- plain/json/empty 输出测试加入 `src/test/cli-doc-decision-board.test.ts`。

## 验收标准

- doc list 保留 `--plain`/`--json` 枚举；交互模式打开双栏浏览器，支持栏切换、vim 键和黄色活动边框；终端尺寸不可用时 TTY 回退 plain 输出；CLI/MCP 文档指南已更新；测试覆盖 plain/json/empty。

## Related Concepts

- [[concepts/cli-tui]] — 共享双栏交互浏览器模式
- [[concepts/cli-instructions]] — CLI 和 MCP 的文档指南均已更新

## Related Sources

- [[sources/back-574-decision-list-view-update-commands]] — 本任务改编的决策列表查看器（同批次）
- [[sources/back-552-doc-view-plain]] — 此处保留的 plain 输出回退契约
