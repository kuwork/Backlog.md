---
title: Web UI 功能
labels: [concept]
created_date: 2026-05-10 00:00
updated_date: 2026-05-20 23:45
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
- 里程碑搜索（子串包含匹配 + Fuse.js fallback）

### 文档与决策
- 文档列表（支持子文件夹分组）
- 决策记录查看

### Wiki
- 侧边栏可折叠文件树，反映 `backlog/wiki/` 目录结构，文件夹与文件数量实时统计
- 点击 `.md` 文件导航到 `/wiki/:path`，Markdown 渲染（`MermaidMarkdown`、frontmatter 提取标题）
- **在线编辑**：标题、正文、labels 均可修改，保存后自动更新 frontmatter（`updated_date`），未保存变更检测与取消/保存操作
- **Wikilink 交互预览**：`[[wikilinks]]` 渲染为可点击内部链接，点击弹出模态框异步预览目标页面内容，而非直接跳转
- **文件管理**：侧边栏 hover 显示 `+` 下拉菜单，支持创建文件/文件夹、重命名；重命名当前浏览的页面时自动导航到新路径
- **实时同步**：文件系统变更通过 WebSocket 广播到所有打开的标签页
- 深度链接支持

### 设置（Settings）
- 配置管理
- Definition of Done 默认值编辑
- Web UI 主题自定义
- **语言切换**：英语 / 日语 / 简体中文 / 繁体中文，通过 `/api/config` 持久化

## 任务编辑

- 富文本 Markdown 编辑器（MDEditor）
- **[[粘贴为 Markdown]]** — 从 Word/Google Docs/网页自动转换为 Markdown，支持 `.docx` 文件上传
- **[[本地文件预览]]** — 点击本地路径在模态框中查看代码/Markdown
- 验收标准交互式勾选列表
- 验收标准同步修复（ContentStore）
- 任务内容目录（TOC）与滚动监听
- 富表单：状态、优先级、标签、里程碑、负责人、依赖、引用、文档链接
- **路径自动补全**：references 与 documentation 输入框支持项目路径自动补全，键盘导航（上下箭头、Enter、Esc、左右进入/返回目录）

## 技术特性

- **国际化（i18n）**：零依赖自定义 React Context + Hook，~300 键覆盖 4 种语言，编译时嵌入单文件二进制
- **实时同步**：文件系统变更自动刷新所有视图
- **响应式**：桌面与移动端适配
- **暗黑模式**：Tailwind CSS dark mode
- **Mermaid 图表**：任务中的 Mermaid 语法自动渲染
- **图片与附件**：`assets/` 目录下的资源自动提供，支持临时粘贴图片的 promote 机制
- **预览防崩溃**：尖括号类型字符串过滤
- **草稿保留**：未保存的草稿在文件刷新后保留
