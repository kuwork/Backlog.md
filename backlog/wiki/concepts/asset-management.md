---
type: concept
title: 资源管理与临时文件提升
updated: 2026-05-10
---

# 资源管理与临时文件提升

Backlog.md 的 Web UI 资源处理系统，管理粘贴图片的上传、临时存储和持久化提升。

## AssetManager

`src/core/assets.ts` 中的 `AssetManager` 类处理所有资源操作。

**方法**
- `uploadFile(file, isTemp?)` — multipart 上传
- `uploadFromDataUri(dataUri, isTemp?)` — base64 解码并上传
- `uploadFromUrl(url, isTemp?)` — 安全远程下载并上传
- `promote(urls)` — 将 `.temp/` 中的文件移动到 `paste/`
- `cleanup(options?)` — 删除过期临时文件（默认 30 分钟）
- `downloadImage(url)` — SSRF 安全的图片获取

## 临时目录设计

**为什么使用临时目录？**
避免用户在编辑器中粘贴图片但未保存时，`assets/` 中积累孤立文件。

**流程**
```
粘贴 → upload to .temp/ → 编辑中预览 → 保存时 promote → paste/
```

- 临时文件保存在 `backlog/assets/.temp/{uuid}.png`
- 保存时前端扫描 Markdown 中的 `/assets/.temp/` 引用
- 调用 `POST /api/assets/promote` 批量移动
- 后端返回 URL 映射，前端替换后再执行正常保存

## 安全下载（downloadImage）

- 协议白名单：仅 `http:` / `https:`
- 主机黑名单：`localhost`、`127.0.0.1`、`::1`、私有 IP 范围
- 重定向限制：最多 3 跳，每次重定向后重新验证目标
- Content-Type 验证：必须以 `image/` 开头
- 大小限制：20 MB（通过 `content-length` 头或下载后 blob size）
- 超时：30 秒

## 清理

服务器启动时异步运行 `cleanupTempAssets()`：
- 非阻塞，不影响服务器启动
- 逐文件 try/catch，单个文件错误不中断整体清理
- 删除超过 30 分钟的 `.temp/` 文件
