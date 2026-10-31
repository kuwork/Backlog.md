import { useMemo } from "react";
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
export default function SqliteQueryBlock({ block, filePath }: { block: string; filePath?: string }) {
	const { t } = useI18n();
	// Identity has to survive re-renders: the shared core re-runs its query whenever this object
	// changes, so building it inline would fire a request for every block on any parent render -
	// a document refresh after a save would re-query all ten blocks at once.
	const engine = useMemo<QueryEngineConfig>(
		() => ({
			id: "sqlite",
			dict: t.sqliteQueryBlock,
			highlightLanguage: "sql",
			run: (request) => apiClient.runSqliteQuery(request),
			exportCsv: (request) => apiClient.exportSqliteCsv(request),
			actions: { showHide: true, copy: true, export: true, pagination: true },
		}),
		[t],
	);
	return <SqlQueryBlock block={block} engine={engine} filePath={filePath} />;
}
