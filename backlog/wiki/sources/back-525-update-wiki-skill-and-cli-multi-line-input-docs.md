---
title: BACK-525 更新 wiki skill 与 CLI 多行输入文档
labels:
  - source
  - wiki
  - docs
  - cli
  - skill
source_path: backlog/tasks/back-525 - Update-wiki-skill-and-CLI-multi-line-input-docs.md
created_date: '2026-06-27 21:00'
updated_date: '2026-06-27 21:00'
---

# BACK-525 更新 wiki skill 与 CLI 多行输入文档

**状态**: Done | **负责人**: @kimi

纯文档/工具同步任务：将 BACK-523、BACK-524 的 wikilink 增强以及 BACK-508 的 CLI 多行输入行为记录到 agent 可见的文档与内嵌 skill 中。

## 同步内容

### Wiki skill 文档

- 更新 `.codex/skills/llm-wiki-for-backlog/SKILL.md`
  - `[[target|alias]]` 别名语法，支持 Markdown 行内格式与任意 HTML
  - `[[target]]{...}` markdown-it-attrs 属性块
  - `![[path]]` / `![[path|alt|WxH]]` 媒体 wikilink
- 修复 `scripts/embed-wiki-skill.ts` 中的 `$` 转义，避免嵌入的 Python 正则失效
- 重新生成 `src/skills/embedded/llm-wiki-for-backlog.ts`

### CLI 多行输入文档（BACK-508）

- `src/guidelines/agent-guidelines.md` 与 `CLI-INSTRUCTIONS.md`：聚焦 `--desc` / `--description` 的多行输入行为
- `src/guidelines/cli-instructions/task-creation.md`：增加 `--desc`、`--plan`、`--notes` 的多行示例
- `src/guidelines/cli-instructions/task-execution.md`：增加 `--comment` 等字段的多行示例
- `src/guidelines/cli-instructions/task-finalization.md`：增加 `--final-summary` 的多行示例

## 说明

- 不引入新产品行为，仅保持文档与实现一致
- `bunx tsc --noEmit` 通过
- `description-newlines.test.ts` 在当前 Windows 环境存在预先存在的失败，但手动 CLI 验证确认换行保留正确

## Related Concepts

- [[concepts/wikilink]] — Wiki 交叉引用语法
- [[concepts/embedded-skills]] — Skill 构建时嵌入机制
- [[concepts/cli-entry]] — CLI 入口与命令结构

## Related Sources

- [[sources/back-523-wiki-wikilinks-alias-support-with-markdown-html-labels-and-markdown-it-attrs]] — BACK-523 别名与属性块
- [[sources/back-524-add-media-wikilink-support-for-images-video-and-audio]] — BACK-524 媒体 wikilink
- [[sources/back-508-cli-description-escapes]] — BACK-508 CLI description 换行转义修复
