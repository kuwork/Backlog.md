import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDiagramEngine } from "../charts/diagram-engine";
import { useQueryResultRegistry } from "../charts/query-result-registry";
import { getChartEngine } from "../charts/registry";
import { useOptionalTheme } from "../contexts/ThemeContext";
import { useI18n } from "../hooks/useI18n";

const MIN_SCALE = 0.5;
const MAX_SCALE = 8;
const SCALE_STEP = 0.15;

/**
 * Only engines that draw to a cloneable SVG DOM (not canvas) can be shown in the
 * fullscreen overlay. Mermaid/Pele emits SVG, so its node subtree can be cloned
 * verbatim; an engine that renders to a canvas bitmap would clone a blank surface.
 */
const FULLSCREEN_LANGS = new Set(["mermaid"]);

interface Point {
	x: number;
	y: number;
}

interface ViewState {
	scale: number;
	translate: Point;
	rotation: number;
}

const defaultView: ViewState = {
	scale: 1,
	translate: { x: 0, y: 0 },
	rotation: 0,
};

interface ChartBlockProps {
	/** Fence language, e.g. `mermaid` or `echarts`. */
	lang: string;
	/** Fenced block body, exactly as authored. */
	source: string;
}

/**
 * Renders any chart-language block through the engine registry. The component
 * owns the container node itself, so the engine draws into it and disposes on
 * unmount/theme change — no post-render DOM replacement, unlike the old
 * `renderMermaidIn` pass.
 *
 * For SVG-based engines (mermaid) a "view fullscreen" button overlays the chart;
 * opening it clones the rendered SVG into a CSS fullscreen overlay with the same
 * zoom/pan/rotate interactions as the image lightbox.
 */
export default function ChartBlock({ lang, source }: ChartBlockProps) {
	const ref = useRef<HTMLDivElement | null>(null);
	const { t } = useI18n();
	const mode = useOptionalTheme();
	const engineId = useDiagramEngine();
	const engine = getChartEngine(lang);
	const registry = useQueryResultRegistry();
	const resolveQuery = registry?.get;
	// Only charts that actually reference a query result need to re-render when the registry changes;
	// keep the dependency key at 0 otherwise so an unrelated result update does not redraw this chart.
	const registryKey = source.includes("fromQuery") ? (registry?.version ?? 0) : 0;

	// The overlay always sits on a dimmed (dark) backdrop. Render Pele with its dark palette and
	// the classic Mermaid engine with a light theme that we then invert, so both read clearly.
	const overlayMode: "light" | "dark" = engineId === "pele" ? "dark" : "light";

	const [isFullscreen, setIsFullscreen] = useState(false);
	const [view, setView] = useState<ViewState>(defaultView);
	const viewRef = useRef(view);
	viewRef.current = view;
	const [hasOverflow, setHasOverflow] = useState(false);
	const cloneRef = useRef<HTMLDivElement | null>(null);
	const overlayRef = useRef<HTMLDivElement | null>(null);
	const isDraggingRef = useRef(false);
	const dragStartRef = useRef<{ x: number; y: number; tx: number; ty: number }>({ x: 0, y: 0, tx: 0, ty: 0 });

	const closeFullscreen = useCallback(() => {
		setIsFullscreen(false);
		setView(defaultView);
		setHasOverflow(false);
	}, []);

	const resetView = useCallback(() => setView(defaultView), []);

	const zoomIn = useCallback(() => {
		setView((prev) => ({ ...prev, scale: Math.min(prev.scale + SCALE_STEP, MAX_SCALE) }));
	}, []);

	const zoomOut = useCallback(() => {
		setView((prev) => ({ ...prev, scale: Math.max(prev.scale - SCALE_STEP, MIN_SCALE) }));
	}, []);

	const rotateLeft = useCallback(() => {
		setView((prev) => ({ ...prev, rotation: prev.rotation - 90 }));
	}, []);

	const rotateRight = useCallback(() => {
		setView((prev) => ({ ...prev, rotation: prev.rotation + 90 }));
	}, []);

	// Wheel zoom is bound as a NATIVE non-passive listener: React delegates
	// `onWheel` through a passive root listener, so calling preventDefault there
	// throws "Unable to preventDefault inside passive event listener". Attaching our
	// own listener with { passive: false } lets us block page scroll/zoom.
	useEffect(() => {
		if (!isFullscreen) return;
		const el = overlayRef.current;
		if (!el) return;
		const onWheel = (e: WheelEvent) => {
			e.preventDefault();
			const delta = e.deltaY > 0 ? -SCALE_STEP : SCALE_STEP;
			const cur = viewRef.current;
			setView((prev) => {
				const nextScale = Math.min(Math.max(prev.scale + delta, MIN_SCALE), MAX_SCALE);
				if (nextScale === prev.scale) return prev;
				const centerX = window.innerWidth / 2 + cur.translate.x;
				const centerY = window.innerHeight / 2 + cur.translate.y;
				const dx = e.clientX - centerX;
				const dy = e.clientY - centerY;
				const factor = nextScale / prev.scale;
				return {
					...prev,
					scale: nextScale,
					translate: { x: cur.translate.x - dx * (factor - 1), y: cur.translate.y - dy * (factor - 1) },
				};
			});
		};
		el.addEventListener("wheel", onWheel, { passive: false });
		return () => el.removeEventListener("wheel", onWheel);
	}, [isFullscreen]);

	const startDrag = useCallback(
		(e: React.MouseEvent<HTMLDivElement>) => {
			if (view.scale <= 1 && !hasOverflow) return;
			isDraggingRef.current = true;
			dragStartRef.current = { x: e.clientX, y: e.clientY, tx: view.translate.x, ty: view.translate.y };
		},
		[view.scale, view.translate, hasOverflow],
	);

	useEffect(() => {
		// `registryKey` is the subscription signal: bumped, never read, so a query result arriving
		// later re-runs the effect (and therefore `setOption`) for charts that use `fromQuery`.
		void registryKey;
		// `engineId` is the active diagram backend; a Settings switch must re-render the diagram.
		void engineId;
		const el = ref.current;
		const renderEngine = getChartEngine(lang);
		if (!el || !renderEngine) return;

		let cancelled = false;
		let renderer: Awaited<ReturnType<typeof renderEngine.load>> | null = null;

		const frame = requestAnimationFrame(() => {
			if (cancelled) return;
			renderEngine
				.load()
				.then((r) => {
					if (cancelled) return;
					renderer = r;
					void r.render({ container: el, source, mode, resolveQuery });
				})
				.catch((err: unknown) => {
					console.warn("chart engine failed to render", err);
				});
		});

		return () => {
			cancelled = true;
			cancelAnimationFrame(frame);
			if (renderer && el) renderer.dispose?.(el);
		};
		// `engineId` is the active diagram backend; a Settings switch must re-render the diagram.
	}, [lang, source, mode, resolveQuery, registryKey, engineId]);

	// Render the diagram fresh into the fullscreen overlay. We re-render rather than
	// clone the on-page SVG because (1) the classic Mermaid backend renders
	// asynchronously, so the live node may not be ready when the overlay opens,
	// and (2) Mermaid's `run` skips nodes already marked `data-processed`, which
	// made cloning-from-the-page (or re-rendering into a reused node) come up empty.
	// The overlay container is a clean node each time, so both backends render reliably.
	useEffect(() => {
		if (!isFullscreen) return;
		const target = cloneRef.current;
		if (!target) return;
		const renderEngine = getChartEngine(lang);
		if (!renderEngine) return;

		let cancelled = false;
		target.replaceChildren();
		const frame = requestAnimationFrame(() => {
			if (cancelled) return;
			renderEngine
				.load()
				.then((r) => {
					if (cancelled) return;
					void r.render({ container: target, source, mode: overlayMode, resolveQuery });
					const svg = target.querySelector("svg");
					if (svg) {
						// Size the diagram to "fit and center": read its natural coordinate
						// space (viewBox is authoritative; fall back to the rendered box),
						// then scale it with a contain-fit (whole diagram visible, no
						// overflow) plus a readability floor (each side >= 50% of the
						// available area) so extreme aspect ratios stay legible. We set an
						// explicit pixel size on the SVG and let the parent flexbox center it
						// — this works for any native aspect ratio and does not depend on the
						// SVG's own `preserveAspectRatio` (some Mermaid outputs align content
						// to the top-left, leaving the diagram stuck in a corner).
						const svgEl = svg as SVGSVGElement;
						const vb = svgEl.viewBox;
						let naturalW = 100;
						let naturalH = 100;
						if (vb?.baseVal?.width && vb?.baseVal?.height) {
							naturalW = vb.baseVal.width;
							naturalH = vb.baseVal.height;
						} else {
							const rect = svgEl.getBoundingClientRect();
							naturalW = rect.width || 100;
							naturalH = rect.height || 100;
						}
						const availW = (typeof window !== "undefined" ? window.innerWidth : 1024) * 0.9;
						const availH = (typeof window !== "undefined" ? window.innerHeight : 768) * 0.9;
						// Contain-fit: scale so the whole diagram is visible with no overflow.
						let fit = Math.min(availW / naturalW, availH / naturalH);
						// Readability floor: if the contained diagram would be too small to read,
						// stop shrinking at a minimum (each side >= 50% of the available area) so
						// the text stays legible. The diagram then overflows and can be panned/zoomed.
						const minW = availW * 0.5;
						const minH = availH * 0.5;
						if (naturalW * fit < minW) fit = minW / naturalW;
						if (naturalH * fit < minH) fit = minH / naturalH;
						svgEl.removeAttribute("width");
						svgEl.removeAttribute("height");
						svgEl.style.width = `${naturalW * fit}px`;
						svgEl.style.height = `${naturalH * fit}px`;
						svgEl.style.maxWidth = "none";
						svgEl.style.maxHeight = "none";
						if (!cancelled) {
							setHasOverflow(naturalW * fit > availW || naturalH * fit > availH);
						}
					}
				})
				.catch((err: unknown) => {
					console.warn("chart fullscreen render failed", err);
				});
		});

		return () => {
			cancelled = true;
			cancelAnimationFrame(frame);
		};
	}, [isFullscreen, lang, source, resolveQuery, overlayMode]);

	// Esc closes; lock page scroll while open.
	useEffect(() => {
		if (!isFullscreen) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				e.preventDefault();
				e.stopPropagation();
				closeFullscreen();
			}
		};
		document.addEventListener("keydown", onKey, { capture: true });
		document.body.style.overflow = "hidden";
		document.documentElement.style.overflow = "hidden";
		return () => {
			document.removeEventListener("keydown", onKey, { capture: true });
			document.body.style.overflow = "unset";
			document.documentElement.style.overflow = "unset";
		};
	}, [isFullscreen, closeFullscreen]);

	// Pan while zoomed in.
	useEffect(() => {
		if (!isFullscreen) return;
		const onMove = (e: MouseEvent) => {
			if (!isDraggingRef.current) return;
			const dx = e.clientX - dragStartRef.current.x;
			const dy = e.clientY - dragStartRef.current.y;
			setView((prev) => ({ ...prev, translate: { x: dragStartRef.current.tx + dx, y: dragStartRef.current.ty + dy } }));
		};
		const onUp = () => {
			isDraggingRef.current = false;
		};
		window.addEventListener("mousemove", onMove);
		window.addEventListener("mouseup", onUp);
		return () => {
			window.removeEventListener("mousemove", onMove);
			window.removeEventListener("mouseup", onUp);
		};
	}, [isFullscreen]);

	const transformStyle = `translate(${view.translate.x}px, ${view.translate.y}px) scale(${view.scale}) rotate(${view.rotation}deg)`;
	const canPan = view.scale > 1 || hasOverflow;
	const cursor = canPan ? "grab" : "default";
	const supportsFullscreen = FULLSCREEN_LANGS.has(lang.toLowerCase());

	return (
		<div className="chart-block-wrapper relative">
			<div ref={ref} className={engine?.containerClassName ?? "chart-block"} style={engine?.containerStyle} />

			{supportsFullscreen && (
				<button
					type="button"
					onClick={() => setIsFullscreen(true)}
					className="absolute top-1 right-1 z-10 rounded-md p-1 leading-none bg-black/10 hover:bg-black/20 text-gray-700 dark:text-gray-200 dark:bg-white/10 dark:hover:bg-white/20"
					aria-label={t.imageLightbox.viewFullscreen}
					title={t.imageLightbox.viewFullscreen}
				>
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
						aria-hidden="true"
					>
						<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3" />
					</svg>
				</button>
			)}

			{isFullscreen && (
				<div
					className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center"
					role="dialog"
					aria-modal="true"
					aria-label={t.imageLightbox.viewFullscreen}
				>
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							closeFullscreen();
						}}
						className="absolute top-4 right-4 z-20 rounded-lg w-10 h-10 flex items-center justify-center bg-black/20 hover:bg-black/40 text-white/90 hover:text-white text-2xl transition-colors"
						aria-label={t.common.close}
					>
						×
					</button>

					<div
						ref={overlayRef}
						className="absolute inset-0 flex items-center justify-center overflow-hidden"
						role="application"
						aria-label={t.imageLightbox.viewFullscreen}
						onMouseDown={startDrag}
					>
						<div
							ref={cloneRef}
							className="chart-fullscreen-content max-w-[90vw] max-h-[90vh] flex items-center justify-center"
							style={{
								transform: transformStyle,
								transformOrigin: "center",
								cursor,
								transition: "transform 100ms ease-out",
								// The classic Mermaid backend bakes light colors into its SVG;
								// invert it so the (light) strokes become visible on the dimmed backdrop.
								...(engineId === "mermaid" ? { filter: "invert(1) hue-rotate(180deg)" } : {}),
							}}
						/>
					</div>

					<div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
						<button
							type="button"
							onClick={rotateLeft}
							className="rounded-lg w-10 h-10 flex items-center justify-center bg-black/20 hover:bg-black/40 text-white/90 hover:text-white text-xl transition-colors"
							aria-label={t.imageLightbox.rotateLeft}
						>
							↺
						</button>
						<button
							type="button"
							onClick={zoomOut}
							className="rounded-lg w-10 h-10 flex items-center justify-center bg-black/20 hover:bg-black/40 text-white/90 hover:text-white text-2xl transition-colors"
							aria-label={t.imageLightbox.zoomOut}
						>
							−
						</button>
						<button
							type="button"
							onClick={resetView}
							className="rounded-lg w-10 h-10 flex items-center justify-center bg-black/20 hover:bg-black/40 text-white/90 hover:text-white text-xl transition-colors"
							aria-label={t.imageLightbox.resetZoom}
						>
							⎌
						</button>
						<button
							type="button"
							onClick={zoomIn}
							className="rounded-lg w-10 h-10 flex items-center justify-center bg-black/20 hover:bg-black/40 text-white/90 hover:text-white text-2xl transition-colors"
							aria-label={t.imageLightbox.zoomIn}
						>
							+
						</button>
						<button
							type="button"
							onClick={rotateRight}
							className="rounded-lg w-10 h-10 flex items-center justify-center bg-black/20 hover:bg-black/40 text-white/90 hover:text-white text-xl transition-colors"
							aria-label={t.imageLightbox.rotateRight}
						>
							↻
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
