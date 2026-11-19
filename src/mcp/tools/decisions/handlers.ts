import { loadDecisionFromSource } from "../../../core/entity-source.ts";
import type { Decision } from "../../../types/index.ts";
import { isAmbiguousIdError, normalizeEntityId } from "../../../utils/entity-id.ts";
import { BacklogToolError, getEntityIdentityErrorCode } from "../../errors/mcp-errors.ts";
import type { McpServer } from "../../server.ts";
import type { CallToolResult } from "../../types.ts";
import { buildListResult, selectListPage } from "../../utils/list-page.ts";

export type DecisionDeleteArgs = {
	id: string;
};

export type DecisionViewArgs = {
	id?: string;
	sourcePath?: string;
};

export type DecisionUpdateArgs = {
	id?: string;
	newId?: string;
	sourcePath?: string;
	title?: string;
	content?: string;
	appendContent?: string[];
	status?: string;
};

export type DecisionListArgs = {
	limit?: number;
	offset?: number;
	status?: string;
	search?: string;
};

export class DecisionHandlers {
	constructor(private readonly core: McpServer) {}

	private async loadDecisionOrThrow(selector: { id?: string; sourcePath?: string }): Promise<Decision> {
		if (selector.sourcePath) {
			return await loadDecisionFromSource(this.core, selector);
		}
		if (!selector.id) {
			throw new BacklogToolError("Provide id or sourcePath to select a decision.", "VALIDATION_ERROR");
		}
		const decision = await this.core.filesystem.loadDecision(selector.id);
		if (!decision) {
			throw new BacklogToolError(`Decision not found: ${selector.id}`, "DECISION_NOT_FOUND");
		}
		return decision;
	}

	async viewDecision(args: DecisionViewArgs): Promise<CallToolResult> {
		const decision = await this.loadDecisionOrThrow(args);
		const lines = [
			`Decision ${decision.id} - ${decision.title}`,
			`Status: ${decision.status}`,
			`Date: ${decision.date}`,
			`Path: ${decision.path ?? "(unknown)"}`,
			"",
			decision.rawContent.trim() || "(empty decision)",
		];
		return { content: [{ type: "text", text: lines.join("\n") }] };
	}

	async deleteDecision(args: DecisionDeleteArgs): Promise<CallToolResult> {
		const deleted = await this.core.filesystem.deleteDecision(args.id);
		if (!deleted) {
			throw new BacklogToolError(`Decision not found: ${args.id}`, "DECISION_NOT_FOUND");
		}
		return {
			content: [{ type: "text", text: `Decision deleted: ${args.id}` }],
		};
	}

	async updateDecision(args: DecisionUpdateArgs): Promise<CallToolResult> {
		const existing = await this.loadDecisionOrThrow(args);
		const appendContent = (args.appendContent ?? []).filter((chunk) => chunk.trim().length > 0);
		const hasContent = typeof args.content === "string";
		const hasAppend = appendContent.length > 0;
		const hasStatus = typeof args.status === "string" && args.status.trim().length > 0;
		const hasTitle = typeof args.title === "string" && args.title.trim().length > 0;
		const hasNewId = typeof args.newId === "string" && args.newId.trim().length > 0;

		if (!hasContent && !hasAppend && !hasStatus && !hasTitle && !hasNewId) {
			throw new BacklogToolError(
				"Provide content, appendContent or status to update a decision; title and newId are also supported.",
				"VALIDATION_ERROR",
			);
		}

		try {
			if (!hasContent && !hasAppend && !hasTitle && !hasNewId) {
				// Status-only change: write it without round-tripping the sections.
				await this.core.updateDecisionStatus(existing.id, args.status as string, undefined, {
					...(args.sourcePath ? { sourcePath: args.sourcePath } : {}),
				});
			} else {
				const body = hasContent
					? [args.content as string, ...appendContent].join("\n\n")
					: [existing.rawContent, ...appendContent].join("\n\n");
				await this.core.updateDecisionFromContent(existing.id, body, {
					...(hasStatus ? { status: args.status } : {}),
					...(hasTitle ? { title: args.title } : {}),
					...(hasNewId ? { newId: args.newId } : {}),
					...(args.sourcePath ? { sourcePath: args.sourcePath } : {}),
				});
			}

			const updatedId = normalizeEntityId("decision", args.newId ?? existing.id);
			const updated = await this.core.filesystem.loadDecision(updatedId);
			return {
				content: [
					{
						type: "text",
						text: `Updated decision ${updated?.id ?? updatedId} (status: ${updated?.status ?? existing.status}).`,
					},
				],
			};
		} catch (error) {
			if (isAmbiguousIdError(error) || error instanceof BacklogToolError) throw error;
			if (error instanceof Error) {
				throw new BacklogToolError(
					`Failed to update decision: ${error.message}`,
					getEntityIdentityErrorCode(error) ?? "OPERATION_FAILED",
				);
			}
			throw new BacklogToolError("Failed to update decision.", "OPERATION_FAILED");
		}
	}

	private formatDecisionSummaryLine(decision: Decision): string {
		const meta: string[] = [`status: ${decision.status ?? "(unknown)"}`];
		if (decision.date) {
			meta.push(`date: ${decision.date}`);
		}
		return `  ${decision.id} - ${decision.title} (${meta.join(", ")})`;
	}

	async listDecisions(args: DecisionListArgs = {}): Promise<CallToolResult> {
		let decisions = await this.core.filesystem.listDecisions();
		if (args.status) {
			const wanted = args.status.toLowerCase();
			decisions = decisions.filter((decision) => (decision.status ?? "").toLowerCase() === wanted);
		}
		if (args.search) {
			const needle = args.search.toLowerCase();
			decisions = decisions.filter((decision) => {
				const haystacks = [decision.id, decision.title];
				return haystacks.some((value) => value.toLowerCase().includes(needle));
			});
		}

		const page = selectListPage(decisions, { limit: args.limit, offset: args.offset });
		const text =
			page.items.length === 0
				? "No decisions found."
				: ["Decisions:", ...page.items.map((decision) => this.formatDecisionSummaryLine(decision))].join("\n");

		return buildListResult([{ type: "text", text }], page, { label: "decision" });
	}
}
