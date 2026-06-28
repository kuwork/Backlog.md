---
title: Web UI 功能
labels: [concept]
created_date: 2026-05-10 00:00
updated_date: 2026-06-27 21:00
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
- **子任务归组**：按 ID 排序时子任务自动归组到父任务下方（BACK-496）
- **标签颜色自定义**：`LabelFilterDropdown` 中每个标签可设置预设颜色，持久化到 `config.yml`，卡片标签渲染对应背景色（BACK-500）
- **卡片标签宽度自适应**：`TaskCard` 根据容器宽度动态计算可显示标签数量，而非硬编码限制 3 个（BACK-500）
- **拖拽时保持列排序稳定**：拖拽开始不再清除本地排序，避免任务在光标下跳动（BACK-504）
- **跨列精确放置**：`draggedTaskId` 提升到 Board 级别，跨列拖拽支持插入到目标列任意位置（BACK-504）
- **跨分支任务列排序菜单**：列含跨分支任务时仍显示本地排序菜单（ID/标题/优先级），仅隐藏会修改 ordinal 的「Apply Priority Order」按钮（BACK-512）

### 所有任务（All Tasks）
- 表格布局
- 状态/优先级/标签/里程碑筛选
- 多状态筛选支持
- **搜索框与类型下拉**：输入框左侧图标按钮弹出下拉菜单（All / Tasks / Documents / Decisions / Wiki）
- **子任务归组**：按 ID 排序时子任务归组到父任务下方（BACK-496）

### 里程碑（Milestones）
- 里程碑列表与详情
- 未分配任务池
- 拖放分配任务到里程碑
- 已完成的里程碑折叠区
- 里程碑搜索（子串包含匹配 + Fuse.js fallback）
- **里程碑日期编辑**：`dueDate`、`plannedStart`、`plannedEnd` 三个 date 输入框；新增 `actualStart` / `actualEnd` datetime-local 输入框（BACK-493）
- **子任务归组**：按 ID 排序时子任务归组到父任务下方（BACK-496）

### 文档与决策
- **文档文件夹树**：递归渲染 `backlog/docs/` 目录结构，文件夹可展开/折叠，显示文件数量徽标
- **文件夹操作**：hover 显示 `+` 下拉菜单，支持新建文件/文件夹
- **无独立重命名**：文档遵循 `{id} - {title}.md` 约定，重命名通过编辑标题自动完成
- 决策记录查看

### Wiki
- 侧边栏可折叠文件树，反映 `backlog/wiki/` 目录结构
- 点击 `.md` 文件导航到 `/wiki/:path`，Markdown 渲染
- **在线编辑**：标题、正文、labels 可修改，未保存变更检测
- **Wikilink 交互预览**：`[[wikilinks]]` 可点击弹出模态框预览
  - 支持别名语法 `[[target|alias]]`，别名内可使用 Markdown 行内格式与 HTML（BACK-523）
  - 支持属性块 `[[target]]{...}`（BACK-523）
  - 支持媒体嵌入 `![[path|alt|WxH]]`（图片/视频/音频，BACK-524）
- **Markdown 相对链接预览**：标准相对链接点击拦截后预览或 SPA 导航
- **Wiki 搜索**：全局搜索支持 wiki 页面，支持 `type:wiki <keyword>`
- **文件管理**：创建/重命名/删除文件与文件夹
- **Wiki URL 编码**：`encodeWikiPath()` 分段编码，`/` 保持可读
- **粘贴图片 promote**：粘贴图片先存 `.temp/`，保存时自动迁移到 `paste/`
- **页面切换退出编辑**：切换 Wiki 页面时自动退出编辑模式，避免新页面内容在编辑器中误显示（BACK-510）
- 实时同步（WebSocket）

### 草稿（Drafts）
- 草稿列表卡片布局
- **筛选栏**：关键字搜索、状态、优先级、里程碑、标签筛选
- 结果计数器、清除筛选、空状态双模式
- 所有筛选客户端执行，状态同步到 URL 查询参数
- **提升/降级交互**：草稿可提升为任务（emerald 按钮），非 Done 任务可降级为草稿（amber 按钮）

### 设置（Settings）
- 配置管理、Definition of Done 默认值编辑
- Web UI 主题自定义
- **语言切换**：英语 / 日语 / 简体中文 / 繁体中文
- **Locale 切换防覆盖**：`App.tsx` 仅在首次加载时从服务器同步 locale，避免后台数据刷新覆盖用户手动选择（BACK-503）

## 任务编辑

- 富文本 Markdown 编辑器（MDEditor）
- **粘贴为 Markdown** — Word/Google Docs/网页自动转换，支持 `.docx` 上传
- **本地文件预览** — 点击本地路径在模态框中查看
- 验收标准交互式勾选列表
- 任务内容目录（TOC）与滚动监听
- 富表单：状态、优先级、标签、里程碑、负责人、依赖、引用、文档链接
- **标签输入下拉框**：`ChipInput` 支持自动完成，focus 时显示项目已有标签，支持模糊过滤，Enter 创建新标签，大小写不敏感重复检测（BACK-501）
- **降级为草稿** / **提升为任务**：amber/emerald 按钮，确认后调用 API
- **路径自动补全**：references 与 documentation 输入框支持键盘导航
- **日期字段**：`dueDate`/`plannedStart`/`plannedEnd`（date 输入）+ `actualStart`/`actualEnd`（datetime-local 输入）
- **键盘快捷键修复**：全局快捷键（E/C/D/P/Ctrl+S/Escape）在输入框聚焦时正确抑制（BACK-494）
- **依赖项钻取导航**：Dependencies 区域的依赖任务标签可点击，直接打开该任务详情；标题栏左侧显示返回按钮可回到父任务（BACK-505）
- **稳定任务模态框 URL**：`/task/:id` 路由支持从任意视图打开任务详情，底层页面保持可见；支持前缀无关匹配（`506` → `BACK-506`）；裸 `/task/:id` 自动重定向到 `/task/:id/:title`（BACK-509）
- **本地 URL 短别名**：Markdown 中同源 URL 渲染为 `DOC#:id`、`Decisions#:id`、`TASK#:id`、`WIKI#:path` 别名，提升可读性（BACK-511）

## 技术特性

- **国际化（i18n）**：零依赖自定义 React Context + Hook，~300 键覆盖 4 种语言
- **实时同步**：文件系统变更自动刷新所有视图
- **响应式**：桌面与移动端适配
- **暗黑模式**：Tailwind CSS dark mode
- **Mermaid 图表**：任务中的 Mermaid 语法自动渲染
- **图片与附件**：`assets/` 自动提供，临时粘贴图片 promote 机制
- **预览防崩溃**：尖括号类型字符串过滤
- **草稿保留**：未保存的草稿在文件刷新后保留
- **日期指示器**：TaskCard 计划日期与逾期高亮
- **时区一致性**：所有 UTC 存储字符串统一通过 `parseStoredUtcDate` 解析为本地时间（BACK-497）
- **统计缓存**：服务端 debounced 缓存 + 客户端 localStorage 双缓存层，确保统计页面瞬时加载且数据实时同步（BACK-503）

### 甘特图（Gantt View）
- `/gantt` 路由，左侧任务列表 + 右侧时间线双栏布局
- 五级时间粒度：日 / 周 / 月 / 季度 / 年
- **跟踪甘特图**：双层渲染（实际条 + 计划边框），支持计划 vs 实际偏差追踪（BACK-495）
- 最小宽度回退机制
- 依赖箭头可视化：SVG 贝塞尔曲线
- 时间线拖拽平移，左右面板滚动同步
- 左表支持四列排序，计划/实际时间列可切换显示
- 子任务 ID 归组（BACK-496）
- 时区一致（BACK-497）

### 统计页面（Statistics / Project Health）
- **顶部健康摘要**：四种风险分类的彩色圆点计数（🟡 临期 / 🔴 逾期 / 🔵 停滞 / 🔴 阻塞）
- **GitHub 风格贡献热力图**：7×53 网格，周日开始，inline style 配色，hover/click tooltip 显示日期和完成数，支持 4 语言本地化（BACK-503）
- **服务端缓存自动刷新**：CLI 创建任务后 500ms 内统计自动更新，WebSocket 推送 `"statistics-updated"`，客户端 `localStorage` 缓存瞬时加载
- **详情列表**：按 At Risk / Overdue / Stale / Blocked 分块展示任务卡片
- 所有卡片保持点击编辑行为

## 排序交互

### 任务列表表头排序
- 双箭头图标设计：↑ 在左表示升序，↓ 在右表示降序
- 未激活时两支箭头均为灰色；激活时对应方向高亮
- 三种状态外框宽度一致（`w-4`），切换时不引起表头抖动

### 里程碑分组独立排序
- 每个分组（未分配任务 + 各里程碑）拥有独立排序状态
- 表头列：ID、标题、状态、优先级

### 看板列本地排序
- 操作菜单提供 6 个本地排序选项：ID ↑/↓、标题 ↑/↓、优先级 ↑/↓
- 仅影响当前列展示顺序，不保存到后端
- 拖拽任务后自动清除本地排序

## Related Concepts
- [[concepts/web-server]] — Web Server HTTP API 与后端支撑
- [[concepts/date-fields]] — 日期字段语义与存储格式
- [[concepts/gantt-view]] — 甘特图详细技术实现
- [[concepts/task-lifecycle]] — 任务状态流转

## Related Sources
- [[sources/web-ui-sort-optimization]] — BACK-484 排序优化
- [[sources/draft-filters-task]] — BACK-486 草稿筛选
- [[sources/task-edit-modal-keyboard-fix]] — BACK-494 键盘快捷键修复
- [[sources/subtask-grouping-fix]] — BACK-496 子任务归组
- [[sources/timezone-handling-fix]] — BACK-497 时区处理修复
- [[sources/sidebar-collapse-button-fix]] — BACK-499 折叠按钮与 resize handle 重叠修复
- [[sources/label-color-customization-task]] — BACK-500 标签颜色自定义与宽度自适应
- [[sources/task-detail-label-dropdown-task]] — BACK-501 标签输入下拉框与模糊过滤
- [[sources/back-504]] — BACK-504 看板拖拽修复
- [[sources/back-505]] — BACK-505 依赖项钻取导航
- [[sources/stable-task-modal-urls-task]] — BACK-509 稳定任务模态框 URL
- [[sources/wiki-page-switch-edit-mode-fix]] — BACK-510 Wiki 编辑模式修复
- [[sources/local-url-short-aliases-task]] — BACK-511 本地 URL 短别名
- [[sources/back-512-kanban-column-sort-menu-cross-branch]] — BACK-512 看板列跨分支排序菜单修复
