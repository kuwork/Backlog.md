import { describe, expect, it } from "bun:test";
import { joinMarkdownTarget, processMarkdownLocalPaths } from "../web/utils/markdown-paths.ts";

const BASE = "backlog/docs/PRDS/sqlite/doc-24.md";

function joined(target: string, base = BASE): string {
	return joinMarkdownTarget(base, target).href;
}

describe("BACK-835 render-time joining", () => {
	it("leaves URL-layer destinations untouched", () => {
		expect(joined("/documentation/10:55-74")).toBe("/documentation/10:55-74");
		expect(joined("/assets/paste/image.png")).toBe("/assets/paste/image.png");
		expect(joined("#heading")).toBe("#heading");
		expect(joined("https://example.com/x.png")).toBe("https://example.com/x.png");
		expect(joined("mailto:a@b.com")).toBe("mailto:a@b.com");
	});

	it("refuses protocol-relative destinations", () => {
		expect(joinMarkdownTarget(BASE, "//evil.com/x.png")).toEqual({ href: "#", rejected: true });
	});

	it("joins dot-relative, bare and sibling targets with the document directory", () => {
		expect(joined("./fig.png")).toBe("/backlog/docs/PRDS/sqlite/fig.png");
		expect(joined("images/fig.png")).toBe("/backlog/docs/PRDS/sqlite/images/fig.png");
		expect(joined("../shared/spec.md")).toBe("/backlog/docs/PRDS/shared/spec.md");
		expect(joined("assets/x.png")).toBe("/backlog/docs/PRDS/sqlite/assets/x.png");
	});

	it("allows multi-level parents while the result stays inside the project root", () => {
		expect(joined("../../../scripts/note.md")).toBe("/backlog/scripts/note.md");
		expect(joined("../../../../src/foo.ts")).toBe("/src/foo.ts");
	});

	it("rejects any join that escapes the project root", () => {
		expect(joinMarkdownTarget(BASE, "../../../../../etc/passwd")).toEqual({ href: "#", rejected: true });
		expect(joinMarkdownTarget(BASE, "../../../../../../Windows/system.ini").rejected).toBe(true);
	});

	it("keeps line ranges, fragments and queries attached to the joined path", () => {
		expect(joined("doc-5.md:12-20")).toBe("/backlog/docs/PRDS/sqlite/doc-5.md:12-20");
		expect(joined("./doc-5.md:7")).toBe("/backlog/docs/PRDS/sqlite/doc-5.md:7");
		expect(joined("./doc-5.md#section")).toBe("/backlog/docs/PRDS/sqlite/doc-5.md#section");
		expect(joined("./fig.png?v=2")).toBe("/backlog/docs/PRDS/sqlite/fig.png?v=2");
	});

	it("encodes filenames once and never double-encodes an escaped path", () => {
		expect(joined("my file.png")).toBe("/backlog/docs/PRDS/sqlite/my%20file.png");
		expect(joined("中文.md")).toBe(`/backlog/docs/PRDS/sqlite/${encodeURIComponent("中文.md")}`);
		expect(joined("%E4%B8%AD.md")).toBe("/backlog/docs/PRDS/sqlite/%E4%B8%AD.md");
		expect(joined('a"onerror="x.png')).not.toContain('"');
	});

	it("keeps working without a document path", () => {
		expect(joinMarkdownTarget(undefined, "./fig.png").href).toBe("./fig.png");
	});
});

describe("BACK-835 markdown pass", () => {
	it("rewrites links, images and raw HTML media attributes", () => {
		const source = [
			"![diagram](./fig.png)",
			"[spec](../shared/spec.md:12-20)",
			'<video src="./clip.mp4"></video>',
			'<img src="images/photo.png">',
			'<a href="/wiki/concepts/x">wiki</a>',
		].join("\n");
		expect(processMarkdownLocalPaths(source, BASE)).toBe(
			[
				"![diagram](/backlog/docs/PRDS/sqlite/fig.png)",
				"[spec](/backlog/docs/PRDS/shared/spec.md:12-20)",
				'<video src="/backlog/docs/PRDS/sqlite/clip.mp4"></video>',
				'<img src="/backlog/docs/PRDS/sqlite/images/photo.png">',
				'<a href="/wiki/concepts/x">wiki</a>',
			].join("\n"),
		);
	});

	it("never rewrites code fences or inline code", () => {
		const source = ["```", "[a](./inside.md)", "```", "", "Use `[b](./inline.md)` literally."].join("\n");
		expect(processMarkdownLocalPaths(source, BASE)).toBe(source);
	});

	it("emits a dead anchor for an escape or a protocol-relative URL", () => {
		const source = "[bad](../../../../../etc/passwd)\n[evil](//evil.com/x)";
		expect(processMarkdownLocalPaths(source, BASE)).toBe("[bad](#)\n[evil](#)");
	});
});

describe("BACK-835 project-relative document base (doc-34 regression)", () => {
	// The API derives this from <data-dir>/docs + the collection-relative document path.
	const DOC_BASE = "backlog/docs/PRDS/cypher/test/doc-34 - test-doc.md";
	const COLLECTION_BASE = "PRDS/cypher/test/doc-34 - test-doc.md";
	const SOURCE = [
		"[duckdb](../../duckdb/doc-26 - DuckDB-Explorer-演示.md)",
		"[duckdb:10-50](<../../duckdb/doc-26 - DuckDB-Explorer-演示.md:10-50>)",
		"[auto-port](../../../../wiki/concepts/auto-port.md)",
		"[auto-port:10-50](../../../../wiki/concepts/auto-port.md:10-50)",
	].join("\n");

	it("joins all four links, including a sibling collection reached by multi-level ../", () => {
		expect(processMarkdownLocalPaths(SOURCE, DOC_BASE)).toBe(
			[
				"[duckdb](/backlog/docs/PRDS/duckdb/doc-26%20-%20DuckDB-Explorer-%E6%BC%94%E7%A4%BA.md)",
				"[duckdb:10-50](/backlog/docs/PRDS/duckdb/doc-26%20-%20DuckDB-Explorer-%E6%BC%94%E7%A4%BA.md:10-50)",
				"[auto-port](/backlog/wiki/concepts/auto-port.md)",
				"[auto-port:10-50](/backlog/wiki/concepts/auto-port.md:10-50)",
			].join("\n"),
		);
	});

	it("shows why the collection-relative base must not reach the join pass", () => {
		expect(processMarkdownLocalPaths("[a](../../../../wiki/concepts/auto-port.md)", COLLECTION_BASE)).toBe("[a](#)");
	});
});
