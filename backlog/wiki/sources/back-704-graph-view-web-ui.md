---
title: BACK-704 - Web UI 的 D3.js 任务图谱可视化页面
labels: [source, graph, web-ui]
created_date: 2026-09-26 14:14
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-704 - D3.js-task-graph-visualization-page-in-the-Web-UI.md
---

# BACK-704 - Web UI 的 D3.js 任务图谱可视化页面

在 BACK-703 的 `/api/graph` 响应体之上为 Web UI 新增 Neo4j 风格的图谱页面（doc-014 §4 视图层），并在同一天把图谱产物移出项目树，放入按 slot 键控的 OS 缓存，配以锁接管协议。

## 实现要点

- 导航/路由：Graph 入口位于 SideNavigation 中 Statistics 下方，`/graph` 在 SPA 回退中注册；打开节点时通过 `backgroundLocation` 把弹层压在图谱之上，关闭后回到图谱且视口不动（milestone 同理）
- `GraphView.tsx` 承载整个页面：按需引入 d3、同步 250 tick 预计算布局（仅拖拽时重新加热），以及恒定屏幕尺寸规则——每个图空间量（半径、虚线、箭头、标题板、边标签）都除以实时缩放因子 `k`，并从缩放处理器重新应用
- 视觉语法：恒定屏幕尺寸的半径编码度（sqrt 映射到 6–20px）、按 kind 填充 + 着色描边、标题板实体代码分三个缩放层级披露、深缩放时边上显示关系名、可点击图例过滤 kind；DependsOn 实线、ParentOf 虚线（箭头在父端）、BelongsToMilestone 点线
- 交互：悬停/点击邻域聚焦（其余淡出到 0.18/0.06），选中的固定状态在模态框往返后存活；点击要么把镜头飞到可读的缩放（600 ms 缓动），要么打开详情模态框；键盘层（方向键平移、Ctrl+]/[ 缩放、Ctrl+0 总览、Esc 清除）
- Bun 打包了第二个缺少 `interrupt()` 的 d3-selection 副本（d3-zoom 会调用它）——给持有的原型打补丁并把缩放时长设为 0；冷启动快速路径现在要求 `nodeCount > 0`，温热但为空的缓存绝不吐出空图谱
- 按 slot 键控的缓存：图谱产物移到 OS 缓存目录，命名为 `backlog-graph-<sha256-16>.{kuzu,kuzu.meta.json,kuzu.lock}`，由小写项目路径 + slot（web = 绑定端口、TUI = "tui"、默认）哈希而成，两个浏览器会话绝不争抢；`BACKLOG_GRAPH_CACHE_DIR` 可覆盖（测试通过 `bunfig.toml` preload 固定）
- 锁接管：`startGraphService(core, {slot, onChanged?, onColdStart?, onLockConflict?})` 是唯一宿主入口；CLI 处理程序对死 pid 回收并给出提示，对存活持有者仅在 TTY 上询问 y/N（绝不阻塞管道）；无处理程序时保持旧的静默 503 降级行为
- 控制簇评审打磨：总览键从缩放键对之间移出，进入 3 列网格（左上单元格）并带强调色，差一点按错不再被读作缩放
- 在真实浏览器中针对播种过的项目验证：镜头飞入、聚焦固定、箭头边缘间隙从 k=0.05 到 k=4 保持 2px、两个会话各自持有数据库

## 验收标准

- 图谱导航入口 + 路由；`/api/graph` 的交互式力导向缩放/平移/拖拽渲染
- 节点 kind 与边类型用图例视觉区分；点击打开详情模态框
- `graph-updated` WS 消息原位重新拉取；700+ 节点保持可交互
- 按 slot 键控的 OS 缓存产物，两个会话共存；死 pid 回收与仅 TTY 接管提示
- `startGraphService` 作为唯一宿主入口；控制簇网格保持每个键的原有位置

## Related Concepts

- [[concepts/web-ui-features]] — 页面遵循的模态框弹层、图例与控制约定
- [[concepts/web-server]] — 本页面依赖的 SPA 回退、WS 广播与图谱托管

## Related Sources

- [[sources/back-703-graph-incremental-sync]] — `/api/graph` 响应体与 `graph-updated` 广播（同一批）
- [[sources/back-705-graph-control-cluster-styling]] — 移除总览强调色的后续任务（同一批）
- [[sources/back-710-task-modal-relationship-graph]] — 以本页面为范型的迷你图谱视图（同一批）
