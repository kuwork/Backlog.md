import { useI18n } from "../hooks/useI18n";
import { apiClient } from "../lib/api";
import SqlQueryBlock, { type QueryEngineConfig } from "./SqlQueryBlock.tsx";

/**
 * The `duckdb-query` block in reading view (m-12 / BACK-778 + BACK-779 + BACK-780 + BACK-781).
 *
 * Thin wrapper over the same engine-agnostic {@link SqlQueryBlock} the SQLite block uses. Show/Hide
 * (BACK-779), Copy Markdown (BACK-780) and Export CSV (BACK-781) are all enabled here now; the three
 * actions were switched on one task at a time, mirroring how m-11 grew the SQLite block feature by
 * feature. Base rendering (table / list / value, loading / error / empty / summary / truncated,
 * refresh) is already live.
 */
export default function DuckdbQueryBlock({ block }: { block: string }) {
	const { t } = useI18n();
	const engine: QueryEngineConfig = {
		id: "duckdb",
		dict: t.duckdbQueryBlock,
		run: (request) => apiClient.runDuckdbQuery(request),
		exportCsv: (request) => apiClient.exportDuckdbCsv(request),
		actions: { showHide: true, copy: true, export: true, pagination: true },
	};
	return <SqlQueryBlock block={block} engine={engine} />;
}
