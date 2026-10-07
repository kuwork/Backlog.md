---
title: 'BACK-756 - Speed up graph canvas rendering on high-DPI screens'
labels:
  - source
  - web-ui
created_date: '2026-10-07 22:50'
updated_date: '2026-10-07 22:50'
source_path: backlog/tasks/back-756 - Speed-up-graph-canvas-rendering-on-high-DPI-screens.md
---

# Speed up graph canvas rendering on high-DPI screens

知识/任务图 canvas 在高 DPI 屏掉帧，最严重在点击飞入：每帧重绘每条边/节点各一次 draw call（2k+ 边、700+ 节点），加上 fly-in 跨 k>=1.8 后的旋转关系文本，后台存储还按 devicePixelRatio（2-3x）放大；且无视口裁剪，放大后仍为整库付费。

目标：保持同一画面，同时把一帧压到相机移动时能稳 60fps。

- **裁剪**：由实时 zoom transform 反推图空间窗口（含 CULL_PAD/k），跳过窗外的节点与包围盒不交的边
- **批绘**：边按 (dash, alpha)、节点按 (style, alpha) 分桶，每桶一次 stroke+fill；新 `strokeEdgeBatch`/`paintNodeBatch`（`src/web/utils/graph-canvas.ts`）。实测边通道由 ~2200 stroke + ~1650 fill/帧 降到个位数，手势降到 1 次
- **DPR 上限**：`resize()` 中 `MAX_DPR=2`，Retina/4K 不再绘 4-9x 像素
- **文本 LOD**：`markCameraMoving()` 在每次手势/飞入/布局 tick 标记，移动中跳过标题与关系名、由 140ms settle 计时器重绘；文本揭示改为三阶段单一 `textStage`（none | focus | all）——飞行中仅焦点簇（飞入目标 + 邻居）留名，其余隐藏、关系名等画面停；落定/手势抬起/布局稳定时焦点簇一次点亮，余下名字于 TEXT_CLUSTER_MS(300ms) 后到齐；深缩关系名仅那时且 k>=RELATION_ZOOM_THRESHOLD 出现
- **手势快照**：平移/滚轮不再全成本重绘——抓取整屏保真快照（文字仍在，每帧一次 drawImage）拖动 bitmap，释放恢复实时场景与全设备锐度（移除 GESTURE_DPR，不降后台缩放）
- **回归修复**：ESC 不清焦点（`releaseFocus` 亦清 `hoverIdRef`）；dpr/zoom 按钮冻结（d3-zoom end 无条件释放快照；程序化相机移动包 `programmatic()` 守卫，仅真实手势驱动文本揭示）；quadtree 仅在仿真 end 事件与预计算后重建（仅服务命中测试）
- **验证**：`bunx tsc --noEmit` 在 src/ 干净；biome 两文件干净；`web-graph-canvas.test.tsx` 5 pass（任务图/知识图/无 roundRect 回退/依赖子图/空语料）

## Related Concepts

- [[concepts/kuzu-graph]] — 知识图谱的图数据与渲染基础
- [[concepts/web-ui-features]] — Web UI 性能与交互

## Related Sources

- [[sources/back-702-kuzu-graph-foundation]] — 图数据基础
- [[sources/back-704-graph-view-web-ui]] — 图视图 Web UI
- [[sources/back-720-graph-canvas-2d-renderer]] — 2D canvas 渲染器（本任务在其之上批绘/裁剪）
