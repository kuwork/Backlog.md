import { UniverSheetsCorePreset } from "@univerjs/preset-sheets-core";
import "@univerjs/preset-sheets-core/lib/index.css";
import UniverSheetsCoreEnUSLocale from "@univerjs/preset-sheets-core/locales/en-US";
import UniverSheetsCoreJaJPLocale from "@univerjs/preset-sheets-core/locales/ja-JP";
import UniverSheetsCoreZhCNLocale from "@univerjs/preset-sheets-core/locales/zh-CN";
import UniverSheetsCoreZhTWLocale from "@univerjs/preset-sheets-core/locales/zh-TW";
import type { Univer } from "@univerjs/presets";
import { createUniver, LocaleType } from "@univerjs/presets";
import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { useI18nContext } from "../contexts/I18nContext";
import { apiClient } from "../lib/api";
import type { Locale } from "../locales";
import type { BinaryOfficePreviewProps } from "./binaryOfficeFile";
import FullscreenToggleButton from "./FullscreenToggleButton";
import Modal from "./Modal";
import { applySnapshotToXlsxWithStats } from "./xlsxSnapshotWriter";
import { xlsxToUniverModel } from "./xlsxToUniverModel";

/**
 * The Univer workbench localizes itself, so it needs its own locale pack next to
 * the app dictionary. Univer ships all four of our languages, so the workbench
 * follows the app language the same way the dictionary does — without this it
 * stayed Chinese in every locale.
 */
const UNIVER_LOCALE: Record<Locale, { type: LocaleType; pack: typeof UniverSheetsCoreEnUSLocale }> = {
	en: { type: LocaleType.EN_US, pack: UniverSheetsCoreEnUSLocale },
	ja: { type: LocaleType.JA_JP, pack: UniverSheetsCoreJaJPLocale },
	"zh-CN": { type: LocaleType.ZH_CN, pack: UniverSheetsCoreZhCNLocale },
	"zh-TW": { type: LocaleType.ZH_TW, pack: UniverSheetsCoreZhTWLocale },
};

const actionBtn =
	"rounded-md border border-gray-300 px-3 py-1 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700";
const primaryBtn =
	"rounded-md bg-blue-600 px-3 py-1 text-sm text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";

type XlsxMode = "viewing" | "editing";

/** What the modal can ask the mounted viewer to do. */
interface XlsxViewerHandle {
	/** Patch the original package with the current editor content and return the bytes. */
	save: () => Promise<{ bytes: ArrayBuffer; changedCells: number }>;
}

/**
 * Preview popup for Excel workbooks (.xlsx / .xlsm).
 *
 * Two explicit modes, because the chrome alone made them indistinguishable:
 * "viewing" renders a read-only sheet with no ribbon, and "editing" swaps in the
 * full Univer chrome (ribbon, formula bar, status bar) with the workbook
 * unlocked through its permission point.
 *
 * Univer fixes its chrome at construction time, so a mode switch rebuilds the
 * instance (the parsed bytes are cached, nothing is re-fetched). Saving patches
 * the original package in place — see xlsxSnapshotWriter — so charts, images and
 * everything else the preview does not parse survive a save.
 */
export default function XlsxPreviewModal({
	isOpen = true,
	onClose,
	fileName,
	fileUrl,
	filePath,
}: BinaryOfficePreviewProps) {
	const { t } = useI18nContext();
	const [fullscreen, setFullscreen] = useState(false);
	const [mode, setMode] = useState<XlsxMode>("viewing");
	const [saving, setSaving] = useState(false);
	const [savedAt, setSavedAt] = useState<number | null>(null);
	const [dirty, setDirty] = useState(false);
	/** Bumped whenever the viewer has to reload from disk (exit edit, close). */
	const [reloadToken, setReloadToken] = useState(0);
	const viewerRef = useRef<XlsxViewerHandle | null>(null);

	const editing = mode === "editing";

	const resetMode = useCallback(() => {
		setMode("viewing");
		setDirty(false);
		setSavedAt(null);
		setReloadToken((token) => token + 1);
	}, []);

	const enterEdit = useCallback(() => {
		setMode("editing");
		setDirty(false);
		setSavedAt(null);
	}, []);

	const exitEdit = useCallback(() => {
		if (dirty && !window.confirm(t.preview.shared.unsavedExitConfirm)) return;
		resetMode();
	}, [dirty, resetMode, t]);

	const handleClose = useCallback(() => {
		if (editing && dirty && !window.confirm(t.preview.shared.unsavedCloseConfirm)) return;
		resetMode();
		onClose();
	}, [dirty, editing, onClose, resetMode, t]);

	const saveWorkbook = useCallback(async () => {
		if (!filePath || !viewerRef.current) return;
		if (!window.confirm(t.preview.shared.saveConfirm)) return;
		setSaving(true);
		try {
			const { bytes, changedCells } = await viewerRef.current.save();
			// A typed value that is still sitting in the in-cell editor never reaches
			// the snapshot. Say so instead of reporting a save that changed nothing.
			if (changedCells === 0) {
				window.alert(t.preview.xlsx.noChanges);
				return;
			}
			await apiClient.saveXlsx(filePath, bytes);
			setSavedAt(Date.now());
			setDirty(false);
		} catch (error) {
			console.error("Failed to save xlsx:", error);
			const message = error instanceof Error ? error.message : String(error);
			window.alert(t.preview.shared.saveFailed.replace("{message}", message));
		} finally {
			setSaving(false);
		}
	}, [filePath, t]);

	const headerActions = (
		<div className="flex items-center gap-2">
			{editing ? (
				<>
					<span className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-2 py-0.5 text-xs font-medium text-white">
						{t.preview.shared.editMode}
					</span>
					<button
						type="button"
						className={primaryBtn}
						onClick={saveWorkbook}
						disabled={saving || !filePath}
						title={filePath ? t.preview.xlsx.saveTitle : t.preview.xlsx.saveDisabledTitle}
					>
						{saving ? t.common.saving : t.common.save}
					</button>
					{savedAt ? (
						<span className="text-xs text-green-600 dark:text-green-400">{t.preview.shared.saved}</span>
					) : null}
					<button type="button" className={actionBtn} onClick={exitEdit}>
						{t.preview.shared.exitEdit}
					</button>
				</>
			) : (
				<>
					<span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
						{t.preview.shared.readOnlyPreview}
					</span>
					<button
						type="button"
						className={actionBtn}
						onClick={enterEdit}
						disabled={!fileUrl}
						title={t.preview.xlsx.enterEditTitle}
					>
						{t.common.edit}
					</button>
				</>
			)}
			<FullscreenToggleButton active={fullscreen} onClick={() => setFullscreen((f) => !f)} />
		</div>
	);

	return (
		<Modal
			isOpen={isOpen}
			onClose={handleClose}
			title={fileName}
			maxWidthClass="max-w-6xl"
			fullscreen={fullscreen}
			noPadding
			actions={headerActions}
		>
			<div
				className={`relative w-full ${
					fullscreen ? "h-full overflow-hidden rounded-none" : "h-[72vh] overflow-hidden rounded-lg"
				}${editing ? " ring-2 ring-inset ring-blue-500/60" : ""}`}
			>
				{fileUrl ? (
					<XlsxViewer
						key={`${reloadToken}-${mode}`}
						fileUrl={fileUrl}
						cacheKey={reloadToken}
						editing={editing}
						viewerRef={viewerRef}
						onDirty={() => {
							setDirty(true);
							// A save badge would be misleading once more edits land.
							setSavedAt(null);
						}}
					/>
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
// XLSX: SheetJS -> IWorkbookData -> Univer canvas. One Univer instance per open
// and per mode (the chrome is fixed at construction), disposed on unmount.
// ---------------------------------------------------------------------------
function XlsxViewer({
	fileUrl,
	cacheKey,
	editing,
	viewerRef,
	onDirty,
}: {
	fileUrl: string;
	/** Changes whenever the modal asks for a reload, so the request bypasses any cache. */
	cacheKey: number;
	editing: boolean;
	viewerRef: RefObject<XlsxViewerHandle | null>;
	onDirty: () => void;
}) {
	const { t, locale } = useI18nContext();
	const containerRef = useRef<HTMLDivElement>(null);
	const onDirtyRef = useRef(onDirty);
	onDirtyRef.current = onDirty;
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);

	// Reading is not the same as being allowed to write. Univer's editable
	// permission point only guards mutation commands, while double-click and a
	// typed character open the in-cell editor without consulting it — a read-only
	// sheet that shows a caret looks editable and silently drops the edit. Both
	// entry points are bound to the engine canvas, so a capture-phase guard on the
	// container (its ancestor) stops them before the engine sees the event.
	// Selection, scrolling, sheet switching and copy shortcuts stay untouched.
	useEffect(() => {
		if (editing) return undefined;
		const container = containerRef.current;
		if (!container) return undefined;
		const block = (event: Event) => {
			event.preventDefault();
			event.stopPropagation();
		};
		const onKeyDown = (event: KeyboardEvent) => {
			// Ctrl/Cmd/Alt combinations are navigation and clipboard shortcuts.
			if (event.ctrlKey || event.metaKey || event.altKey) return;
			// Shift+Space selects the row; plain Space is a text input.
			if (event.key === " " && event.shiftKey) return;
			// F2 and printable characters are the keyboard ways into the editor.
			if (event.key === "F2" || event.key.length === 1) block(event);
		};
		container.addEventListener("dblclick", block, true);
		container.addEventListener("keydown", onKeyDown, true);
		return () => {
			container.removeEventListener("dblclick", block, true);
			container.removeEventListener("keydown", onKeyDown, true);
		};
	}, [editing]);

	useEffect(() => {
		let cancelled = false;
		let univer: Univer | null = null;
		let commandSubscription: { dispose: () => void } | null = null;
		const container = containerRef.current;
		if (!container) return undefined;

		(async () => {
			try {
				const separator = fileUrl.includes("?") ? "&" : "?";
				const response = await fetch(`${fileUrl}${separator}_v=${cacheKey}`, { cache: "no-store" });
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
				const buffer = await response.arrayBuffer();
				if (cancelled) return;

				const model = await xlsxToUniverModel(buffer, "workbook");
				if (model.sheetOrder.length === 0) throw new Error(t.preview.xlsx.noSheets);

				const univerLocale = UNIVER_LOCALE[locale];
				const created = createUniver({
					locale: univerLocale.type,
					locales: { [univerLocale.type]: univerLocale.pack },
					darkMode: document.documentElement.classList.contains("dark"),
					presets: [
						UniverSheetsCorePreset({
							container,
							// Viewing keeps only the grid; editing brings the full workbench
							// (ribbon, formula bar, status bar) so the two states are obvious.
							header: editing,
							toolbar: editing,
							ribbonType: "simple",
							formulaBar: editing,
							// Keep the sheet-tab bar in both modes: it is the only way to switch
							// worksheets. The statistic bar is editor-only.
							footer: { sheetBar: true, statisticBar: editing, zoomSlider: true },
						}),
					],
				});
				univer = created.univer;
				if (cancelled) {
					created.univer.dispose();
					return;
				}

				const workbook = created.univerAPI.createWorkbook(model);
				if (workbook) {
					// Registers the workbook's editable permission point: it gates every
					// mutation command (typing, paste, clear, formula edits), which is what
					// makes viewing mode genuinely read-only even when a command slips past
					// the input guard. It does NOT gate opening the editor — that is what
					// the capture-phase guard above is for.
					try {
						await workbook.setEditable(editing);
					} catch (error) {
						console.error("Univer setEditable failed:", error);
					}
					if (editing) {
						// Only real cell mutations count as unsaved work — selection and
						// scrolling must not trigger the discard prompt.
						commandSubscription = workbook.onCommandExecuted((command) => {
							const id = command?.id ?? "";
							if (id.includes("set-range-values") || id.includes("merge") || id.includes("set-range-styles")) {
								onDirtyRef.current();
							}
						});
					}
				}

				// Each save must patch the freshest bytes: patching the mount-time
				// buffer again would roll back everything saved before it.
				let latestBytes = buffer;
				viewerRef.current = {
					save: async () => {
						const workbook = created.univerAPI.getActiveWorkbook();
						if (!workbook) throw new Error(t.preview.xlsx.noActiveWorkbook);
						// Commit a value still sitting in the in-cell editor. Clicking a
						// button outside the canvas does not always end the edit, and the
						// snapshot would then be taken before the change lands — which is
						// exactly how editing a merged cell ended up saving nothing.
						const editable = workbook as unknown as { endEditingAsync?: (save?: boolean) => Promise<boolean> };
						if (typeof editable.endEditingAsync === "function") {
							await editable.endEditingAsync(true).catch(() => false);
						}
						// Let the commit command run before the snapshot is read.
						await new Promise((resolve) => setTimeout(resolve, 0));
						const result = await applySnapshotToXlsxWithStats(latestBytes, workbook.save());
						latestBytes = result.bytes;
						return { bytes: result.bytes, changedCells: result.changedCells };
					},
				};

				setLoading(false);
			} catch (e) {
				if (!cancelled) {
					setError(e instanceof Error ? e.message : String(e));
					setLoading(false);
				}
			}
		})();

		return () => {
			cancelled = true;
			viewerRef.current = null;
			commandSubscription?.dispose();
			commandSubscription = null;
			univer?.dispose();
			univer = null;
			// Univer detaches its own canvas; clear anything left behind so a
			// re-open never renders two workbooks into the same node.
			container.replaceChildren();
		};
	}, [fileUrl, cacheKey, editing, viewerRef, locale, t]);

	return (
		<div className="relative h-full w-full bg-white dark:bg-gray-900">
			{/* Always mounted: createUniver attaches to this node, so it must not
			    be swapped out for the loading/error state. */}
			<div ref={containerRef} className="h-full w-full overflow-hidden" />
			{loading && !error && (
				<div className="absolute inset-0 flex items-center justify-center bg-white/80 text-gray-500 dark:bg-gray-900/80 dark:text-gray-400">
					{editing ? t.preview.xlsx.openingEditor : t.preview.xlsx.parsing}
				</div>
			)}
			{error && (
				<div className="absolute inset-0 flex items-center justify-center bg-white/90 px-6 text-center text-red-500 dark:bg-gray-900/90">
					{t.preview.shared.renderFailed.replace("{format}", "XLSX").replace("{message}", error)}
				</div>
			)}
		</div>
	);
}
