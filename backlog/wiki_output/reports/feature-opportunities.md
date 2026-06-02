---
title: 功能机会分析
labels: [report, roadmap]
created_date: 2026-05-20 21:35
updated_date: 2026-05-20 21:35
---


# 功能机会分析

基于 Backlog.md 现有架构（任务/草稿/里程碑/看板/Web UI/MCP/wiki/搜索/序列）的功能增强建议。按**投入产出比**和**与现有架构的契合度**排序。

---

## 🔥 高优先级

### 1. Wiki CLI 桥接

**现状**: Wiki 的 ingest 完全依赖 LLM agent 主动执行。如果用户在没有 AI agent 的终端里工作，wiki 就会 stale。

**建议命令**:
- `backlog wiki ingest [--since <date>]` — CLI 触发增量摄取，基于 `wiki/log.md` 最后一次 ingest 的时间戳，扫描变更文件
- `backlog wiki search <query>` — 本地搜索 wiki 内容（复用 Fuse.js），覆盖 `concepts/`、`entities/`、`sources/`
- `backlog wiki status` — 报告上次 ingest 时间、未摄取 source 数量、orphan pages

**价值**: 让 wiki 不依赖 LLM 也能自转，降低使用门槛；复用现有文件扫描、markdown 解析和搜索能力。

### 2. 任务模板系统

**现状**: 创建任务支持 `--dod`、`--ac`、`-l` 等很多选项，但团队有固定模式（Bug 报告、Feature 开发）时，每次手动输入很重复。

**建议命令**:
- `backlog template create <name>` — 基于当前任务生成模板，存到 `backlog/templates/`
- `backlog task create "某功能" --template feature` — 创建时自动套用模板的默认字段（DoD、AC、labels、priority、plan 结构）
- 模板支持占位符：`{{date}}`、`{{author}}`、`{{taskId}}`

**价值**: 高频痛点，代码量小，直接复用现有 `task create` CLI 的 `buildTaskUpdateInput` 流程。

---

## 🔥 中优先级

### 3. 轻量级时间追踪

**建议命令**:
- `backlog task start <id>` / `backlog task stop <id>` — 在 task frontmatter 里记录 `time_entries: [{start, end, duration}]`
- `backlog task log <id> --time 2h "做了某事"` — 手动追加时间记录
- `backlog overview --time-report` — 按 milestone、assignee 或标签汇总时间

**价值**: 项目管理刚需；完全可用纯 markdown YAML 数组存储，与"markdown-native"哲学零冲突。

### 4. 批量操作

**建议命令**:
- `backlog task bulk --status "In Progress" --set-status "Review"`
- `backlog task bulk --label backend --assign @alice`
- `backlog task bulk --milestone v1.0 --archive`
- 配合 `--dry-run` 先预览变更

**价值**: 里程碑/sprint 收尾时的效率杀手；依赖数据已在 frontmatter 中，只需批量读写文件。

### 5. 依赖关系可视化

**建议命令**:
- `backlog graph` 或 `backlog board --graph` — 生成 Mermaid 格式的依赖图（任务 → 子任务 → 依赖任务）
- Web UI 增加 **Graph 视图**，用 Mermaid 或轻量 canvas 渲染

**价值**: 锦上添花，但依赖数据已在 frontmatter 里，只需生成图描述，投入很小。

---

## 🔥 低优先级 / 长期

### 6. Git Hook 集成

- **commit-msg hook**: 解析 `BACK-123` 或 `fixes BACK-123`，自动把对应任务状态改为 "In Progress" 或 "Done"
- `backlog install-hooks` — 一键安装预配置的 git hooks

### 7. Sprint/迭代管理

现有 milestone 概念之上，增加 sprint 的时间盒约束（固定周期、容量规划）。

### 8. 日历视图

`backlog board --calendar` 或 Web UI 的 Calendar 视图，按时间维度查看任务。

---

## 架构契合度总结

| 功能 | 复用现有能力 | 新增复杂度 | 推荐时机 |
|---|---|---|---|
| Wiki CLI 桥接 | 文件扫描、Fuse.js 搜索、markdown 解析 | 低 | 立即 |
| 任务模板 | `task create` 流程、模板合并层 | 低 | 立即 |
| 时间追踪 | frontmatter YAML 数组、overview 统计 | 低 | 短期 |
| 批量操作 | 批量文件读写、frontmatter 更新 | 中 | 短期 |
| 依赖图可视化 | Mermaid 渲染（已有）、frontmatter 读取 | 低 | 中期 |
| Git Hook | hook 模板、commit 解析、状态流转 | 中 | 中期 |

---

## Related Sources

- [[sources/wiki-web-ui-task]] — BACK-473 Web UI Wiki 区域与文件树导航
- [[sources/wiki-install-task]] — BACK-474 Wiki Install 命令
- [[concepts/web-ui-features]] — Web UI 功能总览
- [[concepts/core-architecture]] — 核心架构与数据流

## Related Concepts

- [[concepts/task-lifecycle]] — 任务生命周期与字段设计
- [[concepts/search-sequences]] — 搜索与序列基础设施
- [[concepts/web-server]] — Web Server API 扩展点
