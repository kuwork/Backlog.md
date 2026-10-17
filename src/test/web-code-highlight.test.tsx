import { describe, expect, it } from "bun:test";
import { highlightCode } from "../web/utils/code-highlight.tsx";

/**
 * The util is the query block's share of the reading view's own highlighting, so what matters here
 * is that it produces the same element shape a fenced block gets (`<span class="token ...">`) and
 * that a grammar it does not know costs nothing but the colour.
 */
describe("highlightCode (BACK-811)", () => {
	/** Every `<span>` the returned tree holds, as `className → text`. */
	function tokens(node: ReturnType<typeof highlightCode>): { className: string; text: string }[] {
		const found: { className: string; text: string }[] = [];
		const walk = (value: unknown) => {
			if (value === null || value === undefined || typeof value === "boolean") return;
			if (typeof value === "string" || typeof value === "number") return;
			if (Array.isArray(value)) {
				for (const item of value) walk(item);
				return;
			}
			if (typeof value !== "object") return;
			const element = value as { type?: unknown; props?: { className?: unknown; children?: unknown } };
			if (element.props && typeof element.props.className === "string") {
				let text = "";
				const collect = (child: unknown) => {
					if (typeof child === "string") text += child;
					else if (Array.isArray(child)) for (const item of child) collect(item);
					else if (child && typeof child === "object")
						collect((child as { props?: { children?: unknown } }).props?.children);
				};
				collect(element.props.children);
				found.push({ className: element.props.className, text });
			}
			if (element.props) walk(element.props.children);
		};
		walk(node);
		return found;
	}

	it("tokenizes SQL the way a `sql` fence in a task body is tokenized", () => {
		const found = tokens(highlightCode("SELECT id FROM tasks WHERE id = 1 -- note", "sql"));
		expect(found.map((token) => token.text)).toContain("SELECT");
		expect(found.map((token) => token.text)).toContain("-- note");
		for (const token of found) expect(token.className).toContain("token");
	});

	it("tokenizes Cypher", () => {
		const found = tokens(highlightCode("MATCH (t:Task) RETURN t.id", "cypher"));
		expect(found.length).toBeGreaterThan(0);
		for (const token of found) expect(token.className).toContain("token");
	});

	it("returns the plain text for a grammar it does not know", () => {
		expect(highlightCode("SELECT 1", "klingon")).toBe("SELECT 1");
		expect(highlightCode("SELECT 1", "")).toBe("SELECT 1");
	});

	it("keeps every character of the source, whatever the grammar does to it", () => {
		const source = "SELECT name\nFROM people\nWHERE name = 'O''Brien'";
		const node = highlightCode(source, "sql");
		let text = "";
		const collect = (value: unknown) => {
			if (typeof value === "string") text += value;
			else if (Array.isArray(value)) for (const item of value) collect(item);
			else if (value && typeof value === "object")
				collect((value as { props?: { children?: unknown } }).props?.children);
		};
		collect(node);
		expect(text).toBe(source);
	});
});
