---
title: Wiki Skill 安装
labels: [usermanual]
created_date: 2026-05-12 00:00
updated_date: '2026-10-09 23:30'
---


# Wiki Skill 安装

Backlog.md 内置 `llm-wiki-for-backlog` skill，帮助 AI 代理理解和维护项目知识库。通过 `backlog wiki install` 命令，可将该 skill 一键安装到支持的 AI 工具中。

## 什么是 Wiki Skill

`llm-wiki-for-backlog` 是一个 Agent Skill，提供以下能力：

- **构建知识库**：根据项目 backlog 内容自动生成结构化 wiki
- **增量摄取**：将新任务、文档、决策编译为可交叉引用的知识页面
- **查询与报告**：基于 wiki 内容回答项目相关问题
- **健康检查**：扫描知识库中的矛盾、孤立页面和缺失引用

安装后，AI 代理在会话中可直接引用该 skill 的指南，更准确地执行 wiki 相关操作。

## 支持的 AI 工具

| 别名 | 对应工具 | Skills 目录 |
|------|---------|------------|
| `claude` | Claude Code / Claude Desktop | `.claude/skills/` |
| `codex` | OpenAI Codex CLI | `.codex/skills/` |
| `agents` | 通用 Agents 目录 | `.agents/skills/` |

## 安装 Skill

### 安装到指定 Agent

```bash
backlog wiki install claude
```

该命令会将内置 skill 文件写入 Agent 的 skills 目录。安装结果会显示 skill 名称、描述和触发词。

### 强制覆盖

如果目标目录已存在同名 skill，或该目录被其他 skill 占用，使用 `--force` 覆盖：

```bash
backlog wiki install claude --force
```

### 预览安装

使用 `--dry-run` 预览安装操作，不实际写入文件：

```bash
backlog wiki install codex --dry-run
```

## 安装机制

### 统一存储与符号链接

Skill 文件集中存储在项目根目录的 `.agents/skills/llm-wiki-for-backlog/` 中。各 Agent 的 skills 目录通过**符号链接**指向该统一位置：

```
.agents/skills/llm-wiki-for-backlog/     ← 实际文件
.claude/skills/llm-wiki-for-backlog/    ← 符号链接
.codex/skills/llm-wiki-for-backlog/     ← 符号链接
```

这种设计的优点是：
- 更新 skill 时只需修改一处
- 多个 Agent 共享同一套 skill 内容
- 避免文件重复和版本不一致

### Windows 兼容性

Windows 上创建目录符号链接需要管理员权限或开启开发者模式。当符号链接创建失败时，命令会自动**回退到直接复制**文件到 Agent 的实际目录，并记录警告提示。

### Skill 来源

Skill 内容在构建时嵌入编译后的二进制文件中：

- **Canonical 源**：`.codex/skills/llm-wiki-for-backlog/SKILL.md`
- **嵌入产物**：`src/skills/embedded/llm-wiki-for-backlog.ts`
- **构建时生成**：`scripts/embed-wiki-skill.ts` 将 skill 文件打包为 TypeScript 模块

这意味着即使在没有网络连接或源码仓库的环境中，编译后的 `backlog` 二进制也能完成 skill 安装。

## 更新 Skill

当 Backlog.md 版本升级后，内置 skill 内容可能已更新。重新执行安装命令即可覆盖为最新版本：

```bash
backlog wiki install claude --force
```

建议在每次升级 Backlog.md 后检查并更新已安装的 skill（升级 CLI 本身的方法见[安装与初始化](../00-快速开始/01-安装与初始化.md)的「升级 Backlog.md」一节）。

## 安装后的工作流

安装 skill 后，AI 代理即可按 `llm-wiki-for-backlog` 的约定维护项目 wiki。它不是 RAG——每次查询不重新推导知识，而是把 backlog 源**增量编译**成一份持久、互链的 wiki，知识逐次累积。代理侧四类操作：

| 操作 | 说明 |
|------|------|
| 摄取（Ingest） | 读取 `tasks/`、`docs/`、`decisions/` 等 backlog 源，生成 source 摘要页、概念页、实体页，更新 `index.md` / `overview.md` / `log.md`；git 可用时按上次摄取以来的变更做增量摄取 |
| 查询（Query） | 先读 `wiki/index.md`，从编译好的 wiki 综合回答，产物（报告等）写入 `wiki_output/` |
| 健康检查（Lint） | 扫描矛盾、孤立页、过时结论、缺失交叉引用 |
| 回写（Flowback） | 把有价值的查询结果保存回 `wiki/`，让知识复利增长 |

**维护边界**（与 AGENTS.md 的 WIKI GUIDELINES 一致）：

- `wiki/` 由 LLM 全权维护——人类可读、可浏览，但不要手改；手改会被下一次摄取覆盖，且破坏互链一致性
- backlog 源目录（`tasks/`、`docs/` 等）对 wiki 操作是**只读**的
- 摄取永不递归处理 `wiki/`、`wiki_output/` 自身
- `wiki/log.md` 只追加；所有跨页引用使用 wikilink（`[[path/to/page]]`，不带 `.md`）
