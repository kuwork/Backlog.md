/**
 * Render-time local path joining (BACK-835).
 *
 * Markdown bodies are written next to the files they reference, but the browser resolves a bare
 * `src` / `href` against the page URL. The join pass rewrites every local destination into a
 * site-absolute URL path built from the path of the document being rendered, so the emitted
 * `<img src>` / `<a href>` already carries the resolved location. The server then treats that
 * path as a route and falls back to its try_files resolver.
 *
 * This module is deliberately pure (no DOM, no node:path) so it can run both in the browser and
 * under `bun test`.
 */

export interface JoinedTarget {
	/** The destination to write into the Markdown source. Rejected targets become a dead `#` anchor. */
	href: string;
	/** True when the target was refused (escape, protocol-relative URL, malformed value). */
	rejected: boolean;
}

const EXTERNAL_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const SAFE_SCHEME = /^(?:https?|ftp|mailto|tel|data):/i;
const LINE_RANGE = /^(.+?)(:\d+(?:-\d+)?)$/;

interface SplitTarget {
	path: string;
	range: string;
	query: string;
	fragment: string;
	enclosed: boolean;
}

/** Split a Markdown destination into the parts that must not be joined with the document path. */
function splitTarget(raw: string): SplitTarget {
	let value = raw.trim();
	const enclosed = value.startsWith("<") && value.endsWith(">");
	if (enclosed) value = value.slice(1, -1);

	let fragment = "";
	const hashIndex = value.indexOf("#");
	if (hashIndex >= 0) {
		fragment = value.slice(hashIndex);
		value = value.slice(0, hashIndex);
	}
	let query = "";
	const queryIndex = value.indexOf("?");
	if (queryIndex >= 0) {
		query = value.slice(queryIndex);
		value = value.slice(0, queryIndex);
	}
	let range = "";
	const rangeMatch = LINE_RANGE.exec(value);
	if (rangeMatch) {
		value = rangeMatch[1] ?? value;
		range = rangeMatch[2] ?? "";
	}
	return { path: value, range, query, fragment, enclosed };
}

/** Decode an already escaped segment once; a literal `%` is kept instead of throwing. */
function decodeSegment(segment: string): string {
	try {
		return decodeURIComponent(segment);
	} catch {
		return segment;
	}
}

/** Percent-encode every path segment so a filename cannot inject an HTML attribute or a URL. */
function encodePath(posixPath: string): string {
	return posixPath
		.split("/")
		.map((segment) => encodeURIComponent(decodeSegment(segment)))
		.join("/");
}

/** POSIX `.` / `..` folding. An empty stack on `..` means the join escaped the project root. */
function normalizeJoin(baseDir: string, targetPath: string): string | null {
	const segments = `${baseDir}/${targetPath}`.replace(/\\/g, "/").split("/");
	const resolved: string[] = [];
	for (const segment of segments) {
		if (!segment || segment === ".") continue;
		if (segment === "..") {
			if (resolved.length === 0) return null;
			resolved.pop();
			continue;
		}
		resolved.push(segment);
	}
	return resolved.length > 0 ? resolved.join("/") : null;
}

/**
 * Join one local Markdown destination with the document path.
 *
 * A leading `/` is a URL (entity short links, `/assets/paste/...`, SPA routes) and is returned
 * unchanged. External URLs, hash anchors and query-only destinations are untouched too. Every
 * other destination is a relative path: `./`, `../` and bare names are folded against
 * `dirname(basePath)` and emitted as a site-absolute URL path. Multi-level `../` chains are
 * allowed as long as they stay inside the project root; escaping is rejected.
 */
export function joinMarkdownTarget(basePath: string | undefined, target: string): JoinedTarget {
	const raw = target.trim();
	if (!raw) return { href: target, rejected: false };

	// Protocol-relative destinations would turn into an external navigation once the browser
	// sees them. Refuse them here instead of emitting a working tag.
	if (raw.startsWith("//")) return { href: "#", rejected: true };

	// URL / route layer: never joined with a local path.
	if (raw.startsWith("/")) return { href: target, rejected: false };
	if (raw.startsWith("#") || raw.startsWith("?")) return { href: target, rejected: false };

	// Split the trailing :N / :N-M suffix first. A bare `doc-5.md:12` must not be mistaken for an
	// URL scheme just because a colon precedes the digits.
	const parts = splitTarget(raw);
	if (!parts.path) return { href: target, rejected: false };
	if (EXTERNAL_SCHEME.test(parts.path)) {
		return SAFE_SCHEME.test(parts.path) ? { href: target, rejected: false } : { href: "#", rejected: true };
	}

	// Without a document path there is no base to join against. Keep the destination as written
	// so surfaces that do not know their file do not silently break their existing links.
	if (!basePath) return { href: target, rejected: false };

	const base = basePath.replace(/\\/g, "/").replace(/^\/+/, "");
	const baseDir = base.includes("/") ? base.slice(0, base.lastIndexOf("/")) : "";
	const joined = normalizeJoin(baseDir, parts.path.replace(/\\/g, "/"));
	if (!joined) return { href: "#", rejected: true };

	const href = `/${encodePath(joined)}${parts.range}${parts.query}${parts.fragment}`;
	return { href, rejected: false };
}

/** Code fences and inline code spans must never be rewritten. */
function protectedRanges(source: string): { start: number; end: number }[] {
	const ranges: { start: number; end: number }[] = [];
	for (const match of source.matchAll(/```[\s\S]*?```/g)) {
		const start = match.index ?? 0;
		ranges.push({ start, end: start + match[0].length });
	}
	for (const match of source.matchAll(/`[^`\n]+`/g)) {
		const start = match.index ?? 0;
		ranges.push({ start, end: start + match[0].length });
	}
	return ranges;
}

function isProtected(offset: number, ranges: { start: number; end: number }[]): boolean {
	for (const range of ranges) {
		if (offset >= range.start && offset < range.end) return true;
	}
	return false;
}

/**
 * Rewrite every local Markdown link / image destination (and raw HTML `src` / `href` attributes
 * used by `<video>`, `<audio>` and `<img>`) into a joined site-absolute URL path.
 */
export function processMarkdownLocalPaths(source: string, basePath?: string): string {
	if (!basePath) return source;
	const ranges = protectedRanges(source);

	let result = source.replace(/(!?\[[^\]]*\])\(([^)]+)\)/g, (match, ...args) => {
		const offset = args[args.length - 2] as number;
		if (isProtected(offset, ranges)) return match;
		const prefix = args[0] as string;
		const destination = args[1] as string;
		const { href } = joinMarkdownTarget(basePath, destination);
		return `${prefix}(${href})`;
	});

	// Raw HTML media tags are not Markdown links. Only rewrite attributes whose value is a local
	// path; URL-layer values (leading `/`, external schemes, anchors) come back unchanged.
	result = result.replace(
		/(<(?:img|video|audio|source|a)\b[^>]*?\b(?:src|href)\s*=\s*)(["'])([^"']*)\2/gi,
		(match, ...args) => {
			const offset = args[args.length - 2] as number;
			if (isProtected(offset, ranges)) return match;
			const opening = args[0] as string;
			const quote = args[1] as string;
			const destination = args[2] as string;
			const { href } = joinMarkdownTarget(basePath, destination);
			return `${opening}${quote}${href}${quote}`;
		},
	);
	return result;
}
