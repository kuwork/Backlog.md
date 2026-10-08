## v1.53.2-CN Release Notes

> 上一个版本：[v1.53.1-CN](https://github.com/kuwork/Backlog.md/releases/tag/v1.53.1-CN)
>
> 这是一个**补丁版本（hotfix）**，覆盖 2026-10-08 的 2 个任务（BACK-757、BACK-758），只修一类问题：**自定义数据目录（`.backlog` 或任意 `backlog-dir`）下，memo 与图谱语料的目录解析仍硬编码成 `backlog`**，导致读写/监控走错路径、图谱无数据。无新增能力、无命令变化、无数据迁移。

### 🎯 主要亮点

- **自定义目录全面生效**（BACK-757/758）：继 1.53.x 引入可配置 `backlog-dir` 后，发现 memo 存储与图谱扫描两处仍把目录名写死成 `backlog`，`.backlog` 项目下它们会去读写/监听不存在的 `backlog/...`，而真正的语料在 `.backlog/...`。本期把这两处统一改为复用 `resolveBacklogDirectory()`（未配置时回退默认 `backlog`），与 tasks/docs/decisions 的解析路径对齐。

---

### 🐛 缺陷修复

#### Memo 走错目录 + 重跑 init 不补建（BACK-757）

- **症状**：把数据放在 `.backlog`（通过 `backlog init --backlog-dir .backlog` 或配置 `backlog_directory`）的项目，`backlog browser` 启动报 `ENOENT` 监控 `backlog\memos`；memo 的读/写/归档也落到了错误的 `backlog/memos`，`.backlog/memos` 里的旧 memo 读不到。
- **根因**：`src/core/memos.ts` 的 `memoDir()` / `memoArchiveDir()` 直接 `join(root, DEFAULT_DIRECTORIES.BACKLOG, ...)`，全仓只有 memo 这一处没走 `resolveBacklogDirectory()`。
- **连带修复**：`src/core/init.ts` 的重新初始化分支只调 `saveConfig()`、漏掉 `ensureBacklogStructure()`，所以升级后重跑 `backlog init` 不会补建缺失的 `memos/`、`docs/`（wiki 根）。重跑 init 现在会补建缺失目录。

#### 图谱扫描 / 热更新走错目录（BACK-758）

- **症状**：`.backlog` 项目启动后任务图谱、知识图谱为空（看不到节点），尽管磁盘上有 task 与 doc 文件。
- **根因**：`src/graph/scanner.ts` 的 `scanWhitelistedDirs` 与 `src/graph/service.ts` 的文件监听目录都硬编码 `join(projectRoot, "backlog", ...)`，扫描器扫不到 `.backlog/tasks`、`.backlog/docs`，返回 0 个文件，图谱建不出节点；监听也只盯着 `backlog/`。
- **说明**：图数据库本身存于全局缓存目录（`AppData/Local/backlog.md/graph`），不依赖项目内 backlog 目录，本次无需变更——只是"语料扫描"与"监听"两处走了错路径。

两处修复均对未初始化项目（`backlogDir` 为 `null`）回退到 `DEFAULT_DIRECTORIES.BACKLOG`，行为不变。

---

### 🧪 质量基建

- 新增回归用例锁定修复点：
  - `src/test/memos.test.ts`：验证存在 `.backlog/config.yml` 时 `memoDir` 解析到 `.backlog/memos` 而非 `backlog/memos`，并覆盖读写。
  - `src/test/graph-foundation.test.ts`：验证 `.backlog` 项目下 `scanWhitelistedDirs` 能扫到 `tasks` 与 `docs`（修复前为 0）。
- 受影响套件全绿：`memos` 23/23、`server-memos` 19/19、`web-memos` 54/54、`graph` 66/66；其中 server 套件含"禁止 id 逃逸 memo 目录"的安全测试，确认路径越界防护未受影响。
- `bunx biome check` 在各自改动文件上干净；repo-wide 仅报无关 untracked 的 CRLF 既有问题。

---

### ⚙️ 版本与升级说明

**命令面 / 契约变化**

本期无新增、无移除、无破坏性变更。`backlog init`、`backlog memo`、`backlog browser` 的命令行接口与 `memo_*` MCP 工具、`/api/memos` 的契约保持不变。

**需要留意的行为变化**

- 此前若你已用自定义 `backlog-dir`（如 `.backlog`），memo 实际被写到了错误的 `backlog/memos`（项目根下会多出一个 `backlog/` 目录）。升级后：
  - 旧 memo 仍在原 `.backlog/memos`——现在能被正确识别、展示与编辑；
  - 升级后启动时若根下误建了空/错的 `backlog/memos`，可手动删除（其内容与 `.backlog/memos` 不冲突时无需迁移，升级后写入只进 `.backlog/memos`）。
- 重跑 `backlog init` 现在会补建缺失的 `memos/`、`docs/` 等目录（之前需要手动建）。
- 仍无数据迁移需求；tasks/docs/decisions 早已走正确路径，本次只补齐 memo 与 graph 两处。

---

### 未跟进

- `mcp-memos > deletes a memo` 在 Windows 上偶发 afterEach 超时，是 `recursive` 目录 watcher 与 `rm` 的既有竞态，与本次改动无关（`McpServer` 不走 `startMemoWatcher`），本期未处理。
