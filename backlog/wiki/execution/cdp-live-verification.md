---
title: headless Chrome CDP 实况验证
created_date: '2026-09-26 14:45'
updated_date: '2026-09-26 14:45'
labels: [execution, testing, web-ui]
extracted_from:
  - "[[sources/back-670-loading-motion-reduce-removal]]"
  - "[[sources/back-668-branch-indexing-header-chip]]"
  - "[[sources/back-661-deep-link-first-load-guard]]"
  - "[[sources/back-638-header-outline-toc]]"
  - "[[sources/back-641-sidebar-toggle-z-index]]"
  - "[[sources/back-663-completed-popup-read-only]]"
---

# headless Chrome CDP 实况验证

## 适用场景

jsdom 证明不了的东西：真实渲染（computed style、动画矩阵）、真实视口、真实网络时序、真实鼠标命中。本波（653–714）CDP 已是 web 改动的事实标准收尾验证。

## 已验证的用法

- **计算样式与动画探针**：读取 computed `animation-name` 与间隔采样的 transform 矩阵，区分"画了但没动"与"真的在转"（BACK-670 在 reduced-motion 主机上定位假死 spinner）
- **virtual-time 冻结**：暂停 virtual time 抓住瞬态帧再断言/截图——冷启动窗口里的索引指示器用此法在两种主题下取证（BACK-668：去掉 `.dark` 补拍亮色主题）
- **Fetch 域持有端点**：按住 `/api/status` 观察客户端加载态（注意副作用：客户端会卡在 loading，BACK-670 记录）
- **真实网络时序复现**：慢 `/api/search`（4.7MB/347 任务 ~1019ms）+ ~780ms 到达的 `loaded` 帧复现深链竞态；反向因果探针用"永不打开的 WebSocket"（BACK-661）
- **CDP 命中测试 + 真实鼠标事件**：逐像素确认 z-index 归属（BACK-641：切换按钮最右像素属于 header nav 还是按钮）
- **截图取证**：修复前后截图存入 `backlog/assets/images/`（BACK-613 先例），深色模式 pill 计算色 + 截图复核（BACK-636）
- **小视口走查**：720px 视口验证浮动面板（BACK-638）

## 常见陷阱

- **Bun keep-alive 池打到 DevTools HTTP 服务**：复用连接的第二个请求收到 404——给 CDP HTTP 请求加 `Connection: close`（BACK-674 记录，与 [[execution/bun-windows-test-toolkit]] 的 server 套件陷阱同源）
- CDP 探针本身改变时序——结论以"探针在/不在都复现"为准（BACK-670 的 260ms 双采样）

## 参考任务

- [[sources/back-670-loading-motion-reduce-removal]] — 动画探针与 reduced-motion 主机
- [[sources/back-661-deep-link-first-load-guard]] — 网络时序复现与因果探针
- [[sources/back-668-branch-indexing-header-chip]] — virtual-time 冻结取证
