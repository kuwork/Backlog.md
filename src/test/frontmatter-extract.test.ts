import { describe, expect, it } from "bun:test";
import { extractFrontmatter } from "../web/utils/frontmatter-extract";

describe("extractFrontmatter", () => {
	it("returns the source untouched when there is no frontmatter", () => {
		const source = "## Heading\n\nSome body text.";
		const result = extractFrontmatter(source);
		expect(result.entries).toEqual([]);
		expect(result.body).toBe(source);
	});

	it("extracts a simple frontmatter block and strips it from the body", () => {
		const source = ["---", "title: My Doc", "status: Done", "---", "", "# Body", "", "Content here."].join("\n");
		const result = extractFrontmatter(source);
		expect(result.entries).toEqual([
			{ key: "title", value: "My Doc" },
			{ key: "status", value: "Done" },
		]);
		expect(result.body).toBe("# Body\n\nContent here.");
	});

	it("strips surrounding quotes from values", () => {
		const source = "---\ntitle: 'Quoted Title'\n---\nbody";
		const result = extractFrontmatter(source);
		expect(result.entries).toEqual([{ key: "title", value: "Quoted Title" }]);
	});

	it("flattens list items into the parent value", () => {
		const source = ["---", "references:", "  - one.md", "  - two.md", "---", "body"].join("\n");
		const result = extractFrontmatter(source);
		expect(result.entries).toEqual([{ key: "references", value: "one.md, two.md" }]);
	});

	it("does not strip a `---` that is not a leading fence", () => {
		const source = "Intro\n\n---\n\nmiddle\n\n---";
		const result = extractFrontmatter(source);
		expect(result.entries).toEqual([]);
		expect(result.body).toBe(source);
	});

	it("tolerates CRLF line endings", () => {
		const source = "---\r\nkey: value\r\n---\r\nbody";
		const result = extractFrontmatter(source);
		expect(result.entries).toEqual([{ key: "key", value: "value" }]);
		expect(result.body).toBe("body");
	});
});
