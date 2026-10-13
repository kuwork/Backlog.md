import { useI18n } from "../hooks/useI18n";
import { apiClient } from "../lib/api";
import SqlQueryBlock, { type QueryEngineConfig } from "./SqlQueryBlock.tsx";

/**
 * The `duckdb-query` block in reading view (m-12 / BACK-778).
 *
 * Thin wrapper over the same engine-agnostic {@link SqlQueryBlock} the SQLite block uses. The three
 * action buttons are disabled here and switched on incrementally by BACK-779 (Show/Hide), BACK-780
 * (Copy Markdown) and BACK-781 (Export CSV), mirroring how m-11 grew the SQLite block feature by
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
		actions: { showHide: false, copy: false, export: false },
	};
	return <SqlQueryBlock block={block} engine={engine} />;
}
