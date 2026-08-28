import { AmbiguousIdError, entityIdsEqual, findUniqueEntityById, normalizeEntityId } from "./entity-id.ts";

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

const REFERENCE_GUIDANCE = "Rename or delete the conflicting files so exactly one of them matches this reference.";

function stripMarkdownExtension(value: string): string {
	return value.replace(/\.md$/i, "");
}

function toLookupKey(value: string): string {
	return value.trim().toLowerCase();
}

/**
 * Extract the document ID from a document filename.
 * Handles both `doc-1.md` and `doc-1 - Title.md` forms.
 */
export function documentFilenameId(filename: string): string | null {
	const withoutExtension = stripMarkdownExtension(filename.trim());
	if (!withoutExtension) return null;
	const separatorIndex = withoutExtension.indexOf(" - ");
	if (separatorIndex < 0) return normalizeDocumentId(withoutExtension);
	return normalizeDocumentId(withoutExtension.slice(0, separatorIndex));
}

/**
 * Normalized original-case docs-relative path plus its "<directory>/<filename id>" stem,
 * or null when the path cannot address a file.
 */
function documentPathShape(path: string): { full: string; stem: string } | null {
	const segments = path.split(/[\\/]+/).filter((segment) => segment.length > 0 && segment !== ".");
	if (segments.length === 0 || segments.some((segment) => segment === "..")) return null;
	const full = stripMarkdownExtension(segments.join("/"));
	if (!full) return null;
	const slashIndex = full.lastIndexOf("/");
	const dir = slashIndex >= 0 ? full.slice(0, slashIndex + 1) : "";
	const base = slashIndex >= 0 ? full.slice(slashIndex + 1) : full;
	const separatorIndex = base.indexOf(" - ");
	const stem = separatorIndex >= 0 ? `${dir}${base.slice(0, separatorIndex)}` : full;
	return { full, stem };
}

/** Path-form lookup keys: full path sans extension plus the "<directory>/<filename id>" stem. */
function storedPathLookupKeys(path: string | undefined): string[] {
	if (!path) return [];
	const shape = documentPathShape(path);
	if (!shape) return [];
	// Without an id-title separator the stem equals the full path, so one key covers both forms.
	return shape.stem === shape.full ? [toLookupKey(shape.full)] : [toLookupKey(shape.full), toLookupKey(shape.stem)];
}

/** Filename-slug lookup keys: whole basename sans extension plus its title slug after "<id> - ". */
function filenameSlugKeys(path: string | undefined): string[] {
	const base = (path ?? "").split(/[\\/]/).pop() ?? "";
	const withoutExtension = stripMarkdownExtension(base.trim());
	if (!withoutExtension) return [];
	const separatorIndex = withoutExtension.indexOf(" - ");
	if (separatorIndex < 0) return [toLookupKey(withoutExtension)];
	return [toLookupKey(withoutExtension), toLookupKey(withoutExtension.slice(separatorIndex + 3))];
}

/**
 * Shortest doc-view reference that addresses each ambiguous candidate alone: the
 * "<directory>/<filename id>" stem when unique across candidates, otherwise the full
 * docs-relative path sans extension. Candidates without a path separator pass through as-is.
 */
export function documentReferenceSuggestions(candidates: readonly string[]): string[] {
	const resolved = candidates.map((candidate) => {
		const shape = candidate.includes("/") || candidate.includes("\\") ? documentPathShape(candidate) : null;
		return shape ?? { stem: candidate.trim(), full: candidate.trim() };
	});
	const stemCounts = new Map<string, number>();
	for (const { stem } of resolved) {
		stemCounts.set(stem, (stemCounts.get(stem) ?? 0) + 1);
	}
	return resolved.map(({ stem, full }) => (stemCounts.get(stem) === 1 ? stem : full));
}

/** Normalized docs-relative path key for a user-supplied reference, or null when unusable. */
function referencePathKey(reference: string): string | null {
	const segments = reference
		.trim()
		.replace(/\\/g, "/")
		.split("/")
		.filter((segment) => segment.length > 0 && segment !== ".");
	if (segments.length === 0 || segments.some((segment) => segment === "..")) return null;
	if (/^[a-zA-Z]:$/.test(segments[0] ?? "")) return null;
	return toLookupKey(stripMarkdownExtension(segments.join("/")));
}

/** Returns the single match, throws listing candidates on several, and returns null on none. */
function uniqueDocumentMatch<T extends DocumentIdentity>(matches: readonly T[], reference: string): T | null {
	if (matches.length > 1) {
		throw new AmbiguousIdError(
			"Document",
			reference,
			matches.map((document) => document.path ?? document.title),
			REFERENCE_GUIDANCE,
			`Document reference "${reference}"`,
		);
	}
	return matches[0] ?? null;
}

/**
 * Resolves one document from a user-supplied CLI reference, trying forms in order:
 *
 * 1. Bare/frontmatter ID - identical to {@link findDocumentById}, still fail-closed there.
 * 2. Docs-relative path - full relative path or "<directory>/<filename id>", with optional .md.
 * 3. Filename title slug - basename sans extension or its title portion after "<id> - ".
 *
 * Every form must match at most one file; otherwise an {@link AmbiguousIdError} lists the
 * candidates instead of guessing which file the user meant.
 */
export function findDocumentByReference<T extends DocumentIdentity>(
	documents: readonly T[],
	reference: string,
): T | null {
	// An ambiguous ID must fail closed here; later forms must not rescue a bare-ID collision.
	findDocumentById(documents, reference);

	const pathKey = referencePathKey(reference);
	if (pathKey !== null) {
		const match = uniqueDocumentMatch(
			documents.filter((document) => storedPathLookupKeys(document.path).includes(pathKey)),
			reference,
		);
		if (match) return match;
	}

	const slugKey = toLookupKey(stripMarkdownExtension(reference));
	if (slugKey) {
		const match = uniqueDocumentMatch(
			documents.filter((document) => filenameSlugKeys(document.path).includes(slugKey)),
			reference,
		);
		if (match) return match;
	}

	return null;
}
