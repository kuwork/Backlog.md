import { useMemo } from "react";
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
export default function MdbQueryBlock({ block, filePath }: { block: string; filePath?: string }) {
	const { t } = useI18n();
	// Memoized for its identity: the shared core re-runs the query whenever this object changes, so
	// building it inline would re-query every block in the document on any parent render.
	const engine = useMemo<QueryEngineConfig>(
		() => ({
			id: "mdb",
			dict: t.mdbQueryBlock,
			highlightLanguage: "sql",
			run: (request) => apiClient.runMdbQuery(request),
			exportCsv: (request) => apiClient.exportMdbCsv(request),
			actions: { showHide: true, copy: true, export: true, pagination: true },
		}),
		[t],
	);
	return <SqlQueryBlock block={block} engine={engine} filePath={filePath} />;
}
