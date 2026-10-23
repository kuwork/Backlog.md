/**
 * Display-only extraction of a leading YAML frontmatter block from a markdown file.
 *
 * This is intentionally separate from `src/markdown/frontmatter.ts` (which wraps gray-matter and is
 * used for logic/parsing on the server): the file preview only needs to *show* the header somewhere
 * other than the markdown body, and importing gray-matter into the web bundle is undesirable. The
 * parser below is deliberately small and good enough for rendering - it is not a substitute for the
 * canonical parser anywhere data is read.
 */

export interface FrontmatterEntry {
	key: string;
	value: string;
}

export interface FrontmatterExtraction {
	/** The markdown body with the frontmatter fences (and the blank line that follows) removed. */
	body: string;
	/** Parsed `key: value` rows; list items are flattened into their parent value with ", ". */
	entries: FrontmatterEntry[];
}

const FRONTMATTER_FENCE = /^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n+/;

export function extractFrontmatter(source: string): FrontmatterExtraction {
	const match = FRONTMATTER_FENCE.exec(source);
	if (!match) return { body: source, entries: [] };

	const block = match[1] ?? "";
	const full = match[0] ?? "";
	const body = source.slice(full.length);
	const entries: FrontmatterEntry[] = [];
	let currentKey: string | null = null;

	for (const rawLine of block.split(/\r?\n/)) {
		if (rawLine.trim() === "") continue;

		const listItem = /^\s*-\s+(.*\S)\s*$/.exec(rawLine);
		if (listItem && currentKey !== null) {
			const last = entries[entries.length - 1];
			if (last) {
				last.value = last.value ? `${last.value}, ${listItem[1] ?? ""}` : (listItem[1] ?? "");
			}
			continue;
		}

		const pair = /^([A-Za-z0-9_][\w-]*):\s*(.*)$/.exec(rawLine);
		if (pair) {
			const key = pair[1] ?? "";
			currentKey = key;
			let value = (pair[2] ?? "").trim();
			if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
				value = value.slice(1, -1);
			}
			entries.push({ key, value });
		} else {
			currentKey = null;
		}
	}

	return { body, entries };
}
