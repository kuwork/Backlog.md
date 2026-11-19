import matter from "gray-matter";

function normalizeFlowList(prefix: string, rawValue: string): string | null {
	// Handle inline lists like assignee: [@user, "someone"]
	const match = rawValue.match(/^\[(.*)\]\s*(#.*)?$/);
	if (!match) return null;

	const listBody = match[1] ?? "";
	const comment = match[2];
	const items = listBody
		.split(",")
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);

	const normalizedItems = items.map((entry) => {
		if (entry.startsWith("'") || entry.startsWith('"')) return entry;
		if (entry.startsWith("@")) {
			const escaped = entry.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
			return `"${escaped}"`;
		}
		return entry;
	});

	const trailingComment = comment ? ` ${comment}` : "";
	return `${prefix}[${normalizedItems.join(", ")}]${trailingComment}`;
}

function preprocessLegacyHandles(content: string): string {
	const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!match) return content;
	const processed = (match[1] || "")
		.split(/\r?\n/)
		.map((line) => {
			// Legacy task files allow unquoted assignee and reporter handles.
			const field = line.match(/^(\s*(?:assignee|reporter):\s*)(.*)$/);
			if (!field) return line;
			const prefix = field[1] ?? "";
			const value = (field[2] ?? "").trim();
			const normalizedFlowList = normalizeFlowList(prefix, value);
			if (normalizedFlowList !== null) return normalizedFlowList;
			if (
				value &&
				!value.startsWith("[") &&
				!value.startsWith("'") &&
				!value.startsWith('"') &&
				!value.startsWith("-")
			) {
				return `${prefix}"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
			}
			return line;
		})
		.join("\n");
	return content.replace(/^---\r?\n[\s\S]*?\r?\n---/, () => `---\n${processed}\n---`);
}

/**
 * The only place in the codebase that talks to gray-matter.
 *
 * gray-matter keeps a module-level cache of parse results keyed by the input string and hands the
 * same `data` object back to every later caller, so one caller mutating its result silently changes
 * what the next parse of identical content returns, and a malformed file only throws on its first
 * parse. Passing an options object skips the cache entirely (gray-matter 4.x only reads and writes
 * the cache when `options` is falsy), so every call here passes one.
 */
export function parseFrontmatter(content: string): { data: Record<string, unknown>; content: string } {
	const file = matter(preprocessLegacyHandles(content), {});
	return { data: file.data, content: file.content };
}

/** Serialize `data` as frontmatter above `content`. */
export function stringifyFrontmatter(content: string, data: Record<string, unknown>): string {
	return matter.stringify(content, data, {});
}
