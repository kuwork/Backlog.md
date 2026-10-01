import { Outlet } from "react-router-dom";
import type { Decision, DocsTreeNode, Document, Task, WikiTreeNode } from "../../types";
import { TocProvider } from "../contexts/TocContext";
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
		</TocProvider>
	);
}
