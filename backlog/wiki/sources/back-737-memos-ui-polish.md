---
title: 'BACK-737 - Memos UI polish: calendar popover, note typography, checklist and tag chips'
labels:
  - source
  - feature
  - web-ui
created_date: '2026-10-03 01:10'
updated_date: '2026-10-03 01:14'
source_path: backlog/tasks/back-737 - Memos-UI-polish-calendar-popover-kebab-menu-relative-dates.md
---

# BACK-737 - Memos UI polish: calendar popover, note typography, checklist and tag chips

里程碑后门后的 /memos 页面一次性打磨：日历改为撰写器上的弹层、笔记排版、可勾选清单、行内 #tag 标签 chips 和可用的深链接，每条颜色规则都有明暗两套值并在真实浏览器中核验。

页面收拢为"一个撰写器 + 一条 feed"：日历弹层由撰写器按钮唤起（外点或 Escape 关闭），选天后在撰写器上停放本地化日期 chip、feed 过滤到该日、下一次捕获按当日当前时间落日期。卡片时间戳按流逝时长分桶（15 分钟内 "N min ago"、一小时内 "Today"、否则精确本地时间），对照 30 秒 ticker 计算所以会持续前进而非定格。正文经 `.memo-body` 作用域呈现为笔记散文（1rem / 1.7 行高 / 紧凑块节奏 / 标题上限 1.25rem），替换掉原本生效的渲染器 GitHub 文档默认值——原来的 `prose prose-sm` 包装是死代码（@tailwindcss/typography 根本不是依赖）。行内 `#tag` 就地渲染为 chip，点击或回车即按标签过滤 feed，卡片下重复的整行标签因此删除。清单成为真控件：共享渲染器上的 opt-in `onToggleTask` 加 `toggleTaskInMarkdown` 回写保存的正文标记；勾选态双向受控（checked 恒为显式布尔、handler 点击时读取），第二次点击不会作用在过期副本上。预览样式表被打包两次且第二份落在 source.css 之后，复选框规则因此点名 `.contains-task-list` 以在特异性上领先。

交付后发现一个遗留 bug（2026-10-02 跟进）：本地 23:00 写的 memo 被计到次日，选中写入日反而看到空 feed。根因是 `nowStamp()` 存 UTC（仓库全库约定），但四个按天读取的表面把存储串的前 10 字符当成本地日期：日历分桶（handleGetMemoCalendar）、`listMemosPage` 的 `?date=` 过滤、web 助手的 `memoCreatedOnDate`、search-results 的 memo 深链接；撰写器的补日期 chip 更糟——把本地日期拼到 UTC 时钟上，存出一个日历永远显示不出的时刻。修复是所有按天的问题统一走 `src/utils/date-utc.ts` 的新助手 `localDateKeyFromStoredUtc`；磁盘数据不变，两条已捕获 memo 原地重新归桶。id 是刻意的例外：nextMemoId 保留存储 UTC 日期作为 YYYYMMDD 前缀，因为 id 是必须稳定的文件名、要保持与 created_date 可 grep 对应——其数字可能比归档日本地日早一天，此后果在评审中被明确接受并写入 src/guidelines/mcp/memos.md。由于 bun test 本身在 UTC 运行（两地重合时旧代码看起来正确），新增 memo-local-day-timezone 测试套件在子进程中钉住真实时区（America/Los_Angeles 的 23:00 捕获、Asia/Tokyo 的 00:30 捕获），这是唯一能区分修复前后代码的测试。另：memo-search 的 server-boot 用例在本机约 1/4 概率失败，经 git diff 证明与本次改动无关，未追。

验证：tsc 与 biome 对所触 16 文件干净（仓库级 check 报的 25 个错误是 Windows CRLF 检出伪影）；core memos 19、date-utc 11、web/utils/memos 24、search-results 32、server-memos-endpoint 16、mcp-memos 9、web-memos-page 44、memo-local-day-timezone 3，共 158 通过 0 失败；/memos 加入 SPA 路由表，刷新不再 404。

## Related Concepts
- [[concepts/date-fields]] — UTC 存储/本地显示的日期约定，本任务的 memo 按天分桶 bug 是该约定的具体踩坑
- [[concepts/markdown-pipeline]] — 共享 MermaidMarkdown 渲染器的 opt-in 勾选清单与 #tag chips 扩展
- [[concepts/web-ui-features]] — web UI 组件与主题体系，明暗双色与真实浏览器核验所在层
- [[concepts/web-ui-i18n]] — 日历标题/相对时间桶等文案进入 en/ja/zh-CN/zh-TW 四语字典
- [[concepts/memos]] — UTC 存储/本地日分桶约定与 23:00 错日修复所属的 memos 子系统

## Related Sources
- [[sources/back-736-memos-milestone-acceptance-pass]] — 本打磨任务紧随其后的里程碑验收门
- [[sources/back-738-memo-card-copy-id-modal-background]] — 依赖本任务的后续 memo 卡片菜单修复
- [[sources/back-733-include-memos-in-global-search]] — memo 深链接的本地日修复承接其搜索结果路由
