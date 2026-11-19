import type { McpServer } from "../../server.ts";
import type { McpToolHandler } from "../../types.ts";
import { createSimpleValidatedTool } from "../../validation/tool-wrapper.ts";
import type { DecisionDeleteArgs, DecisionListArgs, DecisionUpdateArgs, DecisionViewArgs } from "./handlers.ts";
import { DecisionHandlers } from "./handlers.ts";
import { decisionDeleteSchema, decisionListSchema, decisionUpdateSchema, decisionViewSchema } from "./schemas.ts";

export function registerDecisionTools(server: McpServer): void {
	const handlers = new DecisionHandlers(server);

	const listDecisionTool: McpToolHandler = createSimpleValidatedTool(
		{
			name: "decision_list",
			description: "List Backlog.md decisions with optional status/search filtering and offset+limit paging",
			inputSchema: decisionListSchema,
			annotations: { title: "List Decisions", readOnlyHint: true, destructiveHint: false },
		},
		decisionListSchema,
		async (input) => handlers.listDecisions(input as DecisionListArgs),
	);

	const viewDecisionTool: McpToolHandler = createSimpleValidatedTool(
		{
			name: "decision_view",
			description: "View a Backlog.md decision by ID or exact project-relative source path",
			inputSchema: decisionViewSchema,
			annotations: { title: "View Decision", readOnlyHint: true, destructiveHint: false },
		},
		decisionViewSchema,
		async (input) => handlers.viewDecision(input as DecisionViewArgs),
	);

	const deleteDecisionTool: McpToolHandler = createSimpleValidatedTool(
		{
			name: "decision_delete",
			description: "Delete a Backlog.md decision by id",
			inputSchema: decisionDeleteSchema,
			annotations: { title: "Delete Decision", destructiveHint: true },
		},
		decisionDeleteSchema,
		async (input) => handlers.deleteDecision(input as DecisionDeleteArgs),
	);

	const updateDecisionTool: McpToolHandler = createSimpleValidatedTool(
		{
			name: "decision_update",
			description:
				"Update an existing Backlog.md decision's status, body, or both; also supports optional title and newId updates and sourcePath for exact source selection",
			inputSchema: decisionUpdateSchema,
			annotations: { title: "Update Decision", destructiveHint: false },
		},
		decisionUpdateSchema,
		async (input) => handlers.updateDecision(input as DecisionUpdateArgs),
	);

	server.addTool(listDecisionTool);
	server.addTool(viewDecisionTool);
	server.addTool(deleteDecisionTool);
	server.addTool(updateDecisionTool);
}

export type { DecisionDeleteArgs, DecisionListArgs, DecisionUpdateArgs, DecisionViewArgs } from "./handlers.ts";
export { decisionDeleteSchema, decisionListSchema, decisionUpdateSchema, decisionViewSchema } from "./schemas.ts";
