---
type: source
title: BACK-474 Wiki Install 命令
source_path: backlog/tasks/back-474 - Add-wiki-install-command.md
updated: 2026-05-10
---

# BACK-474 Wiki Install 命令

**状态**: Done | **标签**: feature, cli, wiki | **优先级**: medium

添加 `backlog wiki install <agent>` CLI 命令，将内置的 `llm-wiki-for-backlog` skill 安装到指定 Agent 的 Skills 目录。

## Skill 嵌入策略

由于 CLI 编译为独立可执行文件（`bun build --compile`），skill 文件必须在构建时嵌入二进制中：
- `scripts/embed-wiki-skill.ts` 扫描 `.codex/skills/llm-wiki-for-backlog/` 并生成 `src/skills/embedded/llm-wiki-for-backlog.ts`
- 生成模块导出 `Record<string, string>` 映射（相对路径 → 文件内容）
- 嵌入脚本已加入 `package.json` 的 build pipeline

## Agent 别名映射

仅支持具有显式 Skills 目录支持的 Agent：

| 别名 | Skills 目录 |
|---|---|
| `claude` | `.claude/skills/` |
| `codex` | `.codex/skills/` |
| `agents` | `.agents/skills/` |

无效或不支持的别名会返回清晰错误，列出有效选项。

## 统一存储与符号链接

Skills 集中存储在 `.agents/skills/llm-wiki-for-backlog/`。Agent 特定目录（如 `.claude/skills/`）是**符号链接**指向 `.agents/skills/`。

**安装逻辑**
1. 将 skill 文件写入 `.agents/skills/llm-wiki-for-backlog/`（如不存在则创建）
2. 检查 Agent 的 skills 路径：
   - 不存在 → 创建指向 `.agents/skills` 的符号链接
   - 已是指向 `.agents/skills` 的符号链接 → 无操作
   - 指向其他地方的符号链接 → 错误（需 `--force` 替换）
   - 是包含内容的实际目录 → 错误（需 `--force` 替换为符号链接）
3. `--force` 时替换实际目录/其他符号链接为正确符号链接

**Windows 兼容性**
- Windows 上创建目录符号链接需要提升权限（管理员）或开发者模式
- 符号链接创建失败时**回退到直接复制**到 Agent 的实际目录（`.claude/skills/llm-wiki-for-backlog/`）
- 回退时记录警告，告知用户 `.agents/skills/` 是首选统一位置

## 命令选项

```
backlog wiki install <agent>
  --force       覆盖现有 skill 或将现有目录替换为符号链接
  --dry-run     预览操作而不写入
```

## 输出

安装结果包括 skill 名称、描述、触发词（从 SKILL.md YAML frontmatter 提取）。

## 测试

- `src/test/wiki-install.test.ts` — 12 个单元测试，覆盖 resolveAgent、installWikiSkill、dry-run、force overwrite、符号链接处理、结果格式化
