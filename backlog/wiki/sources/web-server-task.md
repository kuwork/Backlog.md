---
type: source
title: BACK-100 嵌入式 Web 服务器
source_path: backlog/completed/back-100 - Add-embedded-web-server-to-Backlog-CLI.md
updated: 2026-05-06
---

# BACK-100 摘要

在 Backlog CLI 可执行文件中嵌入了一个基于 Bun.serve() 的 Web 服务器，提供现代化的 Web UI 进行任务管理。

## 技术栈

- **后端**：Bun.serve() HTTP 服务器，RESTful API
- **前端**：React 18 + TypeScript + Tailwind CSS v4
- **构建**：Vite
- **渲染**：react-markdown（任务描述）、Mermaid 图表

## 核心功能

1. 交互式看板（拖放）
2. 任务全生命周期 CRUD（模态框编辑）
3. 验收标准交互式编辑器
4. 实时更新（跨视图同步）
5. 响应式设计（桌面/移动端）
6. 暗黑模式
7. 任务归档确认对话框
8. 里程碑泳道（MVP）
9. 所有更改与 Markdown 文件同步

## 启动命令

`backlog browser`（自动打开浏览器，默认端口 6420）
`backlog browser --port 8080 --no-open`

## 后台服务化

参见 `backlog/docs/doc-003 - Running-Backlog-Browser-as-a-Service.md`
支持 Linux/WSL2 (systemd)、macOS (launchd)、Windows (Task Scheduler / NSSM)
