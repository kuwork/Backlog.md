import { describe, expect, it } from "bun:test";
import JSZip from "jszip";
import { normalizePptxMedia } from "./pptxMediaNormalize";

const SVG = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>';

async function readText(zip: JSZip, path: string): Promise<string> {
	const file = zip.file(path);
	if (!file) throw new Error(`missing entry: ${path}`);
	return file.async("string");
}

async function buildDeck(): Promise<ArrayBuffer> {
	const zip = new JSZip();
	zip.file("ppt/slides/slide1.xml", "<slide/>");
	zip.file(
		"ppt/slides/_rels/slide1.xml.rels",
		'<Relationships xmlns="x">' +
			'<Relationship Id="rId1" Type="img" Target="media/photo.svg"/>' +
			'<Relationship Id="rId2" Type="layout" Target="../slideLayouts/layout1.xml"/>' +
			"</Relationships>",
	);
	zip.file("ppt/slides/media/photo.svg", SVG);
	// A canonical-location image must be left untouched.
	zip.file("ppt/media/keep.png", "PNG");
	zip.file(
		"ppt/slides/_rels/slide2.xml.rels",
		'<Relationships xmlns="x"><Relationship Id="rId1" Type="img" Target="../media/keep.png"/></Relationships>',
	);
	return zip.generateAsync({ type: "arraybuffer" });
}

describe("normalizePptxMedia", () => {
	it("relocates slide-local media into ppt/media/ and rewrites Targets", async () => {
		const out = await normalizePptxMedia(await buildDeck());
		const zip = await JSZip.loadAsync(out);
		const names: string[] = [];
		zip.forEach((p) => {
			names.push(p.replace(/\\/g, "/"));
		});
		const relocated = names.filter((n) => n.startsWith("ppt/media/") && !n.endsWith("/"));
		expect(relocated).toContain("ppt/media/ppt_slides_media_photo.svg");
		expect(relocated).toContain("ppt/media/keep.png");
		expect(names.some((n) => n === "ppt/slides/media/photo.svg")).toBe(false);

		const rels = await readText(zip, "ppt/slides/_rels/slide1.xml.rels");
		expect(rels).toContain('Target="../media/ppt_slides_media_photo.svg"');
		expect(rels).toContain('Target="../slideLayouts/layout1.xml"');
		expect(await readText(zip, "ppt/media/ppt_slides_media_photo.svg")).toBe(SVG);
	});

	it("passes through decks that already use ppt/media/", async () => {
		// No media outside ppt/media/ -> no relocation -> original buffer returned.
		const zip = new JSZip();
		zip.file("ppt/slides/slide1.xml", "<slide/>");
		zip.file(
			"ppt/slides/_rels/slide1.xml.rels",
			'<Relationships xmlns="x"><Relationship Id="rId1" Type="img" Target="../media/keep.png"/></Relationships>',
		);
		zip.file("ppt/media/keep.png", "PNG");
		const deck = await zip.generateAsync({ type: "arraybuffer" });
		const out = await normalizePptxMedia(deck);
		expect(out).toBe(deck);
	});
});
