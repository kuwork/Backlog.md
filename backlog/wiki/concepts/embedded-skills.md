---
title: 内嵌 Skill 架构
labels: [concept]
created_date: 2026-05-12 00:00
updated_date: 2026-10-16 18:20
---

# 内嵌 Skill 架构

Backlog.md 将关键 Agent Skill 文件嵌入编译后的独立二进制中，使 `backlog wiki install <agent>` 与 `backlog migrate install <agent>` 命令无需依赖外部网络或文件系统即可安装 skill。

## 问题背景

`bun build --compile` 生成的单文件可执行二进制不包含运行时文件系统中的松散文件。如果 skill 以独立文件形式存放在仓库中，编译后的 CLI 无法访问它们。

## 解决方案

**构建时嵌入**

`scripts/embed-skills.ts`（BACK-801 起替代已删除的 `scripts/embed-wiki-skill.ts`，泛化为多技能）在构建阶段扫描 `.codex/skills/<skill-name>/` 目录，将所有文件内容生成到 `src/skills/embedded/<skill-name>.ts`：

```typescript
export const LLM_WIKI_FOR_BACKLOG_SKILL: Record<string, string> = {
	"references/usermanual-writing-guide.md": `# UserManual 编写指引\n...`,
	"scripts/merge.py": `#!/usr/bin/env python3\n...`,
	"SKILL.md": `---\nname: llm-wiki-for-backlog\n...`,
};
```

- 键为相对路径（不含目录前缀）
- 值为文件原始内容字符串
- 该模块被 `wiki install` / `migrate install` 命令导入，写入目标 Agent 的 skills 目录

**Seed-only 项目记忆（BACK-801）**

每个技能的嵌入模块导出两个映射：`<NAME>_SKILL`（常规内容文件，安装时总是重写）与 `<NAME>_SEED_FILES`（项目私有记忆种子）。seed 通过 template → target 映射声明：模板文件（如 `references/current-branch-migration-exclusions.template.md`）的内容以 target 正式文件名嵌入，而模板与本地维护的 target 文件都从 `<NAME>_SKILL` 中排除——fork 私有记忆永不进入发布二进制。安装时 seed 文件仅在目标缺失时写入，`--force` 也不覆盖，用户在目标项目里维护的副本不会被冲掉。llm-wiki-for-backlog 的 seedFiles 为空，行为不变。

**Skill 源目录**

- **Canonical 源**：`.codex/skills/<skill-name>/`（当前有 `llm-wiki-for-backlog/` 与 `task-migration-architect/`，各含 `SKILL.md`、`references/` 等）
- **嵌入产物**：`src/skills/embedded/<skill-name>.ts`（auto-generated，禁止手动编辑）
- **构建流水线（BACK-553 现代化）**：`scripts/build.ts` 使用 `Bun.build` + `bun-plugin-tailwind` 编译独立二进制，构建前嵌入 skill 并在编译时嵌入 React 应用、Tailwind CSS、JS 与静态资源。支持 `BACKLOG_BUILD_OUTFILE`/`BACKLOG_BUILD_VERSION`/`BACKLOG_BUILD_TARGET`/`BACKLOG_BUILD_EXECUTABLE_PATH` 环境变量。`bun build`/`bun run cli`/CI 均统一调用该脚本（[[sources/back-553-modernize-browser-bundling|BACK-553]]）。

## 与 Agent Skills 目录的关系

嵌入的 skill 被安装到：
- `.agents/skills/<skill-name>/`（统一存储）
- `.claude/skills/<skill-name>/`（符号链接或复制）
- `.codex/skills/<skill-name>/`（符号链接或复制）

详见 [[sources/wiki-install-task]] 与 [[sources/back-801-migrate-install-task-migration-architect]]。

## 维护

修改 skill 内容时，应编辑 `.codex/skills/<skill-name>/` 下的文件，然后重新运行 `bun scripts/embed-skills.ts` 生成 TypeScript 模块。不要直接修改 `src/skills/embedded/` 下的生成文件。

**近期更新（BACK-525）**：同步了 wikilink 别名、属性块与媒体 wikilink 的文档说明，并修复了 `scripts/embed-wiki-skill.ts` 中 `$` 转义问题。

**近期更新（BACK-712）**：SKILL.md 的 wiki lint 指引新增 source 回引独立校验——`wiki lint` 退出码干净不代表 `source_path` 可解析；代理必须独立于 lint 结果校验 `source_path` 解析、查重命名历史、只更新已证实路径、源已消失时保留 source 页、歧义标识升级而非猜测。canonical SKILL.md 与嵌入模块已同步，lint 命令行为不变（[[sources/back-712-wiki-lint-source-path-guidance]]）。

**近期更新（BACK-801）**：嵌入脚本泛化为 `scripts/embed-skills.ts` 多技能架构并引入 seed-file 映射；新增 `task-migration-architect` 技能与 `backlog migrate install` 命令，安装机制复刻 wiki install（`wiki-install.ts` 未改动），seed 记忆文件 seed-only 写入（[[sources/back-801-migrate-install-task-migration-architect]]）。

## Related Sources
- [[sources/back-553-modernize-browser-bundling]] — BACK-553 构建现代化
- [[sources/wiki-install-task]] — BACK-474 Wiki install
- [[sources/back-801-migrate-install-task-migration-architect]] — BACK-801 多技能嵌入泛化与 seed-only 项目记忆
- [[sources/back-712-wiki-lint-source-path-guidance]] — BACK-712 lint source_path 独立校验指引
