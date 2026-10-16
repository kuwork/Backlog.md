---
title: BACK-777 - 验证 DuckDB 原生绑定在 Bun 下只读运行
labels: [source, duckdb, bun, spike]
created_date: 2026-10-16 01:00
updated_date: 2026-10-16 01:00
source_path: backlog/tasks/back-777 - Verify-DuckDB-native-binding-loads-and-runs-read-only-queries-in-Bun.md
---

# BACK-777 - 验证 DuckDB 原生绑定在 Bun 下只读运行

m-12（DuckDB Explorer）动工前的技术验证（spike）：确认选定的绑定 `@duckdb/node-api` 能在 `bun`（即 `src/server` 的运行时，而非仅 node）下加载、以 `READ_ONLY` 模式打开 `.duckdb` 文件并执行 `SELECT`，且 DuckDB 特有值类型能强制转换到 `src/sqlite/markdown.ts`、`src/sqlite/csv.ts` 与 `src/web/lib/api.ts` 已依赖的共享 `SqliteCell` 契约（`string | number | boolean | null`）。若原生绑定加载失败，回退方案为 `@duckdb/duckdb-wasm` 并需在此记录原因。

## 目标

三件事必须证真：Bun 下 `import { DuckDBInstance } from "@duckdb/node-api"` 无错；`.duckdb` 以 `READ_ONLY` 打开后可查询、不可写；INTEGER/BIGINT、DECIMAL、DOUBLE、VARCHAR、BOOLEAN、TIMESTAMP、DATE、BLOB、NULL 各自强制到 JSON 安全的 `SqliteCell`。确切的绑定 API 调用、只读打开咒语与类型映射表记入任务笔记；spike 代码放 scratch 脚本、不提交进 `src/`，且不破坏 tsc / biome / 既有套件。

## 实现要点（验证结论）

- **Go**：`bun add @duckdb/node-api` 装上 `@duckdb/node-api@1.5.6-r.1`，Bun 1.3.13（Windows x64）下导入无错。原生绑定确认可用，WASM 回退不需要；该包成为运行时依赖（`package.json` 与 `bun.lockb` 更新）。
- 只读打开：`DuckDBInstance.create(path, { access_mode: "READ_ONLY" })`。此构建**没有** `DuckDBAccessMode` 枚举，配置就是 DuckDB 配置键的 `Record<string, string>`。对只读句柄执行 `CREATE` 抛引擎级错误 `Invalid Input Error: Cannot execute statement of type "CREATE" on database … attached in read-only mode`——引擎本身就是承重的只读层，与 SQLite 的 `PRAGMA query_only` 同构。
- 关闭是**同步**的：`connection.closeSync()` / `instance.closeSync()`，没有异步 `close()`。
- 查询：`connection.runAndReadAll(sql)` 返回 `DuckDBResultReader`，用 `reader.columnNames()` + `reader.getRowObjects()`（同步，返回 `Record<string, DuckDBValue>[]`）。`getRowObjectsJS()` 在此构建的 reader 上**不存在**（只在物化的 `DuckDBResult` 上），所以强制转换要直接对类型化 `DuckDBValue` 包装对象做。
- 类型强制映射（DuckDB → `SqliteCell`）：INTEGER/DOUBLE/VARCHAR/BOOLEAN/NULL 直通；BIGINT → `String(bigint)`（同 SQLite `toCell`）；DECIMAL(w,s) 形态为 `{ width, scale, value: "<integer string>" }`，按 scale 拼小数字符串（`"12345"` scale 3 → `"12.345"`），绝不用原始整数形态；TIMESTAMP 为 `{ micros: "<string>" }` → `new Date(Number(micros) / 1000).toISOString()`；DATE 为 `{ days: <int> }` → epoch 天数转 ISO 取前 10 位；BLOB 为 `{ bytes: Buffer }` → `<blob N 字节>`（措辞对齐 SQLite `toCell`）。
- 因此 `src/duckdb/query.ts` 需要自己的 `toCell`，最稳的判别器是 `reader.columnTypes()[i].typeId`（4=INTEGER、5=BIGINT、11=DOUBLE、19=DECIMAL、17=VARCHAR、1=BOOLEAN、12=TIMESTAMP、13=DATE、18=BLOB），`typeof` 作 NULL/原始值回退——与 SQLite 主要见原始值的 `toCell` 不同，这个必须拆 DuckDB 包装对象。
- 可复现验证脚本是 `scripts/duckdb-spike.ts`（未跟踪、不进 `src/`），m-12 提交前保留参考或删除。

## 验证

spike 脚本造了一张多类型表并读回，逐项确认上表映射；三条 AC（导入、只读打开、类型强制）全部在 Bun 下实测通过；tsc / biome / 既有套件未受影响。结论解锁 BACK-778..781。

## Related Sources

- [[sources/back-778-duckdb-query-live-blocks]] — 直接后继：基于本任务结论建 DuckDB 引擎与查询块
- [[sources/m-12-duckdb-explorer]] — 所属里程碑 DuckDB Explorer
- [[sources/doc-25-duckdb-explorer-prd]] — 设计来源 PRD（DuckDB Explorer）
- [[sources/doc-23-sqlite-explorer-prd]] — 关联 PRD（SQLite Explorer，共享 SqliteCell 契约的来源）
