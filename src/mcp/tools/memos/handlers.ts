import { createMemo, deleteMemo, getMemo, listMemosPage, type Memo, updateMemo } from "../../../core/memos.ts";
import { BacklogToolError } from "../../errors/mcp-errors.ts";
import type { McpServer } from "../../server.ts";
import type { CallToolResult } from "../../types.ts";

export type MemoListArgs = {
	limit?: number;
	cursor?: string;
	date?: string;
	tags?: string[];
};

export type MemoViewArgs = {
	id: string;
};

export type MemoCreateArgs = {
	content: string;
	tags?: string[];
};

export type MemoUpdateArgs = {
	id: string;
	content?: string;
	append?: string;
	tags?: string[];
};

export type MemoDeleteArgs = {
	id: string;
};

function formatMemo(memo: Memo): string {
	const metadata: string[] = [
		`ID: ${memo.id}`,
		`Created: ${memo.createdDate}`,
		...(memo.updatedDate ? [`Updated: ${memo.updatedDate}`] : []),
		`Tags: ${memo.tags.length > 0 ? memo.tags.join(", ") : "(none)"}`,
		`Path: ${memo.path}`,
	];
	return [`Memo ${memo.id} - ${memo.displayTitle}`, ...metadata.map((line) => `  ${line}`), "", memo.rawContent].join(
		"\n",
	);
}

function formatMemoSummaryLine(memo: Memo): string {
	const metadata: string[] = [`created: ${memo.createdDate}`];
	if (memo.tags.length > 0) {
		metadata.push(`tags: ${memo.tags.join(", ")}`);
	}
	return `  ${memo.id} - ${memo.displayTitle} (${metadata.join(", ")})`;
}

export class MemoHandlers {
	constructor(private readonly core: McpServer) {}

	private get root(): string {
		return this.core.filesystem.rootDir;
	}

	private async loadMemoOrThrow(id: string): Promise<Memo> {
		const memo = await getMemo(this.root, id);
		if (!memo) {
			throw new BacklogToolError(`Memo not found: ${id}`, "MEMO_NOT_FOUND");
		}
		return memo;
	}

	async listMemos(args: MemoListArgs = {}): Promise<CallToolResult> {
		const page = await listMemosPage(this.root, {
			limit: args.limit,
			cursor: args.cursor,
			date: args.date,
			tags: args.tags,
		});

		const lines: string[] =
			page.items.length === 0
				? ["No memos found."]
				: ["Memos:", ...page.items.map((memo) => formatMemoSummaryLine(memo))];
		if (page.nextCursor) {
			lines.push(`More memos available. Next cursor: ${page.nextCursor}`);
		}

		return {
			content: [
				{
					type: "text",
					text: lines.join("\n"),
				},
			],
			structuredContent: {
				items: page.items,
				nextCursor: page.nextCursor,
			},
		};
	}

	async viewMemo(args: MemoViewArgs): Promise<CallToolResult> {
		const memo = await this.loadMemoOrThrow(args.id);
		return {
			content: [
				{
					type: "text",
					text: formatMemo(memo),
				},
			],
		};
	}

	async createMemo(args: MemoCreateArgs): Promise<CallToolResult> {
		const memo = await createMemo(this.root, args.content, args.tags ?? []);
		return {
			content: [
				{
					type: "text",
					text: ["Memo created successfully.", formatMemo(memo)].join("\n"),
				},
			],
		};
	}

	async updateMemo(args: MemoUpdateArgs): Promise<CallToolResult> {
		const hasContent = args.content !== undefined;
		const hasAppend = args.append !== undefined;
		if (hasContent === hasAppend) {
			throw new BacklogToolError(
				"Exactly one of 'content' (replace the memo body) or 'append' (append to the memo body) is required.",
				"VALIDATION_ERROR",
			);
		}

		const existing = await this.loadMemoOrThrow(args.id);
		const content = hasAppend ? `${existing.rawContent}\n${args.append}` : args.content;
		const memo = await updateMemo(this.root, existing.id, { content, ...(args.tags && { tags: args.tags }) });
		if (!memo) {
			throw new BacklogToolError(`Memo not found: ${args.id}`, "MEMO_NOT_FOUND");
		}
		return {
			content: [
				{
					type: "text",
					text: ["Memo updated successfully.", formatMemo(memo)].join("\n"),
				},
			],
		};
	}

	async deleteMemo(args: MemoDeleteArgs): Promise<CallToolResult> {
		const deleted = await deleteMemo(this.root, args.id);
		if (!deleted) {
			throw new BacklogToolError(`Memo not found: ${args.id}`, "MEMO_NOT_FOUND");
		}
		return {
			content: [
				{
					type: "text",
					text: `Memo deleted: ${args.id}`,
				},
			],
		};
	}
}
