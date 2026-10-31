import type { SlideHandle, ZipParseLimits } from "@aiden0z/pptx-renderer";
import { PptxViewer, RECOMMENDED_ZIP_LIMITS } from "@aiden0z/pptx-renderer";
import type { MouseEvent as ReactMouseEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useI18nContext } from "../contexts/I18nContext";
import type { BinaryOfficePreviewProps } from "./binaryOfficeFile";
import FullscreenToggleButton from "./FullscreenToggleButton";
import Modal from "./Modal";

const actionBtn =
	"rounded-md border border-gray-300 px-3 py-1 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700";

// Thumbnails are rendered at the box's measured width (see the thumbnail
// effect) so they can never spill past the sidebar or the active-slide ring.

// Line-style (outline) play glyph, matching the other hairline icons in the UI.
function PlayIcon({ className }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
			className={className}
		>
			<polygon points="6 3 20 12 6 21 6 3" />
		</svg>
	);
}

/**
 * Relaxed ZIP safety envelope for locally-authored decks. RECOMMENDED_ZIP_LIMITS
 * caps a single ZIP entry at 32 MiB, which rejects PPTX that embed media larger
 * than that (e.g. an embedded .mp4). We keep the guardrails (entry count, media
 * total, concurrency) but raise the per-entry / total / media ceilings so normal
 * decks with a video or large images still preview instead of erroring out.
 */
const PREVIEW_ZIP_LIMITS: ZipParseLimits = {
	...RECOMMENDED_ZIP_LIMITS,
	maxEntryUncompressedBytes: 512 * 1024 * 1024, // 512 MiB per entry
	maxTotalUncompressedBytes: 2 * 1024 * 1024 * 1024, // 2 GiB total
	maxMediaBytes: 1.5 * 1024 * 1024 * 1024, // 1.5 GiB under ppt/media/
};

/**
 * Preview popup for PowerPoint (.pptx) documents, rendered read-only with
 * @aiden0z/pptx-renderer (Apache-2.0). The renderer parses OOXML into HTML/SVG
 * DOM and mounts slides windowed (IntersectionObserver) so large decks stay
 * responsive. Editing is out of scope — the library has no edit API.
 *
 * Viewer-side features: a thumbnail directory (one scaled preview per slide,
 * click to jump) and a play mode (one slide at a time, fit-to-contain, with
 * prev/next + keyboard navigation). Both reuse the same loaded viewer instance.
 */
export default function PptxPreviewModal({ isOpen = true, onClose, fileName, fileUrl }: BinaryOfficePreviewProps) {
	const { t } = useI18nContext();
	const [fullscreen, setFullscreen] = useState(false);

	const headerActions = <FullscreenToggleButton active={fullscreen} onClick={() => setFullscreen((f) => !f)} />;

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
					<PptxViewerInner fileUrl={fileUrl} />
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
// PPTX: @aiden0z/pptx-renderer. Fetch the raw bytes, parse + build + render in
// one call, mount windowed. Dispose on unmount to free blob URLs / observers.
// ---------------------------------------------------------------------------

/**
 * pptx-renderer paints pictures that have no image data as a dash-bordered
 * light-grey box with the exact text "No image data". We hide its parent shape
 * container so the stray block doesn't cover the slide. Real pictures (incl.
 * the full-slide background) never produce this text and are left untouched.
 */
function hideEmptyPictures(root: HTMLElement) {
	// The renderer (wn) paints pictures that have NO image data as a
	// dash-bordered light-grey div with the exact text "No image data" inside
	// the pic shape container. Hide the whole shape container so the stray
	// block disappears. Real pictures (incl. the full-slide background) load a
	// real image and never produce this text, so they are never touched.
	// NOTE: do NOT key off `[data-pptx-background-image]` -- that attribute is
	// present on every picture *before* its image finishes loading, so hiding
	// on an empty URL would wrongly kill the full-slide background too.
	const all = root.querySelectorAll<HTMLElement>("div");
	for (const el of all) {
		// Only the leaf node carries the bare "No image data" text; its ancestor
		// pic box also reports the same textContent, so require a leaf
		// (children.length === 0) to avoid hiding the whole slide by mistake.
		if (el.children.length === 0 && el.textContent && el.textContent.trim() === "No image data") {
			const box = el.parentElement ?? el;
			box.style.setProperty("display", "none");
		}
	}
}

// ---------------------------------------------------------------------------
// Play overlay: one slide at a time, fit-to-contain, edge-to-edge (no chrome).
// Controls mirror WPS presentation mode:
//   next  -> → ↓ Space PageDown Enter / wheel down / left click
//   prev  -> ← ↑ PageUp Backspace / wheel up
//   first/last -> Home / End
//   exit  -> Esc (or the floating exit button)
// A floating hint sits bottom-left and auto-dims after 4s of mouse idle.
// ---------------------------------------------------------------------------
function PlayOverlay({
	viewer,
	slideCount,
	startIndex,
	onClose,
}: {
	viewer: PptxViewer;
	slideCount: number;
	startIndex: number;
	onClose: () => void;
}) {
	const { t } = useI18nContext();
	const [index, setIndex] = useState(startIndex);
	const containerRef = useRef<HTMLDivElement>(null);
	const handleRef = useRef<SlideHandle | null>(null);
	const [box, setBox] = useState({ w: 0, h: 0 });
	const wheelAt = useRef(0);
	const hintTimer = useRef<number | null>(null);
	const [hintOn, setHintOn] = useState(true);

	const next = useCallback(() => setIndex((i) => Math.min(slideCount - 1, i + 1)), [slideCount]);
	const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

	// Keep the hint visible, then dim it after a short idle.
	const bumpHint = useCallback(() => {
		setHintOn(true);
		if (hintTimer.current) window.clearTimeout(hintTimer.current);
		hintTimer.current = window.setTimeout(() => setHintOn(false), 4000);
	}, []);

	useEffect(() => {
		bumpHint();
		window.addEventListener("mousemove", bumpHint);
		return () => {
			window.removeEventListener("mousemove", bumpHint);
			if (hintTimer.current) window.clearTimeout(hintTimer.current);
		};
	}, [bumpHint]);

	// Track the viewport size for fit-to-contain scaling.
	useEffect(() => {
		const el = containerRef.current;
		if (!el) return undefined;
		const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
		measure();
		const ro = new ResizeObserver(measure);
		ro.observe(el);
		return () => ro.disconnect();
	}, []);

	// Render the current slide. renderSlideToContainer APPENDS a slide node and
	// never clears the container, so we dispose the previous handle AND wipe the
	// DOM first — otherwise the old slide stays mounted and navigating looks like
	// nothing changed. The slide is then centered in the viewport.
	useEffect(() => {
		const el = containerRef.current;
		if (!el || !viewer) return undefined;
		handleRef.current?.dispose();
		handleRef.current = null;
		el.replaceChildren();
		const sw = viewer.slideWidth || 914;
		const sh = viewer.slideHeight || 514;
		const scale = box.w && box.h ? Math.min(box.w / sw, box.h / sh) : 1;
		const h = viewer.renderSlideToContainer(index, el, scale);
		handleRef.current = h;
		const node = h?.element;
		if (node) {
			node.style.position = "absolute";
			node.style.left = "50%";
			node.style.top = "50%";
			node.style.transformOrigin = "center center";
			node.style.transform = `translate(-50%, -50%) scale(${scale})`;
		}
		return () => {
			h?.dispose();
			handleRef.current = null;
		};
	}, [index, viewer, box.w, box.h]);

	// Keyboard. Capture phase so Escape is swallowed before the Modal's own
	// document-level close handler sees it (Esc should only leave play mode).
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (
				e.key === "ArrowRight" ||
				e.key === "ArrowDown" ||
				e.key === " " ||
				e.key === "PageDown" ||
				e.key === "Enter"
			) {
				e.preventDefault();
				next();
				bumpHint();
			} else if (e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "PageUp" || e.key === "Backspace") {
				e.preventDefault();
				prev();
				bumpHint();
			} else if (e.key === "Home") {
				e.preventDefault();
				setIndex(0);
			} else if (e.key === "End") {
				e.preventDefault();
				setIndex(slideCount - 1);
			} else if (e.key === "Escape") {
				e.preventDefault();
				e.stopPropagation();
				onClose();
			}
		};
		window.addEventListener("keydown", onKey, true);
		return () => window.removeEventListener("keydown", onKey, true);
	}, [next, prev, bumpHint, slideCount, onClose]);

	// Mouse wheel navigation, throttled so a single trackpad flick doesn't skip
	// several slides. Ctrl+wheel (browser zoom) is left alone.
	useEffect(() => {
		const onWheel = (e: WheelEvent) => {
			if (e.ctrlKey) return;
			if (Math.abs(e.deltaY) < Math.abs(e.deltaX) || Math.abs(e.deltaY) < 4) return;
			e.preventDefault();
			const now = Date.now();
			if (now - wheelAt.current < 350) return;
			wheelAt.current = now;
			if (e.deltaY > 0) next();
			else prev();
			bumpHint();
		};
		window.addEventListener("wheel", onWheel, { passive: false });
		return () => window.removeEventListener("wheel", onWheel);
	}, [next, prev, bumpHint]);

	// WPS: a left click anywhere advances. Ignore clicks on in-slide links.
	const onStageClick = (e: ReactMouseEvent) => {
		if ((e.target as HTMLElement).closest("a")) return;
		next();
		bumpHint();
	};

	// Portal to <body> so the overlay truly covers the whole viewport,
	// independent of the (possibly non-fullscreen) preview modal.
	return createPortal(
		<div className="fixed inset-0 z-[100] overflow-hidden bg-black">
			{/* Slide stage — fills the whole viewport. */}
			{/* biome-ignore lint/a11y/noStaticElementInteractions: full-screen click-to-advance stage (WPS-style), not a control widget */}
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard nav is bound globally on window in this overlay */}
			<div ref={containerRef} onClick={onStageClick} className="absolute inset-0" />

			{/* Floating hint, bottom-left. */}
			<div
				className={`pointer-events-none absolute bottom-3 left-3 rounded-md bg-black/55 px-3 py-2 text-white transition-opacity duration-300 ${
					hintOn ? "opacity-100" : "opacity-0"
				}`}
			>
				<div className="text-sm font-medium tabular-nums">
					{t.preview.pptx.pageOfPages.replace("{current}", String(index + 1)).replace("{total}", String(slideCount))}
				</div>
				<div className="mt-0.5 text-[11px] leading-relaxed text-white/70">{t.preview.pptx.shortcutHint}</div>
			</div>

			{/* Exit affordance for mouse-only users. */}
			<button
				type="button"
				onClick={(e) => {
					e.stopPropagation();
					onClose();
				}}
				className={`absolute bottom-3 right-3 rounded-md border border-white/30 bg-black/55 px-3 py-1.5 text-sm text-white transition-opacity duration-300 hover:bg-white/10 ${
					hintOn ? "opacity-100" : "opacity-0"
				}`}
			>
				{t.preview.pptx.exitPlay}
			</button>
		</div>,
		document.body,
	);
}

// ---------------------------------------------------------------------------
function PptxViewerInner({ fileUrl }: { fileUrl: string }) {
	const { t } = useI18nContext();
	const containerRef = useRef<HTMLDivElement>(null);
	const viewerRef = useRef<PptxViewer | null>(null);
	const thumbRefs = useRef<(HTMLDivElement | null)[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [ready, setReady] = useState(false);
	const [slideCount, setSlideCount] = useState(0);
	const [slideAspect, setSlideAspect] = useState(9 / 16);
	const [currentIndex, setCurrentIndex] = useState(0);
	const [tocOpen, setTocOpen] = useState(true);
	const [playing, setPlaying] = useState(false);

	useEffect(() => {
		let cancelled = false;
		let mediaObserver: MutationObserver | null = null;
		let onRenderComplete: (() => void) | null = null;
		const container = containerRef.current;
		if (!container) return undefined;
		(async () => {
			try {
				const resp = await fetch(fileUrl);
				if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
				const buffer = await resp.arrayBuffer();
				if (cancelled) return;
				const viewer = await PptxViewer.open(buffer, container, {
					zipLimits: PREVIEW_ZIP_LIMITS,
					listOptions: { windowed: true },
					onSlideChange: (i: number) => setCurrentIndex(i),
				});
				if (cancelled) {
					viewer.destroy();
					return;
				}
				viewerRef.current = viewer;
				setSlideCount(viewer.slideCount);
				setSlideAspect((viewer.slideHeight || 514) / (viewer.slideWidth || 914));
				setReady(true);
				// Hide empty picture placeholders left by the renderer (see
				// hideEmptyPictures). Cover both the first paint and windowed
				// lazy mounts of later slides.
				const cleanup = () => hideEmptyPictures(container);
				cleanup();
				onRenderComplete = cleanup;
				viewer.addEventListener("rendercomplete", cleanup);
				if (typeof MutationObserver !== "undefined") {
					let raf = 0;
					mediaObserver = new MutationObserver(() => {
						cancelAnimationFrame(raf);
						raf = requestAnimationFrame(cleanup);
					});
					mediaObserver.observe(container, { childList: true, subtree: true });
				}
			} catch (e) {
				if (!cancelled) setError(e instanceof Error ? e.message : String(e));
			}
		})();
		return () => {
			cancelled = true;
			if (mediaObserver) mediaObserver.disconnect();
			if (onRenderComplete && viewerRef.current) {
				viewerRef.current.removeEventListener("rendercomplete", onRenderComplete);
			}
			thumbRefs.current = [];
			viewerRef.current?.destroy();
			viewerRef.current = null;
		};
	}, [fileUrl]);

	// Render thumbnails into the sidebar once the viewer is ready and the
	// directory is open. Dispose every handle on cleanup (toggle off / unmount).
	useEffect(() => {
		if (!ready || !tocOpen || !viewerRef.current) return undefined;
		const viewer = viewerRef.current;
		const handles: SlideHandle[] = [];
		for (let i = 0; i < slideCount; i++) {
			const el = thumbRefs.current[i];
			if (!el) continue;
			// Clear first (a prior width change or theme toggle re-runs this
			// effect) then render at the box's OWN measured width so the
			// thumbnail is laid out to exactly the available space and can never
			// overflow the sidebar / active-slide ring.
			el.replaceChildren();
			const w = Math.round(el.clientWidth);
			if (w <= 0) continue;
			const h = viewer.renderThumbnailToContainer(i, el, { width: w });
			if (h) handles.push(h);
			hideEmptyPictures(el);
		}
		return () => {
			for (const h of handles) h.dispose();
		};
	}, [ready, tocOpen, slideCount]);

	const goTo = (i: number) => {
		viewerRef.current?.goToSlide(i);
	};

	// Keep the scroll container mounted at all times (the open effect attaches
	// to it); show loading / error as an overlay instead of swapping the tree.
	return (
		<div className="relative flex h-full min-h-0 flex-col">
			{ready && (
				<div className="flex shrink-0 items-center gap-2 border-b border-gray-200 px-2 py-1.5 dark:border-gray-700">
					<button
						type="button"
						className={actionBtn}
						onClick={() => setTocOpen((o) => !o)}
						title={t.preview.pptx.outlineTitle}
					>
						{tocOpen ? t.preview.pptx.hideOutline : t.preview.pptx.showOutline}
					</button>
					<button
						type="button"
						className={`${actionBtn} inline-flex items-center gap-1`}
						onClick={() => setPlaying(true)}
						title={t.preview.pptx.play}
					>
						<PlayIcon className="h-3.5 w-3.5" />
						{t.preview.pptx.play}
					</button>
					<span className="ml-auto text-xs tabular-nums text-gray-500 dark:text-gray-400">
						{t.preview.pptx.pageOfPages
							.replace("{current}", String(currentIndex + 1))
							.replace("{total}", String(slideCount))}
					</span>
				</div>
			)}
			<div className="flex min-h-0 flex-1">
				{ready && tocOpen && slideCount > 1 && (
					<aside className="w-44 shrink-0 min-h-0 overflow-y-auto border-r border-gray-200 p-2 [scrollbar-gutter:stable] dark:border-gray-700">
						{Array.from({ length: slideCount }, (_, i) => i).map((slideIndex) => (
							<button
								key={slideIndex}
								type="button"
								onClick={() => goTo(slideIndex)}
								className={`mb-2 block w-full rounded p-1 text-left transition-colors ${
									slideIndex === currentIndex
										? "bg-blue-50 ring-2 ring-blue-400 dark:bg-blue-900/40"
										: "hover:bg-gray-100 dark:hover:bg-gray-700"
								}`}
							>
								<div
									ref={(el) => {
										thumbRefs.current[slideIndex] = el;
									}}
									className="mb-1 w-full overflow-hidden rounded bg-white shadow-sm dark:bg-gray-900"
									style={{ aspectRatio: `${1 / slideAspect}` }}
								/>
								<span className="block truncate text-xs text-gray-600 dark:text-gray-300">
									{t.preview.pptx.slideIndex.replace("{index}", String(slideIndex + 1))}
								</span>
							</button>
						))}
					</aside>
				)}
				<div className="relative min-w-0 flex-1">
					<div ref={containerRef} className="h-full overflow-auto bg-white px-2 py-2 dark:bg-gray-900" />
					{!ready && !error && (
						<div className="absolute inset-0 flex items-center justify-center text-gray-400 dark:text-gray-500">
							{t.preview.pptx.loading}
						</div>
					)}
					{error && (
						<div className="absolute inset-0 flex items-center justify-center text-red-500">
							{t.preview.shared.renderFailed.replace("{format}", "PPTX").replace("{message}", error)}
						</div>
					)}
				</div>
			</div>
			{playing && viewerRef.current && (
				<PlayOverlay
					viewer={viewerRef.current}
					slideCount={slideCount}
					startIndex={currentIndex}
					onClose={() => setPlaying(false)}
				/>
			)}
		</div>
	);
}
