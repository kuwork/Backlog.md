---
title: BACK-845 - PPTX 幻灯片本地媒体路径归一化
labels: [source, web, office, pptx, bugfix]
created_date: 2026-11-10 00:27
updated_date: 2026-11-10 00:27
source_path: backlog/tasks/back-845 - Fix-PPTX-preview-missing-slide-local-media.md
---

# BACK-845 - PPTX 幻灯片本地媒体路径归一化

一份把图片放在 `ppt/slides/media/` 的 PPTX 在网页端预览时图片全空。本任务在浏览器内把这类非标准但 PowerPoint 合法的路径归一化到 `ppt/media/`，磁盘文件分毫不动。

## 问题

`@aiden0z/pptx-renderer@1.4.0` 把媒体解析**硬编码**在 `ppt/media/`：内部 `rv()` 收集器只登记该前缀的部件，`gs()` 查找也把关系目标重写到同一目录。而 PowerPoint 允许幻灯片本地媒体 `ppt/slides/media/`，其 `.rels` 的 `Target` 相对幻灯片自身。该 deck 的 12 张 SVG 图片因此从未被收集，落到渲染器的 "No image data" 占位，再被 `hideEmptyPictures()` 隐去。

两个排除项值得记牢：

- **不是 SVG 格式问题**：渲染器支持 svg → `image/svg+xml` → `<img src=blob:>`，失败纯粹来自路径。
- **不是可配置的解析器问题**：公开 `open()` 不转发自定义 `mediaResolver`（内部 `presentation.mediaResolver` 被消费但从未由构造器/parse 接通），所以走 resolver 注入不可行。

## 解决方案

新增 `src/web/utils/pptxMediaNormalize.ts`，`PptxPreviewModal.tsx` 在 fetch 到 `arrayBuffer` 后、调用 `PptxViewer.open` 之前先归一化：

1. 用 JSZip（已是直接依赖，`xlsxSnapshotWriter.ts` 也在用）扫描 zip，找出不在 `ppt/media/` 下的媒体条目。
2. 逐个迁到 `ppt/media/<带碰撞安全前缀的唯一名>`——前缀取自原路径，保证两张幻灯片的同名文件不互相覆盖。
3. 重写所有 `*_rels/*.rels` 的 `Target`，按幻灯片目录重算到 `ppt/media/` 的相对路径。
4. **没有偏离路径的媒体时原样返回同一个 buffer**，标准 deck 零重压开销。

`src/web/utils/pptxMediaNormalize.test.ts` 覆盖「迁移 + Target 重写」与「标准路径直通（identity buffer）」两条路径。

## 验证

真实 deck 实测：12 张图片全部迁入 `ppt/media/`，slide3 / slide4 的 rels `Target` 改为 `../media/ppt_slides_media_*.svg`，图片正常显示。`tsc --noEmit` 与 `biome check` 通过，新单测通过。

长期正解是给 pptx-renderer 提 PR，让它的媒体索引器认识 slide-local 目录；当前内存 shim 是项目侧权宜之计。

## Related Concepts

- [[concepts/file-preview]] — PPTX 预览模态框所属的四模态框体系
- [[concepts/markdown-pipeline]] — Office 链接与内嵌 viewer 的挂载链路

## Related Sources

- [[sources/back-829-pptx-preview-modal]] — 引入 `@aiden0z/pptx-renderer` 的原始任务
- [[sources/back-838-office-page-sheet-ranges]] — 同一 viewer 上的范围投影扩展
