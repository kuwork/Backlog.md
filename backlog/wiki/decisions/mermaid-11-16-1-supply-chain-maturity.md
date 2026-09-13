---
title: mermaid 选择 11.16.1 而非最新 11.17.2
description: BACK-626 以供应链验证成熟度优先于版本新度
labels: [decision, security, dependencies]
created_date: '2026-09-13 01:12'
updated_date: '2026-09-13 01:12'
---

# mermaid 选择 11.16.1 而非最新 11.17.2

## 背景

五个 2026-08 的 GHSA 影响固定版本 `mermaid@11.15.0`，且 mermaid 不是 dev-only：预构建浏览器 bundle 被嵌入编译后的 CLI 二进制，在回环 Web UI 中渲染任务/文档 Markdown。修复需选择 >= 11.16.1 的版本；当时最新干净的 11.x 是 11.17.2。

## 备选方案

| 方案 | 优点 | 缺点 |
|---|---|---|
| A. 升到最新 11.17.2 | 版本最"新"、未来差异最大 | 公开发布时间短，供应链侧尚无第三方深度验证 |
| B. 升到 11.16.1 | 已清除全部五个公告；带已发布的深度供应链验证；已有约五周公开暴露 | 非最新小版本 |

## 决策

选择 **方案 B**（`mermaid@11.16.1`，精确固定，不用 `^`）。安全目标（清除已知公告）与方案 A 等价，额外获得曝光时间与验证记录；供应商 bundle 进入编译产物，成熟度优先。

## 配套

- `bun.lock` 中该 bump 相关的 7 行新增仅落在 mermaid 子树；其余 150 行删除是未改动树上 `bun i` 也能复现的孤立条目清理
- `bun.nix` 六个条目的 name/url/hash 手改（生成器需 Docker/Nix，本环境不可用），哈希逐字节匹配 lockfile 的 sha512 integrity
- fork 无 Nix CI 校验，字节级交叉核对是唯一本地保证（[[concepts/ci-platform-contracts]]）

## Related Sources

- [[sources/back-626-dependabot-mermaid-bump]] — BACK-626 实现与验证
