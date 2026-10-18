---
id: doc-31
title: ECharts 图表演示
type: guide
created_date: '2026-10-18 04:51'
updated_date: '2026-10-18 12:32'
---
# ECharts 图表演示

m-17 的验收样本（BACK-812 / BACK-813 / BACK-814）。本页所有图表在阅读视图里都会**实时渲染**，不需要你准备数据。

三种用法：

| 用法 | 写法 | 数据来源 | 任务 |
|---|---|---|---|
| 独立图表 | `echarts` fence + 标准 option JSON | option 自带 | BACK-812 |
| 查询直出 | `sqlite-query` / `duckdb-query` / `cypher-query` + `view: echarts` + `chart` | SQL / Cypher 结果 | BACK-813 |
| 图表引用查询 | `echarts` fence 里写 `fromQuery: <id>` | 同文档内带 `id` 的 query-block | BACK-814 |

主题自动跟随应用明暗模式，不用手写配色。引擎走 `echarts/core` 动态导入，不进首屏包。

> [!IMPORTANT]
> 只支持 **JSON**：option 里不能出现函数（不执行、不解析），与 mermaid 的 `securityLevel: strict` 对齐。非法 JSON 或未知 `series.type` 回退为普通代码块，不会崩。

```bash
bun run src/cli.ts browser --no-open   # 打开 Web UI，进入本页查看渲染结果
```

---

# 一、独立图表（`echarts` fence）

## 1. 柱状图 bar

分类对比最常用的形式：

```echarts
{
  "title": { "text": "每周完成任务数" },
  "tooltip": {},
  "xAxis": { "type": "category", "data": ["第1周", "第2周", "第3周", "第4周"] },
  "yAxis": { "type": "value" },
  "series": [
    { "name": "完成", "type": "bar", "data": [10, 18, 25, 33] }
  ]
}
```

## 2. 折线图 line

`smooth: true` 让折线平滑；多条 series 共用同一个 `xAxis` 即多线对比：

```echarts
{
  "title": { "text": "燃尽趋势" },
  "tooltip": { "trigger": "axis" },
  "xAxis": { "type": "category", "data": ["D1", "D2", "D3", "D4", "D5"] },
  "yAxis": { "type": "value" },
  "series": [
    { "name": "剩余", "type": "line", "smooth": true, "data": [20, 16, 11, 7, 0] },
    { "name": "已完成", "type": "line", "smooth": true, "data": [0, 4, 9, 13, 20] }
  ]
}
```

## 3. 饼图 pie

`radius` 控制半径，`"55%"` 是普通饼图，`["40%", "70%"]` 可做环形：

```echarts
{
  "title": { "text": "任务状态分布" },
  "tooltip": {},
  "legend": { "data": ["待办", "进行中", "已完成"] },
  "series": [
    {
      "type": "pie",
      "radius": "55%",
      "data": [
        { "name": "待办", "value": 12 },
        { "name": "进行中", "value": 7 },
        { "name": "已完成", "value": 25 }
      ]
    }
  ]
}
```

## 4. 散点图 scatter / 涟漪散点 effectScatter

散点用 `[[x, y], ...]`；`effectScatter` 带涟漪动画，适合强调异常点：

```echarts
{
  "title": { "text": "投入 vs 影响" },
  "tooltip": {},
  "xAxis": { "type": "value", "name": "投入" },
  "yAxis": { "type": "value", "name": "影响" },
  "series": [
    { "type": "scatter", "data": [[3, 8], [5, 6], [2, 9], [8, 4], [6, 7]] }
  ]
}
```

```echarts
{
  "title": { "text": "离群点（涟漪）" },
  "xAxis": { "type": "value" },
  "yAxis": { "type": "value" },
  "series": [
    { "type": "effectScatter", "rippleEffect": { "scale": 4 }, "data": [[1, 1], [5, 5], [9, 2]] }
  ]
}
```

## 5. 雷达图 radar

`radar.indicator` 定维度与量程，series 里的 `value` 顺序对齐 indicator：

```echarts
{
  "title": { "text": "技能覆盖" },
  "radar": {
    "indicator": [
      { "name": "前端", "max": 100 },
      { "name": "后端", "max": 100 },
      { "name": "文档", "max": 100 },
      { "name": "测试", "max": 100 }
    ]
  },
  "series": [
    { "type": "radar", "data": [{ "value": [80, 70, 90, 55], "name": "团队" }] }
  ]
}
```

## 6. 热力图 heatmap

两个类目轴 + `visualMap` 定色阶；`data` 是 `[xIndex, yIndex, value]`：

```echarts
{
  "title": { "text": "活跃度热力图" },
  "tooltip": {},
  "xAxis": { "type": "category", "data": ["周一", "周二", "周三", "周四", "周五"] },
  "yAxis": { "type": "category", "data": ["第1周", "第2周", "第3周"] },
  "visualMap": { "min": 0, "max": 10 },
  "series": [
    {
      "type": "heatmap",
      "data": [[0, 0, 5], [1, 0, 7], [2, 1, 3], [3, 2, 9], [4, 1, 6]]
    }
  ]
}
```

## 7. 仪表盘 gauge

单指标进度；`max` 缺省 100：

```echarts
{
  "title": { "text": "里程碑进度" },
  "series": [
    { "type": "gauge", "data": [{ "value": 68, "name": "完成度" }] }
  ]
}
```

## 8. 漏斗图 funnel

转化链路，`value` 自然递减：

```echarts
{
  "title": { "text": "转化漏斗" },
  "series": [
    {
      "type": "funnel",
      "data": [
        { "name": "访问", "value": 100 },
        { "name": "注册", "value": 60 },
        { "name": "活跃", "value": 35 },
        { "name": "付费", "value": 12 }
      ]
    }
  ]
}
```

## 9. 桑基图 sankey

`nodes` 用 `data`、流向用 `links`（`source` / `target` 必须是 data 里已有的名字）：

```echarts
{
  "title": { "text": "依赖流向" },
  "series": [
    {
      "type": "sankey",
      "data": [
        { "name": "cli" },
        { "name": "mcp" },
        { "name": "web" },
        { "name": "core" }
      ],
      "links": [
        { "source": "cli", "target": "core", "value": 3 },
        { "source": "mcp", "target": "core", "value": 2 },
        { "source": "web", "target": "core", "value": 4 }
      ]
    }
  ]
}
```

## 10. 树图 tree

层级用嵌套 `children`：

```echarts
{
  "title": { "text": "目录结构" },
  "series": [
    {
      "type": "tree",
      "data": [
        {
          "name": "src",
          "children": [
            { "name": "web" },
            { "name": "cli.ts" },
            { "name": "sqlite" }
          ]
        }
      ]
    }
  ]
}
```

## 11. 矩形树图 treemap

面积即权重，同样支持嵌套：

```echarts
{
  "title": { "text": "工作量分布" },
  "series": [
    {
      "type": "treemap",
      "data": [
        { "name": "web", "value": 40, "children": [{ "name": "ui", "value": 25 }, { "name": "api", "value": 15 }] },
        { "name": "cli", "value": 30 },
        { "name": "docs", "value": 20 }
      ]
    }
  ]
}
```

## 12. 旭日图 sunburst

多层环形，适合两层以上的占比拆分：

```echarts
{
  "title": { "text": "工作拆解" },
  "series": [
    {
      "type": "sunburst",
      "data": [
        { "name": "A", "value": 10, "children": [{ "name": "A1", "value": 6 }, { "name": "A2", "value": 4 }] },
        { "name": "B", "value": 8 }
      ]
    }
  ]
}
```

## 13. 关系图 graph

`layout: "force"` 力导向；`links` 不带 value 也可以：

```echarts
{
  "title": { "text": "实体关系" },
  "series": [
    {
      "type": "graph",
      "layout": "force",
      "data": [{ "name": "a" }, { "name": "b" }, { "name": "c" }],
      "links": [
        { "source": "a", "target": "b" },
        { "source": "b", "target": "c" }
      ]
    }
  ]
}
```

> 需要力导向 + 关系语义的图，优先用 `cypher-query` 的 `view: graph`（doc-28）——它有图例配置和持久化；`echarts` 的 graph 更适合 option 完全自定的场合。

## 14. 平行坐标 parallel

每个维度一根轴，`parallelAxis` 的 `dim` 对应 data 下标：

```echarts
{
  "title": { "text": "多维对比" },
  "parallelAxis": [
    { "dim": 0, "name": "CPU" },
    { "dim": 1, "name": "内存" },
    { "dim": 2, "name": "IO" }
  ],
  "parallel": {},
  "series": [
    { "type": "parallel", "data": [[3, 8, 2], [5, 4, 7], [9, 2, 1]] }
  ]
}
```

## 15. K 线 candlestick

每条数据是 `[open, close, low, high]`：

```echarts
{
  "title": { "text": "吞吐量波动" },
  "xAxis": { "type": "category", "data": ["D1", "D2", "D3"] },
  "yAxis": { "type": "value" },
  "series": [
    {
      "type": "candlestick",
      "data": [
        [100, 120, 90, 130],
        [120, 125, 110, 128],
        [128, 140, 118, 142]
      ]
    }
  ]
}
```

## 16. 箱线图 boxplot

每条数据是 `[min, Q1, median, Q3, max]`：

```echarts
{
  "title": { "text": "延迟分布" },
  "xAxis": { "type": "category", "data": ["p50", "p90", "p99"] },
  "yAxis": { "type": "value" },
  "series": [
    { "type": "boxplot", "data": [[10, 20, 30, 40, 60], [15, 25, 35, 45, 70], [20, 30, 40, 55, 90]] }
  ]
}
```

## 17. 路径图 lines

`coordinateSystem: "cartesian2d"` 时 `coords` 是直角坐标对；换成 `"geo"` 需要先注册地图：

```echarts
{
  "title": { "text": "调用路径" },
  "xAxis": { "type": "value" },
  "yAxis": { "type": "value" },
  "series": [
    {
      "type": "lines",
      "coordinateSystem": "cartesian2d",
      "data": [
        { "coords": [[1, 1], [4, 3]] },
        { "coords": [[2, 4], [5, 1]] }
      ]
    }
  ]
}
```

## 18. 象形柱图 pictorialBar

`symbol` 决定“柱子”长什么样，三种取值都支持：

| 取值 | 写法 | 说明 |
|---|---|---|
| 内置形状 | `circle` / `rect` / `roundRect` / `triangle` / `diamond` / `pin` / `arrow` / `none` | 直接写名字，`none` 等于不画 |
| 自定义路径 | `path://M512,0L640,384…Z` | 任意 SVG path，会被缩放贴合柱子的包围盒 |
| 图片 | `image://https://…` 或 `image://data:image/svg+xml,…` | 真图片当柱子；**跨域图片会污染 canvas**（截图 / 导出失败），所以跨域要么带 CORS 头，要么用内联 data URI |

比 `bar` 多出来的几个开关：

| 选项 | 作用 |
|---|---|
| `symbolSize` | 单个形状的宽高；`["60%", "100%"]` 表示跟随类目带宽 / 柱高 |
| `symbolPosition` | `start` / `center` / `end`——`end` 把形状贴在数值顶端，不铺满整根柱 |
| `symbolRepeat` | `true` 或 `"fixed"` 把形状重复堆叠（叠币效果），配合 `symbolMargin` 控制间距 |
| `symbolBoundingData` | 重复 / 裁剪的参照满值（例如按 100% 铺满） |
| `symbolClip` | `true` 时超出实际数值的重复形状被裁掉——水位图的关键 |

> [!WARNING]
> 单独用 `symbolRepeat` 时，重复的个数由数值决定（多高就叠几层）；一旦同时写了 `symbolBoundingData`，长度就**按这个满值铺满**、数据值不再参与，必须再开 `symbolClip` 才能裁回实际数值——这是最容易踩的坑。

### 18.1 内置形状（逐项指定）

`symbol` 可以写在 **data item** 上，一根柱一个形状：

```echarts
{
  "title": { "text": "内置形状" },
  "tooltip": {},
  "xAxis": {
    "type": "category",
    "data": ["circle", "rect", "roundRect", "triangle", "diamond", "pin"]
  },
  "yAxis": { "type": "value" },
  "series": [
    {
      "type": "pictorialBar",
      "symbolSize": [34, 34],
      "data": [
        { "value": 60, "symbol": "circle" },
        { "value": 72, "symbol": "rect" },
        { "value": 84, "symbol": "roundRect" },
        { "value": 96, "symbol": "triangle" },
        { "value": 108, "symbol": "diamond" },
        { "value": 120, "symbol": "pin" }
      ]
    }
  ]
}
```

### 18.2 柱顶图标（`symbolPosition: "end"`）

一条 `bar` 打底、一条 `pictorialBar` 只画顶端形状，是最常见的组合：

```echarts
{
  "title": { "text": "柱顶图标" },
  "tooltip": { "trigger": "axis" },
  "xAxis": { "type": "category", "data": ["北京", "上海", "深圳"] },
  "yAxis": { "type": "value" },
  "series": [
    { "type": "bar", "barWidth": 26, "data": [120, 92, 150] },
    {
      "type": "pictorialBar",
      "symbol": "diamond",
      "symbolPosition": "end",
      "symbolSize": [26, 13],
      "symbolOffset": [0, "-50%"],
      "data": [120, 92, 150]
    }
  ]
}
```

### 18.3 自定义形状（`path://`）

`path://` 后面接标准 SVG path 的 `d`，坐标原点在左上角，形状会按 `symbolSize` 缩放：

```echarts
{
  "title": { "text": "path:// 自定义形状" },
  "tooltip": {},
  "xAxis": { "type": "category", "data": ["A", "B", "C", "D"] },
  "yAxis": { "type": "value" },
  "series": [
    {
      "type": "pictorialBar",
      "symbol": "path://M512,0L640,384L1024,384L704,608L832,1024L512,768L192,1024L320,608L0,384L384,384Z",
      "symbolSize": [34, 34],
      "data": [60, 120, 180, 200]
    }
  ]
}
```

### 18.4 本地图片（`backlog/assets`）

`image://` 后面直接跟图片地址。仓库把 `backlog/assets/` 挂在 `/assets/` 下，所以写 `image:///assets/images/web.jpeg`（前缀 `image://` + 根路径 `/assets/...`）：

```echarts
{
  "title": { "text": "本地图片（assets）" },
  "tooltip": {},
  "xAxis": { "type": "category", "data": ["周一", "周二", "周三", "周四"] },
  "yAxis": { "type": "value" },
  "series": [
    {
      "type": "pictorialBar",
      "symbol": "image:///assets/images/葡萄.svg",
      "symbolSize": [22, 22],
      "symbolRepeat": true,
      "symbolMargin": 4,
      "data": [40, 80, 120, 160]
    }
  ]
}
```

图片按 `symbolSize` 拉伸，不会自动保持比例——`web.jpeg` 约 2:1，所以这里给 44×22。换成自己的图时，把文件丢进 `backlog/assets/images/`，路径按 `/assets/images/<文件名>` 写即可。

配合 `symbolRepeat: true` 让图片沿柱子重复堆叠，长度才跟着数值走；不重复时一张图只会贴在柱子起点，看着像掉在横轴上。

### 18.5 内联图片（`image://data:`）

不想依赖文件时，用 data URI 内联一张 SVG；跨域图片没带 CORS 头会污染 canvas（截图 / 导出失败），内联则没有这个问题：

```echarts
{
  "title": { "text": "内联 data URI" },
  "tooltip": {},
  "xAxis": { "type": "category", "data": ["周一", "周二", "周三", "周四"] },
  "yAxis": { "type": "value" },
  "series": [
    {
      "type": "pictorialBar",
      "symbol": "image://data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='15' fill='%233b82f6'/%3E%3Ccircle cx='11' cy='12' r='4' fill='white' opacity='0.45'/%3E%3C/svg%3E",
      "symbolSize": [32, 32],
      "symbolRepeat": true,
      "symbolMargin": 4,
      "data": [40, 80, 120, 160]
    }
  ]
}
```

### 18.6 叠币水位（`symbolRepeat` + `symbolClip`）

底层用一根浅色 `bar` 当容器，上层用重复圆形按实际值裁剪：

```echarts
{
  "title": { "text": "叠币水位" },
  "tooltip": {},
  "xAxis": { "type": "category", "data": ["达成率"] },
  "yAxis": { "type": "value", "max": 100, "axisLabel": { "formatter": "{value}%" } },
  "series": [
    {
      "type": "bar",
      "barWidth": 44,
      "data": [100],
      "itemStyle": { "color": "rgba(148,163,184,0.25)", "borderRadius": 8 },
      "silent": true,
      "z": 1
    },
    {
      "type": "pictorialBar",
      "symbol": "circle",
      "symbolSize": [44, 15],
      "symbolRepeat": true,
      "symbolMargin": 2,
      "symbolBoundingData": 100,
      "symbolClip": true,
      "data": [68],
      "itemStyle": { "color": "#3b82f6" },
      "z": 2
    }
  ]
}
```

> 底层**别**用同形状的重复序列（`pictorialBar` + `symbolRepeat`、`data: [100]`）：那样水位线以上会留一排灰币，一眼看上去像是已经满格。用 `bar` 当容器、只让彩色层裁剪，水位线才干净。裁剪线正好切在某枚币中间时顶部会是半个，这是 `symbolClip` 的预期表现。

## 19. 主题河流 themeRiver

每条数据是 `[时间, 数值, 主题名]`；`singleAxis` 必需，且必须显式写 `"type": "time"`——写成空对象 `{}` 时轴的类型不是时间，河流带画不出来（只剩标题和图例）：

```echarts
{
  "title": { "text": "主题河流" },
  "tooltip": { "trigger": "axis" },
  "singleAxis": { "type": "time" },
  "series": [
    {
      "type": "themeRiver",
      "data": [
        ["2026-01", 10, "cli"],
        ["2026-01", 7, "web"],
        ["2026-02", 14, "cli"],
        ["2026-02", 9, "web"],
        ["2026-03", 12, "cli"],
        ["2026-03", 15, "web"]
      ]
    }
  ]
}
```

## 20. 自定义 custom —— 形状示意

`custom` 必须提供 `renderItem` 函数才有实际输出；JSON 里函数不会被求值，所以下面**只是 option 形状**，故意用 `json` fence 而非 `echarts` fence（渲染出来会是空图）：

```json
{
  "title": { "text": "自定义绘制" },
  "xAxis": { "type": "value" },
  "yAxis": { "type": "value" },
  "series": [
    {
      "type": "custom",
      "renderItem": "<function — 不能在 JSON 里表达>",
      "data": [[1, 1], [2, 3], [3, 2]]
    }
  ]
}
```

需要真正的自定义绘制时，在代码里注册 `renderItem` 后改用组件渲染；文档里的 `custom` 只当占位。

## 21. 地图 map —— 形状示意（不渲染）

`map` / `geo` 系列要求先用 `echarts.registerMap(...)` 注册对应 GeoJSON。本仓库默认不注册任何地图，写 `echarts` fence 只会得到空图，因此这里同样给 `json` 形状示意：

```json
{
  "title": { "text": "区域数据" },
  "geo": { "map": "<已注册的地图名>" },
  "series": [
    {
      "type": "map",
      "geoIndex": 0,
      "data": [
        { "name": "<区域名>", "value": 100 }
      ]
    }
  ]
}
```

> 地图数据必须来自合规来源（官方审图号 / 有资质的地图服务），不要随手塞第三方 GeoJSON；本引擎不做地图数据内置，就是为把这一步显式留给接入方。

## 22. 和弦图 chord（v6 新增）

`data` 列实体、`links` 列两两流量：

```echarts
{
  "title": { "text": "模块耦合" },
  "series": [
    {
      "type": "chord",
      "data": [{ "name": "cli" }, { "name": "mcp" }, { "name": "web" }],
      "links": [
        { "source": "cli", "target": "mcp", "value": 3 },
        { "source": "cli", "target": "web", "value": 2 },
        { "source": "mcp", "target": "web", "value": 5 }
      ]
    }
  ]
}
```

> `chord` 是 ECharts 6 新增的类型；`echarts@6.x` 才有，升大版本前别指望它。

---

# 二、查询直出（`view: echarts`）

给 query-block 加 `view: echarts` + `chart`，直接把查询结果画成图，省掉手抄数据。三种库（sqlite / duckdb / cypher）通用。

数据源用现成的 `backlog/databases/demo-shop.sqlite`（`order_details` 视图，80 行订单）。

## 23. 简单映射形式

`chart` 只描述映射关系：`type` + `categoryField` + `valueField`（加可选 `title` / `name` / `categoryAxisName` / `valueAxisName`）；饼图出 `name/value`，散点出 `x/y`，其余按类目柱/线处理：

```sqlite-query
source: backlog/databases/demo-shop.sqlite
view: echarts
sql: |
  SELECT category,
         ROUND(SUM(amount), 2) AS revenue
  FROM order_details
  GROUP BY category
  ORDER BY revenue DESC
chart: |
  { "type": "bar", "categoryField": "category", "valueField": "revenue", "title": "各品类成交额", "name": "成交额", "valueAxisName": "元" }
```

饼图同一份查询，换个 `type` 即可：

```sqlite-query
source: backlog/databases/demo-shop.sqlite
view: echarts
sql: |
  SELECT category,
         COUNT(*) AS orders
  FROM order_details
  GROUP BY category
  ORDER BY orders DESC
chart: |
  { "type": "pie", "categoryField": "category", "valueField": "orders", "title": "各品类订单数" }
```

## 24. 高级形式（`option` + `@result`）

`chart` 写成 `{"option": ...}` 就是完整 option 树，字符串值里的两个占位符会被替换：

| 占位符 | 替换成 | 典型位置 |
|---|---|---|
| `@result` | 整个结果为对象数组（列名 → 值） | `dataset.source` |
| `@result:<列名>` | 该列的值数组 | `xAxis.data`、`series.data` |

`@result:category` 取类目、`@result:revenue` 取数值：

```sqlite-query
source: backlog/databases/demo-shop.sqlite
view: echarts
sql: |
  SELECT substr(ordered_at, 1, 7) AS month,
         ROUND(SUM(amount), 2)     AS revenue
  FROM order_details
  GROUP BY month
  ORDER BY month
chart: |
  {
    "option": {
      "title": { "text": "月度成交额" },
      "tooltip": { "trigger": "axis" },
      "xAxis": { "type": "category", "data": "@result:month" },
      "yAxis": { "type": "value", "name": "元" },
      "series": [
        { "name": "成交额", "type": "line", "smooth": true, "data": "@result:revenue" }
      ]
    }
  }
```

`@result` 直接喂 `dataset.source`，再用 `encode` 指列：

```sqlite-query
source: backlog/databases/demo-shop.sqlite
view: echarts
sql: |
  SELECT customer,
         ROUND(SUM(amount), 2) AS spend
  FROM order_details
  GROUP BY customer
  ORDER BY spend DESC
  LIMIT 6
chart: |
  {
    "option": {
      "title": { "text": "客户消费排行" },
      "tooltip": {},
      "dataset": { "source": "@result" },
      "xAxis": { "type": "category" },
      "yAxis": { "type": "value", "name": "元" },
      "series": [
        { "type": "bar", "encode": { "x": "customer", "y": "spend" } }
      ]
    }
  }
```

> 占位符必须**整值**出现（`"@result:month"`），不做字符串内拼接——这样语法无歧义，XSS 面与独立 `echarts` fence 完全一致（只有 `JSON.parse`，没有函数执行）。
>
> `chart` 可以单行 JSON，也可以 `chart: |` 块标量写多行。缺 `chart`、JSON 非法、缺字段都会在块内联报错，不影响同页其他块。

---

# 三、图表引用查询（`fromQuery`）

query-block 加 `id` 变成「命名查询」，独立 `echarts` fence 就能用 `fromQuery` 引用它的结果——**同文档内**生效，图表和查询各写各的，不必挤在一个块里。

## 25. 命名查询

`id` 只在本篇文档内唯一；重复 `id` 后写覆盖先写，并在控制台 warn。

```sqlite-query
source: backlog/databases/demo-shop.sqlite
id: monthly
view: table
sql: |
  SELECT substr(ordered_at, 1, 7) AS month,
         ROUND(SUM(amount), 2)     AS revenue
  FROM order_details
  GROUP BY month
  ORDER BY month
```

查询块照常渲染成表格（`view: table`），图表只是「顺带」复用它的结果。

## 26. series 级引用

`fromQuery` + `categoryField` + `valueField` 挂在 series 上，自动生成 `data`；option 里没有 `xAxis` 时，按第一个引用的 `categoryField` 自动补一根类目轴：

```echarts
{
  "title": { "text": "月度成交额（引用 id: monthly）" },
  "tooltip": { "trigger": "axis" },
  "yAxis": { "type": "value", "name": "元" },
  "series": [
    {
      "name": "成交额",
      "type": "line",
      "smooth": true,
      "fromQuery": "monthly",
      "categoryField": "month",
      "valueField": "revenue"
    }
  ]
}
```

## 27. dataset 级引用

`{"fromQuery": "monthly"}` 整块替换成 `{"source": [...对象数组]}`，配合 `encode` 指列；自己写 `xAxis` 时以你写的为准：

```echarts
{
  "title": { "text": "月度成交额（dataset 形式）" },
  "tooltip": { "trigger": "axis" },
  "dataset": { "fromQuery": "monthly" },
  "xAxis": { "type": "category" },
  "yAxis": { "type": "value", "name": "元" },
  "series": [{ "type": "bar", "encode": { "x": "month", "y": "revenue" } }]
}
```

## 28. 生命周期

- 查询结果落地后，引用它的图表**自动重绘**（不必手动刷新页面）；点查询块头的刷新按钮，图也跟着变。
- 只有 `source` 里出现 `fromQuery` 的图表才会订阅结果更新，其余图表不受影响。
- 引用不存在的 `id` 时，图内显示「未找到查询 id: xxx」，不报错、不白屏。
- 建议把命名查询块写在引用它的图表**前面**（同页顺序阅读更自然）；顺序反了也能渲染，只是首帧会短暂空一下。

---

# 验收对照

| 任务 | 看什么 | 本页位置 |
|---|---|---|
| BACK-812 | 全部内置 series（23 类）都有一节：20 类可渲染图 + custom / map 形状示意 + chord；明暗模式切换重绘；非法 JSON 回退代码块 | §1–§22 |
| BACK-813 | `view: echarts` 简单 / 高级两种写法出图；缺字段内联报错 | §23–§24 |
| BACK-814 | `id` 命名查询；series / dataset 两种 `fromQuery`；刷新后图跟着变；未知 id 友好提示 | §25–§28 |
