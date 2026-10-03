---
title: BACK-736 - Memos milestone regression and acceptance pass
labels:
  - source
  - feature
  - testing
created_date: '2026-10-03 01:10'
updated_date: '2026-10-03 01:14'
source_path: backlog/tasks/back-736 - Memos-milestone-regression-and-acceptance-pass.md
---

# Memos milestone regression and acceptance pass

里程碑 m-10（memos 集成）内每个前置任务都是孤立验证以保持速度，整个功能是否还成立从未被证明。本任务是这个里程碑宣告完成前的唯一门禁：跑项目级检查、跑全量测试并与变更前基线对比、在真实浏览器里按 doc-20 第 9 节逐项走验收。

检查结果：bunx tsc --noEmit 干净；bun run check .（biome）干净，覆盖 633 个文件。测试按本仓库依赖的分批方式运行——单体 `bun test` 在这台机器上会挂死（跑过 17 分钟无输出、三个流浪 bun 进程），属于仓库文档已记载的既有环境问题，非 memos 工作引入的回归。分批结果全绿 0 失败：memo 专项 6 文件 72 通过；web 批（src/test/web-*，52 文件）368 通过；graph + server 批 30 文件 192 通过。

端到端验收在一次性语料的 live 源码服务器（127.0.0.1:6479）上完成，覆盖 doc-20 §9：POST /api/memos 建 memo 立即可见；.md 直接丢进 backlog/memos/ 也立即可见；带 type=memo 的搜索命中且不过滤查询也含 memo；日历接口按年月返回正确计数；标志性承诺 §9.6——外部编辑（追加已有文件与新建文件两种）都在约一秒内以 memos-updated 经 websocket 广播（观察到 2/2）。

过程中落地一项加固：memo 目录 watcher 补挂 'error' 监听器（fs.watch 对目录被删/不可达会异步抛 'error'，无监听器会击垮进程），与 ContentStore watcher 对齐。已知限制：watcher 只在服务初始化时 backlog/memos/ 已存在才绑定，全新项目首次写入前的外部编辑要等到服务重启才被监视（server-memo-broadcast 测试因此先种子目录再启动）。浏览器步行未获得（本机 agent-browser 守护进程卡死，about:blank 80 秒超时，已知状况），以 jsdom 组件测试 + live 服务器 HTTP/websocket 验收作为替代证据。doc-20 §9 无偏差，§9.7（memo 提升为 task）按文档声明属于范围外。

## Related Concepts
- [[concepts/web-server]] — live 服务器验收所依赖的 API/websocket 行为
- [[concepts/core-architecture]] — ContentStore 边界决定 watcher 覆盖范围与已知限制
- [[concepts/memos]] — 本任务验收的 m-10 memos 里程碑所属子系统

## Related Sources
- [[sources/back-733-include-memos-in-global-search]] — 被验收的里程碑任务之一：memo 全局搜索
- [[sources/back-734-memos-knowledge-web-links]] — 被验收的里程碑任务之一：memo 知识网链接
- [[sources/back-735-memos-realtime-sync]] — 被验收的里程碑任务之一：memo 实时同步，§9.6 为其标志性承诺
- [[sources/back-737-memos-ui-polish]] — 本门禁通过后交付的里程碑后续 UI 打磨任务
