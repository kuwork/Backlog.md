import type React from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../hooks/useI18n";

const LIGHTBOX_IMAGE_SELECTOR = "[data-lightbox-img]";
const MIN_SCALE = 0.5;
const MAX_SCALE = 8;
const SCALE_STEP = 0.15;

interface ImageLightboxContextValue {
	openLightbox: (src: string) => void;
}

const ImageLightboxContext = createContext<ImageLightboxContextValue | null>(null);

export function useImageLightbox(): ImageLightboxContextValue {
	const ctx = useContext(ImageLightboxContext);
	if (!ctx) {
		throw new Error("useImageLightbox must be used within ImageLightboxProvider");
	}
	return ctx;
}

interface ImageLightboxProviderProps {
	children: React.ReactNode;
}

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

export function ImageLightboxProvider({ children }: ImageLightboxProviderProps) {
	const { t } = useI18n();
	const [isOpen, setIsOpen] = useState(false);
	const [sources, setSources] = useState<string[]>([]);
	const [currentIndex, setCurrentIndex] = useState(0);
	const [view, setView] = useState<ViewState>(defaultView);
	const [isDragging, setIsDragging] = useState(false);
	const imgRef = useRef<HTMLImageElement>(null);
	const isDraggingRef = useRef(false);
	const dragStartRef = useRef<{ x: number; y: number; tx: number; ty: number }>({ x: 0, y: 0, tx: 0, ty: 0 });

	const collectSources = useCallback((): string[] => {
		if (typeof document === "undefined") return [];
		const imgs = Array.from(document.querySelectorAll(LIGHTBOX_IMAGE_SELECTOR)) as HTMLImageElement[];
		return Array.from(new Set(imgs.map((img) => img.getAttribute("src")).filter((src): src is string => Boolean(src))));
	}, []);

	const resetView = useCallback(() => {
		setView(defaultView);
	}, []);

	const openLightbox = useCallback(
		(src: string) => {
			if (typeof document === "undefined" || !src) return;
			const collected = collectSources();
			const index = collected.indexOf(src);
			setSources(collected);
			setCurrentIndex(index >= 0 ? index : 0);
			resetView();
			setIsOpen(true);
		},
		[collectSources, resetView],
	);

	const closeLightbox = useCallback(() => {
		setIsOpen(false);
		resetView();
	}, [resetView]);

	const goNext = useCallback(() => {
		if (sources.length <= 1) return;
		setCurrentIndex((idx) => (idx + 1) % sources.length);
		resetView();
	}, [sources.length, resetView]);

	const goPrev = useCallback(() => {
		if (sources.length <= 1) return;
		setCurrentIndex((idx) => (idx - 1 + sources.length) % sources.length);
		resetView();
	}, [sources.length, resetView]);

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

	const clampTranslate = useCallback((point: Point, currentScale: number): Point => {
		if (!imgRef.current || currentScale <= 1) return { x: 0, y: 0 };
		const base = Math.max(imgRef.current.clientWidth, imgRef.current.clientHeight) * (currentScale - 1) * 0.5;
		const padding = Math.min(window.innerWidth, window.innerHeight) * 0.15;
		const limit = base + padding;
		return {
			x: Math.max(-limit, Math.min(limit, point.x)),
			y: Math.max(-limit, Math.min(limit, point.y)),
		};
	}, []);

	const startDrag = useCallback(
		(clientX: number, clientY: number) => {
			if (view.scale <= 1) return;
			isDraggingRef.current = true;
			setIsDragging(true);
			dragStartRef.current = { x: clientX, y: clientY, tx: view.translate.x, ty: view.translate.y };
		},
		[view.scale, view.translate],
	);

	const endDrag = useCallback(() => {
		isDraggingRef.current = false;
		setIsDragging(false);
	}, []);

	useEffect(() => {
		if (!isOpen) return;

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				e.preventDefault();
				e.stopPropagation();
				closeLightbox();
			} else if (e.key === "ArrowRight") {
				e.preventDefault();
				e.stopPropagation();
				goNext();
			} else if (e.key === "ArrowLeft") {
				e.preventDefault();
				e.stopPropagation();
				goPrev();
			}
		};

		const blockScroll = (e: Event) => {
			e.preventDefault();
		};

		document.addEventListener("keydown", handleKeyDown, { capture: true });
		document.addEventListener("wheel", blockScroll, { passive: false, capture: true });
		document.body.style.overflow = "hidden";
		document.documentElement.style.overflow = "hidden";

		return () => {
			document.removeEventListener("keydown", handleKeyDown, { capture: true });
			document.removeEventListener("wheel", blockScroll, { capture: true });
			document.body.style.overflow = "unset";
			document.documentElement.style.overflow = "unset";
		};
	}, [isOpen, closeLightbox, goNext, goPrev]);

	useEffect(() => {
		if (!isOpen) return;

		const handleMouseMove = (e: MouseEvent) => {
			if (!isDraggingRef.current) return;
			const dx = e.clientX - dragStartRef.current.x;
			const dy = e.clientY - dragStartRef.current.y;
			const next = clampTranslate(
				{ x: dragStartRef.current.tx + dx, y: dragStartRef.current.ty + dy },
				view.scale,
			);
			setView((prev) => ({ ...prev, translate: next }));
		};

		const handleMouseUp = () => {
			if (isDraggingRef.current) {
				endDrag();
			}
		};

		const handleTouchMove = (e: TouchEvent) => {
			if (!isDraggingRef.current) return;
			const touch = e.touches[0];
			if (!touch) return;
			e.preventDefault();
			const dx = touch.clientX - dragStartRef.current.x;
			const dy = touch.clientY - dragStartRef.current.y;
			const next = clampTranslate(
				{ x: dragStartRef.current.tx + dx, y: dragStartRef.current.ty + dy },
				view.scale,
			);
			setView((prev) => ({ ...prev, translate: next }));
		};

		const handleTouchEnd = () => {
			if (isDraggingRef.current) {
				endDrag();
			}
		};

		window.addEventListener("mousemove", handleMouseMove);
		window.addEventListener("mouseup", handleMouseUp);
		window.addEventListener("touchmove", handleTouchMove, { passive: false });
		window.addEventListener("touchend", handleTouchEnd);

		return () => {
			window.removeEventListener("mousemove", handleMouseMove);
			window.removeEventListener("mouseup", handleMouseUp);
			window.removeEventListener("touchmove", handleTouchMove);
			window.removeEventListener("touchend", handleTouchEnd);
		};
	}, [isOpen, view.scale, clampTranslate, endDrag]);

	const handleWheel = useCallback(
		(e: React.WheelEvent<HTMLImageElement>) => {
			e.preventDefault();
			const delta = e.deltaY > 0 ? -SCALE_STEP : SCALE_STEP;
			const pointerX = e.clientX;
			const pointerY = e.clientY;

			setView((prev) => {
				const nextScale = Math.min(Math.max(prev.scale + delta, MIN_SCALE), MAX_SCALE);
				if (nextScale === prev.scale) return prev;

				const centerX = window.innerWidth / 2 + prev.translate.x;
				const centerY = window.innerHeight / 2 + prev.translate.y;
				const dx = pointerX - centerX;
				const dy = pointerY - centerY;
				const factor = nextScale / prev.scale;
				const nextTranslate = clampTranslate(
					{ x: prev.translate.x - dx * (factor - 1), y: prev.translate.y - dy * (factor - 1) },
					nextScale,
				);
				return { ...prev, scale: nextScale, translate: nextTranslate };
			});
		},
		[clampTranslate],
	);

	const handleMouseDown = useCallback(
		(e: React.MouseEvent<HTMLImageElement>) => {
			if (view.scale <= 1) return;
			startDrag(e.clientX, e.clientY);
		},
		[view.scale, startDrag],
	);

	const handleTouchStart = useCallback(
		(e: React.TouchEvent<HTMLImageElement>) => {
			if (view.scale <= 1) return;
			const touch = e.touches[0];
			if (!touch) return;
			startDrag(touch.clientX, touch.clientY);
		},
		[view.scale, startDrag],
	);

	const cursor = view.scale <= 1 ? "default" : isDragging ? "grabbing" : "grab";
	const transformStyle = `translate(${view.translate.x}px, ${view.translate.y}px) scale(${view.scale}) rotate(${view.rotation}deg)`;

	const value = useMemo(() => ({ openLightbox }), [openLightbox]);

	return (
		<ImageLightboxContext.Provider value={value}>
			{children}
			{isOpen && (
				<div
					className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center"
					role="presentation"
					onWheel={(e) => e.preventDefault()}
				>
					<button
						type="button"
						onClick={closeLightbox}
						className="absolute top-4 right-4 z-20 rounded-lg w-10 h-10 flex items-center justify-center bg-black/20 hover:bg-black/40 text-white/90 hover:text-white text-2xl transition-colors"
						aria-label={t.common.close}
					>
						×
					</button>

					{sources.length > 1 && (
						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								goPrev();
							}}
							className="absolute left-4 top-1/2 -translate-y-1/2 z-20 rounded-lg w-14 h-14 flex items-center justify-center bg-black/20 hover:bg-black/40 text-white/90 hover:text-white text-4xl transition-colors"
							aria-label={t.common.back}
						>
							‹
						</button>
					)}

					{sources.length > 1 && (
						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								goNext();
							}}
							className="absolute right-4 top-1/2 -translate-y-1/2 z-20 rounded-lg w-14 h-14 flex items-center justify-center bg-black/20 hover:bg-black/40 text-white/90 hover:text-white text-4xl transition-colors"
							aria-label={t.common.next}
						>
							›
						</button>
					)}

					{sources[currentIndex] && (
						<img
							ref={imgRef}
							key={sources[currentIndex]}
							src={sources[currentIndex]}
							alt=""
							aria-label={t.common.preview}
							className="max-w-[90vw] max-h-[90vh] object-contain select-none"
							style={{
								transform: transformStyle,
								transformOrigin: "center",
								cursor,
								transition: isDragging ? "none" : "transform 100ms ease-out",
							}}
							onWheel={handleWheel}
							onMouseDown={handleMouseDown}
							onTouchStart={handleTouchStart}
							draggable={false}
						/>
					)}

					{sources.length > 1 && (
						<div className="absolute bottom-[5.5rem] left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-black/20">
							{sources.map((src, idx) => {
								const distance = Math.abs(idx - currentIndex);
								const dotScale = Math.max(0.5, 1.25 - distance * 0.2);
								const isActive = idx === currentIndex;
								return (
									<button
										key={src}
										type="button"
										onClick={(e) => {
											e.stopPropagation();
											setCurrentIndex(idx);
											resetView();
										}}
										className={`w-2.5 h-2.5 rounded-full transition-all duration-200 ease-out ${
											isActive ? "bg-white" : "bg-white/40 hover:bg-white/70"
										}`}
										style={{ transform: `scale(${dotScale})` }}
										aria-label={t.imageLightbox.goToImage.replace("{index}", String(idx + 1))}
									/>
								);
							})}
						</div>
					)}

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
		</ImageLightboxContext.Provider>
	);
}
