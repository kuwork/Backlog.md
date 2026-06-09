---
title: BACK-514 浏览器 Web UI 自动端口选择
created_date: '2026-06-09 00:40'
updated_date: '2026-06-09 00:40'
labels: [source, feature, web-ui, server, port, enhancement]
source_path: backlog/tasks/back-514 - Use-available-port-for-browser-web-UI.md
---

# BACK-514 浏览器 Web UI 自动端口选择

添加 `autoPort` 配置项（默认 `true`），通过自动选择可用端口，使多个 Backlog.md 浏览器实例能够并发运行。

## 行为

- 启用 `autoPort` 时，服务器在绑定前先解析一个可用端口
- `defaultPort` 仍作为优先起始端口
- 若优先端口被占用，则扫描接下来的 100 个用户端口（1024–65535）
- 若全部 100 个端口均被占用，则启动失败并显示明确的错误信息
- 禁用 `autoPort` 时，保留原有的 EADDRINUSE 崩溃行为
- 启动日志和浏览器打开操作始终使用实际绑定的端口

## 实现

- 添加 `get-port@7.2.0` 依赖
- `BacklogConfig` 中增加 `autoPort` 字段，默认 `true`
- `BacklogServer.start()` 使用 `getPort({ port: portNumbers(...) })`
- 拒绝扫描范围之外的 OS 分配回退端口
- 设置 UI 在默认端口输入框下方暴露 `autoPort` 开关
- 回归测试位于 `src/test/server-port.test.ts`（11 个测试）

## 相关概念
- [[concepts/auto-port]] — autoPort 配置与端口选择行为
- [[concepts/web-server]] — BacklogServer 启动与绑定

## 相关来源
- [[sources/back-470-task-comments]] — BACK-470 父功能任务
