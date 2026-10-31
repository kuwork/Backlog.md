import { useI18n } from "../hooks/useI18n";
import { apiClient } from "../lib/api";
import SqlQueryBlock, { type QueryEngineConfig } from "./SqlQueryBlock.tsx";

/**
 * The `mdb-query` block in reading view (Access live query).
 *
 * Thin wrapper over the same engine-agnostic {@link SqlQueryBlock} the SQLite and DuckDB blocks use.
 * Show/Hide, Copy Markdown and Export CSV are all enabled (mirroring m-11 / m-12); pagination is on
 * too, so a large table can be browsed without raising the preview cap. The server loads the Access
 * file into an in-memory SQLite database and runs the statement there, so the grid it returns is the
 * exact shape this core already renders.
 */
export default function MdbQueryBlock({ block }: { block: string }) {
	const { t } = useI18n();
	const engine: QueryEngineConfig = {
		id: "mdb",
		dict: t.mdbQueryBlock,
		run: (request) => apiClient.runMdbQuery(request),
		exportCsv: (request) => apiClient.exportMdbCsv(request),
		actions: { showHide: true, copy: true, export: true, pagination: true },
	};
	return <SqlQueryBlock block={block} engine={engine} />;
}
