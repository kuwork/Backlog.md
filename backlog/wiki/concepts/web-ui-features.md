---
type: concept
title: Web UI 功能
updated: 2026-05-10
---

# Web UI 功能

`backlog browser` 启动的现代化 Web 界面，基于 React + Tailwind CSS v4。

## 页面与视图

### 看板（Kanban Board）
- 拖放任务到不同状态列
- 里程碑泳道（Swimlanes）
- 标签筛选下拉框
- 实时更新

### 所有任务（All Tasks）
- 表格布局（ redesigned ）
- 状态/优先级/标签/里程碑筛选
- 多状态筛选支持
- 搜索框

### 里程碑（Milestones）
- 里程碑列表与详情
- 未分配任务池
- 拖放分配任务到里程碑
- 已完成的里程碑折叠区
- 里程碑搜索（Fuse.js）

### 文档与决策
- 文档列表（支持子文件夹分组）
- 决策记录查看

### Wiki
- 侧边栏可折叠文件树，反映 `backlog/wiki/` 目录结构
- 点击 `.md` 文件导航到 `/wiki/:path`
- 只读 Markdown 渲染（`MermaidMarkdown`、frontmatter 提取标题）
- 深度链接支持

### 设置（Settings）
- 配置管理
- Definition of Done 默认值编辑
- Web UI 主题自定义

## 任务编辑

- 富文本 Markdown 编辑器（MDEditor）
- **[[粘贴为 Markdown]]** — 从 Word/Google Docs/网页自动转换为 Markdown
- **[[本地文件预览]]** — 点击本地路径在模态框中查看代码/Markdown
- 验收标准交互式勾选列表
- 验收标准同步修复（ContentStore）
- 任务内容目录（TOC）与滚动监听
- 富表单：状态、优先级、标签、里程碑、负责人、依赖、引用、文档链接

## 技术特性

- **实时同步**：文件系统变更自动刷新所有视图
- **响应式**：桌面与移动端适配
- **暗黑模式**：Tailwind CSS dark mode
- **Mermaid 图表**：任务中的 Mermaid 语法自动渲染
- **图片与附件**：`assets/` 目录下的资源自动提供，支持临时粘贴图片的 promote 机制
- **预览防崩溃**：尖括号类型字符串过滤
- **草稿保留**：未保存的草稿在文件刷新后保留
