---
title: 快速笔记（Memos）子系统
labels:
  - concept
  - memos
created_date: '2026-10-03 01:13'
updated_date: '2026-10-05 08:30'
---

# 快速笔记（Memos）子系统

Backlog.md 的轻量随手记子系统：一行会议记录不再需要套用任务/文档的 ID 方案、标题与段落结构。Memos 在 `backlog/memos/` 下新增第五种文件实体，定位是"极简捕获 + 日历"，刻意与 ContentStore 重量级体系保持边界。

## 存储与 ID 约定

- 独立核心模块 `src/core/memos.ts` 独占 memo 文件格式与全部 IO，对外暴露 list / read / create / update / delete 加分页（[[sources/back-728-memo-storage-layer]]）。
- ID 为日期+序号格式 `YYYYMMDD-N`：取当日已有最大序号 +1，跨天重置为 1。id 前缀保留存储 UTC 日期，即使比归档日本地日早一天也保持稳定（文件名必须与 created_date 可 grep 对应）。
- frontmatter 只含 id、created_date、updated_date、tags，**没有 title 字段**——displayTitle 由正文首个非空行派生（空行开头回退前 40 字符）。
- 刻意排除：不接入 ContentStore / 快照机制、不改 EntityKind、无 pinned/promote 字段。
- **UTC 存储 / 本地日分桶约定**：时间戳按仓库惯例存 UTC（`new Date().toISOString().slice(0, 16)`），但所有"按天"的表面（日历分桶、`?date=` 过滤、memoCreatedOnDate、搜索深链接）必须经 `src/utils/date-utc.ts` 的 `localDateKeyFromStoredUtc` 换算成本地日。违反此约定曾导致本地 23:00 写的 memo 被计到次日（[[sources/back-737-memos-ui-polish]]）。

## 四个消费面

CLI、HTTP API、MCP 三方共享同一存储模块、同一 ID 方案、同一文件格式：

- **CLI**：`backlog memo` 命令组（create / list / view / update / delete），参照 decision 命令组风格，create 支持 `--content` 或 stdin，backlog/memos/ 刻意不入版本库（[[sources/back-730-cli-memo-subcommand]]）。
- **HTTP API**：`/api/memos` 路由镜像 docs 路由蓝本；server 层不做任何文件写入——handler 只校验输入、委托 core、广播。因 memos 不在 ContentStore 中，每次写操作后 handler 必须显式 `broadcastDataUpdated("memos")` 发出 memos-updated websocket 消息（[[sources/back-729-memo-http-api]]）。
- **MCP**：memo_create / memo_list / memo_view / memo_update / memo_delete 五工具，完全镜像 documents 工具组结构，注册到双引导路径（[[sources/back-740-memo-mcp-tools]]）。
- **Web UI**：/memos 单页信息流 + 日历双模式，共享单一 selectedDate；feed 分页基于游标 + IntersectionObserver 哨兵自动加载（[[sources/back-731-memos-feed-page]]、[[sources/back-732-memos-calendar-mode]]）。

## 钉板与归档

- **钉板视图**：`?view=board` 进入 WebGL 便利贴钉板，与信息流/日历三态共存；渲染、三层确定性布局与交互模型详见 [[concepts/memo-board]]（[[sources/back-746-memo-board-webgl-pinboard]]）。
- **归档**：卡片菜单（Copy ID 与 Delete 之间）与钉板 hover 按钮均可归档——memo 文件从 `backlog/memos/` 逐字节 rename 到 `backlog/archive/memos/`（见 [[decisions/memo-archive-rename-not-rewrite]]），归档后从 feed、日历、标签过滤与钉板全部消失；显式不做取消归档。init 对称创建两个 memo 目录（见 [[decisions/init-memos-dirs-symmetric]]）（[[sources/back-747-memo-archiving]]）。

## 全局搜索与知识网

- memo 成为全局搜索的一种结果类型（与任务/文档/决策/wiki 并列）。因刻意不进 ContentStore 快照，SearchService 通过注入式 loader 获取 memo 语料；刷新走「stat 签名 + 500ms 语料 TTL」双门控——签名未变只重置时钟，签名变化（增删改）才后台全量重载重建索引（[[sources/back-733-include-memos-in-global-search]]、[[sources/back-745-memo-corpus-signature-gate]]）。
- memo 正文经共享 MermaidMarkdown 渲染器 + TaskIdIndexProvider 作用域，裸实体 id（task-123）与 `[[wiki/path]]` 自动成为出站链接，零新解析代码。关键边界是**只出站、不入站**：memos 不是链接目标，没有 /memo/:id 路由，EntityKind 不含 memo（[[sources/back-734-memos-knowledge-web-links]]）。

## 实时同步

memos 是纯 markdown 文件，web UI 之外的编辑（编辑器、脚本、CLI）必须实时反映到 /memos。专用 `fs.watch` 目录监视器覆盖 ContentStore 覆盖不到的 backlog/memos/，75ms 防抖合并广播；客户端以 window 事件转发 + refreshInPlace 原地刷新（[[sources/back-735-memos-realtime-sync]]，模式详见 [[concepts/live-sync-pattern]]）。

## Related Concepts

- [[concepts/memo-board]] — WebGL 钉板视图的渲染、布局与交互
- [[concepts/live-sync-pattern]] — memos-updated 的 window 事件转发 + 原地刷新复用模式
- [[concepts/spotlight-search]] — 全局搜索的 Fuse 索引架构，memo 经注入式 loader 接入
- [[concepts/wikilink]] — memo 出站 [[wiki/path]] 链接复用的 wiki 链接机制
- [[concepts/markdown-pipeline]] — MermaidMarkdown 共享渲染器与实体链接插件
- [[concepts/date-fields]] — UTC 存储/本地显示的日期约定，memo 按天分桶是该约定的具体应用
- [[concepts/list-paging]] — memo_list 的分页模型（CLI 窗口 vs MCP offset 信封）
- [[concepts/mcp-workflow]] — backlog://workflow/memos 使用指南所在的指令面

## Related Sources

- [[sources/back-728-memo-storage-layer]] — 存储层与 YYYYMMDD-N ID 方案
- [[sources/back-729-memo-http-api]] — /api/memos 路由与显式 memos-updated 广播
- [[sources/back-730-cli-memo-subcommand]] — backlog memo CLI 命令组
- [[sources/back-731-memos-feed-page]] — /memos 信息流与游标分页
- [[sources/back-732-memos-calendar-mode]] — 日历模式与补录式 createdDate 钉住
- [[sources/back-733-include-memos-in-global-search]] — 注入式 loader 接入全局搜索
- [[sources/back-734-memos-knowledge-web-links]] — 只出站不入站的知识网链接
- [[sources/back-735-memos-realtime-sync]] — 专用 fs.watch + 原地刷新
- [[sources/back-736-memos-milestone-acceptance-pass]] — m-10 里程碑验收门
- [[sources/back-737-memos-ui-polish]] — 23:00 错日修复与 UTC/本地日约定
- [[sources/back-738-memo-card-copy-id-modal-background]] — 卡片菜单与模态返回修复
- [[sources/back-740-memo-mcp-tools]] — memo MCP 五工具
- [[sources/back-746-memo-board-webgl-pinboard]] — WebGL 钉板视图
- [[sources/back-747-memo-archiving]] — 归档到 archive/memos 与 init 目录修复
- [[sources/doc-20-memos-integration]] — Memos 集成的设计输入稿

## Related Entities
