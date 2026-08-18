---
title: 浏览器服务器默认回环 + --host 显式开放 LAN
created_date: '2026-08-17 23:00'
updated_date: '2026-08-17 23:00'
labels: [decision, security, server]
---

# 浏览器服务器默认回环 + --host 显式开放 LAN

## 背景

Bun.serve 默认绑定 `0.0.0.0`，使未认证的 Web UI API 暴露给 LAN/VPN，属于安全漏洞。

## 决策

BACK-558 默认绑定 `127.0.0.1`，保留熟悉的 `http://localhost:PORT` 显示；通过 `--host 0.0.0.0` 显式开放 LAN 并打印警告。

## 理由

- 修复默认网络暴露，符合安全预期
- 用户仍可通过显式选项按需 LAN 访问
- 通配绑定时打印具体 LAN IPv4 地址，避免显示不可达的 `0.0.0.0`
- 保留 `get-port@7.2.0` 端口探测，其探测已覆盖通配接口，无 macOS 假空闲回归

## Related Sources

- [[sources/back-558-browser-server-loopback-only]] — 实现
