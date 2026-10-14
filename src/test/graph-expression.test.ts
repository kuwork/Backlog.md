import { describe, expect, it } from "bun:test";
import {
	COMPARE_OPERATORS,
	compileExpression,
	expressionError,
	expressionFields,
	LOGIC_OPERATORS,
	type PropertyBag,
} from "../web/utils/graph-expression.ts";

/**
 * The rule editor's condition language (BACK-794): only a comparison may be boolean, so
 * `priority && status` is an error rather than a silent truthiness test.
 */

describe("compileExpression", () => {
	it("evaluates a simple equality against a node's properties", () => {
		const rule = compileExpression('status == "open"');
		expect(rule.test({ status: "open" } as PropertyBag)).toBe(true);
		expect(rule.test({ status: "done" } as PropertyBag)).toBe(false);
	});

	it("compares numbers with the full operator set", () => {
		const rule = compileExpression("priority >= 3");
		expect(rule.test({ priority: 5 } as PropertyBag)).toBe(true);
		expect(rule.test({ priority: 2 } as PropertyBag)).toBe(false);
		expect(rule.test({ priority: 3 } as PropertyBag)).toBe(true);
	});

	it("combines comparisons with && and || and grouping", () => {
		const rule = compileExpression('(priority >= 3 || status == "vip") && done != true');
		expect(rule.test({ priority: 5, done: false } as PropertyBag)).toBe(true);
		expect(rule.test({ status: "vip", done: false } as PropertyBag)).toBe(true);
		expect(rule.test({ priority: 1, status: "open", done: false } as PropertyBag)).toBe(false);
		expect(rule.test({ priority: 5, done: true } as PropertyBag)).toBe(false);
	});

	it("negates a comparison with !", () => {
		const rule = compileExpression('!(type == "internal")');
		expect(rule.test({ type: "user" } as PropertyBag)).toBe(true);
		expect(rule.test({ type: "internal" } as PropertyBag)).toBe(false);
	});

	it("matches substrings with contains (case-insensitive)", () => {
		const rule = compileExpression('tag contains "auth"');
		expect(rule.test({ tag: "authentication" } as PropertyBag)).toBe(true);
		expect(rule.test({ tag: "oauth2" } as PropertyBag)).toBe(true);
		expect(rule.test({ tag: "user" } as PropertyBag)).toBe(false);
	});

	it("matches prefixes with startsWith (case-insensitive)", () => {
		const rule = compileExpression('name startsWith "Dr"');
		expect(rule.test({ name: "Dr. Smith" } as PropertyBag)).toBe(true);
		expect(rule.test({ name: "Mr. Smith" } as PropertyBag)).toBe(false);
	});

	it("reads a missing property as null, which fails to match", () => {
		const rule = compileExpression('status == "open"');
		expect(rule.test({} as PropertyBag)).toBe(false);
	});

	it("treats an empty condition as matching nothing", () => {
		const rule = compileExpression("   ");
		expect(rule.test({ anything: 1 } as PropertyBag)).toBe(false);
	});

	it("rejects a bare property where a comparison is expected", () => {
		expect(() => compileExpression("priority && status")).toThrow();
		expect(() => compileExpression("priority")).toThrow();
	});

	it("rejects unbalanced parentheses and trailing tokens", () => {
		expect(() => compileExpression("(status == 1")).toThrow();
		expect(() => compileExpression("status == 1 )")).toThrow();
		expect(() => compileExpression('status == "open" extra')).toThrow();
	});
});

describe("expressionError", () => {
	it("returns null for a well-formed condition", () => {
		expect(expressionError('priority >= 3 && status != "done"')).toBeNull();
	});

	it("returns a message for an ill-formed condition, never throwing", () => {
		expect(expressionError("priority && status")).not.toBeNull();
		expect(expressionError("status ==")).not.toBeNull();
	});
});

describe("expressionFields", () => {
	it("lists the property names a condition reads, without duplicates", () => {
		expect(expressionFields('priority >= 3 && status != "done"').sort()).toEqual(["priority", "status"]);
		expect(expressionFields("a == 1 || a == 2")).toEqual(["a"]);
	});

	it("skips keywords and literals", () => {
		expect(expressionFields("flag == true && other == null")).toEqual(["flag", "other"]);
	});

	it("yields whatever names are readable from a half-typed rule", () => {
		expect(expressionFields("status ==")).toEqual(["status"]);
	});
});

describe("operator vocabulary", () => {
	it("exposes comparisons and logic operators for the editor buttons", () => {
		expect(COMPARE_OPERATORS).toContain("contains");
		expect(COMPARE_OPERATORS).toContain("startsWith");
		expect(LOGIC_OPERATORS).toEqual(["&&", "||", "!", "(", ")"]);
	});
});
