---
title: BACK-732 - memos 日历模式与信息流联动
labels: [source, web-ui, feature]
created_date: 2026-10-03 01:07
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-732 - Calendar-mode-and-feed-calendar-linkage-on-memos.md
---

# BACK-732 - memos 日历模式与信息流联动

仅有 feed 正是本里程碑要解决的 Memos 类工具弱点：别处日历是独立页面、与笔记流互不通信。本任务让 feed 和 calendar 两种模式共存于一个页面并共享单一 selectedDate——点选某天即过滤 feed，清除 chip 即回到全部。在 BACK-731 的 MemosPage 组件上扩展日历模式：CSS grid 月视图（数据来自 GET /api/memos/calendar），按每日 memo 数做强度渐变着色，高亮今天；点击某天在网格下方就地展开 DayPanel（不跳转），面板自带内联 composer 可写入该日期的 memo（含补录历史日期）。不引入第三方日历库（项目用 Tailwind v4 + dark: 变体）。

## 实现要点

跨层改动（补录式捕获是本功能的脊柱）：src/core/memos.ts 的 createMemo 扩展为 createMemo(root, content, tags?, createdDate?)，允许调用方钉住 createdDate——ID 前缀由钉住日期经 dateStampFrom 派生，updatedDate 仍取当前时间，CREATED_DATE_PATTERN 守卫拒绝畸形日期（回退到当前时间）；POST /api/memos 接受 JSON body 中可选的 createdDate（只接受 YYYY-MM-DD 或 YYYY-MM-DD HH:mm，无注入面）；api.ts 的 createMemo 转发该参数。

前端实现：CalendarGrid 由月初星期偏移构建 6x7 月矩阵（相邻月首尾日淡化），格子按最大日计数派生的蓝色强度分级着色（countClass），今天高亮；prev/next/today 翻月在 1 月/12 月跨年并重新拉取计数；点击某天加载该日 memo（fetchMemosPage {date, limit: 100}）就地展开 DayPanel，再次点击或关闭按钮收起；面板 composer 以 createdDate 钉住所选日 POST，随后刷新计数与列表；面板 "View in feed" 动作设置 selectedDate 并切到 feed 模式（即日期 chip 过滤路径）；?view=calendar&date=YYYY-MM-DD 深链直达该月、预选该日并自动展开面板（深链初始化 selectedDay，因此无 date 参数的测试走点击路径）。

## 验证

结果：9 条验收标准全部达成，无新增第三方依赖。memos.test.ts 新增 4 个补录创建测试、web-memos-page.test.tsx 新增 5 个日历测试（网格渲染与翻月、面板开合、深链、补录保存、view-in-feed）、server 端 calendar 端点 3 个测试，浏览器 smoke 确认全部行为，tsc 与 biome 干净。

## Related Concepts

- [[concepts/web-ui-features]] — /memos 页面与视图切换的 Web UI 结构
- [[concepts/date-fields]] — createdDate 钉住与日期格式校验
- [[concepts/web-ui-i18n]] — 四语言日历 locale 键同步（prevMonth/nextMonth/today/viewInFeed 等）
- [[concepts/memos]] — /memos 日历模式与 feed 单页联动所属的 memos 子系统

## Related Sources

- [[sources/back-731-memos-feed-page]] — 被扩展的 feed 页面组件（依赖 BACK-731）
- [[sources/back-729-memo-http-api]] — 提供 calendar 计数端点并被扩展接受 createdDate 的 API
- [[sources/back-728-memo-storage-layer]] — createMemo 签名扩展所在的存储层
