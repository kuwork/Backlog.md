---
title: 平台包 Scope 从主包 package.json 自身推导
created_date: 2026-09-08 17:02
updated_date: 2026-09-08 17:02
labels: [decision]
---

# 平台包 Scope 从主包 package.json 自身推导

## 背景

BACK-621 的平台包启动器需要解析平台包名（如 `@scope/backlog.md-win32-x64`）。scope 此前硬编码为 `@kuwork`，换 scope 发布时会解析失败。

## 决定

scope 不硬编码，从主包自身的 `package.json` `name` 字段推导：scoped（`@org/name`）与 unscoped（`name`）发布都能自适应。

配套决策：EACCES 修复选择 spawn 前 `chmod 0o755` 兜底，而非修改 Windows 发布脚本。

## 理由

- 从主包 name 推导让发布配置是唯一事实来源，launcher 零改动即可适配任意 scope。
- chmod 兜底放在 launcher 侧一处，覆盖所有平台包与所有发布渠道；改 Windows 发布脚本则要追着每个构建配置修。

## 被否方案

- **硬编码 `@kuwork` scope**：更换发布 scope 时 launcher 静默失效。
- **修改 Windows 发布脚本修 EACCES**：修的是单个构建产物，launcher 侧无兜底。

## Related

- [[sources/back-621-launcher-scoped-package-resolution]]
- [[concepts/cli-entry]]
- [[concepts/ci-platform-contracts]]
