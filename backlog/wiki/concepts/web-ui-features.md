---
title: Web UI 功能
labels: [concept]
created_date: 2026-05-10 00:00
updated_date: 2026-05-23 00:40
---


# Web UI 功能

`backlog browser` 启动的现代化 Web 界面，基于 React + Tailwind CSS v4。

## 全局布局

### 侧边栏
- 可拖拽调整宽度：右边缘 1px 手柄，拖拽时显示蓝色 ghost bar（直接操作 DOM 避免 React 重渲染卡顿）
- 松开鼠标后应用宽度并持久化到 `localStorage`
- 最小 200px / 最大 500px 限制

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
- **搜索框与类型下拉**：输入框左侧图标按钮弹出下拉菜单（All / Tasks / Documents / Decisions / Wiki），使用侧边栏同款图标；默认 All，切换后立即触发对应类型过滤

### 里程碑（Milestones）
- 里程碑列表与详情
- 未分配任务池
- 拖放分配任务到里程碑
- 已完成的里程碑折叠区
- 里程碑搜索（子串包含匹配 + Fuse.js fallback，修复短数字 ID 误匹配）

### 文档与决策
- **文档文件夹树**：侧边栏递归渲染 `backlog/docs/` 目录结构，文件夹可展开/折叠（`localStorage` 持久化），显示文件数量徽标；文件点击导航到 `/documentation/:id`
- **文件夹操作**：hover 文件夹显示 `+` 下拉菜单，支持"新建文件"和"新建文件夹"；新建文件时通过 `?path` 查询参数预填充目标路径
- **无独立重命名**：文档遵循 `{id} - {title}.md` 约定，重命名通过编辑标题自动完成（后端 `saveDocument()` 处理文件重命名）
- 决策记录查看

### Wiki
- 侧边栏可折叠文件树，反映 `backlog/wiki/` 目录结构，文件夹与文件数量实时统计
- 点击 `.md` 文件导航到 `/wiki/:path`，Markdown 渲染（`MermaidMarkdown`、frontmatter 提取标题）
- **在线编辑**：标题、正文、labels 均可修改，保存后自动更新 frontmatter（`updated_date`），未保存变更检测与取消/保存操作
- **Wikilink 交互预览**：`[[wikilinks]]` 渲染为可点击内部链接，点击弹出模态框异步预览目标页面内容，而非直接跳转；含 `..` 的相对 wikilink 会基于当前页面路径解析，逃出项目根目录的链接被渲染为删除线（~~text~~）
- **Markdown 相对链接预览**：wiki 页面中的标准 Markdown 相对链接（如 `[标题](./path.md)`）被点击拦截器捕获，解析为当前页面相对路径后打开预览模态框或 SPA 导航，避免跳转到错误 URL
- **Wiki 搜索**：Web 全局搜索栏支持搜索 wiki 页面，结果展示标题与路径，点击导航到对应 wiki 页面；支持 `type:wiki <keyword>` 过滤
- **文件管理**：侧边栏 hover 显示 `+` 下拉菜单，支持创建文件/文件夹、重命名；重命名当前浏览的页面时自动导航到新路径
- **Wiki URL 编码**：`encodeWikiPath()` 分段编码策略，`/` 保持可读不转为 `%2F`，空格与 CJK 等字符安全编码
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
- **降级为草稿**：非 Done 任务在 Preview 模式显示 amber 按钮，确认后调用 `POST /api/tasks/:id/demote`，同步刷新任务列表与草稿列表
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
