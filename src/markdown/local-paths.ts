/**
 * Pure Markdown local-path handling shared by the web renderer and file rename plans.
 * No DOM or node:path dependency is used so the same code runs in browsers and tests.
 */

export interface MarkdownJoinOptions {
	/** Project-relative root of the wiki collection, when rendering a wiki page. */
	wikiRoot?: string;
}

export interface JoinedTarget {
	href: string;
	rejected: boolean;
}

export interface SplitMarkdownTarget {
	path: string;
	range: string;
	query: string;
	fragment: string;
	enclosed: boolean;
}

const EXTERNAL_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const SAFE_SCHEME = /^(?:https?|ftp|mailto|tel|data):/i;
const LOCAL_FILE_EXTENSION = /\.[A-Za-z0-9]+$/;
const LINE_RANGE = /^(.+?)(:\d+(?:-\d+)?)$/;
const EXT_RANGE = /^(.+?)(\.[A-Za-z0-9]+):([^/\\?#]+)$/;
const PAGE_RANGE_TOKEN = /^[Pp]\d+(?:-[Pp]?\d+)?$/;
const LINE_RANGE_TOKEN = /^\d+(?:-\d+)?$/;
const SHEET_EXTENSIONS = new Set(["xlsx", "xlsm"]);
const PAGED_EXTENSIONS = new Set(["pdf", "docx", "pptx"]);

function acceptsRangeToken(ext: string, token: string): boolean {
	if (SHEET_EXTENSIONS.has(ext)) return token.length > 0;
	if (PAGED_EXTENSIONS.has(ext)) return PAGE_RANGE_TOKEN.test(token);
	return LINE_RANGE_TOKEN.test(token);
}

/** Split a destination into the path and suffixes that must be preserved during a rewrite. */
export function splitMarkdownTarget(raw: string): SplitMarkdownTarget {
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
	if (extRangeMatch && acceptsRangeToken(ext, token)) {
		value = `${extRangeMatch[1] ?? value}${extRangeMatch[2] ?? ""}`;
		range = `:${encodeRangeToken(decodeMarkdownSegment(token))}`;
	} else {
		const rangeMatch = LINE_RANGE.exec(value);
		if (rangeMatch) {
			value = rangeMatch[1] ?? value;
			range = rangeMatch[2] ?? "";
		}
	}
	return { path: value, range, query, fragment, enclosed };
}

function encodeRangeToken(token: string): string {
	return encodeURIComponent(token).replace(/\(/g, "%28").replace(/\)/g, "%29").replace(/'/g, "%27");
}

export function decodeMarkdownSegment(segment: string): string {
	try {
		return decodeURIComponent(segment);
	} catch {
		return segment;
	}
}

export function encodeMarkdownPath(posixPath: string): string {
	return posixPath
		.split("/")
		.map((segment) => encodeURIComponent(decodeMarkdownSegment(segment)))
		.join("/");
}

/** Fold POSIX `.` and `..` segments. Null means the path escaped above its root. */
export function normalizeMarkdownJoin(baseDir: string, targetPath: string): string | null {
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

export function joinMarkdownTarget(
	basePath: string | undefined,
	target: string,
	options?: MarkdownJoinOptions,
): JoinedTarget {
	const raw = target.trim();
	if (!raw) return { href: target, rejected: false };
	if (raw.startsWith("//")) return { href: "#", rejected: true };
	if (raw.startsWith("/")) return { href: target, rejected: false };
	if (raw.startsWith("#") || raw.startsWith("?")) return { href: target, rejected: false };

	const parts = splitMarkdownTarget(raw);
	if (!parts.path) return { href: target, rejected: false };
	if (parts.enclosed && parts.path.startsWith("/")) {
		if (parts.path.startsWith("//")) return { href: "#", rejected: true };
		return {
			href: `${encodeMarkdownPath(parts.path)}${parts.range}${parts.query}${parts.fragment}`,
			rejected: false,
		};
	}
	if (EXTERNAL_SCHEME.test(parts.path)) {
		if (SAFE_SCHEME.test(parts.path)) return { href: target, rejected: false };
		if (!parts.path.includes("//") && LOCAL_FILE_EXTENSION.test(parts.path)) {
			// A colon inside a local filename is not an external URI scheme.
		} else {
			return { href: "#", rejected: true };
		}
	}
	if (!basePath) return { href: target, rejected: false };

	const base = basePath.replace(/\\/g, "/").replace(/^\/+/, "");
	const baseDir = base.includes("/") ? base.slice(0, base.lastIndexOf("/")) : "";
	const joined = normalizeMarkdownJoin(baseDir, parts.path.replace(/\\/g, "/"));
	if (!joined) return { href: "#", rejected: true };

	const wikiRoot = options?.wikiRoot?.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
	const targetExt = parts.path.match(/\.([A-Za-z0-9]+)$/)?.[1]?.toLowerCase();
	const isWikiPageTarget = targetExt === undefined || targetExt === "md" || targetExt === "markdown";
	if (wikiRoot && isWikiPageTarget && (joined === wikiRoot || joined.startsWith(`${wikiRoot}/`))) {
		const wikiPage = joined.slice(wikiRoot.length).replace(/^\//, "");
		if (wikiPage) {
			const href = `/wiki/${encodeMarkdownPath(wikiPage)}${parts.range}${parts.query}${parts.fragment}`;
			return { href, rejected: false };
		}
	}

	return { href: `/${encodeMarkdownPath(joined)}${parts.range}${parts.query}${parts.fragment}`, rejected: false };
}

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
	return ranges.some((range) => offset >= range.start && offset < range.end);
}

/** Rewrite Markdown links, images and raw HTML link/media attributes outside code spans. */
export function mapMarkdownTargets(source: string, mapTarget: (target: string) => string): string {
	const markdownRanges = protectedRanges(source);
	let result = source.replace(/(!?\[[^\]]*\])\(([^)]+)\)/g, (match, ...args) => {
		const offset = args[args.length - 2] as number;
		if (isProtected(offset, markdownRanges)) return match;
		const prefix = args[0] as string;
		const destination = args[1] as string;
		return `${prefix}(${mapTarget(destination)})`;
	});

	const htmlRanges = protectedRanges(result);
	result = result.replace(
		/(<(?:img|video|audio|source|a)\b[^>]*?\b(?:src|href)\s*=\s*)(["'])([^"']*)\2/gi,
		(match, ...args) => {
			const offset = args[args.length - 2] as number;
			if (isProtected(offset, htmlRanges)) return match;
			const opening = args[0] as string;
			const quote = args[1] as string;
			const destination = args[2] as string;
			return `${opening}${quote}${mapTarget(destination)}${quote}`;
		},
	);
	return result;
}

export function processMarkdownLocalPaths(source: string, basePath?: string, options?: MarkdownJoinOptions): string {
	if (!basePath) return source;
	return mapMarkdownTargets(source, (target) => joinMarkdownTarget(basePath, target, options).href);
}
