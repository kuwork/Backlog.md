import { describe, expect, it } from "bun:test";
import { labelHue, labelNodeColors } from "../web/utils/graph-palette.ts";

/**
 * The result graph's colour vocabulary (BACK-793): a user database's labels are not known in
 * advance, so each label is hashed onto a hue ring. What matters for a reader is that the
 * mapping is stable (a re-run paints the same picture) and theme-aware (the stroke policy the
 * corpus palette uses).
 */
describe("labelNodeColors", () => {
	it("gives the same label the same colours, every time", () => {
		expect(labelNodeColors("Person", "dark")).toEqual(labelNodeColors("Person", "dark"));
		expect(labelHue("Person")).toBe(labelHue("Person"));
	});

	it("separates the labels of a typical small database", () => {
		// A demo shop's vocabulary: five labels, five hues. Beyond a dozen labels the ring runs
		// out and the legend's text is what tells two labels apart - the colour stays a grouping
		// cue, never an identity.
		const hues = ["Person", "City", "Company", "Product", "Order"].map(labelHue);
		expect(new Set(hues).size).toBe(hues.length);
	});

	it("switches the stroke between themes, keeping the fill's hue", () => {
		const dark = labelNodeColors("Person", "dark");
		const light = labelNodeColors("Person", "light");
		expect(dark.fill).not.toBe(light.fill);
		expect(dark.stroke).not.toBe(light.stroke);
		// The dark stroke is the pale tint; the light one the darker shade.
		expect(dark.stroke).toContain("75%");
		expect(light.stroke).toContain("38%");
	});

	it("keeps every hue inside the ring", () => {
		for (const label of ["a", "Person", "SomeRatherLongLabelName", "KNOWS", "zzz"]) {
			const hue = labelHue(label);
			expect(hue).toBeGreaterThanOrEqual(0);
			expect(hue).toBeLessThan(360);
		}
	});
});
