## 📈 v1.53.8-CN Release Notes

> 上一个版本：[v1.53.7-CN](https://github.com/kuwork/Backlog.md/releases/tag/v1.53.7-CN)
>
> 🚀 这个版本让图表渲染更可控、文档查看更顺手：你可以**切换图表引擎**（Pele 默认，Mermaid 回退），并新增了一份可直接抄的 **Mermaid 图示画廊**；同时修复了「按文档 ID 查看」「文件预览把 frontmatter 当正文」「勾选列表频繁刷屏」等问题，Web 服务端也学会了**缓存自愈**——外部改动无需重启就能在浏览器看到。

### ✨ 新功能

- 🔄 **图表引擎可切换**：渲染 Mermaid 的引擎现在可以在设置里切换——**Pele（Obsidian 团队开源，零依赖，将 Mermaid 12.1.0 语法渲染为 SVG）成为默认**，Mermaid 11.16.1 保留为可选回退。暗色主题下线条 / 箭头对比度也已修正，Pele 图清晰可见。
- 📚 **Mermaid 图示画廊**：新增文档《Mermaid 图示画廊》，收录 **18 类、25 个可直接套用的示例**，覆盖本项目的任务 / 里程碑 / CLI 流程，以及微信支付、支付宝转账等常见场景，末尾附速查表。
- 🆔 **文档支持按 ID 直接查看**：`backlog doc view doc-20`（或 `20`）现在对**子目录里的文档**也能定位（此前子目录文档会报 not found）。这修复了 v1.53.7 的已知问题。
- 🗂️ **文件预览单独呈现 frontmatter**：从任务 / 文档链接点开的文件预览，现在会把顶部的 YAML frontmatter 抽出来，作为独立的**元数据面板**展示，不再把 `---` 当成正文的小节线泄漏进渲染区。
- ✅ **勾选列表合并保存**：任务详情弹窗里连续勾选验收标准（AC）/ 完成定义（DoD）时，会被折叠成**一次保存请求**；服务端广播防抖从 75ms 放宽到 300ms，一次编辑只推一条更新，不再刷屏。

### 🧩 怎么用

**切换图表引擎**：设置 → Diagram Engine 下拉（默认 Pele / Mermaid），保存即生效并写入 `config.yml`：

```yaml
diagram_engine: pele   # pele（默认）或 mermaid
```

**按 ID 查看文档**：

```bash
backlog doc view doc-20      # 根目录或子目录文档均可
backlog doc view 20          # 纯数字 ID 同样支持
```

> 若多个文档 frontmatter 的 `id` 冲突，仍会 fail-closed 报 `AmbiguousIdError` 并列出候选，不会误打开。

完整的 18 类 25 例与速查表，都在文档《Mermaid 图示画廊》里，打开即可看到实时渲染效果。

### ⚠️ 需要注意

- 🧾 **部分 Beta 图表类型有词法限制**（详见《Mermaid 图示画廊》）：`xychart-beta` 的 `x-axis` 类别项必须加双引号（如 `"第1周"`），否则解析报错；`architecture-beta`、`sankey-beta` 的节点 / 标签须为 ASCII（中文会触发 Lexer error），示例已统一用英文标签呈现。
- 🗺️ 地图类图表仍需自备合规底图（同 v1.53.7）。

### ⬆️ 升级说明

- ✅ **直接升级，无需改动已有文档**：Mermaid 写法不变，新增的引擎切换默认 Pele，如不满意可在设置里切回 Mermaid。
- 🛡️ **Web 服务端缓存自愈**：现在会周期性（默认每 10 秒，受 `BACKLOG_RESCAN_INTERVAL_MS` 控制）用文件指纹（mtime+size，必要时 content hash）对账，自动发现 `fs.watch` 漏掉的外部增改删并刷新广播；主数据 WebSocket 断开后会**自动重连**并重新拉取。rm 删文件、长时间空闲后 CLI 改动、空目录增删，都无需重启即可在浏览器看到。
- 🔒 **收尾门禁进入默认状态机**：`backlog init` 新建项目时写入的默认状态机，现在内置「收尾门禁」——`In Progress → In Review` 要求任务文件按 task-finalization 完成，`In Review → Done` 要求按 task-finalization 验证完成（zh-CN / en / ja / zh-TW 四语言同步）。已有项目的自定义状态机不受影响。

### 🐞 已知问题

- 无新增已知问题。v1.53.7 中「`backlog doc view` 不支持按文档 ID 查看」已由本版本修复（BACK-817）。
