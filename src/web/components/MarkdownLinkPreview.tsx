import { useCallback, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiClient } from "../lib/api";
import { encodeWikiPath } from "../utils/urlHelpers";
import { binaryOfficeFileProps, isBinaryOfficeFile, kindFromName } from "./binaryOfficeFile";
import DocPreviewModal from "./DocPreviewModal";
import FilePreviewModal from "./FilePreviewModal";
import PdfPreviewModal from "./PdfPreviewModal";
import PptxPreviewModal from "./PptxPreviewModal";
import XlsxPreviewModal from "./XlsxPreviewModal";

type EntityType = "task" | "draft" | "doc" | "decision" | "wiki";
type LineRange = { lineStart?: number; lineEnd?: number };

export type PreviewTarget =
	| { kind: "file"; path: string }
	| ({ kind: "entity"; type: EntityType; id: string } & LineRange);

function entityPath(type: EntityType, id: string): string {
	switch (type) {
		case "task":
			return `/task/${id}`;
		case "draft":
			return `/draft/${id}`;
		case "doc":
			return `/documentation/${id}`;
		case "decision":
			return `/decisions/${id}`;
		case "wiki":
			return `/wiki/${encodeWikiPath(id)}`;
	}
}

/**
 * One click contract for rendered Markdown bodies (BACK-835, BACK-836): plain entity links
 * navigate, ranged entity links and local file links open a preview modal. Document and decision
 * pages share it so the same link behaves identically on both surfaces.
 */
export function useMarkdownLinkPreview() {
	const navigate = useNavigate();
	const location = useLocation();
	const [previewTarget, setPreviewTarget] = useState<PreviewTarget | null>(null);

	const openEntity = useCallback(
		(type: EntityType, id: string, range?: LineRange) => {
			if (range?.lineStart !== undefined) {
				setPreviewTarget({ kind: "entity", type, id, lineStart: range.lineStart, lineEnd: range.lineEnd });
				return;
			}
			if (type === "task" || type === "draft") {
				navigate(entityPath(type, id), { state: { backgroundLocation: location } });
			} else {
				navigate(entityPath(type, id));
			}
		},
		[navigate, location],
	);

	const linkHandlers = useMemo(
		() => ({
			onFileClick: (path: string) => setPreviewTarget({ kind: "file", path }),
			onTaskClick: (id: string, range?: LineRange) => openEntity("task", id, range),
			onDraftClick: (id: string, range?: LineRange) => openEntity("draft", id, range),
			onDocClick: (id: string, range?: LineRange) => openEntity("doc", id, range),
			onDecisionClick: (id: string, range?: LineRange) => openEntity("decision", id, range),
			onWikiClick: (id: string, range?: LineRange) => openEntity("wiki", id, range),
		}),
		[openEntity],
	);

	const closePreview = useCallback(() => setPreviewTarget(null), []);
	return { linkHandlers, previewTarget, closePreview };
}

export type MarkdownLinkHandlers = ReturnType<typeof useMarkdownLinkPreview>["linkHandlers"];

/** Renders the shared file, entity and Office preview for the target produced by the hook. */
export function MarkdownPreviewModal({ target, onClose }: { target: PreviewTarget | null; onClose: () => void }) {
	if (!target) return null;

	if (target.kind === "entity") {
		return (
			<FilePreviewModal
				path={`preview://${target.type}/${target.id}:${target.lineStart ?? ""}${target.lineEnd !== undefined ? `-${target.lineEnd}` : ""}`}
				onClose={onClose}
				loader={() => apiClient.fetchPreview(target.type, target.id, target.lineStart, target.lineEnd)}
			/>
		);
	}

	if (!isBinaryOfficeFile(target.path)) {
		return <FilePreviewModal path={target.path} onClose={onClose} />;
	}

	const props = { ...binaryOfficeFileProps(target.path), onClose };
	switch (kindFromName(target.path)) {
		case "docx":
			return <DocPreviewModal {...props} />;
		case "pptx":
			return <PptxPreviewModal {...props} />;
		case "xlsx":
			return <XlsxPreviewModal {...props} />;
		default:
			return <PdfPreviewModal {...props} />;
	}
}
