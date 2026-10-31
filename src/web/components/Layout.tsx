import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import type { Decision, DocsTreeNode, Document, Task, WikiTreeNode } from "../../types";
import { TocProvider } from "../contexts/TocContext";
import { kindFromName } from "./binaryOfficeFile";
import DocPdfPreviewModal from "./DocPdfPreviewModal";
import DocPreviewModal from "./DocPreviewModal";
import { HealthIndicator, HealthSuccessToast } from "./HealthIndicator";
import Navigation from "./Navigation";
import SideNavigation from "./SideNavigation";

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

	// Global capture-phase interceptor: any click on a /assets/*.docx or /assets/*.pdf
	// link opens the binary preview modal instead of navigating/downloading. Capture
	// phase runs before MermaidMarkdown's anchor onClick (which would otherwise try the
	// text-file preview path and fall back to window.open for binaries). Modifier keys
	// (Ctrl/Cmd/Shift/Alt) and explicit target="_blank"/download links are left alone so
	// "open in new tab" still works.
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
			const path = url.pathname.toLowerCase();
			if (!path.startsWith("/assets/")) return;
			if (!path.endsWith(".docx") && !path.endsWith(".pdf")) return;
			event.preventDefault();
			event.stopPropagation();
			const rawName = decodeURIComponent(url.pathname.split("/").pop() ?? "");
			const name = rawName || anchor.textContent?.trim() || "文件";
			// PDF uses the served URL; Word uses the project-relative path for server conversion.
			const filePath = `backlog${url.pathname}`;
			setPreviewFile({ url: url.href, name, filePath });
		};
		document.addEventListener("click", handleAssetLinkClick, true);
		return () => document.removeEventListener("click", handleAssetLinkClick, true);
	}, []);

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
			</div>
			{previewFile &&
				(kindFromName(previewFile.name) === "docx" ? (
					<DocPreviewModal
						isOpen={Boolean(previewFile)}
						onClose={() => setPreviewFile(null)}
						fileUrl={previewFile.url}
						filePath={previewFile.filePath}
						fileName={previewFile.name}
					/>
				) : (
					<DocPdfPreviewModal
						isOpen={Boolean(previewFile)}
						onClose={() => setPreviewFile(null)}
						fileUrl={previewFile.url}
						filePath={previewFile.filePath}
						fileName={previewFile.name}
					/>
				))}
		</TocProvider>
	);
}
