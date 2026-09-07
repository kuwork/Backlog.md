import { describe, expect, it } from "bun:test";
import { extractTempImageUrls, replaceTempImageUrls } from "./temp-assets";

describe("extractTempImageUrls", () => {
	it("extracts unique temp asset urls from markdown", () => {
		const text = "![a](/assets/.temp/one.png) ![b](/assets/.temp/two.png) ![a again](/assets/.temp/one.png)";
		expect(extractTempImageUrls(text)).toEqual(["/assets/.temp/one.png", "/assets/.temp/two.png"]);
	});

	it("returns an empty array when no temp urls exist", () => {
		expect(extractTempImageUrls("no images here")).toEqual([]);
		expect(extractTempImageUrls("")).toEqual([]);
	});
});

describe("replaceTempImageUrls", () => {
	it("replaces temp urls with promoted urls", () => {
		const text = "![a](/assets/.temp/one.png)";
		const result = replaceTempImageUrls(text, { "/assets/.temp/one.png": "/assets/promoted.png" });
		expect(result).toBe("![a](/assets/promoted.png)");
	});

	it("leaves text unchanged when mapping is empty", () => {
		const text = "![a](/assets/.temp/one.png)";
		expect(replaceTempImageUrls(text, {})).toBe(text);
	});
});
