import type { McpServer } from "../../server.ts";
import type { McpToolHandler } from "../../types.ts";
import { createSimpleValidatedTool } from "../../validation/tool-wrapper.ts";
import { GraphHandlers, type GraphQueryArgs } from "./handlers.ts";
import { graphQuerySchema } from "./schemas.ts";

export function registerGraphTools(server: McpServer): void {
	const handlers = new GraphHandlers(server);

	const queryTool: McpToolHandler = createSimpleValidatedTool(
		{
			name: "graph_query",
			description:
				"Run a read-only Cypher query against a graph database ('default' = the derived markdown knowledge graph, or a user database). Returns node/edge rows. Write keywords are rejected.",
			inputSchema: graphQuerySchema,
			annotations: { title: "Query Graph", readOnlyHint: true, destructiveHint: false, openWorldHint: false },
		},
		graphQuerySchema,
		async (input) => handlers.queryGraph(input as GraphQueryArgs),
	);

	server.addTool(queryTool);
}
