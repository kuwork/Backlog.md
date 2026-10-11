import { useEffect, useRef, useState } from "react";
import { useI18n } from "../hooks/useI18n";
import { apiClient } from "../lib/api";

const LAST_STATEMENT_KEY = "backlog.graph.cypher.lastStatement";

/**
 * The conceptual kuzu schema, surfaced as a hint so the user can write Cypher against the graph.
 * Mirrors the store's SCHEMA_DDL (doc-014 §1.2 / doc-15): FileNode/Tag/Meta node tables and the
 * relationship tables. Kept as a constant on the client because the schema is stable and the hint
 * only needs the table/property names, not a live introspection call.
 */
const SCHEMA_HINT = {
	nodeTables: [
		{ name: "FileNode", props: ["path", "id", "type", "title", "status", "updatedDate"] },
		{ name: "Tag", props: ["name"] },
		{ name: "Meta", props: ["name", "value"] },
	],
	relTables: ["ParentOf", "BelongsToMilestone", "DependsOn", "SourcedFrom", "LinksTo", "TaggedWith"],
	fileNodeTypes: ["task", "draft", "milestone", "wiki", "decision", "document"],
} as const;

interface CypherSearchDialogProps {
	/** When true the popup is mounted and visible. */
	open: boolean;
	/** Close the popup without running anything (the magnifier toggle or the X). */
	onClose: () => void;
	/** Called on a successful query with the FileNode keys to highlight on the canvas. */
	onSearchSuccess: (nodeKeys: string[]) => void;
	/** Clears the active highlight on the canvas (the 清除 button). */
	onClear: () => void;
}

export default function CypherSearchDialog({ open, onClose, onSearchSuccess, onClear }: CypherSearchDialogProps) {
	const { t } = useI18n();
	const [statement, setStatement] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const textareaRef = useRef<HTMLTextAreaElement | null>(null);

	// Re-open: refill the input with the last statement that was run, per the "show last Cypher
	// again on re-click" behaviour. The popup is unmounted while closed, so this runs each open.
	useEffect(() => {
		if (!open) return;
		setError(null);
		setLoading(false);
		setStatement(localStorage.getItem(LAST_STATEMENT_KEY) ?? "");
		// Focus after the popover paints so the caret lands in the input.
		requestAnimationFrame(() => textareaRef.current?.focus());
	}, [open]);

	if (!open) return null;

	const runSearch = async () => {
		const query = statement.trim();
		if (!query) {
			setError(t.graphView.cypherEmpty);
			return;
		}
		setError(null);
		setLoading(true);
		try {
			// Persist on submit (success or not) so re-opening shows the last query.
			localStorage.setItem(LAST_STATEMENT_KEY, query);
			const result = await apiClient.runCypher(query);
			onSearchSuccess(result.nodeKeys);
			onClose();
		} catch (err) {
			setError(err instanceof Error ? err.message : t.graphView.cypherFailed);
		} finally {
			setLoading(false);
		}
	};

	const handleClear = () => {
		setStatement("");
		setError(null);
		localStorage.removeItem(LAST_STATEMENT_KEY);
		// Restore original state: clear the input and any active highlight on the canvas.
		onClear();
	};

	return (
		<div className="absolute top-36 left-3 z-30 w-[360px] rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
			<div className="flex items-center justify-between border-b border-gray-200 px-3 py-2 dark:border-gray-700">
				<h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{t.graphView.cypherSearch}</h3>
				<button
					type="button"
					onClick={onClose}
					className="-mr-1 flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
					title={t.common.close}
					aria-label={t.common.close}
				>
					<svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<div className="space-y-3 px-3 py-3">
				<section className="rounded-md bg-gray-50 p-2 text-[11px] leading-relaxed text-gray-600 dark:bg-gray-900/50 dark:text-gray-300">
					<p className="mb-1 font-medium text-gray-700 dark:text-gray-200">{t.graphView.cypherSchemaHint}</p>
					<div className="mb-1">
						<span className="font-medium">{t.graphView.cypherNodeTables}：</span>
						{SCHEMA_HINT.nodeTables.map((table) => (
							<span key={table.name} className="ml-1 inline-block">
								<code className="rounded bg-gray-200 px-1 dark:bg-gray-700">{table.name}</code>
								<span className="text-gray-400 dark:text-gray-500">
									( {table.props.join(", ")}
									{")"}
								</span>
							</span>
						))}
					</div>
					<div className="mb-1">
						<span className="font-medium">{t.graphView.cypherRelTables}：</span>
						{SCHEMA_HINT.relTables.map((rel) => (
							<code key={rel} className="ml-1 inline-block rounded bg-gray-200 px-1 dark:bg-gray-700">
								{rel}
							</code>
						))}
					</div>
					<div>
						<span className="font-medium">FileNode.type ∈ </span>
						{SCHEMA_HINT.fileNodeTypes.map((type) => (
							<code key={type} className="ml-1 inline-block rounded bg-gray-200 px-1 dark:bg-gray-700">
								{type}
							</code>
						))}
					</div>
				</section>

				<textarea
					ref={textareaRef}
					value={statement}
					onChange={(event) => setStatement(event.target.value)}
					onKeyDown={(event) => {
						if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
							event.preventDefault();
							void runSearch();
						}
					}}
					rows={4}
					spellCheck={false}
					placeholder={t.graphView.cypherPlaceholder}
					className="w-full resize-y rounded-md border border-gray-300 bg-white px-2 py-1.5 font-mono text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
				/>

				{error && (
					<p className="rounded-md bg-red-50 px-2 py-1.5 text-xs text-red-600 dark:bg-red-900/30 dark:text-red-400">
						{error}
					</p>
				)}

				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={() => void runSearch()}
						disabled={loading}
						className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
					>
						{loading ? (
							<span
								className="h-3.5 w-3.5 animate-spin rounded-circle border-2 border-white/40 border-t-white"
								aria-hidden="true"
							/>
						) : (
							<svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
								/>
							</svg>
						)}
						{t.graphView.cypherSearchButton}
					</button>
					<button
						type="button"
						onClick={handleClear}
						className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
					>
						{t.graphView.cypherClear}
					</button>
					<span className="ml-auto text-[11px] text-gray-400 dark:text-gray-500">⌘/Ctrl+Enter</span>
				</div>
			</div>
		</div>
	);
}
