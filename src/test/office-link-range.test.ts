import { describe, expect, it } from "bun:test";
import {
	binaryOfficeFileProps,
	kindFromName,
	type OfficeRange,
	type ParsedOfficeLink,
	parseOfficeLink,
} from "../web/components/binaryOfficeFile";

function pages(start: number, end?: number): OfficeRange {
	return end === undefined ? { type: "pages", start } : { type: "pages", start, end };
}

function sheets(...items: string[]): OfficeRange {
	return { type: "sheets", items };
}

describe("parseOfficeLink", () => {
	it("parses a docx page range with the P prefix", () => {
		expect(parseOfficeLink("report.docx:P1-P4")).toEqual<ParsedOfficeLink>({
			filePath: "report.docx",
			kind: "docx",
			range: pages(1, 4),
		});
	});

	it("parses a single docx page", () => {
		expect(parseOfficeLink("report.docx:P3")).toEqual<ParsedOfficeLink>({
			filePath: "report.docx",
			kind: "docx",
			range: pages(3),
		});
	});

	it("requires the P prefix on every paged format", () => {
		// A bare `3-7` stays a plain-text line range, so it is NOT a page range on a document:
		// the file opens in full instead of silently selecting pages 3-7.
		expect(parseOfficeLink("report.docx:3-7").range).toBeNull();
		expect(parseOfficeLink("deck.pptx:3-7").range).toBeNull();
		expect(parseOfficeLink("doc.pdf:3-7").range).toBeNull();
		expect(parseOfficeLink("report.docx:3").range).toBeNull();
		// Both the upper-case and lower-case prefix work, and so does a single trailing number.
		expect(parseOfficeLink("report.docx:P3-P7").range).toEqual(pages(3, 7));
		expect(parseOfficeLink("deck.pptx:p3-p7").range).toEqual(pages(3, 7));
		expect(parseOfficeLink("deck.pptx:P3").range).toEqual(pages(3));
		expect(parseOfficeLink("doc.pdf:P3-7").range).toEqual(pages(3, 7));
	});

	it("parses pptx and pdf page ranges", () => {
		expect(parseOfficeLink("deck.pptx:P1-P4").range).toEqual(pages(1, 4));
		expect(parseOfficeLink("deck.pptx:P1-P4").kind).toBe("pptx");
		expect(parseOfficeLink("doc.pdf:P2").range).toEqual(pages(2));
		expect(parseOfficeLink("doc.pdf:P2").kind).toBe("pdf");
	});

	it("parses xlsx sheet-index ranges and single sheet names", () => {
		expect(parseOfficeLink("book.xlsx:p1").range).toEqual(sheets("p1"));
		expect(parseOfficeLink("book.xlsx:p1-p2").range).toEqual(sheets("p1", "p2"));
		expect(parseOfficeLink("book.xlsx:sheetName").range).toEqual(sheets("sheetName"));
		// A hyphenated name is treated as a single sheet, not a range.
		expect(parseOfficeLink("book.xlsx:Q1-Q2").range).toEqual(sheets("Q1-Q2"));
		expect(parseOfficeLink("book.xlsm:p1-p3").kind).toBe("xlsx");
		expect(parseOfficeLink("book.xlsm:p1-p3").range).toEqual(sheets("p1", "p2", "p3"));
	});

	it("decodes a percent-encoded sheet name", () => {
		expect(parseOfficeLink("book.xlsx:Q1%20Sales").range).toEqual(sheets("Q1 Sales"));
	});

	it("handles site-absolute paths with a range", () => {
		const parsed = parseOfficeLink("/backlog/docs/book.xlsx:p1-p3");
		expect(parsed.filePath).toBe("/backlog/docs/book.xlsx");
		expect(parsed.kind).toBe("xlsx");
		expect(parsed.range).toEqual(sheets("p1", "p2", "p3"));
	});

	it("returns no range for plain office links", () => {
		expect(parseOfficeLink("report.docx").range).toBeNull();
		expect(parseOfficeLink("report.docx").kind).toBe("docx");
	});

	it("treats non-office destinations as unsupported with no range", () => {
		const parsed = parseOfficeLink("notes.md:5");
		expect(parsed.kind).toBe("unsupported");
		expect(parsed.range).toBeNull();
		expect(parsed.filePath).toBe("notes.md:5");
	});

	it("drops a query or fragment before reading the range", () => {
		expect(parseOfficeLink("book.xlsx:p1?download=1").filePath).toBe("book.xlsx");
		expect(parseOfficeLink("book.xlsx:p1?download=1").range).toEqual(sheets("p1"));
		expect(parseOfficeLink("/docs/report.docx:P1-P4#top").range).toEqual(pages(1, 4));
	});

	it("ignores an unparsable range token", () => {
		expect(parseOfficeLink("report.docx:xyz").range).toBeNull();
		expect(parseOfficeLink("report.docx:xyz").kind).toBe("docx");
	});
});

describe("kindFromName", () => {
	it("reads the extension past a :range suffix", () => {
		expect(kindFromName("report.docx:P1-P4")).toBe("docx");
		expect(kindFromName("deck.pptx:P1-P4")).toBe("pptx");
		expect(kindFromName("doc.pdf:P2")).toBe("pdf");
		expect(kindFromName("book.xlsx:p1-p2")).toBe("xlsx");
		// A sheet-name token may hold a space; it must not hide the extension.
		expect(kindFromName("book.xlsx:Q1 Sales")).toBe("xlsx");
	});
});

describe("binaryOfficeFileProps", () => {
	it("strips the :range suffix from the byte URL", () => {
		const props = binaryOfficeFileProps("backlog/docs/report.docx:P1-P4");
		expect(props.fileUrl).toBe("/api/raw-file?path=backlog%2Fdocs%2Freport.docx");
		expect(props.filePath).toBe("backlog/docs/report.docx");
	});
});
