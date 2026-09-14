import type { McpServer } from "../../server.ts";
import type { McpToolHandler } from "../../types.ts";
import { createSimpleValidatedTool } from "../../validation/tool-wrapper.ts";
import type { DecisionUpdateArgs } from "./handlers.ts";
import { DecisionHandlers } from "./handlers.ts";
import { decisionUpdateSchema } from "./schemas.ts";

export function registerDecisionTools(server: McpServer): void {
	const handlers = new DecisionHandlers(server);

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

	server.addTool(updateDecisionTool);
}

export type { DecisionUpdateArgs } from "./handlers.ts";
export { decisionUpdateSchema } from "./schemas.ts";
