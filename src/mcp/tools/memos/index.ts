import type { BacklogConfig } from "../../../types/index.ts";
import type { McpServer } from "../../server.ts";
import type { McpToolHandler } from "../../types.ts";
import { createSimpleValidatedTool } from "../../validation/tool-wrapper.ts";
import type { MemoCreateArgs, MemoDeleteArgs, MemoListArgs, MemoUpdateArgs, MemoViewArgs } from "./handlers.ts";
import { MemoHandlers } from "./handlers.ts";
import { memoCreateSchema, memoDeleteSchema, memoListSchema, memoUpdateSchema, memoViewSchema } from "./schemas.ts";

export function registerMemoTools(server: McpServer, _config: BacklogConfig): void {
	const handlers = new MemoHandlers(server);

	const listMemosTool: McpToolHandler = createSimpleValidatedTool(
		{
			name: "memo_list",
			description:
				"List Backlog.md memos (throwaway notes), newest first, with optional date/tag filtering and offset/limit pagination ({ items, total, offset, limit, hasMore })",
			inputSchema: memoListSchema,
			annotations: { title: "List Memos", readOnlyHint: true, destructiveHint: false },
		},
		memoListSchema,
		async (input) => handlers.listMemos(input as MemoListArgs),
	);

	const viewMemoTool: McpToolHandler = createSimpleValidatedTool(
		{
			name: "memo_view",
			description: "View a Backlog.md memo including metadata and full markdown body",
			inputSchema: memoViewSchema,
			annotations: { title: "View Memo", readOnlyHint: true, destructiveHint: false },
		},
		memoViewSchema,
		async (input) => handlers.viewMemo(input as MemoViewArgs),
	);

	const createMemoTool: McpToolHandler = createSimpleValidatedTool(
		{
			name: "memo_create",
			description: "Create a Backlog.md memo with a markdown body and optional tags",
			inputSchema: memoCreateSchema,
			annotations: { title: "Create Memo", destructiveHint: false },
		},
		memoCreateSchema,
		async (input) => handlers.createMemo(input as MemoCreateArgs),
	);

	const updateMemoTool: McpToolHandler = createSimpleValidatedTool(
		{
			name: "memo_update",
			description:
				"Update an existing Backlog.md memo: replace its body with 'content' or append to it with 'append' (exactly one required), optionally replacing tags",
			inputSchema: memoUpdateSchema,
			annotations: { title: "Update Memo", destructiveHint: false },
		},
		memoUpdateSchema,
		async (input) => handlers.updateMemo(input as MemoUpdateArgs),
	);

	const deleteMemoTool: McpToolHandler = createSimpleValidatedTool(
		{
			name: "memo_delete",
			description: "Delete a Backlog.md memo by id",
			inputSchema: memoDeleteSchema,
			annotations: { title: "Delete Memo", destructiveHint: true },
		},
		memoDeleteSchema,
		async (input) => handlers.deleteMemo(input as MemoDeleteArgs),
	);

	server.addTool(listMemosTool);
	server.addTool(viewMemoTool);
	server.addTool(createMemoTool);
	server.addTool(updateMemoTool);
	server.addTool(deleteMemoTool);
}

export type { MemoCreateArgs, MemoDeleteArgs, MemoListArgs, MemoUpdateArgs, MemoViewArgs } from "./handlers.ts";
export { memoCreateSchema, memoDeleteSchema, memoListSchema, memoUpdateSchema, memoViewSchema } from "./schemas.ts";
