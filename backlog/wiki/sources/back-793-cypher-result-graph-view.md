---
title: BACK-793 - 数据库页 Cypher 结果图谱视图
labels: [source, web-ui, graph, cypher]
created_date: 2026-10-16 01:00
updated_date: 2026-10-16 01:00
source_path: backlog/tasks/back-793 - Cypher-result-graph-view-on-the-databases-page.md
---

# BACK-793 - 数据库页 Cypher 结果图谱视图

数据库页（BACK-771 #3，里程碑 m-13）此前只把只读 Cypher 结果渲染成通用表格。本任务让同一结果也能读成知识图谱：复用语料图谱的 canvas 引擎（不复制代码），交互逐项对齐；真正的拦路虎是传输层——`serializeCypherValue` 剥掉了节点单元格的 `_id` 与关系单元格的 `_src`/`_dst`，结果行无法判断哪条边连哪两个节点。

## 目标

- 结果区提供表格 / 图谱 / 并列三种视图模式，选择跨重跑保留；每次运行有独立相机令牌（新结果自适配、回到旧结果恢复原视口）。
- 图窗格把节点单元格去重成节点、关系单元格经内部 id 连接端点成边、路径单元格展开为节点/关系链；无节点的结果（如 `RETURN count(*)`）显示空态而非坏画布。
- 交互与知识图谱完全一致：滚轮/双击缩放、拖拽平移、控制簇、键盘快捷键、延迟 hover 带邻节点变暗、点击聚焦相机飞入、节点拖拽重启模拟、深层缩放显示关系名、图例开关；唯独不含 Cypher 搜索框（页面上已有一个）。
- 关系端点跨越序列化存活：节点保留内部 id、关系保留两端点 id；结果表与 CLI 打印器继续隐藏内部键。
- 画布机制与 GraphView 共用同一组件而非第二份拷贝，GraphView 既有行为（含 Cypher 过滤相机规则）与 web-graph-canvas 冒烟测试不受影响。

## 实现要点

- 传输（`src/graph/store.ts`）：`serializeCypherValue` 保留 `_id` 与 `_src`/`_dst`。两条传输路径统一身份格式：结构化路径把 embind InternalID 结构体（`{offset, table}` BigInt）归一化为 `table:offset` 字符串；toString 恢复路径（任何 INT64 列会迫使整个结果走它——项目自带 `demo` 库即如此）原先把关系留成裸字符串 `(0:0)-{_LABEL: KNOWS, _ID: 2:0}->(0:1)` 并毁掉路径单元格，现在都解析成真实值。BigInt 强制为 JSON 安全数字（超 2^53 转字符串），顺带修复 `POST /api/graph/cypher` 上 `count()` 结果使 `Response.json` 抛错的既有崩溃。CLI 打印器与 Web 的 `cellDisplayText` 把内部键过滤掉，表格观感不变。
- 抽取（`src/web/utils/cypher-graph.ts`）：纯函数 `graphFromCypherResult(result)` 遍历每行每格——节点按内部 id 去重（属性指纹兜底）、关系经 `_src`/`_dst` 连接、路径展开、数组递归；端点不在结果内的关系计入 `danglingEdges` 并跳过；caption 优先级 name > title > key > path > filePath > id > label > code，再退到首个标量属性、最后是 label。11 个单测。
- 共享引擎（`src/web/components/GraphCanvas.tsx`）：把 GraphView 的 canvas 机制原样提取并参数化（视觉词汇、位置键、相机令牌、钉住规则、打开处理器）——预计算 tick 预算与持久位置的力导向布局、快照 blit 拖拽的 d3-zoom、四叉树命中检测、延迟 hover、点击聚焦飞入、拖拽重启模拟、分阶段文字显现、批量绘制、键盘与控制簇。相机规则变成令牌映射（首次构建适配、返回即恢复），精确复现 GraphView 过滤行为，取代 `preFilterTransform`/`fitForFilter` ref 对。`edgeStroke`/`EDGE_STROKE` 移到 `graph-canvas.ts`（GraphLegend 再导出），避免引擎依赖语料图例模块。
- 结果图视图（`CypherResultGraph.tsx`、`GraphDatabases.tsx`）：标题含计数与图例（调色板颜色、计数、可开关）加关系类型；无 Cypher 搜索框；双击只放大不打开（查询结果无详情页）；位置不持久（结果的节点集跨访问不稳定）。标签经 FNV-1a 带 finalizer 哈希（裸 `*31` 哈希会把短标签堆到同一色相，实测过）映射到 12 色相环，描边主题感知。页面加表格/图谱/并列开关（跨重跑保留）、每次运行独立相机令牌、图窗格按视口定高（单独 78vh，并列时图 48vh + 表 42vh）。
- 全屏：图标题上的开关复用 memo 钉板图标（外张四角进入、内收四角离开），对窗格自身容器请求全屏而非整页；图标跟随 `document.fullscreenElement` 而非点击计数（Esc 或浏览器 chrome 可绕开我们退出）；API 缺失（jsdom、旧 Safari 前缀）时按钮退化为无操作。
- 图例从整个结果集构建而非可见子集：关掉某标签不再删除把它找回来的开关；标题计数实际绘制数（"Person 12 · 9 drawn"）。这与任务图谱固定八条目的既有做法一致。
- 越过 500 行显示上限：上限是渲染预算而非数据限制，现在可退出——Cypher 框的"every row"复选框发 `maxRows: null`，CLI `backlog graph query --all` 同样；`null` 是唯一的表达方式（`undefined` 必须继续表示"用默认值"），store 在唯一计行处把 null 译为 Infinity，dump 路径与交互路径共用规则。600 节点库实测：默认 500 行截断，`--all` 报 600。超过 3000 节点图窗格拒绝绘制并说明原因（250 个同步布局 tick 不再是交互）。
- 第 1600 个节点是我们自己的：1599 个业务节点的语料（FileNode 1418 + Tag 181）被 `MATCH (n) RETURN n` 答出 1600 行，多出的 `Meta` 是 store 自用的键值簿记节点表（语料指纹）。`INTERNAL_LABELS` 在抽取时标记内部标签，结果图默认隐藏它们（但仅当结果还含有别的东西——`MATCH (m:Meta)` 不许打开成空窗格）；标题说明隐藏了几个，图例保留条目；表格不动。
- "View ALL" 与一键 schema 示例并列：语句为 `MATCH (n) OPTIONAL MATCH (n)-[r]-() RETURN n,r`（`OPTIONAL MATCH` 承力——去掉它会静默丢掉所有无关系节点）；一次点击同时填框并执行，因此 `run` 接受显式 `{ db, statement }` 对（先 `setStatement` 再点击会在同一拍执行旧文本）。

发现未修的既有 bug：`graph insert "<cypher>"` 对用户库报成功但 dump 出空快照（干净树上复现，dump 时 `countNodes=0`）；CSV 导入不受影响。值得单独立任务。

## 验证

`bunx tsc --noEmit`、`bun run check .` 干净；5 个冒烟测试（JSDOM、打桩 canvas）覆盖视图开关、引擎带图例挂载、并列模式、表格内部键过滤、无节点空态；`cypher-graph` 11 个单测；600 节点库端到端验证 500 截断与 `--all` 全量。

## Related Concepts

- [[concepts/kuzu-graph]] — 语料图谱的 /graph 视图，本任务把其 canvas 引擎共享给 Cypher 结果图

## Related Sources

- [[sources/back-794-cypher-graph-configurable-legend]] — 在本结果图之上加可配置图例（依赖本任务）
- [[sources/back-720-graph-canvas-2d-renderer]] — 图视图 Canvas 2D 渲染器，GraphCanvas 提取自这套机制
- [[sources/back-704-graph-view-web-ui]] — D3.js 任务图谱可视化页面，交互对齐的基准
- [[sources/back-746-memo-board-webgl-pinboard]] — 全屏开关图标复用自 memo 钉板
