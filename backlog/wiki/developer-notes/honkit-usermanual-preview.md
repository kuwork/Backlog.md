---
title: HonKit 预览用户手册
labels: [developer-notes]
description: 使用 HonKit 本地预览和构建 usermanual 的完整操作流程
created_date: 2026-05-12 00:00
---


# HonKit 预览用户手册

[[usermanual/README|Backlog.md 用户手册]] 采用 GitBook 风格的目录结构组织（`README.md` + `SUMMARY.md`），可以直接用 [[entities/backlog-cli|HonKit]] 在本地预览和构建。

## 前置条件

- Node.js 已安装（项目使用 v22）
- `npx` 可用

## 安装 HonKit

### 方案一：本地安装（推荐）

在用户手册目录下安装为开发依赖：

```bash
cd backlog/wiki/usermanual
npm init -y
npm install --save-dev honkit
```

之后可直接用：

```bash
npx honkit serve
npx honkit build
```

### 方案二：全局安装

```bash
npm install -g honkit
```

之后可直接用：

```bash
honkit serve
honkit build
```

### 方案三：不安装，使用 npx（临时）

如果网络通畅，`npx` 会自动下载并执行最新版 HonKit，无需显式安装：

```bash
cd backlog/wiki/usermanual
npx honkit serve --port 4000
```

> 注意：每次运行都会检查版本更新，首次执行可能需要等待下载。

## 目录结构

用户手册源文件位于：

```
backlog/wiki/usermanual/
├── README.md          # 封面/简介
├── SUMMARY.md         # 章节目录导航
├── 00-快速开始/
├── 10-任务管理/
├── 20-看板与可视化/
├── 30-文档与决策/
├── 40-Web界面/
├── 50-AI集成/
└── 60-配置与运维/
```

## 启动本地预览

```bash
cd backlog/wiki/usermanual
npx honkit serve --port 4000
```

浏览器访问 http://localhost:4000 即可实时预览。修改 Markdown 文件后页面会自动刷新。

> HonKit 是 GitBook 的社区维护分支，修复了 GitBook CLI 在 Node.js 新版本上的兼容性问题。

## 构建静态站点

```bash
cd backlog/wiki/usermanual
npx honkit build
```

输出到 `backlog/wiki/usermanual/_book/` 目录，可直接用浏览器打开 `index.html` 查看。

## 生成 PDF

HonKit 生成 PDF **依赖 Calibre** 的 `ebook-convert` 工具。

### 安装 Calibre

1. 下载安装：https://calibre-ebook.com/download
2. 将 Calibre 安装目录（如 `C:\Program Files\Calibre2\`）加入系统 `PATH`
3. 验证：`ebook-convert --version`

### 生成命令

```bash
cd backlog/wiki/usermanual
npx honkit pdf
```

默认输出 `book.pdf` 到当前目录。

### 替代方案（无 Calibre）

若不想安装 Calibre，可先 `npx honkit build` 生成静态 HTML，再用浏览器打开并**打印 → 另存为 PDF**。

## 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| `ebook-convert` 找不到 | 未安装 Calibre 或未加入 PATH | 安装 Calibre 并配置环境变量 |
| `cb.apply is not a function` | 使用原版 GitBook CLI + Node.js 22 | 改用 HonKit |
| 中文路径乱码 | URL 编码正常行为 | 不影响实际访问 |
