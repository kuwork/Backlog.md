## 📈 v1.53.7-CN Release Notes

> 上一个版本：[v1.53.6-CN](https://github.com/kuwork/Backlog.md/releases/tag/v1.53.6-CN)
>
> 🚀 这个版本给文档加了**图表块**：在 Markdown 正文里写一段 `echarts` 配置，就能画出柱状图、折线图、饼图等 20 多种图表；数据库查询的结果也可以直接画成图，不用手抄数据。升级即用，无需迁移。

### ✨ 新功能

- 📊 **文档里直接画图**：除了原有的 `mermaid` 流程图，现在可以用 `echarts` 画数据图表，支持 20 多种内置类型——柱状、折线、饼图、散点、涟漪散点、雷达、热力、仪表盘、漏斗、桑基、树图、矩形树图、旭日、关系图、平行坐标、K 线、箱线图、路径图、象形柱图、主题河流、和弦图等。
- 🔍 **查询结果直接出图**：给 `sqlite-query` / `duckdb-query` / `cypher-query` 加两行配置，查询结果就渲染成图。简单的柱线饼散点只需指定「用哪一列做分类、哪一列做数值」；复杂图形可以把查询结果填进任意 ECharts 配置。
- 🔗 **图表引用查询**：给查询块起个 `id`，另一处的图表用 `fromQuery` 引用它。查询刷新时图表自动跟着变，表格和图可以并存。
- 🌗 **自动跟随明暗主题**：不用手写配色，切换主题时图表同步换色。图表代码按需加载，不会拖慢文档首次打开。

### 🧩 怎么用

写在 Markdown 正文里就行，最小例子：

````markdown
```echarts
{
  "xAxis": { "type": "category", "data": ["周一", "周二", "周三"] },
  "yAxis": { "type": "value" },
  "series": [{ "type": "bar", "data": [12, 20, 15] }]
}
```
````

查询出图则是：

````markdown
```sqlite-query
source: backlog/databases/tasks.sqlite
view: echarts
chart: |
  { "type": "line", "categoryField": "day", "valueField": "total", "title": "每日任务数" }
sql: |
  SELECT day, COUNT(*) AS total FROM tasks GROUP BY day
```
````

📚 更多例子——每一种图表、两种查询出图方式、完整的配置说明——都在文档《ECharts 图表演示》里，打开就能看到实时渲染的效果。

### ⚠️ 需要注意

- 🧾 **图表配置只能是 JSON，不能写函数**。`formatter`、`renderItem` 这类需要函数的配置不会生效；配置写错时会退化成普通代码块，不会让页面出错。
- 🗺️ **地图需要自己准备底图**。内置不含任何地图数据，`map` / `geo` 要先注册地图才能显示，请使用合规来源的地图数据。
- 📌 **`fromQuery` 只引用同一篇文档里的查询块**，不支持跨文档。

### ⬆️ 升级说明

- ✅ 直接升级，无需改动任何已有文档：Mermaid 的写法完全不变，三个查询块原有的用法也不变。
- 📦 图表库已随程序内置，不需要额外安装。

**🐞 已知问题**：`backlog doc view` 目前还不支持按文档 ID 查看（例如 `backlog doc view doc-30` 会失败），改用完整路径即可，后续版本修复。
