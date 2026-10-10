---
title: doc-003 - 将 backlog browser 作为服务运行
labels: [source, web-ui, documentation, ops]
created_date: 2026-09-26 14:15
updated_date: 2026-10-09 23:30
source_path: backlog/docs/doc-003 - Running-Backlog-Browser-as-a-Service.md
---

# doc-003 - 将 backlog browser 作为服务运行

运维指南：将 `backlog browser --no-open` 作为按项目常驻的服务运行，实现开机自启与失败自动重启，并提供 systemd（Linux/WSL2）、launchd（macOS）、Task Scheduler/NSSM（Windows）的可复制配方。

## 目标

让每个项目都能以守护进程方式长期运行 Web UI，开机自启、失败重启，且多项目互不冲突（各自的服务名与端口）。

## 实现要点

- 核心命令：`backlog browser --no-open` 保持 Web UI 运行但不打开浏览器标签页
- 多项目规则：每个项目需要独立的服务名和端口（示例使用 `<project>` 占位符，端口 6420/6421）
- Linux：systemd **user** 单元 `backlog-browser-<project>.service`，配置 `Restart=on-failure`；需要 `loginctl enable-linger` 才能在无会话时开机自启；项目较多时建议使用模板单元（`backlog-browser@.service` 配合 `%i`）
- macOS：launchd LaunchAgent plist，配置 `RunAtLoad` + `KeepAlive`；Label 必须每个项目唯一；按架构区分 `/opt/homebrew/bin/backlog` 与 `/usr/local/bin/backlog`
- Windows：计划任务（`New-ScheduledTaskAction`、`-AtLogOn`）实现登录时启动，或用 NSSM 包装实现真正的登录前后台服务并自动重启
- 每个配方的工作目录必须是项目根目录；二进制路径应与 `which backlog` 一致

## 验证

不适用（运维指南）；每个配方均可自检：`systemctl --user status`、`launchctl load` 或 `nssm start`。

## Related Concepts

- [[concepts/web-server]] — 被守护进程化的 browser 服务器
- [[concepts/auto-port]] — 每项目独立端口规则背后的端口分配考量

## Related Sources

- [[sources/web-server-task]] — 本指南所运维的 browser 服务器功能
- [[sources/back-514-auto-port]] — 多项目运行时相关的自动端口选择
- [[sources/back-558-browser-server-loopback-only]] — 对外暴露为服务的服务器仅回环绑定
