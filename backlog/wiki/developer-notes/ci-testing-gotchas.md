---
title: CI 与测试踩坑笔记
labels: [developer-note]
created: 2026-05-10
created_date: 2026-05-10 00:00
---


# CI 与测试踩坑笔记

给后续维护者和 AI agent 的避坑指南。所有条目必须附带**触发场景**和**修复要点**。

---

## 1. 测试中创建 symlink 前必须确保父目录存在

**触发场景**  
`wiki-install.test.ts` 里测试 "noop when symlink already points to correct target" 时，直接调用 `symlink("../.agents/skills", ".claude/skills", "dir")`，但 `.claude` 目录并不存在。该测试在 Windows 上被跳过，在 macOS/Linux CI 上直接报 `ENOENT`。

**根本原因**  
生产代码 `resolveSkillTargetDir()` 内部有 `mkdir(dirname(agentSkillsPath), { recursive: true })`，但测试为了模拟"已存在正确 symlink"的场景，绕过了生产代码、直接调用 `fs.symlink`，因此目录前置条件缺失。

**修复要点**
- 测试里直接操作文件系统（mkdir/symlink/writeFile）时，必须显式 `mkdir(..., { recursive: true })` 创建完整路径。
- 不要假设生产代码的目录创建逻辑会被测试覆盖到。

---

## 2. Biome 格式化：Error 构造器单行规则

**触发场景**  
`src/commands/wiki-install.ts` 里把 `throw new Error(...)` 拆成三行：

```ts
throw new Error(
    `Skill "${SKILL_NAME}" already exists at "${skillTargetDir}". Use --force to overwrite.`,
);
```

Biome 要求单行书写，CI `bun run check .` 因此失败。

**修复要点**
- 改完代码后**必须**在改动文件上执行 `biome check`（不要只跑 `bun test`）。
- 字符串模板字面量的 Error message 如果较短，Biome 会强制单行。

---

## 3. Windows 本地 CRLF vs CI LF

**触发场景**  
Windows 开发机上 `git config core.autocrlf=true` 会把文件检出为 CRLF。运行 `bun run check .` 时 Biome 会报大量格式化错误（全文件 diff），但在 Linux/macOS CI 上完全通过。

**修复要点**
- Windows 本地报格式错误时，先确认是不是行尾符问题：`git diff` 里出现 `^M` 或 Biome diff 显示 `␍`。
- 不要在 Windows 上盲目执行 `biome format --write` 来"修复"，否则会把全仓库改成 CRLF，引入无意义 diff。
- 真正需要修的只有**实际内容格式**问题（如缩进、引号、行长、多余空行）。

---

## Checklist：提交前必做

- [ ] `bun test <改动相关测试文件>` 通过
- [ ] `bunx tsc --noEmit` 无类型错误
- [ ] `npx biome check <改动文件>` 通过（注意区分 CRLF 伪错误）
- [ ] 如果涉及文件系统操作，检查测试里的目录前置条件

## Related

- [[developer-notes/DEVELOPMENT-GUIDE]] — 通用开发规范（Bun + TypeScript + Biome 技术栈）
- [[developer-notes/architecture-gotchas]] — 架构分层约束
