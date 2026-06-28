---
title: Wikilink 媒体渲染模式
labels:
  - execution
  - wiki
  - wikilink
  - media
  - frontend
extracted_from:
  - BACK-524
  - BACK-523
created_date: '2026-06-27 21:00'
updated_date: '2026-06-27 21:00'
---

# Wikilink 媒体渲染模式

在 Web UI 中渲染 Obsidian 风格的媒体 wikilink（`![[path|alt|WxH]]`）时遵循以下模式。

## 步骤

1. **解析阶段**
   - 使用正则匹配 `![[...]]` 语法
   - 按 `|` 切分：path、alt/caption、尺寸
   - `getMediaType(path)` 按扩展名判定 image / video / audio

2. **路径解析**
   - `assets/...` → 项目根相对，直接映射到 `/assets/...`
   - `./...` / `../...` → 相对当前 wiki 页目录解析，最终同样通过 `/assets/...` 服务
   - 对解析结果进行路径遍历防护

3. **尺寸解析**
   - `parseDimensions` 处理 `W`、`WxH`、`0xH` 三种形式
   - 仅对 image / video 应用 width/height 属性
   - audio 忽略尺寸，始终使用全宽原生控件

4. **HTML 生成**
   - image → `<img>`，绑定现有 LightboxImage 组件以保持预览
   - video → `<video controls>`
   - audio → `<audio controls>`

5. **服务器支持**
   - 在 `BacklogServer.handleAssetRequest` 中补充 video/audio MIME 类型映射
   - 确保静态资源能正确返回 `Content-Type`

## 复用场景

- 新增媒体类型：扩展 `getMediaType` 的扩展名列表与对应 MIME 类型
- 新增尺寸语法：在 `parseDimensions` 中增加分支
- 其他需要内嵌媒体的 Markdown 视图：通过 `MermaidMarkdown` 的组件注册机制复用

## Related Sources
- [[sources/back-524-add-media-wikilink-support-for-images-video-and-audio]] — BACK-524 实现任务
- [[sources/back-523-wiki-wikilinks-alias-support-with-markdown-html-labels-and-markdown-it-attrs]] — BACK-523 别名与属性块

## Related Concepts
- [[concepts/wikilink]] — Wiki 交叉引用语法
- [[concepts/asset-management]] — 资源管理与静态资源服务
