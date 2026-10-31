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

export interface BinaryOfficePreviewProps {
	isOpen?: boolean;
	onClose: () => void;
	fileName: string;
	/** Served URL for the raw bytes, e.g. /assets/report.pdf or /assets/report.docx */
	fileUrl?: string;
	/** Project-relative path, e.g. backlog/assets/report.docx */
	filePath?: string;
}

/**
 * Derive the modal props for a project-relative path (e.g. `backlog/assets/x.pdf`).
 * Both PDF and Word are served as raw bytes from /assets/*; Word additionally keeps the
 * project-relative path (used by the server-side save endpoint).
 */
export function binaryOfficeFileProps(path: string): Omit<BinaryOfficePreviewProps, "onClose"> {
	const fileName = decodeURIComponent(path.split("/").pop() ?? path);
	const lower = path.toLowerCase();
	if (lower.endsWith(".pdf") || lower.endsWith(".docx")) {
		const rel = path.startsWith("backlog/assets/")
			? path.slice("backlog/assets/".length)
			: path.replace(/^.*\/assets\//, "");
		return { fileName, fileUrl: `/assets/${encodeURIComponent(rel)}`, filePath: path };
	}
	return { fileName, filePath: path };
}
