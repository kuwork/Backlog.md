---
title: Skill 文件变更 → 嵌入代码同步模式
labels: [pattern, build, developer-experience, wiki]
created_date: '2026-05-30 15:02'
updated_date: '2026-05-30 15:02'
---

# Skill 文件变更 → 嵌入代码同步模式

当 `.codex/skills/llm-wiki-for-backlog/` 下的 Skill 源文件发生变更时，必须通过构建脚本将变更同步到 `src/skills/embedded/llm-wiki-for-backlog.ts`，否则编译后的二进制将分发旧版本 Skill 内容。

## 适用场景

- 修改 `.codex/skills/llm-wiki-for-backlog/SKILL.md` 内容（如新增 wiki 子目录、调整操作指南）
- 在 Skill 目录下新增或删除附属文件
- 任何影响 Skill 内容的编辑

## 标准步骤

| 顺序 | 动作 | 命令 |
|---|---|---|
| 1 | **编辑 Skill 源文件** | 直接修改 `.codex/skills/llm-wiki-for-backlog/` 下的文件 |
| 2 | **重新生成嵌入代码** | `bun run scripts/embed-wiki-skill.ts` |
| 3 | **验证同步结果** | `git diff src/skills/embedded/llm-wiki-for-backlog.ts` |
| 4 | **提交变更** | 同时提交 Skill 源文件和生成的嵌入代码 |

## 根因说明

`src/skills/embedded/llm-wiki-for-backlog.ts` 是**构建时产物**，由 `scripts/embed-wiki-skill.ts` 读取 `.codex/skills/llm-wiki-for-backlog/` 目录下的所有文件并生成 TypeScript 模块。该嵌入模块被打包进编译后的 `backlog.exe` / npm 包中，供 `wiki-install` 命令使用。

如果仅修改源文件而不重新运行脚本，CLI 的二进制分发版本将继续携带旧 Skill 内容。

## 常见陷阱

| 陷阱 | 示例 | 后果 |
|---|---|---|
| **只改源文件不改嵌入代码** | SKILL.md 新增 5 个 wiki 子目录，但嵌入代码仍使用旧结构 | 用户通过 `backlog wiki install` 安装的是过期 Skill，缺失新功能指南 |
| **提交时遗漏生成文件** | 源文件已提交，但 `src/skills/embedded/llm-wiki-for-backlog.ts` 未纳入 commit | CI 构建产物与源文件不一致 |
| **误以为嵌入代码是手写的** | 直接修改 `src/skills/embedded/llm-wiki-for-backlog.ts` | 下次运行脚本时手动修改会被覆盖 |

## 自动化建议

- 在 `package.json` 的 `build` 脚本中前置 `embed-wiki-skill` 步骤
- 或在 pre-commit hook 中检测 `.codex/skills/llm-wiki-for-backlog/` 变更时自动运行脚本

## 参考任务

- [[sources/back-502]] — BACK-502 同步 llm-wiki-for-backlog SKILL.md 更新到嵌入代码
