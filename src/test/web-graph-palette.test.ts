import { describe, expect, it } from "bun:test";
import { gradientColors, labelHue, labelNodeColors } from "../web/utils/graph-palette.ts";

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
		// Colours resolve to hex, so a resolved colour can feed the settings panel's colour picker.
		expect(dark.fill).toMatch(/^#[0-9a-f]{6}$/);
		expect(light.fill).toMatch(/^#[0-9a-f]{6}$/);
		// The dark stroke is the pale tint; the light one the darker shade.
		const brightness = (hex: string) => {
			const value = Number.parseInt(hex.slice(1), 16);
			return ((value >> 16) & 255) + ((value >> 8) & 255) + (value & 255);
		};
		expect(brightness(dark.stroke)).toBeGreaterThan(brightness(light.stroke));
	});

	it("keeps every hue inside the ring", () => {
		for (const label of ["a", "Person", "SomeRatherLongLabelName", "KNOWS", "zzz"]) {
			const hue = labelHue(label);
			expect(hue).toBeGreaterThanOrEqual(0);
			expect(hue).toBeLessThan(360);
		}
	});
});

describe("gradientColors", () => {
	it("walks the segment from the start colour to the end colour, endpoints included", () => {
		const colors = gradientColors(3, { from: "#000000", to: "#ffffff" });
		expect(colors).toEqual(["#000000", "#808080", "#ffffff"]);
	});

	it("lands a single colour at the segment's midpoint", () => {
		expect(gradientColors(1, { from: "#000000", to: "#ffffff" })).toEqual(["#808080"]);
	});

	it("inverts every sample when the negative is asked for", () => {
		const colors = gradientColors(2, { from: "#000000", to: "#ffffff", invert: true });
		expect(colors).toEqual(["#ffffff", "#000000"]);
	});

	it("overlays each sample halfway onto the type's base colour", () => {
		const colors = gradientColors(1, { from: "#000000", to: "#ffffff", overlayBase: "#ff0000" });
		// midpoint 127.5 mixed 50/50 with #ff0000, rounded only when written
		expect(colors).toEqual(["#bf4040"]);
	});

	it("returns nothing for a bad count or malformed endpoints", () => {
		expect(gradientColors(0, { from: "#000000", to: "#ffffff" })).toEqual([]);
		expect(gradientColors(2, { from: "red", to: "#ffffff" })).toEqual([]);
	});
});
