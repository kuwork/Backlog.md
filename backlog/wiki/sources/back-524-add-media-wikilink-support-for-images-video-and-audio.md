---
title: BACK-524 媒体 wikilink 支持（图片/视频/音频）
labels:
  - source
  - web-ui
  - wiki
  - feature
  - media
source_path: backlog/tasks/back-524 - add-media-wikilink-support-for-images-video-and-audio.md
created_date: '2026-06-27 21:00'
updated_date: '2026-06-27 21:00'
---

# BACK-524 媒体 wikilink 支持（图片/视频/音频）

**状态**: Done | **标签**: web-ui, wiki | **负责人**: kimi

支持 Obsidian 风格的媒体 wikilink，在 wiki 页面及其他 Markdown 渲染视图中嵌入图片、视频和音频。

## 语法

```markdown
![[path]]
![[path|alt]]
![[path|W]]
![[path|alt|W]]
![[path|alt|WxH]]
```

- `path`：相对 backlog 项目根或当前 wiki 页目录的资源路径
- `alt`：可选替代文本 / 标题
- `W` / `WxH`：可选显示尺寸，仅对图片和视频生效；音频忽略尺寸

## 支持的媒体类型

| 类型 | 扩展名 |
|---|---|
| 图片 | png, jpg, jpeg, gif, svg, webp, avif, bmp, ico |
| 视频 | mp4, webm, ogv, mov, mkv |
| 音频 | mp3, wav, ogg, m4a, flac, aac, opus, wma |

## 路径解析

- `assets/photo.png` → 项目根相对， served at `/assets/photo.png`
- `./photo.png` / `../assets/photo.png` → 相对当前 wiki 页目录解析
- 其他解析后的路径同样通过 `/assets/...` 提供服务

## 实现要点

1. **扩展 `src/web/utils/wikiLinks.ts`**
   - `getMediaType`：按扩展名区分 image / video / audio
   - `resolveMediaPath`：相对当前 wiki 页目录解析媒体路径
   - `parseDimensions`：解析 `WxH` / `W` / `0xH` 尺寸
   - `buildWikilinkMediaHtml`：生成 `<img>` / `<video controls>` / `<audio controls>` 原始 HTML

2. **扩展 `MermaidMarkdown.tsx`**
   - 注册 `VideoPlayer` 与 `AudioPlayer` 组件
   - 图片复用现有 `LightboxImage` 组件，保持 lightbox 预览

3. **扩展服务器 MIME 类型映射**
   - `BacklogServer.handleAssetRequest` 增加视频与音频格式 MIME 类型

## 验证

- 新增/扩展 `src/test/wiki-links.test.ts`、`src/test/mermaid-markdown.test.tsx`、`src/test/image-lightbox.test.tsx`、`src/test/server-assets.test.ts`
- 63 个相关测试通过
- 使用 `bun src/cli.ts browser` 端到端验证项目 `assets/` 下的图片与视频

## Related Concepts

- [[concepts/wikilink]] — Wiki 交叉引用语法（含媒体 wikilink）
- [[concepts/asset-management]] — 资源上传、提升与临时文件管理
- [[concepts/web-ui-features]] — Web UI 渲染能力总览

## Related Sources

- [[sources/back-523-wiki-wikilinks-alias-support-with-markdown-html-labels-and-markdown-it-attrs]] — BACK-523 别名与属性块
- [[sources/back-525-update-wiki-skill-and-cli-multi-line-input-docs]] — BACK-525 同步 skill 与 CLI 文档
