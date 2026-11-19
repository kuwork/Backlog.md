import type { BacklogConfig } from "../../../types/index.ts";
import type { McpServer } from "../../server.ts";
import type { McpToolHandler } from "../../types.ts";
import { createSimpleValidatedTool } from "../../validation/tool-wrapper.ts";
import type {
	DocumentCreateArgs,
	DocumentDeleteArgs,
	DocumentFolderDeleteArgs,
	DocumentListArgs,
	DocumentSearchArgs,
	DocumentUpdateArgs,
	DocumentViewArgs,
} from "./handlers.ts";
import { DocumentHandlers } from "./handlers.ts";
import {
	documentCreateSchema,
	documentDeleteSchema,
	documentFolderDeleteSchema,
	documentListSchema,
	documentSearchSchema,
	documentUpdateSchema,
	documentViewSchema,
} from "./schemas.ts";

export function registerDocumentTools(server: McpServer, _config: BacklogConfig): void {
	const handlers = new DocumentHandlers(server);

	const listDocumentsTool: McpToolHandler = createSimpleValidatedTool(
		{
			name: "document_list",
			description: "List Backlog.md documents with optional substring filtering",
			inputSchema: documentListSchema,
			annotations: { title: "List Documents", readOnlyHint: true, destructiveHint: false },
		},
		documentListSchema,
		async (input) => handlers.listDocuments(input as DocumentListArgs),
	);

	const viewDocumentTool: McpToolHandler = createSimpleValidatedTool(
		{
			name: "document_view",
			description: "View a Backlog.md document including metadata and markdown content",
			inputSchema: documentViewSchema,
			annotations: { title: "View Document", readOnlyHint: true, destructiveHint: false },
		},
		documentViewSchema,
		async (input) => handlers.viewDocument(input as DocumentViewArgs),
	);

	const createDocumentTool: McpToolHandler = createSimpleValidatedTool(
		{
			name: "document_create",
			description:
				"Create a Backlog.md document using the shared core document pipeline, with optional docs subdirectory path",
			inputSchema: documentCreateSchema,
			annotations: { title: "Create Document", destructiveHint: false },
		},
		documentCreateSchema,
		async (input) => handlers.createDocument(input as DocumentCreateArgs),
	);

	const updateDocumentTool: McpToolHandler = createSimpleValidatedTool(
		{
			name: "document_update",
			description:
				"Update an existing Backlog.md document's content, optional title, metadata, and optional docs subdirectory path; also supports newId for ID updates and sourcePath for exact source selection",
			inputSchema: documentUpdateSchema,
			annotations: { title: "Update Document", destructiveHint: false },
		},
		documentUpdateSchema,
		async (input) => handlers.updateDocument(input as DocumentUpdateArgs),
	);

	const deleteDocumentTool: McpToolHandler = createSimpleValidatedTool(
		{
			name: "document_delete",
			description: "Delete a Backlog.md document by id, code-name short path, title, or full filename",
			inputSchema: documentDeleteSchema,
			annotations: { title: "Delete Document", destructiveHint: true },
		},
		documentDeleteSchema,
		async (input) => handlers.deleteDocument(input as DocumentDeleteArgs),
	);

	const deleteDocsFolderTool: McpToolHandler = createSimpleValidatedTool(
		{
			name: "document_folder_delete",
			description: "Recursively delete a docs folder and every document beneath it",
			inputSchema: documentFolderDeleteSchema,
			annotations: { title: "Delete Docs Folder", destructiveHint: true },
		},
		documentFolderDeleteSchema,
		async (input) => handlers.deleteDocsFolder(input as DocumentFolderDeleteArgs),
	);

	const searchDocumentTool: McpToolHandler = createSimpleValidatedTool(
		{
			name: "document_search",
			description: "Search Backlog.md documents using the shared fuzzy index",
			inputSchema: documentSearchSchema,
			annotations: { title: "Search Documents", readOnlyHint: true, destructiveHint: false },
		},
		documentSearchSchema,
		async (input) => handlers.searchDocuments(input as DocumentSearchArgs),
	);

	server.addTool(listDocumentsTool);
	server.addTool(viewDocumentTool);
	server.addTool(createDocumentTool);
	server.addTool(updateDocumentTool);
	server.addTool(deleteDocumentTool);
	server.addTool(deleteDocsFolderTool);
	server.addTool(searchDocumentTool);
}

export type {
	DocumentCreateArgs,
	DocumentDeleteArgs,
	DocumentFolderDeleteArgs,
	DocumentListArgs,
	DocumentSearchArgs,
	DocumentUpdateArgs,
	DocumentViewArgs,
} from "./handlers.ts";
export {
	documentCreateSchema,
	documentDeleteSchema,
	documentFolderDeleteSchema,
	documentListSchema,
	documentSearchSchema,
	documentUpdateSchema,
	documentViewSchema,
} from "./schemas.ts";
