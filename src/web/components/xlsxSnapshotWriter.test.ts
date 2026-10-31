import { describe, expect, test } from "bun:test";
import type { IWorkbookData } from "@univerjs/core";
import { CellValueType, LocaleType } from "@univerjs/core";
import JSZip from "jszip";
import * as XLSX from "xlsx";
import { applySnapshotToXlsx, applySnapshotToXlsxWithStats } from "./xlsxSnapshotWriter";

/**
 * The writer only edits the two parts an in-place save is allowed to touch
 * (`<sheetData>`, `<mergeCells>`); everything else has to come through byte for
 * byte. These tests build a small but structurally valid package and check both.
 */

const sheetXml = (titleIndex: number, oldIndex: number) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<dimension ref="A1:C3"/>
<sheetData>
<row r="1" ht="30" customHeight="1"><c r="A1" s="1" t="s"><v>${titleIndex}</v></c></row>
<row r="2"><c r="A2"><v>1</v></c><c r="B2"><v>2</v></c><c r="C2" s="2"><f>A2+B2</f><v>3</v></c></row>
<row r="3"><c r="A3" s="1" t="s"><v>${oldIndex}</v></c></row>
</sheetData>
<mergeCells count="1"><mergeCell ref="A1:C1"/></mergeCells>
</worksheet>`;

interface Fixture {
	bytes: ArrayBuffer;
	titleIndex: number;
	oldIndex: number;
}

/**
 * SheetJS writes a structurally complete package (content types, rels, styles,
 * shared strings); only the worksheet part is replaced so the fixture exercises
 * the real OOXML shape instead of a hand-rolled approximation.
 */
async function basePackage(): Promise<Fixture> {
	const worksheet = XLSX.utils.aoa_to_sheet([["标题"], [1, 2], ["旧值"]]);
	const workbook = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
	const raw = XLSX.write(workbook, { type: "array", bookType: "xlsx", bookSST: true }) as ArrayBuffer;
	const zip = await JSZip.loadAsync(raw);
	const sharedFile = zip.file("xl/sharedStrings.xml");
	const sharedXml = sharedFile ? await sharedFile.async("text") : "";
	const items = sharedXml.match(/<si>[\s\S]*?<\/si>/g) ?? [];
	const titleIndex = items.findIndex((si) => si.includes("标题"));
	const oldIndex = items.findIndex((si) => si.includes("旧值"));
	if (titleIndex < 0 || oldIndex < 0) throw new Error("fixture shared strings missing");
	zip.file("xl/worksheets/sheet1.xml", sheetXml(titleIndex, oldIndex));
	return { bytes: await zip.generateAsync({ type: "arraybuffer" }), titleIndex, oldIndex };
}

function sheetSnapshot(cellData: Record<number, Record<number, unknown>>): IWorkbookData {
	return {
		id: "wb",
		name: "book",
		appVersion: "1.0.0",
		locale: LocaleType.ZH_CN,
		styles: {},
		sheetOrder: ["sheet-1"],
		sheets: {
			"sheet-1": {
				id: "sheet-1",
				name: "Sheet1",
				rowCount: 20,
				columnCount: 10,
				cellData,
				mergeData: [{ startRow: 0, startColumn: 0, endRow: 0, endColumn: 2 }],
			},
		},
	} as unknown as IWorkbookData;
}

async function sheetXmlOf(bytes: ArrayBuffer): Promise<string> {
	const zip = await JSZip.loadAsync(bytes);
	const file = zip.file("xl/worksheets/sheet1.xml");
	if (!file) throw new Error("sheet1.xml missing");
	return file.async("text");
}

describe("applySnapshotToXlsx", () => {
	test("keeps a cached formula when its value did not change", async () => {
		const patched = await applySnapshotToXlsx(
			(await basePackage()).bytes,
			sheetSnapshot({
				0: { 0: { v: "标题", t: CellValueType.STRING } },
				1: {
					0: { v: 1, t: CellValueType.NUMBER },
					1: { v: 2, t: CellValueType.NUMBER },
					2: { v: 3, t: CellValueType.NUMBER },
				},
				2: { 0: { v: "旧值", t: CellValueType.STRING } },
			}),
		);
		const xml = await sheetXmlOf(patched);
		expect(xml).toContain("<f>A2+B2</f>");
		// Untouched rows keep their original attributes (height, customHeight).
		expect(xml).toContain('<row r="1" ht="30" customHeight="1">');
		expect(xml).toContain("<v>3</v>");
	});

	test("keeps the cached result when the formula is unchanged but recalculated", async () => {
		const patched = await applySnapshotToXlsx(
			(await basePackage()).bytes,
			sheetSnapshot({
				0: { 0: { v: "标题", t: CellValueType.STRING } },
				1: {
					0: { v: 1, t: CellValueType.NUMBER },
					1: { v: 2, t: CellValueType.NUMBER },
					// The browser recalculated the formula and produced a different
					// number; the formula itself is untouched, so Excel's cached value
					// has to survive instead of being replaced by the browser's.
					2: { f: "=A2+B2", v: 99, t: CellValueType.NUMBER },
				},
				2: { 0: { v: "旧值", t: CellValueType.STRING } },
			}),
		);
		const xml = await sheetXmlOf(patched);
		expect(xml).toContain('<c r="C2" s="2"><f>A2+B2</f><v>3</v></c>');
		expect(xml).not.toContain("<v>99</v>");
	});

	test("writes an edited formula in place of the original", async () => {
		const patched = await applySnapshotToXlsx(
			(await basePackage()).bytes,
			sheetSnapshot({
				0: { 0: { v: "标题", t: CellValueType.STRING } },
				1: {
					0: { v: 1, t: CellValueType.NUMBER },
					1: { v: 2, t: CellValueType.NUMBER },
					2: { f: "=A2*B2", v: 2, t: CellValueType.NUMBER },
				},
				2: { 0: { v: "旧值", t: CellValueType.STRING } },
			}),
		);
		const xml = await sheetXmlOf(patched);
		expect(xml).toContain('<c r="C2" s="2"><f>A2*B2</f><v>2</v></c>');
		expect(xml).not.toContain("<f>A2+B2</f>");
	});

	test("reports zero changed cells when the snapshot matches the file", async () => {
		const unchanged = sheetSnapshot({
			0: { 0: { v: "标题", t: CellValueType.STRING } },
			1: {
				0: { v: 1, t: CellValueType.NUMBER },
				1: { v: 2, t: CellValueType.NUMBER },
				2: { f: "=A2+B2", v: 3, t: CellValueType.NUMBER },
			},
			2: { 0: { v: "旧值", t: CellValueType.STRING } },
		});
		const result = await applySnapshotToXlsxWithStats((await basePackage()).bytes, unchanged);
		// This is what the modal uses to refuse a save that would change nothing.
		expect(result.changedCells).toBe(0);

		const edited = sheetSnapshot({
			0: { 0: { v: "标题", t: CellValueType.STRING } },
			1: {
				0: { v: 1, t: CellValueType.NUMBER },
				1: { v: 2, t: CellValueType.NUMBER },
				2: { f: "=A2+B2", v: 3, t: CellValueType.NUMBER },
			},
			2: { 0: { v: "改过的合并单元格文字", t: CellValueType.STRING } },
		});
		const changed = await applySnapshotToXlsxWithStats((await basePackage()).bytes, edited);
		expect(changed.changedCells).toBe(1);
	});

	test("writes an edited value and preserves that cell's style index", async () => {
		const patched = await applySnapshotToXlsx(
			(await basePackage()).bytes,
			sheetSnapshot({
				0: { 0: { v: "标题", t: CellValueType.STRING } },
				1: {
					0: { v: 1, t: CellValueType.NUMBER },
					1: { v: 2, t: CellValueType.NUMBER },
					2: { v: 3, t: CellValueType.NUMBER },
				},
				2: { 0: { v: "新值", t: CellValueType.STRING } },
			}),
		);
		const xml = await sheetXmlOf(patched);
		// Edited: regenerated as an inline string, original s="1" carried over.
		expect(xml).toContain('<c r="A3" s="1" t="inlineStr"><is><t xml:space="preserve">新值</t></is></c>');
		// The stale shared-string cell must be gone from the row.
		expect(xml).not.toContain('r="A3" s="1" t="s"');
	});

	test("adds a new cell and leaves other package parts untouched", async () => {
		const { bytes: original } = await basePackage();
		const patched = await applySnapshotToXlsx(
			original,
			sheetSnapshot({
				0: { 0: { v: "标题", t: CellValueType.STRING } },
				1: {
					0: { v: 1, t: CellValueType.NUMBER },
					1: { v: 2, t: CellValueType.NUMBER },
					2: { v: 3, t: CellValueType.NUMBER },
				},
				2: { 0: { v: "旧值", t: CellValueType.STRING } },
				3: { 1: { v: 42, t: CellValueType.NUMBER } },
			}),
		);
		const xml = await sheetXmlOf(patched);
		expect(xml).toContain('<c r="B4"><v>42</v></c>');

		const beforeZip = await JSZip.loadAsync(original);
		const afterZip = await JSZip.loadAsync(patched);
		const beforeStyles = beforeZip.file("xl/styles.xml");
		const afterStyles = afterZip.file("xl/styles.xml");
		if (!beforeStyles || !afterStyles) throw new Error("styles.xml missing");
		expect(await afterStyles.async("text")).toBe(await beforeStyles.async("text"));

		// Merges are unchanged, so the original block is reused verbatim.
		expect(xml).toContain('<mergeCells count="1"><mergeCell ref="A1:C1"/></mergeCells>');
	});

	test("rewrites mergeCells when the merge set changed", async () => {
		const snapshot = sheetSnapshot({
			0: { 0: { v: "标题", t: CellValueType.STRING } },
			1: {
				0: { v: 1, t: CellValueType.NUMBER },
				1: { v: 2, t: CellValueType.NUMBER },
				2: { v: 3, t: CellValueType.NUMBER },
			},
			2: { 0: { v: "旧值", t: CellValueType.STRING } },
		});
		const sheets = snapshot.sheets as Record<string, { mergeData: unknown[] }>;
		const sheet = sheets["sheet-1"];
		if (!sheet) throw new Error("sheet missing");
		sheet.mergeData = [];

		const xml = await sheetXmlOf(await applySnapshotToXlsx((await basePackage()).bytes, snapshot));
		expect(xml).not.toContain("<mergeCells");
	});

	test("production package still reads back as a workbook", async () => {
		const patched = await applySnapshotToXlsx(
			(await basePackage()).bytes,
			sheetSnapshot({
				0: { 0: { v: "标题", t: CellValueType.STRING } },
				1: {
					0: { v: 1, t: CellValueType.NUMBER },
					1: { v: 2, t: CellValueType.NUMBER },
					2: { v: 3, t: CellValueType.NUMBER },
				},
				2: { 0: { v: "新值", t: CellValueType.STRING } },
			}),
		);
		const workbook = XLSX.read(patched, { type: "array" });
		expect(workbook.SheetNames).toEqual(["Sheet1"]);
		const sheetName = workbook.SheetNames[0];
		if (!sheetName) throw new Error("sheet missing");
		const first = workbook.Sheets[sheetName];
		if (!first) throw new Error("sheet data missing");
		expect(first.A3?.v).toBe("新值");
		expect(first.B2?.v).toBe(2);
	});
});
