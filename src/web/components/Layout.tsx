import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import type { Decision, DocsTreeNode, Document, Task, WikiTreeNode } from "../../types";
import { useI18nContext } from "../contexts/I18nContext";
import { TocProvider } from "../contexts/TocContext";
import { isNonPreviewableOffice, kindFromName } from "./binaryOfficeFile";
import DocPreviewModal from "./DocPreviewModal";
import { HealthIndicator, HealthSuccessToast } from "./HealthIndicator";
import Navigation from "./Navigation";
import PdfPreviewModal from "./PdfPreviewModal";
import PptxPreviewModal from "./PptxPreviewModal";
import SideNavigation from "./SideNavigation";
import { SuccessToast } from "./SuccessToast";

interface LayoutProps {
	projectName: string;
	showSuccessToast: boolean;
	onDismissToast: () => void;
	tasks: Task[];
	docs: Document[];
	decisions: Decision[];
	wikiTree: WikiTreeNode[];
	docsTree: DocsTreeNode[];
	isLoading: boolean;
	loadingMessage?: string | null;
	graphStatus?: "building" | "ready" | null;
	loadError?: Error | null;
	onRefreshData: () => Promise<void>;
}

export default function Layout({
	projectName,
	showSuccessToast,
	onDismissToast,
	tasks,
	docs,
	decisions,
	wikiTree,
	docsTree,
	isLoading,
	loadingMessage,
	graphStatus,
	loadError,
	onRefreshData,
}: LayoutProps) {
	const [previewFile, setPreviewFile] = useState<{ url: string; name: string; filePath?: string } | null>(null);
	const [officeNotice, setOfficeNotice] = useState(false);
	const { t } = useI18nContext();

	// Global capture-phase interceptor: any click on a same-origin project .docx, .pdf or .pptx
	// link opens the binary preview modal instead of navigating/downloading. Capture
	// phase runs before MermaidMarkdown's anchor onClick (which would otherwise try the
	// text-file preview path and fall back to window.open for binaries). Unlike the
	// text-file preview, this is not limited to /assets/*: any project-relative path is
	// served as raw bytes via /api/raw-file. Modifier keys (Ctrl/Cmd/Shift/Alt) and
	// explicit target="_blank"/download links are left alone so "open in new tab" works.
	useEffect(() => {
		const handleAssetLinkClick = (event: MouseEvent) => {
			if (event.button !== 0) return;
			if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
			const target = event.target as Element | null;
			const anchor = target?.closest("a") as HTMLAnchorElement | null;
			if (!anchor) return;
			if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;
			const href = anchor.getAttribute("href");
			if (!href) return;
			let url: URL;
			try {
				url = new URL(href, window.location.href);
			} catch {
				return;
			}
			// Only intercept same-origin project files; external links stay with the browser.
			if (url.origin !== window.location.origin) return;
			// Derive the project path from the raw href, never from url.pathname: a relative
			// href such as `assets/x.pdf` resolves against the page URL (/task/411/assets/...)
			// rather than the project, and pathname keeps percent-escapes that a second
			// encodeURIComponent would double (%E4 -> %25E4), both of which 404 on the server.
			let projectPath = href.split(/[?#]/)[0] ?? "";
			try {
				projectPath = decodeURIComponent(projectPath);
			} catch {
				// Malformed percent-escape: keep the href as written rather than failing.
			}
			const path = projectPath.toLowerCase();
			const isPreviewable = path.endsWith(".docx") || path.endsWith(".pdf") || path.endsWith(".pptx");
			if (!isPreviewable && !isNonPreviewableOffice(path)) return;
			// Two addressing conventions, told apart by where the link lives: a rendered
			// markdown body (description / comment / notes) addresses assets as `assets/...`,
			// exactly like an image, while metadata fields carry project-root-relative
			// `backlog/...` paths. A path that resolves in neither context is left to the
			// browser, which 404s a body link written with the backlog/ prefix.
			const relPath = projectPath.replace(/^\//, "");
			const filePath = anchor.closest(".wmde-markdown")
				? relPath.startsWith("assets/")
					? `backlog/${relPath}`
					: null
				: relPath.startsWith("backlog/")
					? relPath
					: null;
			if (!filePath) return;
			if (isNonPreviewableOffice(path)) {
				event.preventDefault();
				event.stopPropagation();
				setOfficeNotice(true);
				return;
			}
			event.preventDefault();
			event.stopPropagation();
			const name = filePath.split("/").pop() || anchor.textContent?.trim() || "文件";
			const fileUrl = `/api/raw-file?path=${encodeURIComponent(filePath)}`;
			setPreviewFile({ url: fileUrl, name, filePath });
			// Everything else (images, markdown, code, external, ...) keeps default browser behavior.
		};
		document.addEventListener("click", handleAssetLinkClick, true);
		return () => document.removeEventListener("click", handleAssetLinkClick, true);
	}, []);

	useEffect(() => {
		if (!officeNotice) return;
		const id = setTimeout(() => setOfficeNotice(false), 4500);
		return () => clearTimeout(id);
	}, [officeNotice]);

	return (
		<TocProvider>
			<div className="h-screen bg-gray-50 dark:bg-gray-900 flex overflow-hidden transition-colors duration-200">
				<HealthIndicator />
				<SideNavigation
					tasks={tasks}
					docs={docs}
					decisions={decisions}
					wikiTree={wikiTree}
					docsTree={docsTree}
					isLoading={isLoading}
					error={loadError}
					onRetry={onRefreshData}
					onRefreshData={onRefreshData}
				/>
				<div className="flex-1 flex flex-col min-h-0 min-w-0">
					<Navigation projectName={projectName} loadingMessage={loadingMessage} graphStatus={graphStatus} />
					<main className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden">
						<Outlet context={{ tasks, docs, decisions, isLoading, onRefreshData }} />
					</main>
				</div>
				{showSuccessToast && <HealthSuccessToast onDismiss={onDismissToast} />}
				{officeNotice && (
					<SuccessToast
						message={t.filePreview.unsupportedType}
						variant="warning"
						onDismiss={() => setOfficeNotice(false)}
					/>
				)}
			</div>
			{previewFile && (
				// Stack above the task/doc modal layer (z-50): the click that opened this
				// preview often came from inside an already-open modal.
				<div className="relative z-[60]">
					{kindFromName(previewFile.name) === "docx" ? (
						<DocPreviewModal
							isOpen={Boolean(previewFile)}
							onClose={() => setPreviewFile(null)}
							fileUrl={previewFile.url}
							filePath={previewFile.filePath}
							fileName={previewFile.name}
						/>
					) : kindFromName(previewFile.name) === "pptx" ? (
						<PptxPreviewModal
							isOpen={Boolean(previewFile)}
							onClose={() => setPreviewFile(null)}
							fileUrl={previewFile.url}
							filePath={previewFile.filePath}
							fileName={previewFile.name}
						/>
					) : (
						<PdfPreviewModal
							isOpen={Boolean(previewFile)}
							onClose={() => setPreviewFile(null)}
							fileUrl={previewFile.url}
							filePath={previewFile.filePath}
							fileName={previewFile.name}
						/>
					)}
				</div>
			)}
		</TocProvider>
	);
}
