import { en, type Translations, zhCN } from "@eigenpal/docx-editor-i18n";
import type { DocxEditorRef } from "@eigenpal/docx-editor-react";
import { lazy, type RefObject, Suspense, useEffect, useRef, useState } from "react";
import { useI18nContext } from "../contexts/I18nContext";
import { apiClient } from "../lib/api";
import type { Locale } from "../locales";
import ja from "../locales/docx/ja";
import zhTW from "../locales/docx/zh-TW";
import type { BinaryOfficePreviewProps } from "./binaryOfficeFile";
import FullscreenToggleButton from "./FullscreenToggleButton";
import Modal from "./Modal";
import "@eigenpal/docx-editor-react/styles.css";

// Code-split: the docx editor (ProseMirror + OOXML parsing) is heavy, so it is only
// fetched when a Word document is actually previewed.
const DocxEditor = lazy(() => import("@eigenpal/docx-editor-react").then((m) => ({ default: m.DocxEditor })));

type DocxMode = "viewing" | "editing";

// docx-editor ships a fixed set of locales (en, de, fr, he, hi, id, pl, pt-BR, tr, zh-CN).
// Our app supports en, ja, zh-CN, zh-TW. Map each app locale to the nearest docx-editor
// locale so the editor UI follows the app language: both Chinese variants use zhCN (there is
// no Traditional Chinese locale, Simplified is the closest), and Japanese falls back to English
// (no Japanese locale exists). Missing keys in a partial locale fall back to en automatically.
function docxI18nFor(locale: Locale): Translations {
	switch (locale) {
		case "zh-TW":
			return zhTW;
		case "ja":
			return ja;
		case "zh-CN":
			return zhCN;
		case "en":
			return en;
	}
}

const actionBtn =
	"rounded-md border border-gray-300 px-3 py-1 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700";
const primaryBtn =
	"rounded-md bg-blue-600 px-3 py-1 text-sm text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";

/**
 * Preview popup for Word (.docx) documents.
 *
 * docx-editor (ProseMirror) parses the OOXML in the browser and restores real pagination:
 * page boundaries, margins, headers/footers. Opens read-only (preview); a header button
 * switches to edit mode, where changes can be saved back to the source file via the
 * server-side /api/docx/save endpoint. Supports a CSS fullscreen toggle that fills the
 * viewport, and the preview body clips to the modal window's rounded corner radius.
 * The editor locale follows the app language (en / ja / zh-CN / zh-TW).
 */
export default function DocPreviewModal({
	isOpen = true,
	onClose,
	fileName,
	fileUrl,
	filePath,
}: BinaryOfficePreviewProps) {
	const { t } = useI18nContext();
	const [fullscreen, setFullscreen] = useState(false);
	const [docxMode, setDocxMode] = useState<DocxMode>("viewing");
	const [docxSaving, setDocxSaving] = useState(false);
	const [docxSavedAt, setDocxSavedAt] = useState<number | null>(null);
	const editorRef = useRef<DocxEditorRef>(null);

	const enterEdit = () => setDocxMode("editing");

	const exitEdit = () => {
		setDocxMode("viewing");
		setDocxSavedAt(null);
	};

	const saveDocxFile = async () => {
		if (!filePath) return;
		if (!window.confirm(t.preview.shared.saveConfirm)) return;
		setDocxSaving(true);
		try {
			const buf = await editorRef.current?.save();
			if (!buf) throw new Error(t.preview.docx.exportFailed);
			await apiClient.saveDocx(filePath, buf);
			setDocxSavedAt(Date.now());
		} catch (e) {
			console.error("Failed to save docx:", e);
			const message = e instanceof Error ? e.message : String(e);
			window.alert(t.preview.shared.saveFailed.replace("{message}", message));
		} finally {
			setDocxSaving(false);
		}
	};

	const headerActions = (
		<div className="flex items-center gap-2">
			{docxMode === "viewing" ? (
				<>
					<span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
						{t.preview.shared.readOnlyPreview}
					</span>
					<button type="button" className={actionBtn} onClick={enterEdit}>
						{t.common.edit}
					</button>
				</>
			) : (
				<>
					<span className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-2 py-0.5 text-xs font-medium text-white">
						{t.preview.shared.editMode}
					</span>
					<button type="button" className={primaryBtn} onClick={saveDocxFile} disabled={docxSaving}>
						{docxSaving ? t.common.saving : t.common.save}
					</button>
					{docxSavedAt ? (
						<span className="text-xs text-green-600 dark:text-green-400">{t.preview.shared.saved}</span>
					) : null}
					<button type="button" className={actionBtn} onClick={exitEdit}>
						{t.preview.shared.exitEdit}
					</button>
				</>
			)}
			<FullscreenToggleButton active={fullscreen} onClick={() => setFullscreen((f) => !f)} />
		</div>
	);

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title={fileName}
			maxWidthClass="max-w-6xl"
			fullscreen={fullscreen}
			noPadding
			actions={headerActions}
		>
			<div
				className={`w-full ${fullscreen ? "h-full overflow-hidden rounded-none" : "h-[72vh] overflow-hidden rounded-lg"}`}
			>
				{fileUrl ? (
					<DocxViewer fileUrl={fileUrl} mode={docxMode} editorRef={editorRef} />
				) : (
					<div className="flex h-full items-center justify-center text-gray-500 dark:text-gray-400">
						{t.preview.shared.missingFileUrl}
					</div>
				)}
			</div>
		</Modal>
	);
}

// ---------------------------------------------------------------------------
// Word: parsed client-side by docx-editor, which restores true pagination.
// Opens read-only; the parent toggles `mode` to "editing" for in-place edits.
// ---------------------------------------------------------------------------
function DocxViewer({
	fileUrl,
	mode,
	editorRef,
}: {
	fileUrl: string;
	mode: DocxMode;
	editorRef: RefObject<DocxEditorRef | null>;
}) {
	const { locale, t } = useI18nContext();
	const [buffer, setBuffer] = useState<ArrayBuffer | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		fetch(fileUrl)
			.then((res) => {
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				return res.arrayBuffer();
			})
			.then((buf) => {
				if (!cancelled) setBuffer(buf);
			})
			.catch((e) => {
				if (!cancelled) setError(e instanceof Error ? e.message : String(e));
			});
		return () => {
			cancelled = true;
		};
	}, [fileUrl]);

	if (error) {
		return (
			<div className="flex h-full items-center justify-center text-red-500">
				{t.preview.shared.loadFailed.replace("{message}", error)}
			</div>
		);
	}
	if (!buffer) {
		return <div className="flex h-full items-center justify-center text-gray-400">{t.common.loading}</div>;
	}
	const editing = mode === "editing";
	return (
		<Suspense
			fallback={
				<div className="flex h-full items-center justify-center text-gray-400">{t.preview.shared.rendering}</div>
			}
		>
			<div className="h-full w-full overflow-auto">
				<DocxEditor
					key={locale}
					ref={editorRef}
					i18n={docxI18nFor(locale)}
					documentBuffer={buffer}
					mode={mode}
					readOnly={!editing}
					showToolbar={editing}
					showFileOpen={false}
					showHelpMenu={editing}
					showMarginGuides
					showRuler={editing}
					onError={(e) => setError(e.message)}
				/>
			</div>
		</Suspense>
	);
}
