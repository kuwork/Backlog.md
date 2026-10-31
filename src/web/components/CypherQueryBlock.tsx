import { useMemo } from "react";
import { parseCypherQueryBlock } from "../../graph/block.ts";
import { GRAPH_UPDATED_EVENT, type GraphUpdatedDetail } from "../../graph/updated.ts";
import { useI18n } from "../hooks/useI18n";
import { apiClient } from "../lib/api";
import { graphFromCypherResult } from "../utils/cypher-graph";
import CypherResultGraph, { GRAPH_NODE_LIMIT } from "./CypherResultGraph.tsx";
import SqlQueryBlock, { type QueryEngineConfig } from "./SqlQueryBlock.tsx";

/**
 * The `cypher-query` block in reading view (doc-27, BACK-802).
 *
 * Thin wrapper over the engine-agnostic {@link SqlQueryBlock}: it supplies the Cypher labels, the
 * block parser (whose statement field is `query`, not `sql`) and the graph endpoints. `source` is a
 * database registry name, not a path, and pagination stays off - the configured row cap is the whole
 * answer, so an over-cap result is a query to rewrite.
 *
 * `view: graph` (BACK-803) draws the raw node/rel structures with the very pane the databases page
 * uses, legend configuration included: it reads the same per-database localStorage entry, so what a
 * reader tuned on the databases page applies here untouched (and the pane's own settings gear edits
 * the same entry). Past {@link GRAPH_NODE_LIMIT} nodes the shared core falls back to the coerced
 * table with a notice. `refresh: auto` (BACK-804) re-runs the statement when the app shell's
 * graph-updated window event names this block's database.
 */
export default function CypherQueryBlock({ block, filePath }: { block: string; filePath?: string }) {
	const { t } = useI18n();
	// Memoized for its identity: the shared core re-runs the query whenever this object changes, so
	// building it inline would re-query the block on every parent render.
	const engine = useMemo<QueryEngineConfig>(
		() => ({
			id: "cypher",
			dict: t.cypherQueryBlock,
			parse: parseCypherQueryBlock,
			highlightLanguage: "cypher",
			run: (request) =>
				apiClient.runCypherQuery({
					source: request.source,
					query: request.sql,
					view: request.view === "graph" ? "graph" : undefined,
				}),
			exportCsv: (request) => apiClient.exportCypherCsv({ source: request.source, query: request.sql }),
			actions: { showHide: true, copy: true, export: true, pagination: false },
			graph: {
				fromResult: (result) =>
					// `nodeKeys` is the corpus highlighter's channel; the extraction only reads the rows.
					graphFromCypherResult({
						columns: result.columns,
						rows: result.graphRows ?? [],
						nodeKeys: [],
						truncated: result.truncated,
					}),
				render: (graph, { source, cameraToken }) => (
					<CypherResultGraph graph={graph} database={source} cameraToken={cameraToken} />
				),
				nodeLimit: GRAPH_NODE_LIMIT,
			},
			refresh: {
				auto: {
					// The app shell owns the one WebSocket and re-dispatches graph-updated as a window
					// event; only a broadcast naming this block's own database re-runs it.
					subscribe: (source, onChanged) => {
						const handle = (event: Event) => {
							if ((event as CustomEvent<GraphUpdatedDetail>).detail?.database === source) onChanged();
						};
						window.addEventListener(GRAPH_UPDATED_EVENT, handle);
						return () => window.removeEventListener(GRAPH_UPDATED_EVENT, handle);
					},
				},
			},
		}),
		[t],
	);
	return <SqlQueryBlock block={block} engine={engine} filePath={filePath} />;
}
