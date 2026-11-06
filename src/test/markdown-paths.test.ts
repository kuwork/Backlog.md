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
	const DOC_BASE = "backlog/docs/PRDS/RelativeLink/doc-34 - Relative-Link-Check.md";
	const COLLECTION_BASE = "PRDS/RelativeLink/doc-34 - Relative-Link-Check.md";
	const SOURCE = [
		"[duckdb](../duckdb/doc-26 - DuckDB-Explorer-演示.md)",
		"[duckdb:10-50](<../duckdb/doc-26 - DuckDB-Explorer-演示.md:10-50>)",
		"[auto-port](../../../wiki/concepts/auto-port.md)",
		"[auto-port:10-50](../../../wiki/concepts/auto-port.md:10-50)",
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

describe("BACK-837 wiki collection boundary", () => {
	// Both values are API-derived: projectPath = <wikiRoot>/<collection-relative page path>.
	const WIKI_BASE = "backlog/wiki/concepts/auto-port.md";
	const WIKI_ROOT = "backlog/wiki";
	const wikiJoined = (target: string) => joinMarkdownTarget(WIKI_BASE, target, { wikiRoot: WIKI_ROOT }).href;

	it("routes a sibling wiki page through /wiki/ and keeps the line range", () => {
		expect(wikiJoined("asset-management.md:10-29")).toBe("/wiki/concepts/asset-management.md:10-29");
		expect(wikiJoined("./asset-management.md:10-29")).toBe("/wiki/concepts/asset-management.md:10-29");
		expect(wikiJoined("../comparisons/migration-decision-process.md")).toBe(
			"/wiki/comparisons/migration-decision-process.md",
		);
	});

	it("keeps cross-collection references as project file links", () => {
		const name = "doc-20 - 快速笔记：Memos-集成.md";
		expect(wikiJoined(`../../docs/memos/${name}:10-20`)).toBe(`/backlog/docs/memos/${encodeURIComponent(name)}:10-20`);
		expect(wikiJoined("../../decisions/decision-2.md:1-12")).toBe("/backlog/decisions/decision-2.md:1-12");
		expect(wikiJoined("../../../scripts/note.md:3-7")).toBe("/scripts/note.md:3-7");
	});

	it("does not double-encode a spaced wiki page already normalised by the composer pass", () => {
		// encodeLocalFileLinkDestinations turns spaces into %20 inside <...> before the join pass.
		const base = "backlog/wiki/test/back-837 - Link-Check.md";
		expect(joinMarkdownTarget(base, "<./Another%20Page.md:3-8>", { wikiRoot: WIKI_ROOT }).href).toBe(
			"/wiki/test/Another%20Page.md:3-8",
		);
		expect(joinMarkdownTarget(base, "<./Another Page.md>", { wikiRoot: WIKI_ROOT }).href).toBe(
			"/wiki/test/Another%20Page.md",
		);
	});

	it("treats media and other non-markdown files inside the wiki root as files", () => {
		expect(wikiJoined("./diagram.png")).toBe("/backlog/wiki/concepts/diagram.png");
		expect(wikiJoined("./data.json")).toBe("/backlog/wiki/concepts/data.json");
	});

	it("leaves entity short links and absolute site paths untouched", () => {
		expect(wikiJoined("/documentation/5:30-41")).toBe("/documentation/5:30-41");
		expect(wikiJoined("/decisions/2")).toBe("/decisions/2");
		expect(wikiJoined("/wiki/concepts/asset-management:10-29")).toBe("/wiki/concepts/asset-management:10-29");
		expect(wikiJoined("https://example.com/x.png")).toBe("https://example.com/x.png");
	});

	it("still rejects a join that escapes the project root", () => {
		expect(joinMarkdownTarget(WIKI_BASE, "../../../../../../etc/passwd", { wikiRoot: WIKI_ROOT })).toEqual({
			href: "#",
			rejected: true,
		});
	});

	it("rewrites a whole wiki body, keeping wiki pages separate from sibling-collection files", () => {
		const source = [
			"[sibling](asset-management.md:10-29)",
			"[doc](<../../docs/memos/doc-20 - 快速笔记：Memos-集成.md:10-20>)",
			"[decision](<../../decisions/decision-2 - Relative-link-check.md:1-12>)",
			"[absolute](</backlog/docs/memos/doc-20 - 快速笔记：Memos-集成.md:10-20>)",
			"[doc-5 A2](/documentation/5:30-41)",
		].join("\n");
		const name = "doc-20 - 快速笔记：Memos-集成.md";
		const decision = "decision-2 - Relative-link-check.md";
		expect(processMarkdownLocalPaths(source, WIKI_BASE, { wikiRoot: WIKI_ROOT })).toBe(
			[
				"[sibling](/wiki/concepts/asset-management.md:10-29)",
				`[doc](/backlog/docs/memos/${encodeURIComponent(name)}:10-20)`,
				`[decision](/backlog/decisions/${encodeURIComponent(decision)}:1-12)`,
				`[absolute](/backlog/docs/memos/${encodeURIComponent(name)}:10-20)`,
				"[doc-5 A2](/documentation/5:30-41)",
			].join("\n"),
		);
	});

	it("does not use wiki routing without the collection root", () => {
		expect(joinMarkdownTarget(WIKI_BASE, "asset-management.md").href).toBe(
			"/backlog/wiki/concepts/asset-management.md",
		);
	});
});

describe("BACK-837 angle brackets with spaced filenames on every collection base", () => {
	const DOC_NAME = "doc-26 - DuckDB-Explorer-演示.md";
	const DECISION_NAME = "decision-2 - Relative-link-check.md";
	const DOC = `backlog/docs/PRDS/duckdb/${DOC_NAME}`;
	const DECISION = `backlog/decisions/${DECISION_NAME}`;
	const WIKI_PAGE = "backlog/wiki/test/Another Page.md";
	const encoded = (path: string) =>
		`/${path
			.split("/")
			.map((segment) => encodeURIComponent(segment))
			.join("/")}`;

	it("resolves doc and decision files from a wiki page while keeping wiki siblings on /wiki/", () => {
		const base = "backlog/wiki/test/back-837 - Link-Check.md";
		const options = { wikiRoot: "backlog/wiki" };
		const source = [
			`[doc](<../../docs/PRDS/duckdb/${DOC_NAME}:10-50>)`,
			`[decision](<../../decisions/${DECISION_NAME}:1-12>)`,
			"[sibling](<./Another Page.md:3-8>)",
		].join("\n");
		expect(processMarkdownLocalPaths(source, base, options)).toBe(
			[
				`[doc](${encoded(DOC)}:10-50)`,
				`[decision](${encoded(DECISION)}:1-12)`,
				"[sibling](/wiki/test/Another%20Page.md:3-8)",
			].join("\n"),
		);
	});

	it("resolves spaced doc, decision and wiki files from a document base", () => {
		const base = "backlog/docs/PRDS/RelativeLink/doc-34 - Relative-Link-Check.md";
		const source = [
			"[decision](<../../../decisions/decision-2 - Relative-link-check.md:1-12>)",
			"[wiki](<../../../wiki/test/Another Page.md:3-8>)",
			"[memo](<../../../docs/memos/doc-20 - 快速笔记：Memos-集成.md:10-20>)",
		].join("\n");
		expect(processMarkdownLocalPaths(source, base).split("\n")).toEqual([
			`[decision](${encoded(DECISION)}:1-12)`,
			`[wiki](${encoded(WIKI_PAGE)}:3-8)`,
			`[memo](${encoded("backlog/docs/memos/doc-20 - 快速笔记：Memos-集成.md")}:10-20)`,
		]);
	});

	it("resolves spaced doc and wiki files from a decision base", () => {
		const base = "backlog/decisions/decision-2 - Relative-link-check.md";
		const source = [
			"[doc](<../docs/PRDS/duckdb/doc-26 - DuckDB-Explorer-演示.md:10-50>)",
			"[wiki](<../wiki/test/back-837 - Link-Check.md:3-8>)",
			"[sibling](<../wiki/test/Another Page.md>)",
		].join("\n");
		expect(processMarkdownLocalPaths(source, base).split("\n")).toEqual([
			`[doc](${encoded(DOC)}:10-50)`,
			`[wiki](${encoded("backlog/wiki/test/back-837 - Link-Check.md")}:3-8)`,
			`[sibling](${encoded(WIKI_PAGE)})`,
		]);
	});

	it("keeps an absolute site path with spaces inside angle brackets on all three bases", () => {
		const target = `</backlog/docs/PRDS/duckdb/${DOC_NAME}:10-50>`;
		for (const base of [
			"backlog/wiki/test/back-837 - Link-Check.md",
			"backlog/docs/PRDS/RelativeLink/doc-34 - Relative-Link-Check.md",
			"backlog/decisions/decision-2 - Relative-link-check.md",
		]) {
			expect(joinMarkdownTarget(base, target).href).toBe(`${encoded(DOC)}:10-50`);
		}
	});
});

describe("CommonMark pointy-bracket destinations with spaces and colons", () => {
	const SPACE_BASE = "backlog/docs/sqlite/index.md";

	it("strips the enclosing brackets and keeps a :N-M range after the extension", () => {
		const name = "doc-20 - 快速笔记：Memos-集成.md";
		expect(joinMarkdownTarget(SPACE_BASE, `<${name}:10-20>`).href).toBe(
			`/backlog/docs/sqlite/${encodeURIComponent(name)}:10-20`,
		);
	});

	it("does not read a fullwidth or ASCII colon inside the filename as a range separator", () => {
		for (const name of ["报告：2024版.md", "报告:2024版.md", "v2:12.md"]) {
			expect(joinMarkdownTarget(SPACE_BASE, name).href).toBe(`/backlog/docs/sqlite/${encodeURIComponent(name)}`);
			expect(joinMarkdownTarget(SPACE_BASE, `${name}:3-9`).href).toBe(
				`/backlog/docs/sqlite/${encodeURIComponent(name)}:3-9`,
			);
		}
	});

	it("rewrites the whole pointy-bracket link through the markdown pass", () => {
		const name = "doc-20 - 快速笔记：Memos-集成.md";
		const source = "[Memos-集成](<../../docs/memos/doc-20 - 快速笔记：Memos-集成.md:10-20>)";
		expect(processMarkdownLocalPaths(source, SPACE_BASE)).toBe(
			`[Memos-集成](/backlog/docs/memos/${encodeURIComponent(name)}:10-20)`,
		);
	});

	it("keeps an absolute site path inside angle brackets as a URL-layer destination", () => {
		expect(joinMarkdownTarget(SPACE_BASE, "</backlog/docs/report.md:10-20>").href).toBe(
			"/backlog/docs/report.md:10-20",
		);
		expect(joinMarkdownTarget(SPACE_BASE, "<//evil.com/x.png>").rejected).toBe(true);
	});

	it("still recognises a range on an extensionless URL-layer destination", () => {
		expect(joined("/documentation/10:55-74")).toBe("/documentation/10:55-74");
	});
});

describe("BACK-836 project-relative decision base", () => {
	// The API derives this from <data-dir>/decisions + the bare decision filename.
	const DECISION_BASE = "backlog/decisions/decision-9 - test-decision.md";
	const COLLECTION_BASE = "decision-9 - test-decision.md";
	const SOURCE = [
		"[wiki](../wiki/concepts/auto-port.md)",
		"[spec](../docs/PRDS/sqlite/doc.md:10-20)",
		"[external](https://example.com/x)",
		"[route](/documentation/10:55-74)",
	].join("\n");

	it("joins sibling-collection references against the decisions directory", () => {
		expect(processMarkdownLocalPaths(SOURCE, DECISION_BASE)).toBe(
			[
				"[wiki](/backlog/wiki/concepts/auto-port.md)",
				"[spec](/backlog/docs/PRDS/sqlite/doc.md:10-20)",
				"[external](https://example.com/x)",
				"[route](/documentation/10:55-74)",
			].join("\n"),
		);
	});

	it("shows why a bare filename base collapses a parent reference into a dead anchor", () => {
		expect(processMarkdownLocalPaths("[wiki](../wiki/concepts/auto-port.md)", COLLECTION_BASE)).toBe("[wiki](#)");
	});
});
