import type { McpServer } from "../../server.ts";
import type { McpToolHandler } from "../../types.ts";
import { createSimpleValidatedTool } from "../../validation/tool-wrapper.ts";
import { GraphHandlers, type GraphListDatabasesArgs, type GraphQueryArgs, type GraphSchemaArgs } from "./handlers.ts";
import { graphListDatabasesSchema, graphQuerySchema, graphSchemaSchema } from "./schemas.ts";

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

	const schemaTool: McpToolHandler = createSimpleValidatedTool(
		{
			name: "graph_schema",
			description:
				"Introspect a graph database's schema ('default' or a user database): every node table with its properties (name, type, primary key) and every relationship table with its source/target endpoints.",
			inputSchema: graphSchemaSchema,
			annotations: { title: "Graph Schema", readOnlyHint: true, destructiveHint: false, openWorldHint: false },
		},
		graphSchemaSchema,
		async (input) => handlers.schemaGraph(input as GraphSchemaArgs),
	);

	const listDatabasesTool: McpToolHandler = createSimpleValidatedTool(
		{
			name: "graph_list_databases",
			description:
				"List the available graph databases: the read-only 'default' derived markdown knowledge graph plus every user database, each with its kind and node/edge counts.",
			inputSchema: graphListDatabasesSchema,
			annotations: { title: "List Graph Databases", readOnlyHint: true, destructiveHint: false, openWorldHint: false },
		},
		graphListDatabasesSchema,
		async (input) => handlers.listDatabases(input as GraphListDatabasesArgs),
	);

	server.addTool(queryTool);
	server.addTool(schemaTool);
	server.addTool(listDatabasesTool);
}
