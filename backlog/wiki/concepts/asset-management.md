---
title: 资源管理与临时文件提升
labels: [concept]
created_date: 2026-05-10 00:00
updated_date: '2026-09-26 14:45'
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

## 各表面 promote 覆盖（BACK-631/632/634）

`.temp` promote 模式已从任务描述扩展到所有挂载 PasteAwareMDEditor 的表面，统一走 `extractTempImageUrls` → `apiClient.promoteAssets` → `replaceTempImageUrls` → 写回编辑器状态 → 持久化：

- **评论**(BACK-631)：评论输入框换用共享富文本编辑器后，`handleAddComment` 遵循任务描述的 promote 路径，保存失败时针对永久 URL 重试（[[sources/back-631-comment-rich-markdown-editor]]）。
- **决策保存**(BACK-632):`DecisionDetail.handleSave` 更新分支此前不 promote,30 分钟清理会留下断图；现已与任务弹窗镜像对齐（[[sources/back-632-decision-image-promotion]]）。
- **决策创建**(BACK-634)：创建分支在 `createDecision` 后归一化正文、promote 粘贴图片再以 `updateDecision` 持久化（[[sources/back-634-decision-creation-sidebar]]）。

## Related Sources

- [[sources/back-631-comment-rich-markdown-editor]] — 评论编辑器 promote
- [[sources/back-632-decision-image-promotion]] — 决策保存 promote
- [[sources/back-634-decision-creation-sidebar]] — 决策创建 promote
