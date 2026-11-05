import { isAbsolute, relative } from "node:path";

/**
 * Shared helpers for resolving Markdown references against the project root (BACK-835).
 *
 * The Web renderer joins a relative destination with the document path and emits a site-absolute
 * URL. The server then matches registered routes first and falls back to this nginx-style
 * try_files resolver: an ordered candidate list is probed and the first existing regular file
 * wins. Everything here is pure and side-effect free so it can be unit tested under Bun.
 */

export const MAX_REFERENCE_FILE_SIZE = 5 * 1024 * 1024;

/** Directories and dot-files that must never be served through a reference. */
const SENSITIVE_SEGMENTS = new Set([".git", ".env", ".temp"]);

/** Files whose bytes must never be rendered in the same origin as the app. */
export const ATTACHMENT_EXTS = new Set(["svg", "html", "htm"]);

/** Extension allowlist doubles as the MIME table for the static fallback and raw-file endpoint. */
export const REFERENCE_MIME_TYPES: Record<string, string> = {
	// Images
	png: "image/png",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	gif: "image/gif",
	svg: "image/svg+xml",
	webp: "image/webp",
	avif: "image/avif",
	bmp: "image/bmp",
	ico: "image/x-icon",
	// Video / audio
	mp4: "video/mp4",
	webm: "video/webm",
	ogv: "video/ogg",
	mov: "video/quicktime",
	mkv: "video/x-matroska",
	mp3: "audio/mpeg",
	wav: "audio/wav",
	ogg: "audio/ogg",
	m4a: "audio/mp4",
	flac: "audio/flac",
	aac: "audio/aac",
	opus: "audio/opus",
	wma: "audio/x-ms-wma",
	// Office / documents
	pdf: "application/pdf",
	doc: "application/msword",
	docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	xls: "application/vnd.ms-excel",
	xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	xlsm: "application/vnd.ms-excel.sheet.macroEnabled.12",
	ppt: "application/vnd.ms-powerpoint",
	pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
	// Text / code, so a joined Markdown or source link can also be served as bytes
	txt: "text/plain; charset=utf-8",
	md: "text/markdown; charset=utf-8",
	markdown: "text/markdown; charset=utf-8",
	json: "application/json; charset=utf-8",
	csv: "text/csv; charset=utf-8",
	css: "text/css; charset=utf-8",
	js: "application/javascript; charset=utf-8",
	mjs: "application/javascript; charset=utf-8",
	ts: "text/plain; charset=utf-8",
	tsx: "text/plain; charset=utf-8",
	html: "text/html; charset=utf-8",
	htm: "text/html; charset=utf-8",
	xml: "application/xml; charset=utf-8",
	yaml: "text/yaml; charset=utf-8",
	yml: "text/yaml; charset=utf-8",
};

export interface ReferenceParts {
	/** Path without the trailing :N or :N-M line range. */
	path: string;
	/** The trailing :N or :N-M suffix, or an empty string. */
	range: string;
}

/** Split a trailing line-range suffix off a reference path (readProjectFile understands it). */
export function splitReferenceRange(rawPath: string): ReferenceParts {
	const normalized = rawPath.replace(/\\/g, "/").replace(/^\/+/, "");
	const match = normalized.match(/^(.+?)(:\d+(?:-\d+)?)$/);
	if (!match) return { path: normalized, range: "" };
	return { path: match[1] ?? normalized, range: match[2] ?? "" };
}

/**
 * Project-relative path for a file whose surface stores it relative to its collection directory
 * (BACK-835). The render-time join pass folds `../` against the directory depth of the document,
 * so a collection-relative base (e.g. `PRDS/doc-1.md` inside <data-dir>/docs) makes a chain that
 * should reach a sibling collection look like a project-root escape and collapse to `#`.
 * `collectionRoot` is the collection directory relative to the project root, obtained with
 * `relative(root, collectionDir)` so custom data directory names need no hard-coded prefix.
 */
export function projectPathForCollection(collectionRoot: string, relativePath: string): string {
	const clean = (value: string) => value.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
	return [clean(collectionRoot), clean(relativePath)].filter(Boolean).join("/");
}

/**
 * Robust containment check: `relative` + `isAbsolute`, never `startsWith` on the joined path.
 * A first `..` segment means the target escapes the root; a sibling named `..foo` does not.
 */
export function isInsideProject(rootDir: string, targetPath: string): boolean {
	const rel = relative(rootDir, targetPath);
	if (!rel || isAbsolute(rel)) return false;
	const first = rel.split(/[\\/]/)[0];
	return first !== "..";
}

/** Dot-directories and environment files are never exposed through a reference. */
export function isSensitiveReference(projectRelativePath: string): boolean {
	const segments = projectRelativePath.replace(/\\/g, "/").split("/");
	return segments.some(
		(segment) => SENSITIVE_SEGMENTS.has(segment.toLowerCase()) || segment.toLowerCase().startsWith(".env"),
	);
}

/** Lower-case extension without the dot. */
export function referenceExtension(path: string): string {
	const match = path.match(/\.([^./\\]+)$/);
	return (match?.[1] ?? "").toLowerCase();
}

export function mimeForReference(path: string): string | null {
	return REFERENCE_MIME_TYPES[referenceExtension(path)] ?? null;
}

export function isAttachmentReference(path: string): boolean {
	return ATTACHMENT_EXTS.has(referenceExtension(path));
}

export interface ReferenceRoots {
	/** Project-relative path of the configured data directory (may contain several segments). */
	dataDir: string;
	/** Project-relative path of the docs collection directory. */
	docsDir: string;
}

/**
 * Ordered nginx-style candidates, expressed as project-relative paths. The server probes them in
 * order and takes the first existing regular file. Collection roots come from the configured data
 * directory, so a custom name (.backlog / custom) needs no hard-coded `backlog/` prefix.
 */
export function referenceCandidates(rawPath: string, roots: ReferenceRoots): string[] {
	const { path } = splitReferenceRange(rawPath);
	if (!path) return [];
	const clean = (value: string) => value.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
	const dataDirName = clean(roots.dataDir);
	const docsDirName = clean(roots.docsDir) || "docs";
	const collections = [
		"tasks",
		"completed",
		"decisions",
		"docs",
		"wiki",
		"wiki_output",
		"memos",
		"drafts",
		"milestones",
		"assets",
	];
	const prefix = (dir: string) => (dir ? `${dir}/` : "");

	const candidates: string[] = [
		// 1. Project root - the containment boundary. Sibling directories of the data directory
		//    are reachable through multi-level ../ joins that stay inside it.
		path,
		// 2. Configured data directory, then its assets folder.
		`${prefix(dataDirName)}${path}`,
		`${prefix(dataDirName)}assets/${path}`,
	];
	// 3. Collection roots, for surfaces whose filePath is collection-relative (BACK-833).
	for (const collection of collections) {
		candidates.push(`${prefix(dataDirName)}${collection}/${path}`);
	}
	// 4. An `assets/...` tail is the legacy body convention: a joined path such as
	//    backlog/docs/PRDS/assets/x.png still resolves to <data-dir>/assets/x.png.
	const assetsIndex = path.lastIndexOf("assets/");
	if (assetsIndex >= 0) {
		const tail = path.slice(assetsIndex);
		candidates.push(`${prefix(dataDirName)}${tail}`);
	}
	// 5. A docs-relative base without the data-directory prefix.
	candidates.push(`${prefix(dataDirName)}${docsDirName}/${path}`);

	const seen = new Set<string>();
	return candidates.filter((candidate) => {
		const normalized = candidate.replace(/\/+/g, "/");
		if (!normalized || seen.has(normalized)) return false;
		seen.add(normalized);
		return true;
	});
}
