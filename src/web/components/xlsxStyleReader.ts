import JSZip from "jszip";

/**
 * Minimal OOXML style reader for the spreadsheet preview.
 *
 * SheetJS (community build) exposes only a fill's `patternType` for .xlsx cells,
 * so fonts, borders, alignment and number formats have to come from the package
 * itself: `xl/styles.xml` holds the shared style table (cellXfs -> fonts / fills /
 * borders / numFmts) and every worksheet stores a `s="<index>"` attribute per
 * styled cell. We resolve the table once per workbook and hand the adapter a flat
 * address -> format map.
 */

export interface CellFormat {
	font?: {
		name?: string;
		size?: number;
		bold?: boolean;
		italic?: boolean;
		underline?: boolean;
		strike?: boolean;
		color?: string;
	};
	/** Solid fill colour, `#RRGGBB`. */
	fill?: string;
	borders?: {
		top?: BorderSide;
		right?: BorderSide;
		bottom?: BorderSide;
		left?: BorderSide;
	};
	align?: {
		horizontal?: string;
		vertical?: string;
		wrapText?: boolean;
	};
	/** Excel number-format code, e.g. `0.00%` or `yyyy/m/d`. */
	numFmt?: string;
}

export interface BorderSide {
	style: string;
	color?: string;
}

/** Default Office theme palette, indexed the way OOXML theme colours are. */
const THEME_PALETTE: Record<number, string> = {
	0: "FFFFFF", // lt1 / background 1
	1: "000000", // dk1 / text 1
	2: "E7E6E6", // lt2 / background 2
	3: "44546A", // dk2 / text 2
	4: "4472C4", // accent 1
	5: "ED7D31", // accent 2
	6: "A5A5A5", // accent 3
	7: "FFC000", // accent 4
	8: "5B9BD5", // accent 5
	9: "70AD47", // accent 6
	10: "0563C1", // hyperlink
	11: "954F72", // followed hyperlink
};

/** Legacy `indexed` colours (BIFF palette), the subset Excel actually emits. */
const INDEXED_PALETTE: string[] = [
	"000000",
	"FFFFFF",
	"FF0000",
	"00FF00",
	"0000FF",
	"FFFF00",
	"FF00FF",
	"00FFFF",
	"000000",
	"FFFFFF",
	"FF0000",
	"00FF00",
	"0000FF",
	"FFFF00",
	"FF00FF",
	"00FFFF",
	"800000",
	"008000",
	"000080",
	"808000",
	"800080",
	"008080",
	"C0C0C0",
	"808080",
	"9999FF",
	"993366",
	"FFFFCC",
	"CCFFFF",
	"660066",
	"FF8080",
	"0066CC",
	"CCCCFF",
	"000080",
	"FF00FF",
	"FFFF00",
	"00FFFF",
	"800080",
	"800000",
	"008080",
	"0000FF",
	"00CCFF",
	"CCFFFF",
	"CCFFCC",
	"FFFF99",
	"99CCFF",
	"FF99CC",
	"CC99FF",
	"FFCC99",
	"3366FF",
	"33CCCC",
	"99CC00",
	"FFCC00",
	"FF9900",
	"FF6600",
	"666699",
	"969696",
	"003366",
	"339966",
	"003300",
	"333300",
	"993300",
	"993366",
	"333399",
	"333333",
];

/** Built-in number formats that appear without an explicit `numFmt` entry. */
const BUILTIN_NUM_FMT: Record<number, string> = {
	0: "General",
	1: "0",
	2: "0.00",
	3: "#,##0",
	4: "#,##0.00",
	9: "0%",
	10: "0.00%",
	11: "0.00E+00",
	12: "# ?/?",
	13: "# ??/??",
	14: "yyyy/m/d",
	15: "d-mmm-yy",
	16: "d-mmm",
	17: "mmm-yy",
	18: "h:mm AM/PM",
	19: "h:mm:ss AM/PM",
	20: "h:mm",
	21: "h:mm:ss",
	22: "yyyy/m/d h:mm",
	37: "#,##0 ;(#,##0)",
	38: "#,##0 ;[Red](#,##0)",
	39: "#,##0.00;(#,##0.00)",
	40: "#,##0.00;[Red](#,##0.00)",
	45: "mm:ss",
	46: "[h]:mm:ss",
	47: "mmss.0",
	48: "##0.0E+0",
	49: "@",
};

function tintHex(hex: string, tint: number): string {
	const value = Number.parseInt(hex, 16);
	const channels = [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
	return channels
		.map((channel) => {
			const mixed = tint < 0 ? channel * (1 + tint) : channel + (255 - channel) * tint;
			return Math.round(Math.min(255, Math.max(0, mixed)))
				.toString(16)
				.padStart(2, "0");
		})
		.join("");
}

/** Resolve an OOXML colour element (`rgb` / `theme`+`tint` / `indexed`) to `#RRGGBB`. */
function parseColor(element: Element | null | undefined): string | null {
	if (!element) return null;
	if (element.getAttribute("auto") === "1") return null;
	const rgb = element.getAttribute("rgb");
	if (rgb) {
		if (/^[0-9a-fA-F]{8}$/.test(rgb)) return `#${rgb.slice(2).toUpperCase()}`;
		if (/^[0-9a-fA-F]{6}$/.test(rgb)) return `#${rgb.toUpperCase()}`;
	}
	const theme = element.getAttribute("theme");
	if (theme !== null) {
		const base = THEME_PALETTE[Number(theme)];
		if (!base) return null;
		const tint = Number(element.getAttribute("tint") ?? "0");
		return `#${(tint ? tintHex(base, tint) : base).toUpperCase()}`;
	}
	const indexed = element.getAttribute("indexed");
	if (indexed !== null) {
		const base = INDEXED_PALETTE[Number(indexed)];
		if (base) return `#${base}`;
	}
	return null;
}

function elements(parent: Element | Document | null, localName: string): Element[] {
	if (!parent) return [];
	// Duck-typed instead of `instanceof Document` so the module also runs where
	// only an XML-parsing shim is installed (tests).
	const root = (parent as Document).documentElement ?? (parent as Element);
	if (!root) return [];
	const children = Array.from(root.children).filter((child) => child.localName === localName);
	if (children.length > 0) return children;
	// Some producers wrap the table one level deeper; fall back to a scoped search.
	return Array.from(root.getElementsByTagName(localName));
}

function child(parent: Element | null | undefined, localName: string): Element | null {
	if (!parent) return null;
	return Array.from(parent.children).find((element) => element.localName === localName) ?? null;
}

function attr(element: Element | null | undefined, name: string): string | null {
	return element?.getAttribute(name) ?? null;
}

function flag(element: Element | null | undefined): boolean {
	if (!element) return false;
	const value = element.getAttribute("val");
	return value !== "0" && value !== "false";
}

function parseFont(font: Element): CellFormat["font"] {
	const result: NonNullable<CellFormat["font"]> = {};
	const name = attr(child(font, "name"), "val");
	if (name) result.name = name;
	const size = Number(attr(child(font, "sz"), "val") ?? Number.NaN);
	if (Number.isFinite(size) && size > 0) result.size = size;
	if (flag(child(font, "b"))) result.bold = true;
	if (flag(child(font, "i"))) result.italic = true;
	const underline = child(font, "u");
	if (underline && underline.getAttribute("val") !== "none") result.underline = true;
	if (flag(child(font, "strike"))) result.strike = true;
	const color = parseColor(child(font, "color"));
	if (color) result.color = color;
	return result;
}

function parseFill(fill: Element): string | undefined {
	const pattern = child(fill, "patternFill");
	if (!pattern) return undefined;
	const patternType = pattern.getAttribute("patternType");
	if (!patternType || patternType === "none") return undefined;
	return parseColor(child(pattern, "fgColor")) ?? parseColor(child(pattern, "bgColor")) ?? undefined;
}

function parseBorder(border: Element): CellFormat["borders"] {
	const result: NonNullable<CellFormat["borders"]> = {};
	for (const side of ["top", "right", "bottom", "left"] as const) {
		const element = child(border, side);
		const style = element?.getAttribute("style");
		if (!element || !style) continue;
		result[side] = { style, color: parseColor(child(element, "color")) ?? undefined };
	}
	return Object.keys(result).length > 0 ? result : undefined;
}

function parseAlignment(xf: Element): CellFormat["align"] {
	const alignment = child(xf, "alignment");
	if (!alignment) return undefined;
	const align: NonNullable<CellFormat["align"]> = {};
	const horizontal = alignment.getAttribute("horizontal");
	if (horizontal && horizontal !== "general") align.horizontal = horizontal;
	const vertical = alignment.getAttribute("vertical");
	if (vertical) align.vertical = vertical;
	const wrapText = alignment.getAttribute("wrapText");
	if (wrapText === "1" || wrapText === "true") align.wrapText = true;
	return Object.keys(align).length > 0 ? align : undefined;
}

function parseStyles(stylesXml: string): CellFormat[] {
	const doc = new DOMParser().parseFromString(stylesXml, "application/xml");
	const root = doc.documentElement;
	if (!root) return [];

	const customFormats = new Map<number, string>();
	for (const numFmt of elements(root, "numFmt")) {
		const id = Number(attr(numFmt, "numFmtId"));
		const code = attr(numFmt, "formatCode");
		if (Number.isFinite(id) && code) customFormats.set(id, code);
	}

	const fontsTable = elements(root, "fonts");
	const fonts = fontsTable.length > 0 ? elements(fontsTable[0] ?? null, "font").map(parseFont) : [];

	const fillsTable = elements(root, "fills");
	const fills = fillsTable.length > 0 ? elements(fillsTable[0] ?? null, "fill").map(parseFill) : [];

	const bordersTable = elements(root, "borders");
	const borders = bordersTable.length > 0 ? elements(bordersTable[0] ?? null, "border").map(parseBorder) : [];

	const cellXfs = elements(root, "cellXfs");
	if (cellXfs.length === 0) return [];

	return elements(cellXfs[0] ?? null, "xf").map((xf) => {
		const format: CellFormat = {};
		const fontId = Number(attr(xf, "fontId") ?? "-1");
		if (xf.getAttribute("applyFont") !== "0" && fonts[fontId]) format.font = fonts[fontId];
		const fillId = Number(attr(xf, "fillId") ?? "-1");
		if (xf.getAttribute("applyFill") !== "0" && fillId >= 0) {
			const fill = fills[fillId];
			if (fill) format.fill = fill;
		}
		const borderId = Number(attr(xf, "borderId") ?? "-1");
		if (xf.getAttribute("applyBorder") !== "0" && borderId >= 0) {
			const border = borders[borderId];
			if (border) format.borders = border;
		}
		const numFmtId = Number(attr(xf, "numFmtId") ?? "0");
		if (xf.getAttribute("applyNumberFormat") !== "0" && numFmtId > 0) {
			const code = customFormats.get(numFmtId) ?? BUILTIN_NUM_FMT[numFmtId];
			if (code && code !== "General") format.numFmt = code;
		}
		const align = parseAlignment(xf);
		if (align) format.align = align;
		return format;
	});
}

function resolveSheetPaths(workbookXml: string, relsXml: string): string[] {
	const workbook = new DOMParser().parseFromString(workbookXml, "application/xml");
	const rels = new DOMParser().parseFromString(relsXml, "application/xml");

	const targets = new Map<string, string>();
	for (const relationship of elements(rels.documentElement, "Relationship")) {
		const id = attr(relationship, "Id");
		const target = attr(relationship, "Target");
		if (id && target) targets.set(id, target);
	}

	const paths: string[] = [];
	for (const sheet of elements(workbook.documentElement, "sheet")) {
		// The r:id attribute is namespaced; read it by qualified name.
		const relId =
			sheet.getAttribute("r:id") ??
			Array.from(sheet.attributes).find((attribute) => attribute.localName === "id")?.value ??
			null;
		if (!relId) continue;
		const target = targets.get(relId);
		if (!target) continue;
		const normalized = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
		paths.push(normalized.replace(/^xl\/\.\.\//, ""));
	}
	return paths;
}

function readSheetFormats(sheetXml: string, formats: CellFormat[]): Map<string, CellFormat> {
	const result = new Map<string, CellFormat>();
	const doc = new DOMParser().parseFromString(sheetXml, "application/xml");
	for (const cell of Array.from(doc.getElementsByTagName("c"))) {
		const reference = cell.getAttribute("r");
		const styleIndex = cell.getAttribute("s");
		if (!reference || styleIndex === null) continue;
		const format = formats[Number(styleIndex)];
		if (!format) continue;
		if (Object.keys(format).length === 0) continue;
		result.set(reference, format);
	}
	return result;
}

/**
 * Resolve the per-sheet cell formats of an .xlsx/.xlsm package.
 * The map is keyed by worksheet index in workbook order, then by A1 address.
 */
export async function readWorkbookFormats(buffer: ArrayBuffer): Promise<Map<number, Map<string, CellFormat>>> {
	const result = new Map<number, Map<string, CellFormat>>();
	let zip: JSZip;
	try {
		zip = await JSZip.loadAsync(buffer);
	} catch {
		return result;
	}

	const stylesFile = zip.file("xl/styles.xml");
	const workbookFile = zip.file("xl/workbook.xml");
	const relsFile = zip.file("xl/_rels/workbook.xml.rels");
	if (!stylesFile || !workbookFile || !relsFile) return result;

	const [stylesXml, workbookXml, relsXml] = await Promise.all([
		stylesFile.async("string"),
		workbookFile.async("string"),
		relsFile.async("string"),
	]);

	const formats = parseStyles(stylesXml);
	if (formats.length === 0) return result;

	const sheetPaths = resolveSheetPaths(workbookXml, relsXml);
	await Promise.all(
		sheetPaths.map(async (path, index) => {
			const file = zip.file(path);
			if (!file) return;
			const xml = await file.async("string");
			result.set(index, readSheetFormats(xml, formats));
		}),
	);

	return result;
}
