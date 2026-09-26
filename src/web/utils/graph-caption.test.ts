import { describe, expect, it } from "bun:test";
import type { GraphNodeDto } from "../lib/api.ts";
import {
	CAPTION_BUDGET,
	CAPTION_CHAR_WIDTH,
	CAPTION_PAD,
	captionFor,
	captionPlateWidth,
	captionTextWidth,
	fileStem,
	truncateCaption,
} from "./graph-caption";

const node = (overrides: Partial<GraphNodeDto> & { id: string }): GraphNodeDto => ({
	title: "",
	kind: "task",
	status: "To Do",
	filePath: "tasks/x.md",
	...overrides,
});

describe("graph node captions", () => {
	it("labels a work file by its code name", () => {
		expect(captionFor(node({ id: "BACK-123" }))).toBe("BACK-123");
	});

	it("labels a knowledge page by its title, not by its path", () => {
		expect(captionFor(node({ id: "wiki/concepts/wiki-lint.md", kind: "wiki", title: "Wiki lint" }))).toBe("Wiki lint");
		expect(
			captionFor(
				node({ id: "decisions/decision-1 - Use-Tailwind.md", kind: "decision", title: "Use Tailwind CSS v4" }),
			),
		).toBe("Use Tailwind CSS v4");
		expect(captionFor(node({ id: "docs/BRDS/doc-14 - Kuzu.md", kind: "document", title: "Kuzu 任务图谱" }))).toBe(
			"Kuzu 任务图谱",
		);
	});

	it("falls back to the file name when a knowledge page declares no title", () => {
		expect(captionFor(node({ id: "wiki/sources/back-712.md", kind: "wiki", title: "  " }))).toBe("back-712");
	});

	it("labels a tag by its name, without the payload's tag: prefix", () => {
		expect(captionFor(node({ id: "tag:topic/lint", kind: "tag", title: "topic/lint" }))).toBe("topic/lint");
	});

	it("trims by width, so a CJK title and a Latin one fill the same plate", () => {
		const latin = truncateCaption("A".repeat(80));
		const cjk = truncateCaption("中".repeat(80));
		// The same budget buys roughly twice as many Latin characters as CJK ones...
		expect(latin.length).toBeGreaterThan(cjk.length);
		// ...and neither result overruns the plate.
		expect(captionTextWidth(latin)).toBeLessThanOrEqual(CAPTION_BUDGET);
		expect(captionTextWidth(cjk)).toBeLessThanOrEqual(CAPTION_BUDGET);
		expect(latin.endsWith("…")).toBe(true);
		expect(cjk.endsWith("…")).toBe(true);
	});

	it("leaves a caption that already fits untouched", () => {
		expect(truncateCaption("Testing Style Guide")).toBe("Testing Style Guide");
	});

	it("reports the plate width as the text plus its padding", () => {
		expect(captionPlateWidth("abc")).toBe(captionTextWidth("abc") + CAPTION_PAD);
		expect(captionTextWidth("ab")).toBeCloseTo(2 * CAPTION_CHAR_WIDTH, 5);
	});

	it("derives the file stem behind a payload id", () => {
		expect(fileStem("wiki/sources/back-712 - X.md")).toBe("back-712 - X");
		expect(fileStem("BACK-1")).toBe("BACK-1");
	});
});
