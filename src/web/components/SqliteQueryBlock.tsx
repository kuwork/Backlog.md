import type { CSSProperties, ReactNode } from "react";
import { Fragment, useCallback, useEffect, useId, useMemo, useState } from "react";
import { parseSqliteQueryBlock, type SqliteQueryView } from "../../sqlite/block.ts";
import { cellToMarkdown, resultToMarkdownTable } from "../../sqlite/markdown.ts";
import { useI18n } from "../hooks/useI18n";
import { apiClient, type SqliteCell, type SqliteQueryResult } from "../lib/api";
import { saveTextFile } from "../lib/save-file";

interface Props {
	/** The fenced block body, exactly as written in the document. */
	block: string;
}

type State =
	| { status: "loading" }
	| { status: "ready"; result: SqliteQueryResult }
	| { status: "error"; message: string };

function fill(template: string, values: Record<string, string | number>): string {
	return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}

/**
 * The surrounding `.wmde-markdown` styles every `<pre>` (chrome, margins, its own font stack) at a
 * specificity no single utility class can beat - the same trap the list view resets `dt` / `dd` for.
 */
const PRE_RESET: CSSProperties = {
	margin: 0,
	padding: 0,
	background: "transparent",
	fontSize: "0.75rem",
	whiteSpace: "pre",
};

function renderCell(cell: SqliteCell): ReactNode {
	if (cell === null) return <span className="text-gray-400 dark:text-gray-500">NULL</span>;
	return String(cell);
}

/** How long a button stays on its confirmation before reverting to the action label. */
const CONFIRMATION_MS = 2000;

/**
 * `navigator.clipboard` is unavailable outside a secure context, and this app is reachable over a
 * plain http LAN address often enough for that to matter. The textarea route is deprecated but is
 * still the only thing that works there, so it is the fallback rather than nothing.
 */
async function writeClipboard(text: string): Promise<void> {
	if (navigator.clipboard?.writeText) {
		try {
			await navigator.clipboard.writeText(text);
			return;
		} catch {
			/* fall through to the textarea below */
		}
	}
	const textarea = document.createElement("textarea");
	textarea.value = text;
	textarea.setAttribute("readonly", "");
	textarea.style.position = "fixed";
	textarea.style.opacity = "0";
	document.body.appendChild(textarea);
	textarea.select();
	try {
		const copied = document.execCommand?.("copy") ?? false;
		if (!copied) throw new Error("document.execCommand('copy') refused");
	} finally {
		document.body.removeChild(textarea);
	}
}

/**
 * A `sqlite-query` block in reading view (doc-16 §6).
 *
 * The SQL never runs here: it is posted to the server, which is the only side that may open the
 * database. A block that cannot even be parsed is reported inline instead of being sent, so a typo
 * costs one render and not one request.
 */
export default function SqliteQueryBlock({ block }: Props) {
	const { t } = useI18n();
	const parsed = useMemo(() => parseSqliteQueryBlock(block), [block]);
	const [nonce, setNonce] = useState(0);
	const [state, setState] = useState<State>({ status: "loading" });
	const [queryOpen, setQueryOpen] = useState(false);
	const panelId = useId();

	useEffect(() => {
		// `nonce` is the refresh signal: bumped, never read. That is the whole point of it - the
		// block and the document path have not changed, the reader just wants the rows re-read.
		void nonce;
		if (!parsed.ok) return;
		let cancelled = false;
		setState({ status: "loading" });
		apiClient
			.runSqliteQuery({ source: parsed.block.source, sql: parsed.block.sql })
			.then((result) => {
				if (!cancelled) setState({ status: "ready", result });
			})
			.catch((error: unknown) => {
				if (cancelled) return;
				setState({ status: "error", message: error instanceof Error ? error.message : String(error) });
			});
		return () => {
			cancelled = true;
		};
	}, [parsed, nonce]);

	const refresh = useCallback(() => setNonce((value) => value + 1), []);
	const view: SqliteQueryView = parsed.ok ? parsed.block.view : "table";

	// Only what the reader already sees on screen is copied - a truncated grid copies the rows that
	// were loaded, which is exactly what the truncation note under the table says is there.
	const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
	const copyMarkdown = useMemo(() => {
		if (state.status !== "ready" || state.result.rows.length === 0) return null;
		return view === "value" ? cellToMarkdown(state.result.rows[0]?.[0] ?? null) : resultToMarkdownTable(state.result);
	}, [state, view]);

	const copy = useCallback(async () => {
		if (!copyMarkdown) return;
		try {
			await writeClipboard(copyMarkdown);
			setCopyState("copied");
		} catch {
			setCopyState("failed");
		}
	}, [copyMarkdown]);

	useEffect(() => {
		if (copyState === "idle") return;
		const timer = setTimeout(() => setCopyState("idle"), CONFIRMATION_MS);
		return () => clearTimeout(timer);
	}, [copyState]);

	// Export re-runs server-side: the server re-reads `source` and `sql` through the same gates it
	// does for a render and returns the CSV text, then the browser writes it where the user picks.
	// The button is shown only when there is a result to save; while saving it stays visible but
	// disabled so the header does not flicker empty mid-save.
	const canExport = parsed.ok && state.status === "ready" && state.result.rows.length > 0;
	const [exportState, setExportState] = useState<
		| { status: "idle" }
		| { status: "saving" }
		| { status: "saved"; name: string; truncated: boolean }
		| { status: "failed"; message: string }
	>({ status: "idle" });
	const exportCsv = useCallback(async () => {
		if (!parsed.ok) return;
		setExportState({ status: "saving" });
		try {
			const payload = await apiClient.exportSqliteCsv({ source: parsed.block.source, sql: parsed.block.sql });
			await saveTextFile(payload.filename, payload.csv);
			setExportState({ status: "saved", name: payload.filename, truncated: payload.truncated });
		} catch (error: unknown) {
			// The save dialog was dismissed: nothing was written, so treat it as a no-op, not a failure.
			if (error instanceof DOMException && error.name === "AbortError") {
				setExportState({ status: "idle" });
				return;
			}
			setExportState({ status: "failed", message: error instanceof Error ? error.message : String(error) });
		}
	}, [parsed]);

	let body: ReactNode;
	if (!parsed.ok) {
		body = <p className="text-red-600 dark:text-red-400">{parsed.error}</p>;
	} else if (state.status === "loading") {
		body = <p className="text-gray-500 dark:text-gray-400">{t.sqliteQueryBlock.loading}</p>;
	} else if (state.status === "error") {
		body = (
			<p className="text-red-600 dark:text-red-400">
				{t.sqliteQueryBlock.error}：{state.message}
			</p>
		);
	} else if (state.result.rows.length === 0) {
		body = <p className="text-gray-500 dark:text-gray-400">{t.sqliteQueryBlock.empty}</p>;
	} else if (view === "value") {
		body = <span>{renderCell(state.result.rows[0]?.[0] ?? null)}</span>;
	} else if (view === "list") {
		// One grid for the whole result set. A per-row <dl> would size its label column against
		// *that row's* longest column name, so the two columns drift out of alignment row by row.
		body = (
			<dl className="grid grid-cols-[minmax(6rem,max-content)_1fr] gap-x-3 gap-y-1">
				{state.result.rows.map((row, rowIndex) => (
					// A result row has no key of its own; the index is the identity.
					// biome-ignore lint/suspicious/noArrayIndexKey: a result row has no identity of its own
					<div key={`row-${rowIndex}`} className="contents">
						{state.result.columns.map((column, columnIndex) => (
							<Fragment key={column}>
								{/*
								 * Inline styles, not utility classes: the surrounding `.wmde-markdown` ships
								 * `dl dt { margin-top; font-style: italic; font-weight: 600 }` and
								 * `dl dd { padding: 0 16px; margin-bottom: 16px }` at (0,2,1) specificity, which
								 * no single Tailwind class on the element can beat.
								 */}
								<dt
									className="text-gray-500 dark:text-gray-400"
									style={{ margin: 0, fontStyle: "normal", fontWeight: 400 }}
								>
									{column}
								</dt>
								<dd
									className="break-words"
									style={{
										margin: 0,
										padding: 0,
										marginBottom:
											columnIndex === state.result.columns.length - 1 && rowIndex < state.result.rows.length - 1
												? "0.75rem"
												: 0,
									}}
								>
									{renderCell(row[columnIndex] ?? null)}
								</dd>
							</Fragment>
						))}
					</div>
				))}
			</dl>
		);
	} else {
		body = (
			<div className="overflow-x-auto">
				<table className="w-full text-left border-collapse">
					<thead>
						<tr>
							{state.result.columns.map((column) => (
								<th
									key={column}
									className="px-2 py-1 border-b border-gray-200 dark:border-gray-700 font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap"
								>
									{column}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{state.result.rows.map((row, rowIndex) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: a result row has no identity of its own
							<tr key={`row-${rowIndex}`} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
								{row.map((cell, columnIndex) => (
									<td
										key={state.result.columns[columnIndex] ?? columnIndex}
										className="px-2 py-1 align-top break-words"
									>
										{renderCell(cell)}
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		);
	}

	return (
		<div className="my-3 rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden text-sm">
			<div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-300">
				<span className="truncate">
					{t.sqliteQueryBlock.title}
					{parsed.ok ? <span className="ml-1 font-mono">{parsed.block.source}</span> : null}
				</span>
				<span className="flex items-center gap-2 shrink-0">
					{state.status === "ready" ? (
						<span>
							{fill(t.sqliteQueryBlock.summary, { count: state.result.rows.length, ms: state.result.elapsedMs })}
						</span>
					) : null}
					<button
						type="button"
						onClick={() => setQueryOpen((open) => !open)}
						aria-expanded={queryOpen}
						aria-controls={panelId}
						className="px-2 py-0.5 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
					>
						{queryOpen ? t.sqliteQueryBlock.hideQuery : t.sqliteQueryBlock.showQuery}
					</button>
					{copyMarkdown ? (
						<button
							type="button"
							onClick={copy}
							className="px-2 py-0.5 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
						>
							{copyState === "copied"
								? t.sqliteQueryBlock.copied
								: copyState === "failed"
									? t.sqliteQueryBlock.copyFailed
									: t.sqliteQueryBlock.copyMarkdown}
						</button>
					) : null}
					{canExport || exportState.status === "saving" ? (
						<button
							type="button"
							onClick={exportCsv}
							disabled={!canExport}
							className="px-2 py-0.5 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
						>
							{exportState.status === "saving" ? t.sqliteQueryBlock.exporting : t.sqliteQueryBlock.exportCsv}
						</button>
					) : null}
					<button
						type="button"
						onClick={refresh}
						disabled={!parsed.ok || state.status === "loading"}
						className="px-2 py-0.5 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
					>
						{t.sqliteQueryBlock.refresh}
					</button>
				</span>
			</div>
			{queryOpen ? (
				<div
					id={panelId}
					className="px-3 py-2 bg-gray-50/50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-700"
				>
					{parsed.ok ? (
						<>
							<div className="mb-1 text-xs text-gray-500 dark:text-gray-400">
								source: <span className="font-mono">{parsed.block.source}</span>
							</div>
							<pre className="font-mono text-xs overflow-x-auto" style={PRE_RESET}>
								{parsed.block.sql}
							</pre>
						</>
					) : (
						// A block that will not parse has no fields to show, and the raw body is what the
						// reader has to fix, so show that instead of explaining the error twice.
						<pre className="font-mono text-xs overflow-x-auto" style={PRE_RESET}>
							{block}
						</pre>
					)}
				</div>
			) : null}
			<div className="p-3">
				{body}
				{state.status === "ready" && state.result.truncated ? (
					<p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
						{fill(t.sqliteQueryBlock.truncated, { count: state.result.rows.length })}
					</p>
				) : null}
				{exportState.status === "saved" ? (
					<p className="mt-2 text-xs break-all">
						<span className="text-gray-500 dark:text-gray-400">
							{fill(t.sqliteQueryBlock.exported, { name: exportState.name })}
						</span>
						{exportState.truncated ? (
							<span className="ml-1 text-gray-500 dark:text-gray-400">
								{fill(t.sqliteQueryBlock.truncated, { count: state.status === "ready" ? state.result.rows.length : 0 })}
							</span>
						) : null}
					</p>
				) : null}
				{exportState.status === "failed" ? (
					<p className="mt-2 text-xs text-red-600 dark:text-red-400">
						{t.sqliteQueryBlock.exportFailed}：{exportState.message}
					</p>
				) : null}
			</div>
		</div>
	);
}
