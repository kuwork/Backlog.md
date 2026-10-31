export type PreviewKind = "pdf" | "docx" | "unsupported";

export function kindFromName(name: string): PreviewKind {
	const ext = name.toLowerCase().split(".").pop() ?? "";
	if (ext === "pdf") return "pdf";
	if (ext === "docx") return "docx";
	return "unsupported";
}

/** True for the binary office types this preview system handles. */
export function isBinaryOfficeFile(path: string): boolean {
	return kindFromName(path) !== "unsupported";
}

/**
 * Office file types the in-app preview cannot render (legacy binary .doc, the
 * PowerPoint/Excel families, macro-enabled variants, templates, ...). These are
 * intercepted so the UI can show a notice instead of letting the browser load
 * or download them. .docx and .pdf are intentionally excluded (they preview).
 */
const NON_PREVIEWABLE_OFFICE_EXTS = new Set([
	"doc",
	"docm",
	"dot",
	"dotm",
	"dotx",
	"ppt",
	"pptx",
	"pptm",
	"pot",
	"potx",
	"potm",
	"pps",
	"ppsx",
	"ppsm",
	"xls",
	"xlsx",
	"xlsm",
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
}

/**
 * Derive the modal props for a project-relative path (e.g. `backlog/assets/x.pdf` or
 * `backlog/docs/x.docx`). Both PDF and Word are served as raw bytes from /api/raw-file,
 * which reads any project file by its project-relative path (not just /assets/*). Word
 * additionally keeps the project-relative path (used by the server-side save endpoint).
 */
export function binaryOfficeFileProps(path: string): Omit<BinaryOfficePreviewProps, "onClose"> {
	const fileName = decodeURIComponent(path.split("/").pop() ?? path);
	const lower = path.toLowerCase();
	if (lower.endsWith(".pdf") || lower.endsWith(".docx")) {
		return { fileName, fileUrl: `/api/raw-file?path=${encodeURIComponent(path)}`, filePath: path };
	}
	return { fileName, filePath: path };
}
