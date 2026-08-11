---
title: BACK-539 Linux runner 构建 win32-arm64 二进制
labels: [source, ci, release, build]
created_date: '2026-08-09 00:00'
updated_date: '2026-08-09 00:00'
source_path: backlog/tasks/back-539 - Build-win32-arm64-release-binary-on-a-Linux-runner.md
---

# BACK-539 在 Linux runner 上构建 win32-arm64 发布二进制

修复 v1.45.2 发布中 win32-arm64 二进制构建失败。

## 问题

v1.45.2 发布失败：`build-bun-windows-arm64` 在编译步骤报 `Failed to extract executable for 'bun-windows-aarch64-v1.3.11'. The download may be incomplete.`。bun install 通过，失败在 `bun build --compile --target=bun-windows-arm64` 需下载嵌入 win-aarch64 运行时的步骤，该下载/解压在 Windows runner 上不稳定。矩阵还缺 `fail-fast: false`，arm64 失败取消掉了通过的 x64-baseline 任务。

## 解决方案

对 `.github/workflows/release.yml` 两处修改：
1. 构建矩阵加 `fail-fast: false`
2. 把 `bun-windows-arm64` 构建从 windows-latest 移到 ubuntu-latest——Bun 可从任意宿主交叉编译 windows-arm64，且所有 Windows 专属步骤都基于 `matrix.target`（含 'windows'）而非 runner OS，故 BIN=.exe、跳过 chmod、跳过 baseline 预置仍正确

## 实现位置

- `.github/workflows/release.yml`

## 测试/验证

用 CI 固定版本 bun 1.3.11 在非 Windows 宿主（macOS）本地交叉编译 `--target=bun-windows-arm64` 验证，成功解压并产出合法 Aarch64 PE32+ exe；YAML 用 ruby 校验。release.yml 仅 tag 推送时运行，AC#3 待下个真实发布确认。

## Related Concepts
- [[concepts/embedded-skills]] — 构建与二进制嵌入
- [[entities/backlog-cli]] — 发布管道

## Related Sources
- [[sources/back-553-modernize-browser-bundling]] — 构建现代化
