import type {
	IBorderData,
	ICellData,
	IColumnData,
	IRange,
	IRowData,
	IStyleData,
	IWorkbookData,
	IWorksheetData,
} from "@univerjs/core";
import {
	BooleanNumber,
	BorderStyleTypes,
	CellValueType,
	HorizontalAlign,
	LocaleType,
	VerticalAlign,
	WrapStrategy,
} from "@univerjs/core";
import * as XLSX from "xlsx";
import type { CellFormat } from "./xlsxStyleReader";
import { readWorkbookFormats } from "./xlsxStyleReader";

/**
 * Adapter: .xlsx package -> Univer IWorkbookData.
 *
 * Univer's open-source core renders IWorkbookData with high layout fidelity, but
 * its own .xlsx import lives in the paid Pro plugins. So the file is read here:
 * SheetJS supplies values, merged ranges and row/column sizes, while the shared
 * style table comes from the OOXML package itself (see xlsxStyleReader, because
 * the community SheetJS build exposes only a fill's pattern type).
 *
 * Known gap (documented, not a bug): charts, pivot tables, sparklines,
 * conditional formatting and drawings are not read, so they are absent from the
 * preview. Theme colours resolve against the default Office palette.
 */

const MIN_ROWS = 80;
const MIN_COLUMNS = 16;
/** Excel's default column width is 8.43 characters ≈ 64 px. */
const DEFAULT_COLUMN_WIDTH = 64;
/** Excel's default row height is 15 pt = 20 px. */
const DEFAULT_ROW_HEIGHT = 20;

const BORDER_STYLE: Record<string, BorderStyleTypes> = {
	thin: BorderStyleTypes.THIN,
	hair: BorderStyleTypes.HAIR,
	dotted: BorderStyleTypes.DOTTED,
	dashed: BorderStyleTypes.DASHED,
	dashDot: BorderStyleTypes.DASH_DOT,
	dashDotDot: BorderStyleTypes.DASH_DOT_DOT,
	double: BorderStyleTypes.DOUBLE,
	medium: BorderStyleTypes.MEDIUM,
	mediumDashed: BorderStyleTypes.MEDIUM_DASHED,
	mediumDashDot: BorderStyleTypes.MEDIUM_DASH_DOT,
	mediumDashDotDot: BorderStyleTypes.MEDIUM_DASH_DOT_DOT,
	slantDashDot: BorderStyleTypes.SLANT_DASH_DOT,
	thick: BorderStyleTypes.THICK,
};

const HORIZONTAL_ALIGN: Record<string, HorizontalAlign> = {
	left: HorizontalAlign.LEFT,
	center: HorizontalAlign.CENTER,
	centerContinuous: HorizontalAlign.CENTER,
	right: HorizontalAlign.RIGHT,
	justify: HorizontalAlign.JUSTIFIED,
	distributed: HorizontalAlign.DISTRIBUTED,
};

const VERTICAL_ALIGN: Record<string, VerticalAlign> = {
	top: VerticalAlign.TOP,
	center: VerticalAlign.MIDDLE,
	bottom: VerticalAlign.BOTTOM,
};

function resolveBorder(side: { style: string; color?: string } | undefined) {
	if (!side) return undefined;
	const style = BORDER_STYLE[side.style];
	if (!style) return undefined;
	return { s: style, cl: { rgb: side.color ?? "#000000" } };
}

/** Translate one cell format into Univer style data (null when nothing applies). */
function buildStyle(format: CellFormat | undefined): IStyleData | null {
	if (!format) return null;
	const style: IStyleData = {};

	if (format.font) {
		const font = format.font;
		if (font.name) style.ff = font.name;
		if (font.size) style.fs = font.size;
		if (font.bold) style.bl = BooleanNumber.TRUE;
		if (font.italic) style.it = BooleanNumber.TRUE;
		if (font.underline) style.ul = { s: BooleanNumber.TRUE };
		if (font.strike) style.st = { s: BooleanNumber.TRUE };
		if (font.color) style.cl = { rgb: font.color };
	}
	if (format.fill) style.bg = { rgb: format.fill };

	if (format.borders) {
		const bd: IBorderData = {};
		const top = resolveBorder(format.borders.top);
		if (top) bd.t = top;
		const right = resolveBorder(format.borders.right);
		if (right) bd.r = right;
		const bottom = resolveBorder(format.borders.bottom);
		if (bottom) bd.b = bottom;
		const left = resolveBorder(format.borders.left);
		if (left) bd.l = left;
		if (Object.keys(bd).length > 0) style.bd = bd;
	}

	if (format.align) {
		const horizontal = HORIZONTAL_ALIGN[format.align.horizontal ?? ""];
		if (horizontal) style.ht = horizontal;
		const vertical = VERTICAL_ALIGN[format.align.vertical ?? ""];
		if (vertical) style.vt = vertical;
		if (format.align.wrapText) style.tb = WrapStrategy.WRAP;
	}

	if (format.numFmt) style.n = { pattern: format.numFmt };

	return Object.keys(style).length > 0 ? style : null;
}

/** Deduplicates styles so identical formatting shares one id (Univer convention). */
class StyleRegistry {
	private readonly idByKey = new Map<string, string>();
	readonly styles: Record<string, IStyleData> = {};

	idFor(style: IStyleData): string {
		const key = JSON.stringify(style);
		const existing = this.idByKey.get(key);
		if (existing) return existing;
		const id = `s${this.idByKey.size + 1}`;
		this.idByKey.set(key, id);
		this.styles[id] = style;
		return id;
	}
}

function cellValue(cell: XLSX.CellObject): Pick<ICellData, "v" | "t"> | null {
	switch (cell.t) {
		case "n":
			return typeof cell.v === "number" && Number.isFinite(cell.v) ? { v: cell.v, t: CellValueType.NUMBER } : null;
		case "s":
			return cell.v === undefined || cell.v === null ? null : { v: String(cell.v), t: CellValueType.STRING };
		case "b":
			return { v: Boolean(cell.v), t: CellValueType.BOOLEAN };
		case "e":
			// Univer has no error cell type; surface the Excel error text as a string.
			return { v: String(cell.w ?? cell.v ?? "#ERROR!"), t: CellValueType.STRING };
		case "d": {
			const value = cell.v;
			if (value instanceof Date) return { v: value.getTime(), t: CellValueType.NUMBER };
			return typeof value === "number" ? { v: value, t: CellValueType.NUMBER } : null;
		}
		default:
			return cell.v === undefined || cell.v === null ? null : { v: String(cell.v), t: CellValueType.STRING };
	}
}

function columnWidthPx(info: { wpx?: number; wch?: number; width?: number }): number | null {
	if (typeof info.wpx === "number" && info.wpx > 0) return Math.round(info.wpx);
	const chars = typeof info.wch === "number" ? info.wch : info.width;
	if (typeof chars === "number" && chars > 0) return Math.round(chars * 7 + 5);
	return null;
}

function rowHeightPx(info: { hpx?: number; hpt?: number }): number | null {
	if (typeof info.hpx === "number" && info.hpx > 0) return Math.round(info.hpx);
	if (typeof info.hpt === "number" && info.hpt > 0) return Math.round((info.hpt * 96) / 72);
	return null;
}

function convertSheet(
	worksheet: XLSX.WorkSheet,
	name: string,
	id: string,
	registry: StyleRegistry,
	formats: Map<string, CellFormat> | undefined,
): IWorksheetData {
	const range = XLSX.utils.decode_range(worksheet["!ref"] ?? "A1");
	const rowCount = Math.max(range.e.r + 1, MIN_ROWS);
	const columnCount = Math.max(range.e.c + 1, MIN_COLUMNS);

	const cellData: Record<number, Record<number, ICellData>> = {};
	const ensureCell = (row: number, column: number): ICellData => {
		let rowCells = cellData[row];
		if (!rowCells) {
			rowCells = {};
			cellData[row] = rowCells;
		}
		let cell = rowCells[column];
		if (!cell) {
			cell = {};
			rowCells[column] = cell;
		}
		return cell;
	};

	// 1. Values and formulas from SheetJS.
	for (let row = range.s.r; row <= range.e.r; row++) {
		for (let column = range.s.c; column <= range.e.c; column++) {
			const cell = worksheet[XLSX.utils.encode_cell({ r: row, c: column })] as XLSX.CellObject | undefined;
			if (!cell) continue;
			const value = cellValue(cell);
			// SheetJS keeps the formula text without the leading "="; Univer wants it.
			const formula = typeof cell.f === "string" && cell.f.trim() ? cell.f.trim() : undefined;
			// A formula without a cached result still has to reach the grid, otherwise
			// the cell would look empty and the formula bar would have nothing to show.
			if (!value && !formula) continue;
			const target = ensureCell(row, column);
			if (value) {
				target.v = value.v;
				target.t = value.t;
			}
			if (formula) target.f = formula.startsWith("=") ? formula : `=${formula}`;
		}
	}

	// 2. Formats from the OOXML style table. Styled-but-empty cells get an entry
	//    too, otherwise their fill and borders would not render.
	if (formats) {
		for (const [reference, format] of formats) {
			const style = buildStyle(format);
			if (!style) continue;
			const cellRef = XLSX.utils.decode_cell(reference);
			if (cellRef.r >= rowCount || cellRef.c >= columnCount) continue;
			ensureCell(cellRef.r, cellRef.c).s = registry.idFor(style);
		}
	}

	const mergeData: IRange[] = (worksheet["!merges"] ?? []).map((merge) => ({
		startRow: merge.s.r,
		startColumn: merge.s.c,
		endRow: merge.e.r,
		endColumn: merge.e.c,
	}));

	const columnData: Record<number, Partial<IColumnData>> = {};
	for (let column = 0; column < columnCount; column++) {
		const info = worksheet["!cols"]?.[column];
		if (!info) continue;
		const entry: Partial<IColumnData> = {};
		const width = columnWidthPx(info);
		if (width) entry.w = width;
		if (info.hidden) entry.hd = BooleanNumber.TRUE;
		if (Object.keys(entry).length > 0) columnData[column] = entry;
	}

	const rowData: Record<number, Partial<IRowData>> = {};
	for (let row = 0; row < rowCount; row++) {
		const info = worksheet["!rows"]?.[row];
		if (!info) continue;
		const entry: Partial<IRowData> = {};
		const height = rowHeightPx(info);
		if (height) entry.h = height;
		if (info.hidden) entry.hd = BooleanNumber.TRUE;
		if (Object.keys(entry).length > 0) rowData[row] = entry;
	}

	return {
		id,
		name,
		tabColor: "",
		hidden: BooleanNumber.FALSE,
		freeze: { xSplit: 0, ySplit: 0, startRow: -1, startColumn: -1 },
		rowCount,
		columnCount,
		zoomRatio: 1,
		scrollTop: 0,
		scrollLeft: 0,
		defaultColumnWidth: DEFAULT_COLUMN_WIDTH,
		defaultRowHeight: DEFAULT_ROW_HEIGHT,
		cellData,
		mergeData,
		columnData,
		rowData,
		rowHeader: { width: 46, hidden: BooleanNumber.FALSE },
		columnHeader: { height: DEFAULT_ROW_HEIGHT, hidden: BooleanNumber.FALSE },
		showGridlines: BooleanNumber.TRUE,
		rightToLeft: BooleanNumber.FALSE,
	};
}

/**
 * Parse an .xlsx/.xlsm package and translate it into Univer workbook data.
 * Cell values come from SheetJS's cached results, so formulas display what Excel
 * last computed instead of being recalculated here.
 */
export async function xlsxToUniverModel(buffer: ArrayBuffer, fallbackName: string): Promise<IWorkbookData> {
	const workbook = XLSX.read(buffer, {
		type: "array",
		cellDates: false, // keep date serials so their number format applies
		cellFormula: true,
		// cellStyles is what makes SheetJS emit !cols / !rows (column widths and
		// row heights). Its per-cell `.s` payload is ignored — real formatting
		// comes from the OOXML style table.
		cellStyles: true,
	});

	const formats = await readWorkbookFormats(buffer);
	const registry = new StyleRegistry();
	const sheets: Record<string, IWorksheetData> = {};
	const sheetOrder: string[] = [];

	workbook.SheetNames.forEach((name, index) => {
		const worksheet = workbook.Sheets[name];
		if (!worksheet) return;
		const id = `sheet-${index + 1}`;
		const sheet = convertSheet(worksheet, name, id, registry, formats.get(index));
		const meta = workbook.Workbook?.Sheets?.[index];
		if (meta?.Hidden) sheet.hidden = BooleanNumber.TRUE;
		sheets[id] = sheet;
		sheetOrder.push(id);
	});

	return {
		id: "backlog-xlsx-preview",
		name: workbook.Props?.Title || fallbackName,
		appVersion: "1.0.0",
		locale: LocaleType.ZH_CN,
		styles: registry.styles,
		sheetOrder,
		sheets,
	};
}
