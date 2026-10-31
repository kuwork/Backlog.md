import { readFile, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { replaceFile } from "../file-system/atomic-write.ts";
import { isNonRelativeSource, segmentsInsideProject } from "../sqlite/paths.ts";

/** A fenced query block can only live in Markdown, so that is all this writes. */
const MARKDOWN_EXTS = new Set([".md", ".markdown"]);

/** `sql` for the SQL explorers, `query` for the Cypher one (doc-27 §3). */
const STATEMENT_FIELDS = new Set(["sql", "query"]);

/** Indentation used when a single-line statement has to become a block scalar. */
const DEFAULT_INDENT = "  ";

const FIELD_LINE = /^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/;

export interface SaveQueryBlockInput {
	projectRoot: string;
	/** Project-relative path of the Markdown file that holds the block. */
	filePath: string;
	/** The fenced block body exactly as it sits between the opening and closing fences. */
	block: string;
	/** The edited statement to write into the block's statement field. */
	statement: string;
}

export type SaveQueryBlockResult = { ok: true; block: string } | { ok: false; error: string };

function fail(error: string): SaveQueryBlockResult {
	return { ok: false, error };
}

/** Character offsets of each line's first character, so a span can be cut out of the raw block. */
function lineStarts(lines: string[]): number[] {
	const starts: number[] = [];
	let offset = 0;
	for (const line of lines) {
		starts.push(offset);
		offset += line.length + 1;
	}
	return starts;
}

/** The leading whitespace of the least indented content line, which is what YAML strips by. */
function scalarIndent(lines: string[]): string {
	let best: string | null = null;
	for (const line of lines) {
		if (line.trim().length === 0) continue;
		const lead = line.slice(0, line.length - line.trimStart().length);
		if (best === null || lead.length < best.length) best = lead;
	}
	return best ?? DEFAULT_INDENT;
}

/**
 * Rewrites the statement field of one block body, keeping every other field byte-for-byte.
 *
 * Only the statement span is touched: an inline value stays inline, and a `|` block scalar keeps
 * its marker and its original indentation so the surrounding document still reads the same.
 * Returns null when the block has no `sql` / `query` field, which a parsed block always has.
 */
function replaceStatement(block: string, statement: string): string | null {
	const lines = block.replace(/\r\n?/g, "\n").split("\n");
	const starts = lineStarts(lines);

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i] ?? "";
		// Indented lines belong to a block scalar, and the statement field is always top-level.
		if (line.trim().length === 0 || /^\s/.test(line)) continue;
		const match = FIELD_LINE.exec(line);
		if (!match) continue;
		const key = (match[1] ?? "").toLowerCase();
		if (!STATEMENT_FIELDS.has(key)) continue;

		const lineStart = starts[i] ?? 0;
		const rawValue = match[2] ?? "";
		const valueStart = lineStart + (match[0].length - rawValue.length);
		const inline = rawValue.trim();

		if (inline === "|" || inline === "|-") {
			// Consume the scalar: indented lines and the blank lines inside it, up to the first
			// top-level line. This mirrors the parser, so both agree on where the scalar ends.
			let end = i + 1;
			for (; end < lines.length; end++) {
				const candidate = lines[end] ?? "";
				if (candidate.trim().length === 0) continue;
				if (!/^\s/.test(candidate)) break;
			}
			const indent = scalarIndent(lines.slice(i + 1, end));
			const body = statement
				.split("\n")
				.map((candidate) => (candidate.trim().length === 0 ? "" : indent + candidate))
				.join("\n");
			const scalarEnd = (starts[end - 1] ?? 0) + (lines[end - 1] ?? "").length;
			return `${block.slice(0, valueStart)}${inline}\n${body}${block.slice(scalarEnd)}`;
		}

		const lineEnd = lineStart + line.length;
		if (!statement.includes("\n")) {
			return `${block.slice(0, valueStart)}${statement}${block.slice(lineEnd)}`;
		}
		// A multi-line statement cannot stay inline, so the field becomes a block scalar.
		const body = statement
			.split("\n")
			.map((candidate) => (candidate.trim().length === 0 ? "" : DEFAULT_INDENT + candidate))
			.join("\n");
		return `${block.slice(0, valueStart)}|\n${body}${block.slice(lineEnd)}`;
	}

	return null;
}

/**
 * Writes an edited statement back into the Markdown file that holds its block.
 *
 * The block is located by its full body rather than by its statement text: the renderer hands back
 * the body verbatim, while the statement it parsed has had a block scalar's indentation stripped,
 * so only the body is still byte-identical to what the file holds. The body has to be unique and
 * fenced, otherwise a look-alike block elsewhere would be rewritten instead. Everything is gated
 * before any byte is touched (relative path, inside the project, Markdown only), and the write goes
 * through {@link replaceFile} so the previous bytes survive an interrupted rename.
 *
 * On success the rewritten body comes back, so the caller can keep editing without re-reading the
 * file - a stale body would no longer be found on the next save.
 */
export async function saveQueryBlockStatement(input: SaveQueryBlockInput): Promise<SaveQueryBlockResult> {
	const { projectRoot, filePath, statement } = input;
	if (!filePath.trim()) return fail("filePath is required.");
	if (!input.block.trim()) return fail("block is required.");
	/**
	 * The renderer hands the body over with a trailing newline appended: `mdast-util-to-hast` adds
	 * one to a code node's value that `remark-parse` itself does not carry. Left in place it is
	 * counted as part of the body, so the text after the match starts at the closing fence rather
	 * than at the newline before it and the rewrite glues the fence onto the last statement line -
	 * which silently breaks the fence. Everything below works on the body without it.
	 */
	const block = input.block.replace(/\r\n?/g, "\n").replace(/\n+$/, "");
	const next = statement.replace(/\r\n?/g, "\n").replace(/\s+$/, "");
	if (next.trim().length === 0) return fail("The statement is empty.");
	if (isNonRelativeSource(filePath)) return fail("filePath must be a project-relative path.");

	const target = join(projectRoot, filePath);
	if (!segmentsInsideProject(projectRoot, target)) {
		return fail("filePath escapes the project directory.");
	}
	if (!MARKDOWN_EXTS.has(extname(target).toLowerCase())) {
		return fail("Only Markdown files can hold query blocks.");
	}

	let text: string;
	try {
		text = await readFile(target, "utf8");
	} catch {
		return fail("The file could not be read.");
	}

	const index = text.indexOf(block);
	if (index < 0) return fail("The block is no longer in the file.");
	if (text.indexOf(block, index + block.length) >= 0) {
		return fail("The block appears more than once; edit the file directly instead.");
	}
	// An opening fence has to precede the span and a closing one has to follow it, so only text
	// that really sits inside a code block is eligible.
	const before = text.slice(0, index);
	const after = text.slice(index + block.length);
	const opensBefore = before.startsWith("```") || before.includes("\n```");
	const closesAfter = after.startsWith("```") || after.includes("\n```");
	if (!opensBefore || !closesAfter) {
		return fail("The block is not inside a fenced code block.");
	}

	const updatedBlock = replaceStatement(block, next);
	if (updatedBlock === null) return fail("The block has no sql / query field to edit.");
	if (updatedBlock === block) return { ok: true, block };

	const tempPath = `${target}.tmp-${Date.now()}`;
	try {
		await writeFile(tempPath, before + updatedBlock + after, "utf8");
		await replaceFile(tempPath, target);
	} catch {
		return fail("The file could not be written.");
	}
	return { ok: true, block: updatedBlock };
}
