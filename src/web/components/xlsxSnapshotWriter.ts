import type { ICellData, IWorkbookData } from "@univerjs/core";
import { CellValueType } from "@univerjs/core";
import JSZip from "jszip";
import * as XLSX from "xlsx";

/**
 * Writer: Univer workbook snapshot -> .xlsx bytes, applied as an in-place patch.
 *
 * The preview never parses everything an .xlsx can hold (charts, pivot tables,
 * images, conditional formatting, data validation, comments...), so rebuilding
 * the package from the snapshot would silently destroy all of it. Instead the
 * original zip is kept and only the two parts the editor can actually change are
 * regenerated:
 *
 *   - `<sheetData>`: rewritten cell by cell, but untouched cells keep their
 *     original XML fragment verbatim (shared formulas, comment anchors, style
 *     indices and cached results survive a save that did not touch them).
 *   - `<mergeCells>`: replaced only when the merge set actually changed.
 *
 * Every other zip entry (styles, theme, sharedStrings, media, drawings, charts,
 * ...) is copied through byte for byte.
 */

const SHEET_DATA_RE = /<sheetData\b[^>]*\/>|<sheetData\b[^>]*>[\s\S]*?<\/sheetData>/;
const MERGE_CELLS_RE = /<mergeCells\b[^>]*\/>|<mergeCells\b[^>]*>[\s\S]*?<\/mergeCells>/;

interface ParsedCell {
	attrs: string;
	type?: string;
	formula?: string;
	/** True when the cell carries an `<f>`, even a text-less shared-formula one. */
	hasFormula: boolean;
	value?: string;
	inner: string;
	/** Original `<c .../>` fragment, reused as-is when the cell is unchanged. */
	fragment: string;
}

interface ParsedRow {
	attrs: string;
	cells: Map<number, ParsedCell>;
}

/** Attributes of an XML start tag, keyed by name. */
function attrMap(attrs: string): Record<string, string> {
	const map: Record<string, string> = {};
	const re = /([\w:.-]+)\s*=\s*"([^"]*)"/g;
	let match = re.exec(attrs);
	while (match) {
		const key = match[1];
		const value = match[2];
		if (key !== undefined && value !== undefined) map[key] = value;
		match = re.exec(attrs);
	}
	return map;
}

function escapeText(value: string): string {
	return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(value: string): string {
	return escapeText(value).replace(/"/g, "&quot;");
}

function columnName(index: number): string {
	let name = "";
	let n = index;
	do {
		name = String.fromCharCode(65 + (n % 26)) + name;
		n = Math.floor(n / 26) - 1;
	} while (n >= 0);
	return name;
}

function cellRef(row: number, column: number): string {
	return `${columnName(column)}${row + 1}`;
}

function decodeRef(ref: string): { row: number; column: number } | null {
	const match = /^([A-Z]+)(\d+)$/.exec(ref.trim().toUpperCase());
	if (!match) return null;
	const letters = match[1] ?? "";
	const rowDigits = match[2] ?? "";
	if (!letters || !rowDigits) return null;
	let column = 0;
	for (const char of letters) column = column * 26 + (char.charCodeAt(0) - 64);
	return { row: Number(rowDigits) - 1, column: column - 1 };
}

/** Split a worksheet's `<sheetData>` into rows/cells, keeping each raw fragment. */
function parseRows(sheetDataXml: string): Map<number, ParsedRow> {
	const rows = new Map<number, ParsedRow>();
	const rowRe = /<row\b([^>]*?)(\/>|>([\s\S]*?)<\/row>)/g;
	let rowMatch = rowRe.exec(sheetDataXml);
	while (rowMatch) {
		const attrs = rowMatch[1] ?? "";
		const inner = rowMatch[3] ?? "";
		// `<row r="N">` is 1-based in OOXML; the snapshot cellData is 0-based.
		const rowNumber = Number(attrMap(attrs).r ?? "0") - 1;
		const cells = new Map<number, ParsedCell>();
		const cellRe = /<c\b([^>]*?)(\/>|>([\s\S]*?)<\/c>)/g;
		let cellMatch = cellRe.exec(inner);
		while (cellMatch) {
			const cellAttrs = cellMatch[1] ?? "";
			const cellSelfClosing = cellMatch[2] === "/>";
			const cellInner = cellMatch[3] ?? "";
			const ref = attrMap(cellAttrs).r;
			if (ref) {
				const decoded = decodeRef(ref);
				if (decoded) {
					const formulaMatch = /<f\b[^>]*>([\s\S]*?)<\/f>/.exec(cellInner);
					const valueMatch = /<v>([\s\S]*?)<\/v>/.exec(cellInner);
					cells.set(decoded.column, {
						attrs: cellAttrs,
						type: attrMap(cellAttrs).t,
						// `<f t="shared" si="0"/>` carries no text: leave it undefined and the
						// fragment is preserved verbatim instead of being regenerated.
						formula: formulaMatch?.[1],
						hasFormula: /<f\b/.test(cellInner),
						value: valueMatch?.[1],
						inner: cellInner,
						fragment: `<c${cellAttrs}${cellSelfClosing ? "/>" : `>${cellInner}</c>`}`,
					});
				}
			}
			cellMatch = cellRe.exec(inner);
		}
		if (Number.isFinite(rowNumber) && rowNumber >= 0) rows.set(rowNumber, { attrs, cells });
		rowMatch = rowRe.exec(sheetDataXml);
	}
	return rows;
}

/** Text of a shared string entry (`<si>`), concatenating rich-text runs. */
function sharedStringText(siXml: string): string {
	const runs = siXml.match(/<t\b[^>]*>[\s\S]*?<\/t>/g) ?? [];
	return runs
		.map((run) => run.replace(/<t\b[^>]*>/, "").replace(/<\/t>$/, ""))
		.join("")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&amp;/g, "&");
}

function inlineText(inner: string): string {
	const match = /<t\b[^>]*>([\s\S]*?)<\/t>/.exec(inner);
	if (!match) return "";
	return (match[1] ?? "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

/**
 * The value of an original cell in a form comparable with the snapshot.
 * Shared strings need the table; everything else is inline.
 */
function originalValue(cell: ParsedCell, shared: string[]): string | number | boolean | null {
	if (cell.type === "s") {
		const index = Number(cell.value);
		return Number.isFinite(index) ? (shared[index] ?? null) : null;
	}
	if (cell.type === "inlineStr") return inlineText(cell.inner);
	if (cell.type === "b") return cell.value === "1";
	if (cell.value === undefined) return null;
	const numeric = Number(cell.value);
	return cell.value !== "" && Number.isFinite(numeric) ? numeric : cell.value;
}

function snapshotValue(cell: ICellData | undefined): string | number | boolean | null {
	if (!cell || cell.v === undefined || cell.v === null) return null;
	if (typeof cell.v === "number" || typeof cell.v === "boolean" || typeof cell.v === "string") return cell.v;
	return String(cell.v);
}

/** True when the snapshot still holds what the file had, i.e. the cell is untouched. */
function valueUnchanged(original: ParsedCell, cell: ICellData | undefined, shared: string[]): boolean {
	const before = originalValue(original, shared);
	const after = snapshotValue(cell);
	if (before === null && after === null) return true;
	if (before === null || after === null) return false;
	if (typeof before === "number" && typeof after === "number") return before === after;
	return String(before) === String(after);
}

function stripEquals(formula: string): string {
	const trimmed = formula.trim();
	return trimmed.startsWith("=") ? trimmed.slice(1) : trimmed;
}

/**
 * Compare the snapshot formula with what the file holds.
 *
 * "same" means the formula text survived untouched, so the original fragment can
 * be reused — this matters because the preview recalculates formulas in the
 * browser, and a value-only comparison would rewrite every formula cell on every
 * save with Univer's result instead of Excel's cached one.
 * "unknown" means the formulas cannot be compared (no formula in the snapshot,
 * or a shared formula with no text of its own), so the decision falls back to
 * the cached value: a formula is only dropped when the value changed too.
 */
function compareFormula(original: ParsedCell, cell: ICellData | undefined): "same" | "different" | "unknown" {
	const next = typeof cell?.f === "string" && cell.f.trim() ? stripEquals(cell.f) : "";
	if (!original.hasFormula) return next ? "different" : "unknown";
	if (!next) return "unknown";
	const before = original.formula ? stripEquals(original.formula) : "";
	if (!before) return "unknown";
	return before === next ? "same" : "different";
}

function serializeCellAttrs(original: ParsedCell | undefined, ref: string, type: string | null): string {
	const parts = [`r="${ref}"`];
	if (original) {
		const attrs = attrMap(original.attrs);
		for (const [key, value] of Object.entries(attrs)) {
			// `t` is decided by the value being written, `r` is already emitted.
			if (key === "r" || key === "t") continue;
			parts.push(`${key}="${escapeAttr(value)}"`);
		}
	}
	if (type) parts.push(`t="${type}"`);
	return parts.join(" ");
}

function formulaBody(formula: string): string {
	return formula.startsWith("=") ? formula.slice(1) : formula;
}

/** Serialize one snapshot cell into `<c>` XML, or null when it carries nothing. */
function serializeCell(ref: string, original: ParsedCell | undefined, cell: ICellData | undefined): string | null {
	if (!cell) return null;
	const value = snapshotValue(cell);
	const formula = typeof cell.f === "string" && cell.f.length > 0 ? cell.f : undefined;

	if (formula) {
		const cached = typeof value === "number" ? `<v>${value}</v>` : "";
		return `<c ${serializeCellAttrs(original, ref, null)}><f>${escapeText(formulaBody(formula))}</f>${cached}</c>`;
	}

	if (value === null) {
		// Style-only cell: keep whatever was already in the file.
		return null;
	}

	const type = cell.t;
	if (type === CellValueType.STRING || type === CellValueType.FORCE_STRING || typeof value === "string") {
		const text = String(value);
		if (text === "") return null;
		return `<c ${serializeCellAttrs(original, ref, "inlineStr")}><is><t xml:space="preserve">${escapeText(text)}</t></is></c>`;
	}
	if (typeof value === "boolean" || type === CellValueType.BOOLEAN) {
		return `<c ${serializeCellAttrs(original, ref, "b")}><v>${value ? 1 : 0}</v></c>`;
	}
	const numeric = Number(value);
	if (!Number.isFinite(numeric)) {
		return `<c ${serializeCellAttrs(original, ref, "str")}><v>${escapeText(String(value))}</v></c>`;
	}
	return `<c ${serializeCellAttrs(original, ref, null)}><v>${numeric}</v></c>`;
}

/** Rebuild the whole `<sheetData>` block from the snapshot. */
function buildSheetData(
	snapshotSheet: { cellData?: Record<number, Record<number, ICellData>> },
	original: Map<number, ParsedRow>,
	shared: string[],
): { xml: string; changed: number } {
	const cellData = snapshotSheet.cellData ?? {};
	const rowNumbers = new Set<number>();
	for (const key of Object.keys(cellData)) rowNumbers.add(Number(key));
	for (const row of original.keys()) rowNumbers.add(row);

	let changed = 0;
	const rowsXml: string[] = [];
	for (const rowNumber of [...rowNumbers].sort((a, b) => a - b)) {
		const originalRow = original.get(rowNumber);
		const rowCells = cellData[rowNumber] ?? {};
		const columns = new Set<number>();
		for (const key of Object.keys(rowCells)) columns.add(Number(key));
		if (originalRow) for (const column of originalRow.cells.keys()) columns.add(column);

		const cellsXml: string[] = [];
		for (const column of [...columns].sort((a, b) => a - b)) {
			const cell = rowCells[column];
			const originalCell = originalRow?.cells.get(column);
			const ref = cellRef(rowNumber, column);

			if (originalCell) {
				const formulaState = compareFormula(originalCell, cell);
				const untouched =
					formulaState === "same" || (formulaState === "unknown" && valueUnchanged(originalCell, cell, shared));
				if (untouched) {
					// Untouched: reuse the original fragment (keeps shared formulas, cm/vm,
					// style indices and cached results exactly as Excel wrote them).
					cellsXml.push(originalCell.fragment);
					continue;
				}
			}

			changed++;
			const serialized = serializeCell(ref, originalCell, cell);
			if (serialized) cellsXml.push(serialized);
		}

		// Reuse the original row attributes (height, customHeight, outline level...);
		// only a row number is guaranteed, so add it when the original had none.
		const baseAttrs = originalRow?.attrs ?? "";
		const attrs = /\br="/.test(baseAttrs) ? baseAttrs : `${baseAttrs} r="${rowNumber + 1}"`;
		if (cellsXml.length === 0) {
			if (originalRow) rowsXml.push(`<row${attrs}/>`);
			continue;
		}
		rowsXml.push(`<row${attrs}>${cellsXml.join("")}</row>`);
	}

	if (rowsXml.length === 0) return { xml: "<sheetData/>", changed };
	return { xml: `<sheetData>${rowsXml.join("")}</sheetData>`, changed };
}

function mergeRefs(
	mergeData: { startRow: number; startColumn: number; endRow: number; endColumn: number }[],
): string[] {
	return mergeData
		.map((range) =>
			range.startRow === range.endRow && range.startColumn === range.endColumn
				? null
				: `${cellRef(range.startRow, range.startColumn)}:${cellRef(range.endRow, range.endColumn)}`,
		)
		.filter((ref): ref is string => Boolean(ref));
}

function buildMergeCells(refs: string[]): string {
	if (refs.length === 0) return "";
	return `<mergeCells count="${refs.length}">${refs.map((ref) => `<mergeCell ref="${ref}"/>`).join("")}</mergeCells>`;
}

function existingMergeRefs(sheetXml: string): string[] {
	const block = MERGE_CELLS_RE.exec(sheetXml)?.[0];
	if (!block) return [];
	const refs = block.match(/ref="([^"]+)"/g) ?? [];
	return refs.map((ref) => ref.slice(5, -1));
}

function sameRefSet(left: string[], right: string[]): boolean {
	if (left.length !== right.length) return false;
	const sortedLeft = [...left].sort();
	const sortedRight = [...right].sort();
	return sortedLeft.every((ref, index) => ref === sortedRight[index]);
}

interface ZipEntry {
	path: string;
	text: string;
}

/** Resolve workbook sheet order -> worksheet part path, via workbook.xml + its rels. */
function resolveSheetEntries(workbookXml: string, relsXml: string): { name: string; path: string }[] {
	const relTargets = new Map<string, string>();
	const relRe = /<Relationship\b[^>]*\/?>/g;
	let relMatch = relRe.exec(relsXml);
	while (relMatch) {
		const attrs = attrMap(relMatch[0]);
		const id = attrs.Id;
		const target = attrs.Target;
		if (id && target) {
			const normalized = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
			relTargets.set(id, normalized.replace(/\/\.\//g, "/"));
		}
		relMatch = relRe.exec(relsXml);
	}

	const entries: { name: string; path: string }[] = [];
	// `<sheet\b` cannot match `<sheets>`: no word boundary between t and s.
	const sheetRe = /<sheet\b[^>]*\/?>/g;
	let sheetMatch = sheetRe.exec(workbookXml);
	while (sheetMatch) {
		const attrs = attrMap(sheetMatch[0]);
		const name = attrs.name ?? "";
		const rid = attrs["r:id"];
		const path = rid ? relTargets.get(rid) : undefined;
		if (path && name) entries.push({ name, path });
		sheetMatch = sheetRe.exec(workbookXml);
	}
	return entries;
}

async function readSharedStrings(zip: JSZip): Promise<string[]> {
	const file = zip.file("xl/sharedStrings.xml");
	if (!file) return [];
	const xml = await file.async("string");
	const items = xml.match(/<si\b[^>]*>[\s\S]*?<\/si>/g) ?? [];
	return items.map(sharedStringText);
}

/**
 * Patch the original package with a Univer snapshot.
 *
 * Throws when the package cannot be read at all; any sheet the snapshot does not
 * know about (added in the editor, which the preview does not support saving) is
 * skipped rather than invented.
 */
export async function applySnapshotToXlsx(original: ArrayBuffer, snapshot: IWorkbookData): Promise<ArrayBuffer> {
	return (await patchXlsx(original, snapshot)).bytes;
}

export interface XlsxPatchResult {
	bytes: ArrayBuffer;
	/**
	 * Cells the snapshot actually changed (plus 1 when the merge set changed).
	 * Zero means the package is semantically identical to the original — the
	 * caller uses that to avoid reporting a save when nothing was committed.
	 */
	changedCells: number;
}

export async function applySnapshotToXlsxWithStats(
	original: ArrayBuffer,
	snapshot: IWorkbookData,
): Promise<XlsxPatchResult> {
	return patchXlsx(original, snapshot);
}

async function patchXlsx(original: ArrayBuffer, snapshot: IWorkbookData): Promise<XlsxPatchResult> {
	const zip = await JSZip.loadAsync(original);
	const workbookEntry = zip.file("xl/workbook.xml");
	if (!workbookEntry) throw new Error("工作簿缺少 xl/workbook.xml，无法安全写回");
	const workbookXml = await workbookEntry.async("string");
	const relsEntry = zip.file("xl/_rels/workbook.xml.rels");
	const relsXml = relsEntry ? await relsEntry.async("string") : "";

	const entries = resolveSheetEntries(workbookXml, relsXml);
	const shared = await readSharedStrings(zip);

	let changedCells = 0;
	const patches: ZipEntry[] = [];
	for (const entry of entries) {
		const sheetId = snapshot.sheetOrder.find((id) => snapshot.sheets[id]?.name === entry.name);
		if (!sheetId) continue;
		const sheetSnapshot = snapshot.sheets[sheetId];
		if (!sheetSnapshot) continue;
		const file = zip.file(entry.path);
		if (!file) continue;
		const sheetXml = await file.async("string");

		const sheetDataMatch = SHEET_DATA_RE.exec(sheetXml);
		if (!sheetDataMatch) continue;

		const originalRows = parseRows(sheetDataMatch[0]);
		const built = buildSheetData(sheetSnapshot, originalRows, shared);
		const nextSheetData = built.xml;
		changedCells += built.changed;

		const nextMergeRefs = mergeRefs(sheetSnapshot.mergeData ?? []);
		const currentMergeRefs = existingMergeRefs(sheetXml);

		let patched = sheetXml.replace(SHEET_DATA_RE, nextSheetData);
		if (!sameRefSet(nextMergeRefs, currentMergeRefs)) {
			changedCells++;
			const nextMergeXml = buildMergeCells(nextMergeRefs);
			if (MERGE_CELLS_RE.test(patched)) {
				patched = nextMergeXml ? patched.replace(MERGE_CELLS_RE, nextMergeXml) : patched.replace(MERGE_CELLS_RE, "");
			} else if (nextMergeXml) {
				// mergeCells belongs right after sheetData in the CT_Worksheet sequence.
				patched = patched.replace(nextSheetData, `${nextSheetData}${nextMergeXml}`);
			}
		}

		patches.push({ path: entry.path, text: patched });
	}

	for (const patch of patches) zip.file(patch.path, patch.text);

	const bytes = await zip.generateAsync({
		type: "arraybuffer",
		compression: "DEFLATE",
		compressionOptions: { level: 6 },
	});
	// Final gate: the patched package must still read back as a workbook, otherwise
	// nothing is sent to the server and the original file stays untouched.
	try {
		const check = XLSX.read(bytes, { type: "array" });
		if (!check.SheetNames || check.SheetNames.length === 0) throw new Error("no worksheets");
	} catch (error) {
		throw new Error(`写回结果校验失败，已取消保存：${error instanceof Error ? error.message : String(error)}`);
	}
	return { bytes, changedCells };
}
