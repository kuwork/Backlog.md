import { describe, expect, it } from "bun:test";
import { officeRangeLabel } from "../web/components/officeRangeLabel";
import { getDictionary } from "../web/locales";

const t = getDictionary("zh-CN");

describe("officeRangeLabel (BACK-838)", () => {
	it("has no label for a link without a range", () => {
		expect(officeRangeLabel(t, undefined)).toBeNull();
		expect(officeRangeLabel(t, null)).toBeNull();
	});

	it("labels a single page and a page window", () => {
		expect(officeRangeLabel(t, { type: "pages", start: 2 })).toBe("第 2 页");
		expect(officeRangeLabel(t, { type: "pages", start: 1, end: 4 })).toBe("第 1–4 页");
		expect(officeRangeLabel(t, { type: "pages", start: 3, end: 3 })).toBe("第 3 页");
	});

	it("labels a sheet index, an index window and a sheet name", () => {
		expect(officeRangeLabel(t, { type: "sheets", items: ["p1"] })).toBe("工作表 1");
		expect(officeRangeLabel(t, { type: "sheets", items: ["p1", "p2", "p3"] })).toBe("工作表 1–3");
		expect(officeRangeLabel(t, { type: "sheets", items: ["Q1 Sales"] })).toBe("工作表 Q1 Sales");
		expect(officeRangeLabel(t, { type: "sheets", items: ["明细"] })).toBe("工作表 明细");
	});

	it("is localized in every supported locale", () => {
		for (const locale of ["en", "ja", "zh-CN", "zh-TW"] as const) {
			const dict = getDictionary(locale);
			expect(officeRangeLabel(dict, { type: "pages", start: 2, end: 5 })).toContain("2");
			expect(officeRangeLabel(dict, { type: "sheets", items: ["p1", "p2"] })).toBeTruthy();
			expect(officeRangeLabel(dict, { type: "sheets", items: ["Q1 Sales"] })).toContain("Q1 Sales");
		}
	});
});
