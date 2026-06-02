---
title: 内嵌 Skill 架构
labels: [concept]
created_date: 2026-05-12 00:00
---


# 内嵌 Skill 架构

Backlog.md 将关键 Agent Skill 文件嵌入编译后的独立二进制中，使 `backlog wiki install <agent>` 命令无需依赖外部网络或文件系统即可安装 skill。

## 问题背景

`bun build --compile` 生成的单文件可执行二进制不包含运行时文件系统中的松散文件。如果 skill 以独立文件形式存放在仓库中，编译后的 CLI 无法访问它们。

## 解决方案

**构建时嵌入**

`scripts/embed-wiki-skill.ts` 在构建阶段扫描 `.codex/skills/llm-wiki-for-backlog/` 目录，将所有文件内容生成到 `src/skills/embedded/llm-wiki-for-backlog.ts`：

```typescript
export const LLM_WIKI_FOR_BACKLOG_SKILL: Record<string, string> = {
	"references/usermanual-writing-guide.md": `# UserManual 编写指引\n...`,
	"scripts/merge.py": `#!/usr/bin/env python3\n...`,
	"SKILL.md": `---\nname: llm-wiki-for-backlog\n...`,
};
```

- 键为相对路径（不含目录前缀）
- 值为文件原始内容字符串
- 该模块被 `wiki install` 命令导入，写入目标 Agent 的 skills 目录

**Skill 源目录**

- **Canonical 源**：`.codex/skills/llm-wiki-for-backlog/`（包含 `SKILL.md`、`references/`、`scripts/`）
- **嵌入产物**：`src/skills/embedded/llm-wiki-for-backlog.ts`（auto-generated，禁止手动编辑）
- **构建流水线**：`package.json` 的 build script 在 `bun build --compile` 之前运行嵌入脚本

## 与 Agent Skills 目录的关系

嵌入的 skill 被安装到：
- `.agents/skills/llm-wiki-for-backlog/`（统一存储）
- `.claude/skills/llm-wiki-for-backlog/`（符号链接或复制）
- `.codex/skills/llm-wiki-for-backlog/`（符号链接或复制）

详见 [[sources/wiki-install-task]]。

## 维护

修改 skill 内容时，应编辑 `.codex/skills/llm-wiki-for-backlog/` 下的文件，然后重新运行嵌入脚本生成 TypeScript 模块。不要直接修改 `src/skills/embedded/llm-wiki-for-backlog.ts`。
