/**
 * Render-time local path joining (BACK-835, BACK-837).
 *
 * Markdown bodies are written next to the files they reference, but the browser resolves a bare
 * `src` / `href` against the page URL. The join pass rewrites every local destination into a
 * site-absolute URL path built from the path of the document being rendered, so the emitted
 * `<img src>` / `<a href>` already carries the resolved location. The server then treats that
 * path as a route and falls back to its try_files resolver.
 *
 * Wiki pages need one extra distinction: a joined target that stays inside the wiki collection is
 * a wiki page and must use the `/wiki/<page>` route, while a target in docs/, decisions/ or any
 * other sibling collection is an ordinary project file and keeps the site-absolute file URL.
 *
 * This module is deliberately pure (no DOM, no node:path) so it can run both in the browser and
 * under `bun test`.
 */

export interface MarkdownJoinOptions {
	/**
	 * Project-relative root of the wiki collection, e.g. `backlog/wiki`. Supplied only when the
	 * body being rendered is a wiki page. The API derives it, so custom data directory names are
	 * honoured without hard-coding a `backlog/` prefix here.
	 */
	wikiRoot?: string;
}

export interface JoinedTarget {
	/** The destination to write into the Markdown source. Rejected targets become a dead `#` anchor. */
	href: string;
	/** True when the target was refused (escape, protocol-relative URL, malformed value). */
	rejected: boolean;
}

const EXTERNAL_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const SAFE_SCHEME = /^(?:https?|ftp|mailto|tel|data):/i;
// A colon can also live *inside* a filename (`v2:12.md`, `报告:2024版.md`). Such a destination has
// no authority (`//`) and ends in a file extension, so it is a local path rather than a URI scheme;
// it is percent-encoded into a site-absolute path below, which is safe. Real schemes either carry
// `//` or have an opaque body with no extension (e.g. `javascript:alert(1)`).
const LOCAL_FILE_EXTENSION = /\.[A-Za-z0-9]+$/;
const LINE_RANGE = /^(.+?)(:\d+(?:-\d+)?)$/;
// Range suffix anchored to a file extension: `<path>.<ext>:<token>`. Anchoring the colon right
// after the extension stops a colon that lives *inside* the filename - a Chinese fullwidth colon
// `：` or an ASCII `:` such as `报告:2024版.md` - from being mistaken for the range separator.
// `splitTarget` falls back to LINE_RANGE when no extension is present.
//
// The token itself is accepted by extension (BACK-838): workbooks take a sheet index (`p1`,
// `p1-p2`) or a sheet name, paged Office formats take `P1-P4` / `P1` only, and every other
// extension keeps its plain-text `12-20` line range. The `P` is what separates "pages 1-4 of a
// document" from "lines 1-4 of a text file", so a bare `1-4` is never a page range. Anything
// else stays part of the path, so a bogus colon is never silently turned into a range.
const EXT_RANGE = /^(.+?)(\.[A-Za-z0-9]+):([^/\\?#]+)$/;
const PAGE_RANGE_TOKEN = /^[Pp]\d+(?:-[Pp]?\d+)?$/;
const LINE_RANGE_TOKEN = /^\d+(?:-\d+)?$/;
const SHEET_EXTENSIONS = new Set(["xlsx", "xlsm"]);
const PAGED_EXTENSIONS = new Set(["pdf", "docx", "pptx"]);

/** True when `token` is a range for a destination ending in `ext`. */
function acceptsRangeToken(ext: string, token: string): boolean {
	if (SHEET_EXTENSIONS.has(ext)) return token.length > 0;
	if (PAGED_EXTENSIONS.has(ext)) return PAGE_RANGE_TOKEN.test(token);
	return LINE_RANGE_TOKEN.test(token);
}

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
	const extRangeMatch = EXT_RANGE.exec(value);
	const ext = (extRangeMatch?.[2] ?? "").replace(".", "").toLowerCase();
	const token = extRangeMatch?.[3] ?? "";
	const rangeAccepted = extRangeMatch !== null && acceptsRangeToken(ext, token);
	if (extRangeMatch && rangeAccepted) {
		// Extension-anchored range wins: the colon sits right after `.<ext>`, so any colon that is
		// part of the filename (Chinese `：` or ASCII `:`) is left in the path, never read as a range.
		value = `${extRangeMatch[1] ?? value}${extRangeMatch[2] ?? ""}`;
		// Decode once before encoding: `:Q1%20Sales` is already escaped in the source, and a
		// second encode would emit `%2520`.
		range = `:${encodeRangeToken(decodeSegment(token))}`;
	} else {
		const rangeMatch = LINE_RANGE.exec(value);
		if (rangeMatch) {
			value = rangeMatch[1] ?? value;
			range = rangeMatch[2] ?? "";
		}
	}
	return { path: value, range, query, fragment, enclosed };
}

/** Percent-encode a range token so a sheet name with spaces or brackets stays inside the destination. */
function encodeRangeToken(token: string): string {
	return encodeURIComponent(token).replace(/\(/g, "%28").replace(/\)/g, "%29").replace(/'/g, "%27");
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
 *
 * With `options.wikiRoot`, a markdown-ish target that resolves inside the wiki collection is
 * emitted as `/wiki/<page>` instead; every other target stays a project file URL (BACK-837).
 */
export function joinMarkdownTarget(
	basePath: string | undefined,
	target: string,
	options?: MarkdownJoinOptions,
): JoinedTarget {
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
	// `<...>` is CommonMark's legal form for a destination holding spaces, but the brackets are
	// stripped before joining. An absolute site path inside them is still a URL-layer destination
	// (e.g. `</backlog/docs/report.md:10-20>`), not a relative path to fold against the document.
	if (parts.enclosed && parts.path.startsWith("/")) {
		if (parts.path.startsWith("//")) return { href: "#", rejected: true };
		return {
			href: `${encodePath(parts.path)}${parts.range}${parts.query}${parts.fragment}`,
			rejected: false,
		};
	}
	if (EXTERNAL_SCHEME.test(parts.path)) {
		if (SAFE_SCHEME.test(parts.path)) return { href: target, rejected: false };
		// `v2:12.md` looks like a scheme but is a filename holding an ASCII colon. Only reject the
		// destination when it actually behaves like an opaque URI (no local file extension).
		if (!parts.path.includes("//") && LOCAL_FILE_EXTENSION.test(parts.path)) {
			// Fall through to the local-path join below.
		} else {
			return { href: "#", rejected: true };
		}
	}

	// Without a document path there is no base to join against. Keep the destination as written
	// so surfaces that do not know their file do not silently break their existing links.
	if (!basePath) return { href: target, rejected: false };

	const base = basePath.replace(/\\/g, "/").replace(/^\/+/, "");
	const baseDir = base.includes("/") ? base.slice(0, base.lastIndexOf("/")) : "";
	const joined = normalizeJoin(baseDir, parts.path.replace(/\\/g, "/"));
	if (!joined) return { href: "#", rejected: true };

	// Wiki pages: a relative link to a sibling wiki page must use the /wiki/ route so the page is
	// rendered as a wiki page (with its frontmatter, wikilinks and optional :N-M section preview).
	// A target in docs/, decisions/ or any other sibling collection stays a project file URL and
	// goes through the shared file/Office preview. Media and other non-markdown files inside the
	// wiki directory are files too, not pages.
	const wikiRoot = options?.wikiRoot?.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
	const targetExt = parts.path.match(/\.([A-Za-z0-9]+)$/)?.[1]?.toLowerCase();
	const isWikiPageTarget = targetExt === undefined || targetExt === "md" || targetExt === "markdown";
	if (wikiRoot && isWikiPageTarget && (joined === wikiRoot || joined.startsWith(`${wikiRoot}/`))) {
		const wikiPage = joined.slice(wikiRoot.length).replace(/^\//, "");
		if (wikiPage) {
			// `encodePath` decodes each segment once before re-encoding it. The composer pass that
			// makes CommonMark-legal destinations (%20 for spaces) has already run, so a plain
			// encodeURIComponent here would turn `Another%20Page.md` into `Another%2520Page.md`
			// and the wiki API would look for a file whose name literally contains "%20".
			const href = `/wiki/${encodePath(wikiPage)}${parts.range}${parts.query}${parts.fragment}`;
			return { href, rejected: false };
		}
	}

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
export function processMarkdownLocalPaths(source: string, basePath?: string, options?: MarkdownJoinOptions): string {
	if (!basePath) return source;
	const ranges = protectedRanges(source);

	let result = source.replace(/(!?\[[^\]]*\])\(([^)]+)\)/g, (match, ...args) => {
		const offset = args[args.length - 2] as number;
		if (isProtected(offset, ranges)) return match;
		const prefix = args[0] as string;
		const destination = args[1] as string;
		const { href } = joinMarkdownTarget(basePath, destination, options);
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
			const { href } = joinMarkdownTarget(basePath, destination, options);
			return `${opening}${quote}${href}${quote}`;
		},
	);
	return result;
}
