import type { CSSProperties, ReactNode } from "react";
import { Fragment, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { format as formatSql } from "sql-formatter";
import { parseQueryBlock, type QueryBlock, type QueryBlockParse } from "../../sqlite/block.ts";
import { cellToMarkdown, resultToMarkdownTable } from "../../sqlite/markdown.ts";
import EchartsFromResult from "../charts/EchartsFromResult";
import { useQueryResultRegistry } from "../charts/query-result-registry";
import type { SqliteCell, SqliteQueryResult } from "../lib/api";
import { apiClient } from "../lib/api";
import { saveTextFile } from "../lib/save-file";
import { highlightCode } from "../utils/code-highlight";
import type { ResultGraph } from "../utils/cypher-graph";
import Switch from "./Switch";

/**
 * The pagination-relevant slice of {@link BacklogConfig}. Every block fetches it on mount and
 * re-fetches on the `backlog-config-updated` window event (dispatched from App.tsx when the
 * server broadcasts a config change), so a Settings save reaches mounted blocks without a
 * reload; a failed fetch falls back to the engine defaults.
 */
interface QueryConfig {
	queryMaxRows: number;
	paginationPageSize: number;
	defaultPagination: boolean;
}

function loadQueryConfig(): Promise<QueryConfig> {
	return apiClient
		.fetchConfig()
		.then((config) => ({
			queryMaxRows: clampNumber(config.queryMaxRows, 500, 1, 5000),
			paginationPageSize: clampNumber(config.paginationPageSize, 50, 1, 1000),
			defaultPagination: config.defaultPagination ?? false,
		}))
		.catch(() => ({ queryMaxRows: 500, paginationPageSize: 50, defaultPagination: false }));
}

/** Clamps `value` to [min, max] after truncating to an integer; non-finite values use `fallback`. */
function clampNumber(value: number | undefined, fallback: number, min: number, max: number): number {
	if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
	return Math.min(Math.max(Math.trunc(value), min), max);
}

/**
 * The set of strings a query block needs. Both the SQLite and DuckDB explorers supply one (under
 * `t.sqliteQueryBlock` / `t.duckdbQueryBlock`); the component itself never hard-codes a label.
 */
export interface QueryBlockDict {
	title: string;
	refresh: string;
	loading: string;
	empty: string;
	truncated: string;
	summary: string;
	error: string;
	showQuery: string;
	hideQuery: string;
	copyMarkdown: string;
	copied: string;
	copyFailed: string;
	exportCsv: string;
	exporting: string;
	exported: string;
	exportFailed: string;
	/** Shown when a `copy_to` target was written: `{path}` is the project-relative destination. */
	writtenTo: string;
	/** Label for the pagination toggle switch. */
	paginationToggle: string;
	/** Pager text: `{page}` and `{total}` are the current and total page numbers. */
	pageXofY: string;
	/** aria-label / tooltip for the previous-page button. */
	prevPage: string;
	/** aria-label / tooltip for the next-page button. */
	nextPage: string;
	/**
	 * The inline statement editor (BACK-833). Only a block that knows which file it came from can
	 * write an edit back, so these strings stay unused on the read-only paths.
	 */
	edit: string;
	save: string;
	saving: string;
	saved: string;
	saveFailed: string;
	test: string;
	testing: string;
	testFailed: string;
	discard: string;
	/** Label for the format button (SQL engines only): reindents the edited statement. */
	format: string;
	/** Shown when the formatter rejects the edited statement (invalid SQL). */
	formatFailed: string;
	/**
	 * Graph-view fallback notice (cypher only): the result's `{count}` nodes exceeded the `{limit}`
	 * cap, so the block drew the table instead. Optional because only graph-capable engines set it.
	 */
	graphTooLarge?: string;
	/** Live-mode chrome (cypher only, BACK-804): the badge, and the pause/resume toggle labels. */
	live?: string;
	pauseAuto?: string;
	resumeAuto?: string;
}

/**
 * The grid every engine returns. `graphRows` is the cypher graph view's raw channel (BACK-803):
 * node/relationship structures the server attaches when the request asks for `view: "graph"`,
 * alongside the coerced `rows` that stay the table fallback.
 */
export interface QueryBlockResult extends SqliteQueryResult {
	graphRows?: unknown[][];
}

/** Everything that differs between the engines, so the render logic is written exactly once. */
export interface QueryEngineConfig {
	/** Engine id, surfaced nowhere but handy for debugging and future branching. */
	id: "sqlite" | "duckdb" | "cypher" | "mdb";
	/** The i18n strings for this engine's block. */
	dict: QueryBlockDict;
	/**
	 * Block body parser; defaults to the SQL grammar. The Cypher explorer supplies its own because
	 * its statement field is `query`, not `sql` (doc-27 §3) - the parsed shape is identical.
	 */
	parse?: (block: string) => QueryBlockParse;
	/**
	 * The grammar the 显示查询 panel tokenizes the statement with - `sql` for the SQL explorers,
	 * `cypher` for the graph one. Both come from the same Prism instance the reading view paints
	 * fenced code with, and an unknown name falls back to plain text rather than failing the render.
	 */
	highlightLanguage?: "sql" | "cypher";
	/** Runs one read-only statement and returns the grid. */
	run: (request: {
		source: string;
		sql: string;
		maxRows?: number;
		copyTo?: string;
		/** The block's `view`, so a graph-capable engine can ask the server for its raw rows. */
		view?: string;
		/** 1-based page for the pagination browser. */
		page?: number;
		/** Rows per page for the pagination browser. */
		pageSize?: number;
	}) => Promise<QueryBlockResult>;
	/** Builds the CSV server-side and returns it with a suggested filename. */
	exportCsv: (request: { source: string; sql: string }) => Promise<{
		filename: string;
		csv: string;
		rows: number;
		truncated: boolean;
	}>;
	/**
	 * Which action buttons this engine's blocks expose. Enabling them is milestone-gated per task.
	 * `pagination` is off for Cypher: its row cap is a memory guard, not a preview window (doc-27
	 * §5.3), so an over-cap result is a query to rewrite, not a result to page through.
	 */
	actions: { showHide: boolean; copy: boolean; export: boolean; pagination: boolean };
	/**
	 * Graph view support (the cypher engine's, BACK-803). Only an engine whose parser accepts
	 * `view: graph` declares it: `fromResult` reads the raw rows into a drawable graph (and feeds
	 * the node-cap guard), `render` draws it, and past `nodeLimit` nodes the block falls back to
	 * the table with a notice instead of freezing on the force layout.
	 */
	graph?: {
		fromResult: (result: QueryBlockResult) => ResultGraph;
		render: (graph: ResultGraph, context: { source: string; cameraToken: string }) => ReactNode;
		nodeLimit: number;
	};
	/**
	 * `refresh: auto` support (the cypher engine's, BACK-804). Only an engine whose parser accepts
	 * `auto` declares it: for an auto block the core subscribes while mounted, collapses a burst of
	 * change notices into one re-run after a 500ms quiet period, and skips the re-render when the
	 * re-run's rows are unchanged. A manual block never touches this - its behaviour is unchanged.
	 */
	refresh?: {
		auto: {
			/** Listen for changes to the database named `source`; returns the unsubscribe. */
			subscribe: (source: string, onChanged: () => void) => () => void;
		};
	};
}

interface Props {
	/** The fenced block body, exactly as written in the document. */
	block: string;
	engine: QueryEngineConfig;
	/**
	 * Project-relative path of the Markdown file the block lives in (BACK-833). Saving writes the
	 * statement back into that file, so a block rendered without one stays read-only and shows no
	 * edit affordance at all.
	 */
	filePath?: string;
}

type State =
	| { status: "loading" }
	| { status: "ready"; result: QueryBlockResult }
	| { status: "error"; message: string };

function fill(template: string, values: Record<string, string | number>): string {
	return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}

/**
 * Keeps the selected page within the result's range. The `page` state holds the reader's intent, but
 * the navigable range is set by `totalPages`; when the query changes (a discard or save swaps in a
 * shorter result, or live data shrinks) the previously chosen page can fall past the end. Without
 * this the pager sticks on an empty out-of-range page instead of snapping back to the last valid one.
 */
function clampPageToTotalPages(setPage: (next: number) => void, page: number, totalPages: number | undefined): void {
	if (totalPages !== undefined && page > totalPages) setPage(Math.max(1, totalPages));
}

/**
 * The textarea and the highlight `<pre>` must agree on every box metric (font, size, line height,
 * padding, border, box-sizing, tab size) or the caret drifts off the coloured text as you scroll.
 * One explicit style object is applied to both layers so the browser's differing textarea defaults
 * cannot pull them apart.
 */
const EDITOR_TEXT_STYLE: CSSProperties = {
	margin: 0,
	border: 0,
	padding: "0.5rem",
	fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
	fontSize: "0.75rem",
	lineHeight: 1.625,
	whiteSpace: "pre",
	overflowWrap: "normal",
	wordBreak: "normal",
	tabSize: 2,
	letterSpacing: "normal",
	boxSizing: "border-box",
};

/**
 * A textarea with a Prism-highlighted layer behind it. The typed text is transparent so the reader
 * sees the same token colours the reading view paints, while the caret and selection stay live. The
 * highlight layer is scroll-synced to the textarea. Box metrics are kept identical between the two
 * layers via {@link EDITOR_TEXT_STYLE}, so the tokens line up with the characters under the caret.
 * Used by the inline SQL editor so a draft reads as code while it is being written.
 */
function HighlightedSqlEditor(props: {
	value: string;
	onChange: (next: string) => void;
	language: "sql" | "cypher";
}): ReactNode {
	const preRef = useRef<HTMLPreElement>(null);
	// `highlightCode` returns the same token spans the reading view uses, so the editor inherits the
	// theme (light/dark) and the editor colours match the rendered block.
	const highlighted = useMemo(() => highlightCode(props.value, props.language), [props.value, props.language]);
	const syncScroll = useCallback((event: React.UIEvent<HTMLTextAreaElement>) => {
		const pre = preRef.current;
		if (pre) {
			pre.scrollTop = event.currentTarget.scrollTop;
			pre.scrollLeft = event.currentTarget.scrollLeft;
		}
	}, []);
	return (
		<div className="relative grid rounded border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900">
			<pre
				ref={preRef}
				aria-hidden="true"
				className="overflow-hidden"
				style={{
					...EDITOR_TEXT_STYLE,
					gridArea: "1 / 1",
					background: "transparent",
					pointerEvents: "none",
				}}
			>
				{highlighted}
			</pre>
			<textarea
				value={props.value}
				onChange={(event) => props.onChange(event.target.value)}
				onScroll={syncScroll}
				spellCheck={false}
				wrap="off"
				rows={Math.min(Math.max(props.value.split("\n").length, 4), 16)}
				className="relative z-10 w-full resize-y bg-transparent text-transparent caret-gray-900 outline-none focus-visible:ring-1 focus-visible:ring-blue-500 dark:caret-gray-100"
				style={{ ...EDITOR_TEXT_STYLE, gridArea: "1 / 1" }}
			/>
		</div>
	);
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

/** The quiet period a live block waits after the last change notice before re-running (BACK-804). */
const AUTO_REFRESH_DEBOUNCE_MS = 500;

/**
 * The stable identity of a result for the live re-run's change check. `elapsedMs` is excluded on
 * purpose: it differs on every run, so including it would make an unchanged result look changed.
 */
function resultFingerprint(result: QueryBlockResult): string {
	return JSON.stringify({
		columns: result.columns,
		rows: result.rows,
		truncated: result.truncated,
		totalRows: result.totalRows,
		graphRows: result.graphRows,
	});
}

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
 * The shared core of the `sqlite-query` and `duckdb-query` result blocks.
 *
 * The block's SQL never runs here: it is posted to the server, which is the only side that may open
 * the database. A block that cannot even be parsed is reported inline instead of being sent, so a
 * typo costs one render and not one request. The engine-specific differences (labels, endpoints,
 * which actions are live) arrive through {@link QueryEngineConfig}.
 */
export default function SqlQueryBlock({ block, engine, filePath }: Props) {
	const dict = engine.dict;
	const parseBlock = engine.parse ?? parseQueryBlock;
	// A successful save rewrites the block body, and the rewrite is what the file now holds - the
	// prop stays stale until the page re-reads it. Keeping the rewritten body here means a second
	// edit still finds its own block, and the grid below re-runs off the new statement.
	const [blockOverride, setBlockOverride] = useState<string | null>(null);
	const activeBlock = blockOverride ?? block;
	useEffect(() => {
		// `block` is the reset signal: a new prop means the page re-read the file, so the local
		// rewrite is dropped in favour of whatever the file says now.
		void block;
		setBlockOverride(null);
		setDisplayedSql(null);
	}, [block]);
	const parsed = useMemo(() => parseBlock(activeBlock), [activeBlock, parseBlock]);
	// Approach A (BACK-814): a block with an `id` publishes its result so an `echarts` block in the
	// same document can reference it via `fromQuery`. No Provider -> no-op, behaviour unchanged.
	const registry = useQueryResultRegistry();
	const setQueryResult = registry?.set;
	/** Pagination is a SQL-only browser; the Cypher engine treats its row cap as the whole answer. */
	const allowPagination = engine.actions.pagination;
	const [nonce, setNonce] = useState(0);
	const [state, setState] = useState<State>({ status: "loading" });
	const [queryOpen, setQueryOpen] = useState(false);
	/** Pagination browser state: whether it is on, the current page, and the resolved page size. */
	const [pagination, setPagination] = useState(false);
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(50);
	/**
	 * The SQL the grid currently reflects. `null` means the committed statement (`parsed.block.sql`);
	 * a successful Test sets it to the drafted statement so pagination keeps browsing the draft
	 * instead of re-running the (stale) block. It reverts to `null` on save, discard, or a file
	 * re-read, at which point the grid is driven by the committed statement again.
	 */
	const [displayedSql, setDisplayedSql] = useState<string | null>(null);
	/** The SQL the next run should execute: the tested draft if one is on screen, else the block. */
	const effectiveSql = displayedSql ?? (parsed.ok ? parsed.block.sql : "");
	const panelId = useId();
	const paginationToggleId = useId();

	useEffect(() => {
		// `nonce` is the refresh signal: bumped, never read. That is the whole point of it - the
		// block and the document path have not changed, the reader just wants the rows re-read.
		void nonce;
		if (!parsed.ok) return;
		let cancelled = false;
		setState({ status: "loading" });
		engine
			.run({
				source: parsed.block.source,
				// Run the statement the grid currently reflects - a tested draft when one is showing,
				// otherwise the committed block - so pagination and refresh stay on the same query.
				sql: effectiveSql,
				// A tested draft must never write its `copy_to` target (a test is read-only by design),
				// so the write target applies only to the committed statement.
				copyTo: displayedSql ? undefined : parsed.block.copyTo,
				// Only a graph-capable engine reads `view`; for the SQL explorers it stays undefined,
				// so JSON.stringify drops it and their request bodies are byte-for-byte unchanged.
				view: engine.graph ? parsed.block.view : undefined,
				page: pagination ? page : undefined,
				pageSize: pagination ? pageSize : undefined,
			})
			.then((result) => {
				if (cancelled) return;
				setState({ status: "ready", result });
				clampPageToTotalPages(setPage, page, result.totalPages);
				if (parsed.ok && parsed.block.id) setQueryResult?.(parsed.block.id, result);
			})
			.catch((error: unknown) => {
				if (cancelled) return;
				setState({ status: "error", message: error instanceof Error ? error.message : String(error) });
			});
		return () => {
			cancelled = true;
		};
	}, [parsed, nonce, engine, pagination, page, pageSize, displayedSql, effectiveSql, setQueryResult]);

	// Load the query config once (memoized) so `defaultPagination` can open the block in paginated
	// mode and the page size matches what the user set in Settings.
	useEffect(() => {
		let cancelled = false;
		void loadQueryConfig().then((config) => {
			if (cancelled) return;
			setPageSize(config.paginationPageSize);
			if (allowPagination && config.defaultPagination) setPagination(true);
		});
		return () => {
			cancelled = true;
		};
	}, [allowPagination]);

	// Re-fetch config when the server broadcasts a config change (e.g. from Settings save).
	useEffect(() => {
		const handle = () => {
			void loadQueryConfig().then((config) => {
				setPageSize(config.paginationPageSize);
				setPagination(allowPagination && config.defaultPagination);
			});
		};
		window.addEventListener("backlog-config-updated", handle);
		return () => window.removeEventListener("backlog-config-updated", handle);
	}, [allowPagination]);

	const togglePagination = useCallback((next: boolean) => {
		setPagination(next);
		if (next) setPage(1);
		setNonce((v) => v + 1);
	}, []);

	const goPrev = useCallback(() => setPage((current) => Math.max(1, current - 1)), []);
	const goNext = useCallback(() => setPage((current) => current + 1), []);

	const refresh = useCallback(() => setNonce((value) => value + 1), []);
	const view: QueryBlock["view"] = parsed.ok ? parsed.block.view : "table";

	// The statement painted by the very Prism pass that colours every fenced code block in the
	// surrounding markdown (BACK-811): a query is code, and the 显示查询 panel used to show it as
	// one flat run of text.
	const highlightedQuery = useMemo(
		() => (parsed.ok ? highlightCode(parsed.block.sql, engine.highlightLanguage ?? "sql") : null),
		[parsed, engine.highlightLanguage],
	);

	// Live mode (BACK-804): only an auto block on an engine that declared `refresh.auto` subscribes.
	const autoRefresh = parsed.ok && parsed.block.refresh === "auto" ? engine.refresh?.auto : undefined;
	// Pause stops the re-run, not the listener, so the flag lives in a ref the subscription callback
	// can read; the state twin only re-renders the toggle's label.
	const [livePaused, setLivePaused] = useState(false);
	const livePausedRef = useRef(false);
	const toggleLivePaused = useCallback(() => {
		livePausedRef.current = !livePausedRef.current;
		setLivePaused(livePausedRef.current);
	}, []);

	// A live re-run keeps the current result on screen while it runs (no loading flash), and keeps
	// the state object itself when the rows are unchanged, so React skips the re-render entirely.
	const rerunAuto = useCallback(() => {
		if (!parsed.ok) return;
		engine
			.run({
				source: parsed.block.source,
				sql: effectiveSql,
				copyTo: displayedSql ? undefined : parsed.block.copyTo,
				view: engine.graph ? parsed.block.view : undefined,
				page: pagination ? page : undefined,
				pageSize: pagination ? pageSize : undefined,
			})
			.then((result) => {
				if (parsed.ok && parsed.block.id) setQueryResult?.(parsed.block.id, result);
				clampPageToTotalPages(setPage, page, result.totalPages);
				setState((current) =>
					current.status === "ready" && resultFingerprint(current.result) === resultFingerprint(result)
						? current
						: { status: "ready", result },
				);
			})
			.catch(() => {
				// A failed live re-run (graph service restarting, database dropped) leaves the current
				// result untouched: the next change notice tries again.
			});
	}, [parsed, engine, pagination, page, pageSize, displayedSql, effectiveSql, setQueryResult]);

	const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	useEffect(() => {
		if (!autoRefresh || !parsed.ok) return;
		const unsubscribe = autoRefresh.subscribe(parsed.block.source, () => {
			if (livePausedRef.current) return; // paused: the notice is dropped, the listener stays
			if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
			autoTimerRef.current = setTimeout(rerunAuto, AUTO_REFRESH_DEBOUNCE_MS);
		});
		return () => {
			unsubscribe();
			if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
		};
	}, [autoRefresh, parsed, rerunAuto]);

	// The graph view's drawable form of the raw rows (cypher only). Null for every text view and
	// for engines without graph support, so the extraction never runs for a table render.
	const resultGraph = useMemo(
		() => (view === "graph" && engine.graph && state.status === "ready" ? engine.graph.fromResult(state.result) : null),
		[view, engine, state],
	);

	// The row number shown in the 序号 column: a local 1-based index in preview mode, the global
	// position across pages in pagination mode (so page 2 starts where page 1 ended).
	const rowBase =
		state.status === "ready" && state.result.page && state.result.pageSize
			? (state.result.page - 1) * state.result.pageSize
			: 0;

	// The page the pager is currently on, falling back to 1 in preview mode.
	const currentPage = state.status === "ready" ? (state.result.page ?? 1) : 1;

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
			const payload = await engine.exportCsv({ source: parsed.block.source, sql: effectiveSql });
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
	}, [parsed, engine, effectiveSql]);

	// Inline editing (BACK-833). Only a block that knows its file can be edited: everything else
	// keeps the read-only body it always had.
	const canEdit = Boolean(filePath) && engine.actions.showHide;
	// The format button is SQL-only: there is no shared Cypher formatter, and its grammar differs.
	const canFormat = engine.highlightLanguage === "sql";
	// `sql-formatter` has no DuckDB dialect, but its Postgres dialect covers DuckDB's SQL well enough;
	// SQLite and MDB fall back to the standard SQL dialect.
	const formatDialect = engine.id === "duckdb" ? "postgresql" : engine.id === "sqlite" ? "sqlite" : "sql";
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState("");
	const [saveState, setSaveState] = useState<
		{ status: "idle" } | { status: "saving" } | { status: "saved" } | { status: "failed"; message: string }
	>({ status: "idle" });
	const [testState, setTestState] = useState<
		{ status: "idle" } | { status: "running" } | { status: "failed"; message: string }
	>({ status: "idle" });
	const [formatState, setFormatState] = useState<{ status: "idle" } | { status: "failed"; message: string }>({
		status: "idle",
	});

	const startEditing = useCallback(() => {
		if (!parsed.ok) return;
		setDraft(parsed.block.sql);
		setSaveState({ status: "idle" });
		setTestState({ status: "idle" });
		setEditing(true);
	}, [parsed]);

	const discardEdit = useCallback(() => {
		setEditing(false);
		setDraft("");
		setTestState({ status: "idle" });
		setDisplayedSql(null);
		// A tested draft has already replaced the grid, so re-run the statement the file still holds.
		setNonce((value) => value + 1);
	}, []);

	/**
	 * Test runs the edited statement without touching the file. `copy_to` is deliberately not sent:
	 * it is a write target, and a test must not write.
	 */
	const testDraft = useCallback(async () => {
		if (!parsed.ok) return;
		setTestState({ status: "running" });
		try {
			const result = await engine.run({
				source: parsed.block.source,
				sql: draft,
				view: engine.graph ? parsed.block.view : undefined,
				page: pagination ? page : undefined,
				pageSize: pagination ? pageSize : undefined,
			});
			setTestState({ status: "idle" });
			// The tested draft is now what the grid reflects: keep it so pagination / refresh stay on
			// the draft instead of re-running the (stale) committed statement.
			setDisplayedSql(draft);
			setState({ status: "ready", result });
			clampPageToTotalPages(setPage, page, result.totalPages);
		} catch (error: unknown) {
			setTestState({ status: "failed", message: error instanceof Error ? error.message : String(error) });
		}
	}, [parsed, draft, engine, pagination, page, pageSize]);

	const saveDraft = useCallback(async () => {
		if (!parsed.ok || !filePath) return;
		setSaveState({ status: "saving" });
		try {
			const saved = await apiClient.saveQueryBlock({ filePath, block: activeBlock, statement: draft });
			// The rewritten body is what the file holds now; adopting it re-parses and re-runs, so
			// the grid refreshes from the statement that was just written.
			setBlockOverride(saved.block);
			// The draft is now the committed statement, so drop the tested-draft marker.
			setDisplayedSql(null);
			setEditing(false);
			setDraft("");
			setTestState({ status: "idle" });
			setSaveState({ status: "saved" });
		} catch (error: unknown) {
			setSaveState({ status: "failed", message: error instanceof Error ? error.message : String(error) });
		}
	}, [parsed, filePath, activeBlock, draft]);

	/**
	 * Format reindents the edited statement in place using `sql-formatter`. It never writes the file -
	 * like Test it is a preview aid - and a statement that does not parse is left untouched with a
	 * transient error note.
	 */
	const formatDraft = useCallback(() => {
		if (!parsed.ok || !canFormat) return;
		try {
			setDraft(formatSql(draft, { language: formatDialect, keywordCase: "upper" }));
			setFormatState({ status: "idle" });
		} catch (error: unknown) {
			setFormatState({ status: "failed", message: error instanceof Error ? error.message : String(error) });
		}
	}, [parsed, draft, canFormat, formatDialect]);

	useEffect(() => {
		if (saveState.status !== "saved") return;
		const timer = setTimeout(() => setSaveState({ status: "idle" }), CONFIRMATION_MS);
		return () => clearTimeout(timer);
	}, [saveState]);

	// The grid as a table: the default body, and the graph view's fallback past its node cap.
	const renderTable = (): ReactNode => {
		if (state.status !== "ready") return null;
		return (
			<div className="overflow-x-auto">
				<table className="w-full text-left border-collapse">
					<thead>
						<tr>
							<th className="px-2 py-1 border-b border-gray-200 dark:border-gray-700 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap w-10 text-right">
								#
							</th>
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
							<tr
								// biome-ignore lint/suspicious/noArrayIndexKey: a result row has no identity of its own
								key={`row-${rowIndex}`}
								className={
									rowIndex === state.result.rows.length - 1 ? "" : "border-b border-gray-100 dark:border-gray-800"
								}
							>
								<td className="px-2 py-1 align-top text-right text-gray-400 dark:text-gray-500 tabular-nums">
									{rowBase + rowIndex + 1}
								</td>
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
	};

	let body: ReactNode;
	if (!parsed.ok) {
		body = <p className="text-red-600 dark:text-red-400">{parsed.error}</p>;
	} else if (state.status === "loading") {
		body = <p className="text-gray-500 dark:text-gray-400">{dict.loading}</p>;
	} else if (state.status === "error") {
		body = (
			<p className="text-red-600 dark:text-red-400">
				{dict.error}：{state.message}
			</p>
		);
	} else if (state.result.rows.length === 0) {
		body = <p className="text-gray-500 dark:text-gray-400">{dict.empty}</p>;
	} else if (view === "graph" && resultGraph && engine.graph) {
		// Past the node cap the force layout stops being an interaction, so the block draws the
		// coerced table it already has and says why - the graph pane itself never sees the result.
		body =
			resultGraph.nodes.length > engine.graph.nodeLimit ? (
				<>
					{renderTable()}
					<p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
						{fill(dict.graphTooLarge ?? "", { count: resultGraph.nodes.length, limit: engine.graph.nodeLimit })}
					</p>
				</>
			) : (
				<div className="h-96">
					{engine.graph.render(resultGraph, { source: parsed.block.source, cameraToken: `run:${nonce}` })}
				</div>
			);
	} else if (view === "value") {
		body = <span>{renderCell(state.result.rows[0]?.[0] ?? null)}</span>;
	} else if (view === "list") {
		// Each row is a flex row: a dedicated 序号 (row-number) gutter column on the left, then the
		// field list. Keeping 序号 as its own leading column (rather than the old "1. id" prefix that
		// merged it into the first field's label) lets it read as a column and stay aligned per row.
		body = (
			<div className="space-y-3">
				{state.result.rows.map((row, rowIndex) => (
					// A result row has no key of its own; the index is the identity.
					<div
						// biome-ignore lint/suspicious/noArrayIndexKey: a result row has no identity of its own
						key={`row-${rowIndex}`}
						className="flex gap-3 items-start"
					>
						{/* 序号: its own column, leading the data fields. */}
						<div className="shrink-0 w-10 pr-2 text-right tabular-nums text-gray-400 dark:text-gray-500 select-none border-r border-gray-200 dark:border-gray-700">
							{rowBase + rowIndex + 1}
						</div>
						<dl className="grid grid-cols-[minmax(6rem,max-content)_1fr] gap-x-3 gap-y-1 flex-1 min-w-0">
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
									<dd className="break-words" style={{ margin: 0, padding: 0 }}>
										{renderCell(row[columnIndex] ?? null)}
									</dd>
								</Fragment>
							))}
						</dl>
					</div>
				))}
			</div>
		);
	} else if (view === "echarts") {
		// Tight coupling (doc-30 §8.3.B): the block is its own chart, no separate visible data source
		// needed. Builds the option from `chart` and reuses the echarts engine's load/render/dispose.
		body = parsed.block.chart ? (
			<EchartsFromResult result={state.result} chart={parsed.block.chart} />
		) : (
			<p className="text-red-600 dark:text-red-400">view: echarts 需要 chart 字段（JSON 形式的图表配置）。</p>
		);
	} else {
		body = renderTable();
	}

	return (
		<div className="my-3 rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden text-sm">
			<div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-300">
				<span className="truncate">
					{dict.title}
					{parsed.ok ? <span className="ml-1 font-mono">{parsed.block.source}</span> : null}
				</span>
				<span className="flex items-center gap-2 shrink-0">
					{state.status === "ready" ? (
						<span>{fill(dict.summary, { count: state.result.rows.length, ms: state.result.elapsedMs })}</span>
					) : null}
					{engine.actions.showHide ? (
						<button
							type="button"
							onClick={() => setQueryOpen((open) => !open)}
							aria-expanded={queryOpen}
							aria-controls={panelId}
							className="px-2 py-0.5 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
						>
							{queryOpen ? dict.hideQuery : dict.showQuery}
						</button>
					) : null}
					{engine.actions.copy && copyMarkdown ? (
						<button
							type="button"
							onClick={copy}
							className="px-2 py-0.5 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
						>
							{copyState === "copied" ? dict.copied : copyState === "failed" ? dict.copyFailed : dict.copyMarkdown}
						</button>
					) : null}
					{engine.actions.export && (canExport || exportState.status === "saving") ? (
						<button
							type="button"
							onClick={exportCsv}
							disabled={!canExport}
							className="px-2 py-0.5 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
						>
							{exportState.status === "saving" ? dict.exporting : dict.exportCsv}
						</button>
					) : null}
					{autoRefresh ? (
						<>
							<span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 select-none">
								<span
									className={`inline-block w-1.5 h-1.5 rounded-full bg-current ${livePaused ? "opacity-40" : ""}`}
									aria-hidden="true"
								/>
								{dict.live}
							</span>
							<button
								type="button"
								onClick={toggleLivePaused}
								className="px-2 py-0.5 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
							>
								{livePaused ? dict.resumeAuto : dict.pauseAuto}
							</button>
						</>
					) : null}
					<button
						type="button"
						onClick={refresh}
						disabled={!parsed.ok || state.status === "loading"}
						className="px-2 py-0.5 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
					>
						{dict.refresh}
					</button>
					{allowPagination ? (
						<label
							htmlFor={paginationToggleId}
							className="flex items-center gap-1.5 cursor-pointer select-none"
							title={dict.paginationToggle}
						>
							<span className="text-xs text-gray-600 dark:text-gray-300">{dict.paginationToggle}</span>
							<Switch
								id={paginationToggleId}
								checked={pagination}
								onChange={togglePagination}
								ariaLabel={dict.paginationToggle}
							/>
						</label>
					) : null}
				</span>
			</div>
			{engine.actions.showHide && queryOpen ? (
				<div
					id={panelId}
					className="px-3 py-2 bg-gray-50/50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-700"
				>
					{parsed.ok ? (
						<>
							<div className="mb-1 flex items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
								<span className="truncate">
									source: <span className="font-mono">{parsed.block.source}</span>
								</span>
								{canEdit && !editing ? (
									<button
										type="button"
										onClick={startEditing}
										className="shrink-0 px-2 py-0.5 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
									>
										{dict.edit}
									</button>
								) : null}
							</div>
							{editing ? (
								<>
									<HighlightedSqlEditor
										value={draft}
										onChange={setDraft}
										language={engine.highlightLanguage ?? "sql"}
									/>
									<div className="mt-2 flex items-center gap-2">
										{canFormat ? (
											<button
												type="button"
												onClick={formatDraft}
												className="px-2 py-0.5 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
											>
												{dict.format}
											</button>
										) : null}
										<button
											type="button"
											onClick={saveDraft}
											disabled={saveState.status === "saving"}
											className="px-2 py-0.5 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
										>
											{saveState.status === "saving" ? dict.saving : dict.save}
										</button>
										<button
											type="button"
											onClick={testDraft}
											disabled={testState.status === "running"}
											className="px-2 py-0.5 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
										>
											{testState.status === "running" ? dict.testing : dict.test}
										</button>
										<button
											type="button"
											onClick={discardEdit}
											className="px-2 py-0.5 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
										>
											{dict.discard}
										</button>
									</div>
									{saveState.status === "saved" ? (
										<p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">{dict.saved}</p>
									) : null}
									{saveState.status === "failed" ? (
										<p className="mt-1 text-xs text-red-600 dark:text-red-400">
											{dict.saveFailed}：{saveState.message}
										</p>
									) : null}
									{testState.status === "failed" ? (
										<p className="mt-1 text-xs text-red-600 dark:text-red-400">
											{dict.testFailed}：{testState.message}
										</p>
									) : null}
									{formatState.status === "failed" ? (
										<p className="mt-1 text-xs text-red-600 dark:text-red-400">
											{dict.formatFailed}：{formatState.message}
										</p>
									) : null}
								</>
							) : (
								<pre className="font-mono text-xs overflow-x-auto" style={PRE_RESET}>
									<code className={`language-${engine.highlightLanguage ?? "sql"}`}>{highlightedQuery}</code>
								</pre>
							)}
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
				{state.status === "ready" && pagination ? (
					<div className="mt-1 flex items-center gap-2 text-xs leading-none text-gray-600 dark:text-gray-300">
						<button
							type="button"
							onClick={goPrev}
							disabled={currentPage <= 1}
							aria-label={dict.prevPage}
							className={`text-xs transition-colors ${
								currentPage <= 1
									? "opacity-0 cursor-default"
									: "cursor-pointer text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
							}`}
						>
							{"←"}
						</button>
						<span className="tabular-nums">
							{fill(dict.pageXofY, { page: currentPage, total: state.result.totalPages ?? 1 })}
						</span>
						<button
							type="button"
							onClick={goNext}
							disabled={currentPage >= (state.result.totalPages ?? 1)}
							aria-label={dict.nextPage}
							className={`text-xs transition-colors ${
								currentPage >= (state.result.totalPages ?? 1)
									? "opacity-0 cursor-default"
									: "cursor-pointer text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
							}`}
						>
							{"→"}
						</button>
					</div>
				) : null}
				{state.status === "ready" && state.result.truncated ? (
					<p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
						{fill(dict.truncated, { count: state.result.rows.length, total: state.result.totalRows })}
					</p>
				) : null}
				{exportState.status === "saved" ? (
					<p className="mt-2 text-xs break-all">
						<span className="text-gray-500 dark:text-gray-400">{fill(dict.exported, { name: exportState.name })}</span>
						{exportState.truncated ? (
							<span className="ml-1 text-gray-500 dark:text-gray-400">
								{fill(dict.truncated, { count: state.status === "ready" ? state.result.rows.length : 0 })}
							</span>
						) : null}
					</p>
				) : null}
				{exportState.status === "failed" ? (
					<p className="mt-2 text-xs text-red-600 dark:text-red-400">
						{dict.exportFailed}：{exportState.message}
					</p>
				) : null}
				{state.status === "ready" && state.result.writtenTo ? (
					<p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
						{fill(dict.writtenTo, { path: state.result.writtenTo })}
					</p>
				) : null}
			</div>
		</div>
	);
}
