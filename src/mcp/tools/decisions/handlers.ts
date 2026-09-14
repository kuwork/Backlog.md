import type { Decision } from "../../../types/index.ts";
import { isAmbiguousIdError } from "../../../utils/entity-id.ts";
import { BacklogToolError } from "../../errors/mcp-errors.ts";
import type { McpServer } from "../../server.ts";
import type { CallToolResult } from "../../types.ts";

export type DecisionUpdateArgs = {
	id: string;
	content?: string;
	appendContent?: string[];
	status?: string;
};

export class DecisionHandlers {
	constructor(private readonly core: McpServer) {}

	private async loadDecisionOrThrow(id: string): Promise<Decision> {
		const decision = await this.core.filesystem.loadDecision(id);
		if (!decision) {
			throw new BacklogToolError(`Decision not found: ${id}`, "DECISION_NOT_FOUND");
		}
		return decision;
	}

	async updateDecision(args: DecisionUpdateArgs): Promise<CallToolResult> {
		const existing = await this.loadDecisionOrThrow(args.id);
		const appendContent = (args.appendContent ?? []).filter((chunk) => chunk.trim().length > 0);
		const hasContent = typeof args.content === "string";
		const hasAppend = appendContent.length > 0;
		const hasStatus = typeof args.status === "string" && args.status.trim().length > 0;

		if (!hasContent && !hasAppend && !hasStatus) {
			throw new BacklogToolError("Provide content, appendContent or status to update a decision.", "VALIDATION_ERROR");
		}

		try {
			if (!hasContent && !hasAppend) {
				// Status-only change: write it without round-tripping the sections.
				await this.core.updateDecisionStatus(existing.id, args.status as string);
			} else {
				const body = hasContent
					? [args.content as string, ...appendContent].join("\n\n")
					: [existing.rawContent, ...appendContent].join("\n\n");
				await this.core.updateDecisionFromContent(existing.id, body, hasStatus ? { status: args.status } : {});
			}

			const updated = await this.core.filesystem.loadDecision(existing.id);
			return {
				content: [
					{
						type: "text",
						text: `Updated decision ${existing.id} (status: ${updated?.status ?? existing.status}).`,
					},
				],
			};
		} catch (error) {
			if (isAmbiguousIdError(error)) throw error;
			if (error instanceof Error) {
				throw new BacklogToolError(`Failed to update decision: ${error.message}`, "OPERATION_FAILED");
			}
			throw new BacklogToolError("Failed to update decision.", "OPERATION_FAILED");
		}
	}
}
