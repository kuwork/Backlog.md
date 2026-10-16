---
title: BACK-794 - Cypher 结果图可配置图例
labels: [source, web-ui, graph, cypher]
created_date: 2026-10-16 01:00
updated_date: 2026-10-16 01:00
source_path: backlog/tasks/back-794 - Configurable-legend-for-the-Cypher-result-graph.md
---

# BACK-794 - Cypher 结果图可配置图例

BACK-793 的结果图按标签给节点上色、关系一律实心带箭头线，无法表达"有趣的轴是某个属性"（状态、优先级、分数），读者也不能选择圆圈叫什么。本任务为该窗格加图例设置面板。评审反馈推翻了最初的五模式设计（corpus / label / values / bands / rules），改为两层颜色模型；落地又经第二轮按类型重构与第三轮 UX 重做。

## 目标

- 结果图标题栏全屏开关旁加图例设置控件，面板只配置该窗格。
- 节点 caption 写成 `{{field}}` 模板（结果自带的属性名以 chip 形式在光标处插入），可整体关闭。
- 节点着色两层：第 1 层节点类型（表 label）拥有色相（每个 Person 同一家族色）；第 2 层字段子类由快捷方法（等宽分箱、分位数、单阈值、按值、contains、前缀、布尔）或读者自写有序规则（先匹配胜，隐式 Other 兜底）决定，类型内子类只变明度不变色相。类型永不写进表达式，引擎叠加其上；未配置字段的节点取类型色相的兜底明度。快捷方法一键生成可编辑规则列表，字段经光标插入下拉框（唯一字段选择器）进入手工编辑的布尔表达式。
- 规则条件是小型布尔表达式：比较（`==`、`!=`、`>`、`>=`、`<`、`<=`）加 `contains`、`startsWith`，以 `&&`、`||`、`!` 组合、括号分组；编辑器提供字段 chip 与运算符按钮。
- 两个编辑器都以示例教学：caption 与规则的现成例子均取自结果自带字段，缺字段的例子不出现。
- 规则列表恒以 "Other" 兜底桶收尾（收集未被任何规则匹配的节点），可配置颜色/计数/可见性但不可删除或重排。
- 关系按类型配置线型（solid/dashed/dotted/long-dashed）× 箭头（无/目标端/两端），以线条实物小样预览。
- 图例继续兼任过滤器：每桶是开关，隐藏条目留在图例中可找回，标题计数实际绘制数。
- 配置按数据库命名空间存 localStorage 并恢复；缺失、残缺或无法解析的条目回退默认而非抛错。

## 实现要点

- 表达式引擎 `src/web/utils/graph-expression.ts`：tokenizer + 递归下降解析单一文法（`||` 最松、`&&`、`!`、比较），只有比较产生布尔——写错的条件是解析错误而非静默真值；`evaluate(properties)` 中节点没有的属性读作 null、不匹配。
- `src/web/utils/cypher-graph.ts`：`ResultGraphNode` 携带剥离内部句柄后的属性，并发布 `ResultGraph.fields`（结果实际携带的属性名并集，排序）。
- 配置 `src/web/utils/graph-legend-config.ts`：类型定义与按数据库的 localStorage 读写，宽容归一化（缺失/残缺/不可解析回退默认、保留有效部分）。第二轮重构后 `GraphLegendConfig = { captionsVisible, types: Record<label, TypeConfig>, relations, hidden }`，每个 TypeConfig 有自己的 caption 模板（空则从 name/title/key/label/id 自动猜测）、可选显式类型色（hex 覆盖自动色相）、自己的有序规则列表与 Other 显式色；`resolveLegend(nodes, config, theme)` 不再需要 fields 参数（经 `fieldsByType` 按类型分组）。
- 面板 `src/web/components/GraphLegendSettings.tsx`：按类型的手风琴（按节点数排序、首个展开），头部色点加重置；规则行与关系行均可钉自己的颜色；快捷添加的参数（方法、分箱、阈值、小数、匹配模式、取值选择）是面板本地状态，只追加生成的规则、不进存储配置。第三轮 UX：面板改为草稿式——编辑实时预览但只在"保存"时持久化，取消/X/再点齿轮恢复打开时的快照；重置也是草稿。
- 调色板 `src/web/utils/graph-palette.ts`：新增 `subclassColors`（色相 + 明度）与 `gradientColors`（两端点 sRGB 插值，可选反相 invert 与 50/50 叠加类型基色，烘焙为规则的显式 hex）；颜色一律发 hex 以便 `<input type="color">` 显示；`explicitNodeColors` 把显式 hex 填充配主题感知描边。
- 顺带修复：CypherResultGraph 的内部桶键曾用 `|` 拼接拆分，与键内的 `|`（如 `t:Meta|s:type:only`）冲突导致 Meta 从未被真正隐藏——改为数组保存，且默认隐藏只在新结果（cameraToken）时重触发而非每次配置编辑；关系线型名（"solid" 等）曾被直接当 dash pattern 传给 canvas/SVG，现在 GraphCanvas 与头部图例都走 `LINE_DASH` 查找；`compileRule` 以 try/catch 包住 `compileExpression`，畸形存储表达式降级而非穿透面板。
- 第三轮 UX 续：内部 Meta 节点在结果含真实数据时从图例 UI 全部消失（图例点、设置面板类型卡与桶列表都读 panelNodes），Meta-only 查询仍显示；图例桶标签主题感知；关系类型增加显示名，未配置类型按排序类型列表轮转线型（solid→dashed→dotted→long），`relationStyle(type, config, order)` 合并式编辑保住其余类型的轮转默认；箭头模式扩为无/末端/始端/两端；全屏从 Fullscreen API 改为 CSS 最大化（`fixed inset-0`）——原生全屏下浏览器保留 Esc，现短按 Esc 释放钉住焦点、长按 600ms 退出最大化；`fitToView`/`flyTo` 改读 ResizeObserver 维护的实时视口尺寸（cssWidth/cssHeight）。

## 验证

`bunx tsc --noEmit` 与 `bun run check .` 干净；`src/test/graph-legend-config.test.ts` 重写为 57 断言（归一化回退、按类型规则、显式色、自动 caption、fieldsByType、子集分箱、存储往返、调色板新增），加 graph-expression、web-cypher-result-graph、web-graph-palette 套件，57 个定向 + 472 个 web-graph 测试通过。全仓套件约 154-161 失败全部定位到本任务未触碰区域（server-* 端点并行超时、memos 端点、web-task-details-modal mock 污染、duckdb musl 绑定解析、git uv_spawn ENOENT 等环境问题），代表性失败文件单独跑全绿。

## Related Concepts

- [[concepts/kuzu-graph]] — 语料图谱与结果图共用引擎与调色板

## Related Sources

- [[sources/back-793-cypher-result-graph-view]] — 本任务配置的结果图本体（依赖关系）
- [[sources/back-720-graph-canvas-2d-renderer]] — GraphCanvas 引擎的来源
- [[sources/back-704-graph-view-web-ui]] — 语料图谱页，共享引擎与图例交互的基准
