import type { DocxEditorRef } from "@eigenpal/docx-editor-react";
import { useRef } from "react";
import { useI18nContext } from "../contexts/I18nContext";
import { binaryOfficeFileProps, kindFromName, parseOfficeLink } from "./binaryOfficeFile";
import { DocxViewer } from "./DocPreviewModal";
import { officeRangeLabel } from "./officeRangeLabel";
import { PdfViewer } from "./PdfPreviewModal";
import { PptxViewerInner } from "./PptxPreviewModal";
import { XlsxViewer, type XlsxViewerHandle } from "./XlsxPreviewModal";

/**
 * Inline Office preview for `![file.docx](/file.docx)` / `![file.pptx](/file.docx:P1-P4)` Markdown
 * images (BACK-838). A Markdown image whose destination is an Office file is rendered as an embedded
 * viewer inside the page instead of an `<img>`; plain images keep the lightbox behaviour.
 */
export default function OfficeEmbedInline({ src, alt }: { src?: string; alt?: string }) {
	const { t } = useI18nContext();
	const docxRef = useRef<DocxEditorRef>(null);
	const xlsxRef = useRef<XlsxViewerHandle>(null);
	if (!src) return null;
	const rel = src.startsWith("/") ? src.slice(1) : src;
	let decoded = rel;
	try {
		decoded = decodeURIComponent(rel);
	} catch {
		/* literal % is not an escape */
	}
	const { filePath, range } = parseOfficeLink(decoded);
	const kind = kindFromName(filePath);
	if (kind === "unsupported") return null;
	const { fileName, fileUrl } = binaryOfficeFileProps(filePath);
	if (!fileUrl) return null;

	// The caption always names the file and lets the badge carry the range, so a descriptive `alt`
	// such as "报告 第 1-2 页" is not repeated by the badge right next to it.
	const label = officeRangeLabel(t, range);

	return (
		<figure className="my-4 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
			<figcaption className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
				<span className="truncate font-medium" title={alt || fileName}>
					{fileName}
				</span>
				{label && (
					<span className="inline-flex shrink-0 items-center rounded-full bg-gray-200 px-2 py-0.5 font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200">
						{label}
					</span>
				)}
			</figcaption>
			<div className="h-[60vh] overflow-auto bg-white dark:bg-gray-900">
				{kind === "docx" && (
					<DocxViewer fileUrl={fileUrl} mode="viewing" editorRef={docxRef} officeRange={range ?? undefined} />
				)}
				{kind === "pptx" && <PptxViewerInner fileUrl={fileUrl} officeRange={range ?? undefined} />}
				{kind === "pdf" && <PdfViewer fileUrl={fileUrl} officeRange={range ?? undefined} />}
				{kind === "xlsx" && (
					<XlsxViewer
						fileUrl={fileUrl}
						cacheKey={0}
						editing={false}
						viewerRef={xlsxRef}
						officeRange={range ?? undefined}
						onDirty={() => {}}
					/>
				)}
			</div>
		</figure>
	);
}
