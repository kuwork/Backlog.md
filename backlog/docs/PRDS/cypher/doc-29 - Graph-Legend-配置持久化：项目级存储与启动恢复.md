---
id: doc-29
title: Graph-Legend 配置持久化：项目级存储与启动恢复
type: specification
created_date: '2026-10-17 02:41'
updated_date: '2026-10-17 03:16'
---
# 背景与问题

图视图的图例配置（BACK-794 引入的 per-type 体系：每个节点类型的颜色、caption 模板、配色规则、关系线样式与箭头）目前只存在**浏览器 localStorage**（键 `backlog.graph.<database>.legend`，按库隔离），唯一入口是 web 界面的图例设置面板。由此产生三个问题：

1. **易丢**：换浏览器、换设备、清缓存，配置即消失。
2. **不可共享**：团队成员各自维护一份，同一数据库的图在不同人屏幕上长得不一样。
3. **文档渲染不确定**：`cypher-query` 块（BACK-803）的 `view: graph` 渲染结果取决于读者浏览器的 localStorage，而不是项目本身。

而 `normalizeLegendConfig` 在设计之初就刻意容忍"部分缺失、手工编辑过的配置"——一个可手改、可进 git 的 JSON 文件完全贴合既有容错设计。

# 目标

- 图例配置持久化到项目内、随 git 版本化。
- 浏览器启动（图组件挂载）时从项目存储恢复配置。
- 保留 localStorage 作为离线缓存与零延迟首帧。
- CLI 可读可图例配置（`backlog graph legend`）。

# 非目标

- 不做多用户实时协同与合并（冲突策略为 last-writer-wins）。
- 不改动 `graph-legend-config.ts` 的归一化/配色/caption 纯函数层。
- 不为 SQL 查询块的 `style:` 字段引入项目级配置（块字段已在文档里，天然版本化）。

# 设计

## 存储

`backlog/databases/graph-legends.yaml`（与 `registry.json` 并排；该目录已随 git 提交），单文件按库名映射：

```yaml
default:
  types:
    Person:
      caption: "{{name}}"
      color: "#3b82f6"
      rules: []
demo:
  types: {}
```

文件为块状 YAML、LF 行尾，便于 review、diff 与手改（YAML 支持注释；JSON 是其子集，脚本生成的 JSON 载荷同样可解析）。缺字段、坏规则由客户端读取时经 `normalizeLegendConfig` 降级处理，服务端不做深度校验。

## 服务端端点

- `GET /api/graph/legend?database=X`：有配置返回 JSON，无配置返回 204。
- `PUT /api/graph/legend`，body `{ "database": "X", "config": {…} }`：校验 config 为 plain object（否则 400），原子写入（临时文件 + rename）；`config: null` 表示重置（删除该库条目）。
- PUT 成功后复用现有 WS 通道广播 `graph-legend-updated`（载荷带 database），其他开着的标签页热更新——与 `backlog-config-updated` 同一套路。

## 启动恢复与迁移（CypherResultGraph，唯一消费方）

1. 挂载时先用 localStorage 渲染（零延迟、离线可用）。
2. 同时向服务器 GET：
   - 服务器有配置且与本地不同 → 应用服务器版本，并回写 localStorage 当缓存。
   - 服务器没有而 localStorage 有 → 把本地配置 PUT 上去一次（**迁移**，老用户配置自动入库）。
   - 两边都没有 → 维持默认。
3. 收到本库的 `graph-legend-updated` 广播 → 重新 GET 并应用。

## 保存链路

设置面板保存 = 写 localStorage（即时生效）+ PUT 服务器（write-through）。PUT 失败不阻断：本地副本保留，下次启动重试迁移逻辑自然兜底。

## CLI

挂在现有 `graph` 命令组（m-13）下，直接读写同一个 YAML 文件（不经 HTTP，离线可用）。删除命令沿用 CLI 惯例命名 `remove`（与 `milestone remove` 一致）：

- `backlog graph legend get <database>`：打印该库配置（`--json` 输出原始 JSON）。
- `backlog graph legend set <database> <file>`：从 YAML 文件导入；`set <database> --stdin` 从标准输入读。
- `backlog graph legend remove <database>`：删除该库条目。

# 冲突与并发

last-writer-wins。图例是低频单人配置，不引入版本向量或合并。服务端写入用原子 rename 防半写文件。

# 验收标准（总览）

- 配置在浏览器 A 保存后，清缓存/换浏览器打开同一项目能看到同样式。
- `graph-legends.yaml` 可手改（删字段、写坏规则），界面按容错规则降级不崩。
- CLI get/set/remove 与 web 面板读写的是同一份数据。
- 全程离线可用：服务器不可达时 localStorage 路径行为与现状一致。
