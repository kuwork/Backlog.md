export type PreviewKind = "pdf" | "docx" | "pptx" | "xlsx" | "unsupported";

/**
 * A page/sheet range carried on an Office-file Markdown link, e.g.
 * `[x.docx](/x.docx:P1-P4)` (docx/pptx/pdf, 1-based, the `P` prefix is required so a bare
 * `1-4` keeps its plain-text "lines 1-4" meaning) or `[x.xlsx](/x.xlsx:p1-p2)` /
 * `[x.xlsx](/x.xlsx:sheetName)` (xlsx: sheet index `pN` or sheet name).
 */
export type OfficeRange = { type: "pages"; start: number; end?: number } | { type: "sheets"; items: string[] };

export function kindFromName(name: string): PreviewKind {
	// Tolerate a trailing `:range` suffix (e.g. `x.docx:P1-P4`) so the kind is read
	// from the real file extension, not the range token that follows it. A sheet name
	// token may hold spaces, so the suffix is matched up to the next path separator.
	const extMatch = name.match(/\.([A-Za-z0-9]+)(?::[^/\\]*)?$/);
	const ext = (extMatch?.[1] ?? "").toLowerCase();
	if (ext === "pdf") return "pdf";
	if (ext === "docx") return "docx";
	if (ext === "pptx") return "pptx";
	if (ext === "xlsx" || ext === "xlsm") return "xlsx";
	return "unsupported";
}

/** True for the binary office types this preview system handles. */
export function isBinaryOfficeFile(path: string): boolean {
	return kindFromName(path) !== "unsupported";
}

/**
 * Office file types the in-app preview cannot render (legacy binary .doc, the
 * legacy .ppt/.pot/.pps families, the legacy .xls/.xlsb families, macro-enabled
 * variants, templates, ...). These are intercepted so the UI can show a notice
 * instead of letting the browser load or download them. .docx, .pdf, .pptx,
 * .xlsx and .xlsm are intentionally excluded (they preview).
 */
const NON_PREVIEWABLE_OFFICE_EXTS = new Set([
	"doc",
	"docm",
	"dot",
	"dotm",
	"dotx",
	"ppt",
	"pptm",
	"pot",
	"potx",
	"potm",
	"pps",
	"ppsx",
	"ppsm",
	"xls",
	"xlt",
	"xltx",
	"xltm",
	"xlsb",
]);

/** True for office extensions the preview modal does not support (e.g. .doc). */
export function isNonPreviewableOffice(path: string): boolean {
	const ext = path.toLowerCase().split(".").pop() ?? "";
	return NON_PREVIEWABLE_OFFICE_EXTS.has(ext);
}

export interface BinaryOfficePreviewProps {
	isOpen?: boolean;
	onClose: () => void;
	fileName: string;
	/** Raw-bytes URL the modal fetches, e.g. /api/raw-file?path=backlog/docs/report.pdf */
	fileUrl?: string;
	/** Project-relative path, e.g. backlog/assets/report.docx or backlog/docs/report.pdf */
	filePath?: string;
	/** Page/sheet range parsed from a `:range` suffix on the link destination (BACK-838). */
	officeRange?: OfficeRange;
}

/** Result of pulling a `:range` suffix off an Office-file link destination. */
export interface ParsedOfficeLink {
	/** Project-relative path with any `:range` suffix removed. */
	filePath: string;
	kind: PreviewKind;
	range: OfficeRange | null;
}

/**
 * Split a Markdown link destination like `backlog/docs/x.docx:P1-P4` into its clean
 * project-relative path and the page/sheet range. Accepts both site-absolute (`/...`)
 * and project-relative inputs. Non-Office or rangeless destinations come back with
 * `kind` set (or "unsupported") and `range: null`.
 */
export function parseOfficeLink(input: string): ParsedOfficeLink {
	// A query or fragment belongs to the browser, not to the file or the range
	// (`/x.xlsx:p1?download=1` still selects sheet 1).
	const raw = input.trim().replace(/[?#].*$/, "");
	const match = raw.match(/^(.+?\.(?:docx|pptx|pdf|xlsx|xlsm)):(.+)$/i);
	if (!match) {
		const kind = kindFromName(raw);
		return { filePath: raw, kind, range: null };
	}
	const filePath = match[1] ?? raw;
	const token = (match[2] ?? "").trim();
	const kind = kindFromName(filePath);
	if (kind === "unsupported") return { filePath, kind, range: null };
	return { filePath, kind, range: parseRangeToken(kind, token) };
}

/** Decode an already escaped token once; a literal `%` is kept instead of throwing. */
function decodeToken(token: string): string {
	try {
		return decodeURIComponent(token);
	} catch {
		return token;
	}
}

function parseRangeToken(kind: PreviewKind, token: string): OfficeRange | null {
	if (!token) return null;
	if (kind === "xlsx") {
		// Sheet index range `p1-p2` (1-based) or a single sheet name (may contain hyphens).
		const idx = token.match(/^p(\d+)(?:-p(\d+))?$/i);
		if (idx) {
			const start = Number.parseInt(idx[1] ?? "1", 10);
			const end = idx[2] ? Number.parseInt(idx[2], 10) : start;
			const items: string[] = [];
			for (let i = start; i <= end; i++) items.push(`p${i}`);
			return { type: "sheets", items };
		}
		// A sheet name reaches the link percent-encoded when it holds a space (`:Q1%20Sales`);
		// Univer matches on the literal name, so decode it back. A literal `%` is not an escape.
		return { type: "sheets", items: [decodeToken(token)] };
	}
	// docx/pptx/pdf: `P1-P4`, `P1` (case-insensitive, the second prefix is optional). A bare
	// `1-4` is NOT a page range: on a text file the same suffix means lines 1-4, so the `P`
	// keeps the two meanings apart.
	const page = token.match(/^p(\d+)(?:-p?(\d+))?$/i);
	if (page) {
		const start = Number.parseInt(page[1] ?? "1", 10);
		const end = page[2] ? Number.parseInt(page[2], 10) : undefined;
		return { type: "pages", start, end };
	}
	return null;
}

/**
 * Derive the modal props for a project-relative path (e.g. `backlog/assets/x.pdf` or
 * `backlog/docs/x.docx`). PDF, Word, PowerPoint and Excel are served as raw bytes from
 * /api/raw-file, which reads any project file by its project-relative path (not just
 * /assets/*). Word additionally keeps the project-relative path (used by the
 * server-side save endpoint).
 */
export function binaryOfficeFileProps(rawPath: string): Omit<BinaryOfficePreviewProps, "onClose"> {
	// Safety net: strip a stray `:range` suffix so the byte URL always points at the file.
	const path = rawPath.replace(/:[^/]*$/, "");
	const fileName = decodeURIComponent(path.split("/").pop() ?? path);
	const kind = kindFromName(path);
	if (kind !== "unsupported") {
		return { fileName, fileUrl: `/api/raw-file?path=${encodeURIComponent(path)}`, filePath: path };
	}
	return { fileName, filePath: path };
}
