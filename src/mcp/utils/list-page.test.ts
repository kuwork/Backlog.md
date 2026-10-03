import { describe, expect, it } from "bun:test";
import { selectListPage } from "../../utils/list-page.ts";
import { buildListResult } from "./list-page.ts";

const getText = (content: unknown[] | undefined, index = 0): string => {
	const item = content?.[index] as { text?: string } | undefined;
	return item?.text ?? "";
};

describe("buildListResult", () => {
	it("wraps content with the structured envelope", () => {
		const page = selectListPage(
			Array.from({ length: 10 }, (_, i) => i + 1),
			{ limit: 3 },
		);
		const result = buildListResult([{ type: "text", text: "Header" }], page, { label: "item" });
		expect(result.structuredContent).toEqual({
			items: [1, 2, 3],
			total: 10,
			offset: 0,
			limit: 3,
			hasMore: true,
		});
		expect(result.isError).toBeUndefined();
	});

	it("appends a 'Showing X-Y of N items' hint to the last text block when windowed", () => {
		const page = { items: [1, 2], total: 10, offset: 0, limit: 2, hasMore: true };
		const result = buildListResult([{ type: "text", text: "Header" }], page, { label: "item" });
		expect(getText(result.content)).toBe("Header\nShowing 1-2 of 10 items.");
	});

	it("pluralizes the label only when total is not 1", () => {
		const page = { items: [1], total: 1, offset: 0, limit: 1, hasMore: false };
		const result = buildListResult([{ type: "text", text: "Header" }], page, { label: "task" });
		expect(getText(result.content)).toBe("Header\nShowing 1-1 of 1 task.");
	});

	it("does not append a hint when limit is 0 (no window applied)", () => {
		const page = { items: [1, 2], total: 2, offset: 0, limit: 0, hasMore: false };
		const result = buildListResult([{ type: "text", text: "Header" }], page, { label: "memo" });
		expect(getText(result.content)).toBe("Header");
	});

	it("appends the hint to the last of multiple content blocks", () => {
		const page = { items: [1, 2], total: 5, offset: 2, limit: 2, hasMore: true };
		const result = buildListResult(
			[
				{ type: "text", text: "Section A" },
				{ type: "text", text: "Section B" },
			],
			page,
			{ label: "decision" },
		);
		expect(result.content).toHaveLength(2);
		expect(getText(result.content, 0)).toBe("Section A");
		expect(getText(result.content, 1)).toBe("Section B\nShowing 3-4 of 5 decisions.");
	});
});
