import { useI18n } from "../hooks/useI18n";
import { apiClient } from "../lib/api";
import SqlQueryBlock, { type QueryEngineConfig } from "./SqlQueryBlock.tsx";

/**
 * The `sqlite-query` block in reading view (doc-16 §6).
 *
 * Thin wrapper over the engine-agnostic {@link SqlQueryBlock}: it supplies the SQLite labels and
 * endpoints and keeps every action live. Behaviour is byte-for-byte what this component rendered
 * before the DuckDB explorer refactored it into a shared core.
 */
export default function SqliteQueryBlock({ block }: { block: string }) {
	const { t } = useI18n();
	const engine: QueryEngineConfig = {
		id: "sqlite",
		dict: t.sqliteQueryBlock,
		run: (request) => apiClient.runSqliteQuery(request),
		exportCsv: (request) => apiClient.exportSqliteCsv(request),
		actions: { showHide: true, copy: true, export: true, pagination: true },
	};
	return <SqlQueryBlock block={block} engine={engine} />;
}
