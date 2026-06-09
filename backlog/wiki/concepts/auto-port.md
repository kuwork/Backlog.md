---
title: 自动端口选择
created_date: '2026-06-09 01:35'
updated_date: '2026-06-09 01:35'
labels: [concept, feature, server, web-ui, port, config]
---

# 自动端口选择

`autoPort` 是 Backlog.md Web UI 服务器的配置项，当默认端口被占用时自动扫描并绑定下一个可用端口，避免多个项目同时启动浏览器界面时发生 `EADDRINUSE` 崩溃。

## 默认行为

- `autoPort` 默认为 `true`，新项目和未显式设置的项目均启用
- 显式设置为 `false` 时，保留原有行为：端口被占用即报错退出

## 端口扫描逻辑

1. 确定**首选端口**：`--port` 参数 > 配置中的 `defaultPort` > 默认 `6420`
2. 从首选端口开始，依次扫描接下来 **100 个用户端口**（范围 `1024–65535`）
3. 使用 `get-port` 库测试每个候选端口的可用性
4. 若 100 个候选端口全部被占用，启动失败并输出清晰的错误提示：
   - 提示用户释放端口、关闭 autoPort 或更换默认端口
5. 拒绝 `get-port` 返回的**超出扫描范围**的 OS 分配端口，防止绑定到不可预期的端口

## 日志与浏览器打开

- 终端启动日志始终显示**实际绑定端口**
- 当实际端口与首选端口不一致时，日志会标注为 "temporary port"
- `openBrowser` 调用使用实际绑定端口，确保浏览器正确打开

## 配置方式

```bash
# 查看当前配置
backlog config get autoPort

# 开启/关闭
backlog config set autoPort true
backlog config set autoPort false
```

Web UI 设置面板中也在 Default Port 输入框下方提供 `autoPort` 开关切换。

## Related Sources
- [[sources/back-514-auto-port]] — BACK-514 实现任务
