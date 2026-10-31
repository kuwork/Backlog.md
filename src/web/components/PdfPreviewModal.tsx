import type * as PdfJs from "pdfjs-dist";
import { type ReactNode, useEffect, useRef, useState } from "react";
import type { BinaryOfficePreviewProps } from "./binaryOfficeFile";
import Modal from "./Modal";

const LIST_ICON_PATH = "M4 6h16M4 12h10M4 18h7";
const CHEVRON_ICON_PATH = "M9 5l7 7-7 7";

const actionBtn =
	"rounded-md border border-gray-300 px-3 py-1 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700";

/**
 * Preview popup for PDF documents, rendered with pdf.js.
 *
 * pdf.js is self-hosted at /vendor/pdf.mjs (embedded in the binary) and loaded at runtime so it
 * is never bundled; the worker is /vendor/pdf.worker.min.mjs. When the PDF embeds an outline
 * (table of contents), a clickable sidebar styled like the task modal's in-page outline
 * (TocDrawer) is shown on the left and scrolls the target page into view. Supports a CSS
 * fullscreen toggle that fills the viewport, and the preview body clips to the modal window's
 * rounded corner radius.
 */
export default function PdfPreviewModal({ isOpen = true, onClose, fileName, fileUrl }: BinaryOfficePreviewProps) {
	const [fullscreen, setFullscreen] = useState(false);

	const headerActions = (
		<button
			type="button"
			className={actionBtn}
			onClick={() => setFullscreen((f) => !f)}
			title={fullscreen ? "退出全屏" : "全屏"}
		>
			{fullscreen ? "退出全屏" : "全屏"}
		</button>
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
					<PdfViewer fileUrl={fileUrl} />
				) : (
					<div className="flex h-full items-center justify-center text-gray-500 dark:text-gray-400">
						无法预览：缺少文件地址
					</div>
				)}
			</div>
		</Modal>
	);
}

// ---------------------------------------------------------------------------
// PDF: pdf.js, self-hosted at /vendor and loaded at runtime (not bundled).
// The bare specifier is kept in a variable so the bundler treats it as a runtime import.
// When the document exposes an outline (table of contents), a sidebar styled like the
// task modal's in-page outline (TocDrawer / TocRows) is rendered and scrolls the page in.
// ---------------------------------------------------------------------------
interface PdfOutlineNode {
	title: string;
	dest?: string | unknown[] | null;
	url?: string | null;
	items: PdfOutlineNode[];
}

function PdfViewer({ fileUrl }: { fileUrl: string }) {
	const containerRef = useRef<HTMLDivElement>(null);
	const pageRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
	const docRef = useRef<PdfJs.PDFDocumentProxy | null>(null);
	const baseWidthRef = useRef<number>(0); // page width at scale 1 (CSS px @72dpi)
	const [error, setError] = useState<string | null>(null);
	const [docReady, setDocReady] = useState(false);
	const [outline, setOutline] = useState<PdfOutlineNode[] | null>(null);
	const [outlineOpen, setOutlineOpen] = useState(false);
	const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
	const [activeKey, setActiveKey] = useState<string | null>(null);
	const [scale, setScale] = useState(1.5);
	const MAX_SCALE = 2.2;

	// Load the document once; page rendering reacts to `scale` below.
	useEffect(() => {
		let cancelled = false;
		let loadingTask: PdfJs.PDFDocumentLoadingTask | null = null;
		(async () => {
			try {
				const pdfSpec = "/vendor/pdf.mjs";
				const pdfjs = (await import(pdfSpec)) as typeof PdfJs;
				pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdf.worker.min.mjs";
				loadingTask = pdfjs.getDocument({ url: fileUrl });
				const doc = await loadingTask.promise;
				if (cancelled) return;
				docRef.current = doc;
				const first = await doc.getPage(1);
				baseWidthRef.current = first.getViewport({ scale: 1 }).width;
				first.cleanup();
				const outlineItems = (await doc.getOutline()) as PdfOutlineNode[] | null;
				if (outlineItems && outlineItems.length > 0 && !cancelled) {
					setOutline(outlineItems);
					setOutlineOpen(true);
				}
				setDocReady(true);
			} catch (e) {
				if (!cancelled) setError(e instanceof Error ? e.message : String(e));
			}
		})();
		return () => {
			cancelled = true;
			loadingTask?.destroy();
			docRef.current = null;
			pageRefs.current.clear();
			setDocReady(false);
		};
	}, [fileUrl]);

	// Fit the page width to the available space so the page never needs horizontal
	// scrolling — especially once the outline sidebar collapses/expands (the sidebar is
	// part of the flex layout, so the container's client width already reflects the
	// space left after the outline toggles). A cap keeps very wide windows from zooming
	// the page absurdly large.
	useEffect(() => {
		if (!docReady) return undefined;
		const container = containerRef.current;
		if (!container) return undefined;
		const fit = () => {
			const base = baseWidthRef.current;
			if (!base) return;
			const avail = container.clientWidth - 16; // px-2 (8px each side)
			if (avail <= 0) return;
			const next = Math.min(MAX_SCALE, Math.max(0.5, avail / base));
			setScale((prev) => (Math.abs(prev - next) < 0.01 ? prev : next));
		};
		fit();
		const ro = new ResizeObserver(fit);
		ro.observe(container);
		return () => ro.disconnect();
	}, [docReady]);

	// Re-render the pages at the current scale whenever it or the document changes.
	useEffect(() => {
		const doc = docRef.current;
		const container = containerRef.current;
		if (!doc || !container || !docReady) return;
		let cancelled = false;
		(async () => {
			container.innerHTML = "";
			pageRefs.current.clear();
			for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
				if (cancelled) return;
				const page = await doc.getPage(pageNum);
				const viewport = page.getViewport({ scale });
				const canvas = document.createElement("canvas");
				canvas.width = viewport.width;
				canvas.height = viewport.height;
				canvas.className = "mb-3 mx-auto shadow";
				pageRefs.current.set(pageNum, canvas);
				container.appendChild(canvas);
				const ctx = canvas.getContext("2d");
				if (!ctx) {
					page.cleanup();
					continue;
				}
				await page.render({ canvas, canvasContext: ctx, viewport }).promise;
				page.cleanup();
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [scale, docReady]);

	const goToOutlineDest = async (dest: string | unknown[] | null | undefined) => {
		const doc = docRef.current;
		if (!doc || dest == null) return;
		try {
			const explicit = typeof dest === "string" ? await doc.getDestination(dest) : dest;
			if (!Array.isArray(explicit) || explicit.length === 0) return;
			const ref = explicit[0];
			const index = await doc.getPageIndex(ref);
			const pageNum = index + 1;
			pageRefs.current.get(pageNum)?.scrollIntoView({ behavior: "smooth", block: "start" });
		} catch {
			/* ignore unresolvable destinations */
		}
	};

	const toggleFold = (key: string) =>
		setCollapsed((prev) => {
			const next = new Set(prev);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return next;
		});

	const allFoldableKeys = (nodes: PdfOutlineNode[], path: string, acc: string[]): void => {
		nodes.forEach((node, i) => {
			const key = `${path}/${i}`;
			if (node.items.length > 0) {
				acc.push(key);
				allFoldableKeys(node.items, key, acc);
			}
		});
	};

	const hasFoldable = outline ? outline.some((n) => n.items.length > 0) : false;

	const toggleAllFolds = () => {
		if (!outline) return;
		if (collapsed.size === 0) {
			const keys: string[] = [];
			allFoldableKeys(outline, "root", keys);
			setCollapsed(new Set(keys));
		} else {
			setCollapsed(new Set());
		}
	};

	// Renders the outline tree with the same visual language as the task modal's
	// in-page outline (TocRows): indented rows, a chevron fold control for branches,
	// a left accent border, and a blue active highlight on the selected entry.
	const renderOutline = (nodes: PdfOutlineNode[], depth: number, keyPath: string): ReactNode => (
		<ul className="space-y-0.5">
			{nodes.map((node, i) => {
				const key = `${keyPath}/${i}`;
				const hasChildren = node.items.length > 0;
				const folded = collapsed.has(key);
				const isActive = activeKey === key;
				return (
					<li key={key} style={{ paddingLeft: 12 + depth * 12 }}>
						<div className="flex items-stretch">
							{hasChildren ? (
								<button
									type="button"
									aria-expanded={!folded}
									aria-label={folded ? "展开" : "折叠"}
									onClick={() => toggleFold(key)}
									className="flex w-5 shrink-0 items-center justify-center rounded text-gray-400 transition-colors duration-200 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-stone-400 dark:text-gray-500 dark:hover:text-gray-200"
								>
									<svg
										className={`h-3.5 w-3.5 transition-transform duration-200 ${folded ? "" : "rotate-90"}`}
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
										aria-hidden="true"
									>
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={CHEVRON_ICON_PATH} />
									</svg>
								</button>
							) : (
								<span className="w-5 shrink-0" aria-hidden="true" />
							)}
							<button
								type="button"
								onClick={() => {
									setActiveKey(key);
									goToOutlineDest(node.dest);
								}}
								title={node.title}
								aria-current={isActive ? "true" : undefined}
								className={`block min-w-0 flex-1 truncate border-l-2 py-1 pr-2 text-left text-sm transition-colors duration-200 ${
									isActive
										? "border-blue-500 font-medium text-blue-600 dark:border-blue-400 dark:text-blue-400"
										: "border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
								}`}
							>
								{node.title}
							</button>
						</div>
						{hasChildren && !folded && renderOutline(node.items, depth + 1, key)}
					</li>
				);
			})}
		</ul>
	);

	if (error) {
		return <div className="flex h-full items-center justify-center text-red-500">PDF 渲染失败：{error}</div>;
	}
	return (
		<div className="flex h-full min-h-0">
			{outline && outlineOpen && (
				<aside className="flex w-72 shrink-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-800">
					<div className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-100 px-3 py-2 dark:border-gray-700">
						<p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">目录</p>
						<div className="flex items-center gap-1">
							{hasFoldable && (
								<button
									type="button"
									onClick={toggleAllFolds}
									title={collapsed.size === 0 ? "折叠全部" : "展开全部"}
									className="shrink-0 rounded px-1.5 py-0.5 text-xs text-gray-500 transition-colors duration-200 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-stone-400 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100"
								>
									{collapsed.size === 0 ? "折叠全部" : "展开全部"}
								</button>
							)}
							<button
								type="button"
								onClick={() => setOutlineOpen(false)}
								aria-label="关闭目录"
								className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-xl leading-none text-gray-400 transition-colors duration-200 hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-stone-400 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300"
							>
								×
							</button>
						</div>
					</div>
					<div className="min-h-0 flex-1 overflow-y-auto p-2">{renderOutline(outline, 0, "root")}</div>
				</aside>
			)}
			<div className="relative min-w-0 flex-1">
				{outline && !outlineOpen && (
					<button
						type="button"
						aria-label="目录"
						title="目录"
						onClick={() => setOutlineOpen(true)}
						className="absolute left-0 top-1/2 z-10 flex -translate-y-1/2 flex-col items-center gap-1.5 rounded-r-md border border-l-0 border-gray-200 bg-white px-1 py-2.5 text-gray-500 shadow-md transition-colors duration-200 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-stone-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400 dark:hover:text-gray-100"
					>
						<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={LIST_ICON_PATH} />
						</svg>
						<span className="text-xs font-medium [writing-mode:vertical-rl]">目录</span>
					</button>
				)}
				<div ref={containerRef} className="h-full overflow-auto px-2" />
			</div>
		</div>
	);
}
