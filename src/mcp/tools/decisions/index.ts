import type { McpServer } from "../../server.ts";
import type { McpToolHandler } from "../../types.ts";
import { createSimpleValidatedTool } from "../../validation/tool-wrapper.ts";
import type { DecisionListArgs, DecisionUpdateArgs } from "./handlers.ts";
import { DecisionHandlers } from "./handlers.ts";
import { decisionListSchema, decisionUpdateSchema } from "./schemas.ts";

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

	const updateDecisionTool: McpToolHandler = createSimpleValidatedTool(
		{
			name: "decision_update",
			description: "Update an existing Backlog.md decision's status, body, or both",
			inputSchema: decisionUpdateSchema,
			annotations: { title: "Update Decision", destructiveHint: false },
		},
		decisionUpdateSchema,
		async (input) => handlers.updateDecision(input as DecisionUpdateArgs),
	);

	server.addTool(listDecisionTool);
	server.addTool(updateDecisionTool);
}

export type { DecisionListArgs, DecisionUpdateArgs } from "./handlers.ts";
export { decisionListSchema, decisionUpdateSchema } from "./schemas.ts";
