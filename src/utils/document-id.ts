import { entityIdsEqual, findUniqueEntityById, normalizeEntityId } from "./entity-id.ts";

const DOCUMENT_PREFIX = "doc";

type DocumentIdentity = { id: string; title: string; path?: string };

const RESOLVE_GUIDANCE = "Rename or delete the conflicting files so exactly one of them carries this ID.";

export function normalizeDocumentId(id: string): string {
	return normalizeEntityId(DOCUMENT_PREFIX, id);
}

export function documentIdsEqual(left: string, right: string): boolean {
	return entityIdsEqual(DOCUMENT_PREFIX, left, right);
}

/** Resolves one document by ID, throwing on ambiguous matches instead of picking a winner. */
export function findDocumentById<T extends DocumentIdentity>(documents: readonly T[], id: string): T | null {
	return findUniqueEntityById(
		"Document",
		DOCUMENT_PREFIX,
		id,
		documents,
		(document) => document.path ?? document.title,
		RESOLVE_GUIDANCE,
	);
}
