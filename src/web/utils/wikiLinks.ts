import { encodeWikiPath } from "./urlHelpers";

const URI_AUTOLINK_PREFIX_REGEX = /^<[A-Za-z][A-Za-z0-9+.-]{1,31}:[^<>\s]*>/;
const EMAIL_AUTOLINK_PREFIX_REGEX = /^<[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z0-9-]+>/;

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "svg", "webp", "avif", "bmp", "ico"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "ogv", "mov"]);
const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "ogg", "m4a", "flac", "aac", "opus", "wma"]);

type MediaType = "image" | "video" | "audio";

function getMediaType(filename: string): MediaType | null {
	const ext = (filename.match(/\.([^./]+)$/) || [])[1]?.toLowerCase() || "";
	if (IMAGE_EXTENSIONS.has(ext)) return "image";
	if (VIDEO_EXTENSIONS.has(ext)) return "video";
	if (AUDIO_EXTENSIONS.has(ext)) return "audio";
	return null;
}

function parseDimensions(sizeSpec: string): { width?: number; height?: number } | null {
	// "200" is treated as "200x0" (width only).
	const plainMatch = sizeSpec.match(/^(\d+)$/);
	if (plainMatch) {
		const width = Number.parseInt(plainMatch[1] as string, 10);
		return width > 0 ? { width } : null;
	}

	const match = sizeSpec.match(/^(\d+)?x(\d+)?$/i);
	if (!match) return null;
	const width = match[1] ? Number.parseInt(match[1] as string, 10) : 0;
	const height = match[2] ? Number.parseInt(match[2] as string, 10) : 0;
	if (width === 0 && height === 0) return null;
	return {
		width: width > 0 ? width : undefined,
		height: height > 0 ? height : undefined,
	};
}

function looksLikeDimensions(value: string): boolean {
	return parseDimensions(value) !== null;
}

interface ProtectedRange {
	start: number;
	end: number;
}

function isInsideRange(offset: number, ranges: ProtectedRange[]): boolean {
	for (const range of ranges) {
		if (offset >= range.start && offset < range.end) return true;
	}
	return false;
}

function getCodeProtectedRanges(source: string): ProtectedRange[] {
	const ranges: ProtectedRange[] = [];
	for (const match of source.matchAll(/```[\s\S]*?```/g)) {
		if (match.index === undefined) continue;
		ranges.push({ start: match.index, end: match.index + match[0].length });
	}
	for (const match of source.matchAll(/`[^`\n]+`/g)) {
		if (match.index === undefined) continue;
		ranges.push({ start: match.index, end: match.index + match[0].length });
	}
	return ranges;
}

function escapeHtml(text: string): string {
	return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function escapeAttr(value: string): string {
	return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function parseStyleString(style: string): Record<string, string> {
	const result: Record<string, string> = {};
	for (const declaration of style.split(";")) {
		const colonIndex = declaration.indexOf(":");
		if (colonIndex <= 0) continue;
		const rawProperty = declaration.slice(0, colonIndex).trim();
		const rawValue = declaration.slice(colonIndex + 1).trim();
		if (!rawProperty || !rawValue) continue;
		const property = rawProperty.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
		result[property] = rawValue;
	}
	return result;
}

function renderInlineMarkdownToHtml(text: string): string {
	let html = text;

	// Inline code spans and single-line fenced code blocks using 1-3 backticks.
	html = html.replace(/(`{1,3})([^`]+?)\1/g, (_, _delim: string, content: string) => {
		return `<code>${escapeHtml(content)}</code>`;
	});

	// Bold + italic.
	html = html.replace(/\*\*\*([^*]+?)\*\*\*/g, "<strong><em>$1</em></strong>");
	// Bold.
	html = html.replace(/\*\*([^*]+?)\*\*/g, "<strong>$1</strong>");
	// Italic.
	html = html.replace(/\*([^*]+?)\*/g, "<em>$1</em>");
	// Strikethrough.
	html = html.replace(/~~([^~]+?)~~/g, "<del>$1</del>");

	return html;
}

interface ParsedAttrs {
	className?: string;
	style?: string;
	id?: string;
	[key: string]: string | boolean | undefined;
}

function parseMarkdownAttrs(attrsString: string): ParsedAttrs {
	const result: ParsedAttrs = {};
	let className = "";
	let style = "";
	let id = "";

	const tokens: string[] = [];
	let current = "";
	let inQuotes = false;
	let quoteChar = "";

	for (const ch of attrsString) {
		if (!inQuotes && (ch === '"' || ch === "'")) {
			inQuotes = true;
			quoteChar = ch;
			current += ch;
		} else if (inQuotes && ch === quoteChar) {
			inQuotes = false;
			quoteChar = "";
			current += ch;
		} else if (!inQuotes && /\s/.test(ch)) {
			if (current.trim()) tokens.push(current.trim());
			current = "";
		} else {
			current += ch;
		}
	}
	if (current.trim()) tokens.push(current.trim());

	for (const token of tokens) {
		if (token.startsWith(".")) {
			className += (className ? " " : "") + token.slice(1);
		} else if (token.startsWith("#")) {
			id = token.slice(1);
		} else {
			const eqIndex = token.indexOf("=");
			if (eqIndex > 0) {
				const key = token.slice(0, eqIndex);
				let value = token.slice(eqIndex + 1);
				if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
					value = value.slice(1, -1);
				}
				if (key === "style") {
					style = value;
				} else {
					result[key] = value;
				}
			} else {
				result[token] = true;
			}
		}
	}

	if (className) result.className = className;
	if (style) result.style = style;
	if (id) result.id = id;
	return result;
}

function attrsToHtmlString(attrs: ParsedAttrs, marker?: string): string {
	const parts: string[] = marker ? [`data-${marker}="true"`] : [];
	if (attrs.id) parts.push(`id="${escapeAttr(attrs.id)}"`);
	if (attrs.className) parts.push(`class="${escapeAttr(attrs.className)}"`);
	if (attrs.style) parts.push(`style="${escapeAttr(attrs.style)}"`);
	for (const [key, value] of Object.entries(attrs)) {
		if (key === "id" || key === "className" || key === "style") continue;
		if (value === true) {
			parts.push(key);
		} else if (typeof value === "string") {
			parts.push(`${key}="${escapeAttr(value)}"`);
		}
	}
	return parts.join(" ");
}

function sanitizeWithRanges(source: string, protectedRanges: ProtectedRange[]): string {
	return source.replace(/<(?=[A-Za-z])/g, (match, offset) => {
		if (isInsideRange(offset, protectedRanges)) return match;
		const remaining = source.slice(offset);
		if (URI_AUTOLINK_PREFIX_REGEX.test(remaining) || EMAIL_AUTOLINK_PREFIX_REGEX.test(remaining)) {
			return match;
		}
		return "&lt;";
	});
}

/**
 * Resolve a wikilink path relative to the current wiki page path.
 * The current page is considered to live under the `wiki/` subdirectory;
 * resolved paths are relative to the backlog project root.
 * Returns null if the resolved path would escape the project root.
 */
export function resolveWikiPath(currentPagePath: string, linkPath: string): string | null {
	// Absolute paths are rejected on the frontend
	if (linkPath.startsWith("/")) return null;
	// No relative segments — already project-root-relative
	if (!linkPath.startsWith(".") && !linkPath.includes("/.")) return linkPath;

	// Treat the current page as residing under wiki/ for correct relative resolution,
	// unless it already lives inside wiki/ or wiki_output/.
	const actualCurrentPath =
		currentPagePath.startsWith("wiki/") || currentPagePath.startsWith("wiki_output/")
			? currentPagePath
			: `wiki/${currentPagePath}`;
	const currentDir = actualCurrentPath.split("/").slice(0, -1).join("/");
	const rawPath = currentDir ? `${currentDir}/${linkPath}` : linkPath;

	const parts = rawPath.split("/");
	const resolved: string[] = [];
	for (const part of parts) {
		if (part === "..") {
			if (resolved.length === 0) return null; // Would escape project root
			resolved.pop();
		} else if (part !== "." && part !== "") {
			resolved.push(part);
		}
	}
	return resolved.join("/");
}

function buildWikilinkHtml(inner: string, attrsRaw: string | undefined, basePath: string): string {
	const pipeIndex = inner.indexOf("|");
	const target = pipeIndex >= 0 ? inner.slice(0, pipeIndex).trim() : inner.trim();
	const alias = pipeIndex >= 0 ? inner.slice(pipeIndex + 1) : target;

	const resolved = resolveWikiPath(basePath, target);
	if (resolved === null) {
		return `<del>${escapeHtml(alias)}</del>`;
	}

	const href = `/wiki/${encodeWikiPath(resolved)}`;
	const attrs = attrsRaw ? parseMarkdownAttrs(attrsRaw.slice(1, -1)) : {};
	const attrsHtml = attrsToHtmlString(attrs, "wikilink");
	const aliasHtml = renderInlineMarkdownToHtml(alias);
	return `<a href="${escapeAttr(href)}" ${attrsHtml}>${aliasHtml}</a>`;
}

/**
 * Resolve a media path referenced by a wikilink.
 * Paths that do not start with a dot are treated as project-root-relative
 * (under the backlog directory). Paths that start with a dot are resolved
 * relative to the current page's directory.
 * Returns null if the resolved path would escape the project root.
 */
export function resolveMediaPath(currentPagePath: string, mediaPath: string): string | null {
	if (mediaPath.startsWith("/")) return null;

	let rawPath: string;
	if (mediaPath.startsWith(".")) {
		const actualCurrentPath =
			currentPagePath.startsWith("wiki/") || currentPagePath.startsWith("wiki_output/")
				? currentPagePath
				: `wiki/${currentPagePath}`;
		const currentDir = actualCurrentPath.split("/").slice(0, -1).join("/");
		rawPath = currentDir ? `${currentDir}/${mediaPath}` : mediaPath;
	} else {
		rawPath = mediaPath;
	}

	const parts = rawPath.split("/");
	const resolved: string[] = [];
	for (const part of parts) {
		if (part === "..") {
			if (resolved.length === 0) return null;
			resolved.pop();
		} else if (part !== "." && part !== "") {
			resolved.push(part);
		}
	}
	return resolved.join("/");
}

function buildWikilinkMediaHtml(inner: string, attrsRaw: string | undefined, basePath: string): string {
	const segments = inner.split("|").map((s) => s.trim());
	const target = segments[0] ?? "";

	// Support both `![[path|alt|200x0]]` and the shorthand `![[path|200x0]]`.
	let alt = "";
	let sizeSpec = "";
	if (segments.length === 2 && looksLikeDimensions(segments[1] ?? "")) {
		sizeSpec = segments[1] ?? "";
	} else {
		alt = segments[1] ?? "";
		sizeSpec = segments[2] ?? "";
	}

	const resolved = resolveMediaPath(basePath, target);
	if (resolved === null) {
		return `<del>${escapeHtml(alt || target)}</del>`;
	}

	const mediaType = getMediaType(resolved) ?? getMediaType(target) ?? "image";
	const assetPath = resolved.startsWith("assets/") ? resolved.slice("assets/".length) : resolved;
	const src = `/assets/${encodeWikiPath(assetPath)}`;
	const dimensions = sizeSpec ? parseDimensions(sizeSpec) : null;
	const attrs = attrsRaw ? parseMarkdownAttrs(attrsRaw.slice(1, -1)) : {};

	const dimensionParts: string[] = [];
	if (dimensions?.width) dimensionParts.push(`width="${dimensions.width}"`);
	if (dimensions?.height) dimensionParts.push(`height="${dimensions.height}"`);
	if (dimensions?.width || dimensions?.height) {
		attrs.style = attrs.style ? `${attrs.style}; max-width: 100%;` : "max-width: 100%;";
	}

	const attrsHtml = attrsToHtmlString(attrs, "wikilink-media");
	const escapedSrc = escapeAttr(src);

	if (mediaType === "image") {
		const commonAttrs = `src="${escapedSrc}" ${dimensionParts.join(" ")} ${attrsHtml}`.trim().replace(/\s+/g, " ");
		return `<img ${commonAttrs} alt="${escapeAttr(alt)}" />`;
	}
	if (mediaType === "video") {
		const commonAttrs = `src="${escapedSrc}" ${dimensionParts.join(" ")} ${attrsHtml}`.trim().replace(/\s+/g, " ");
		return `<video ${commonAttrs} controls preload="metadata"><a href="${escapedSrc}">${escapeHtml(alt || "Video")}</a></video>`;
	}
	if (mediaType === "audio") {
		// Audio controls do not support explicit dimensions; ignore the size spec.
		const attrsHtmlAudio = attrsToHtmlString(attrs, "wikilink-media");
		const commonAttrs = `src="${escapedSrc}" ${attrsHtmlAudio}`.trim().replace(/\s+/g, " ");
		return `<audio ${commonAttrs} controls preload="metadata"><a href="${escapedSrc}">${escapeHtml(alt || "Audio")}</a></audio>`;
	}
	return `<del>${escapeHtml(alt || target)}</del>`;
}

/**
 * Prepare wiki markdown for rendering by:
 * 1. Replacing `[[...]]` wikilinks (with optional alias and markdown-it-attrs) with
 *    raw `<a>` anchors so the existing markdown renderer can process them.
 * 2. Escaping stray `<` characters that would otherwise be parsed as HTML tags,
 *    while protecting code blocks, inline code, and the generated `<a>` tags.
 */
export function prepareWikiMarkdown(source: string, basePath: string): string {
	const codeRanges = getCodeProtectedRanges(source);

	const wikilinkRegex = /!?\[\[([\s\S]*?)\]\](\{[^{}]*\})?/g;
	let transformed = "";
	let lastIndex = 0;
	const wikiRanges: ProtectedRange[] = [];

	for (const match of source.matchAll(wikilinkRegex)) {
		if (match.index === undefined) continue;
		if (isInsideRange(match.index, codeRanges)) continue;

		transformed += source.slice(lastIndex, match.index);
		const isMedia = match[0].startsWith("!");
		const replacement = isMedia
			? buildWikilinkMediaHtml(match[1] as string, match[2] as string | undefined, basePath)
			: buildWikilinkHtml(match[1] as string, match[2] as string | undefined, basePath);
		const start = transformed.length;
		transformed += replacement;
		wikiRanges.push({ start, end: transformed.length });
		lastIndex = match.index + match[0].length;
	}
	transformed += source.slice(lastIndex);

	const allProtectedRanges = [...getCodeProtectedRanges(transformed), ...wikiRanges];
	return sanitizeWithRanges(transformed, allProtectedRanges);
}

export { parseStyleString };
