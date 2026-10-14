/**
 * Graph database browser: every database in the project, and a read-only Cypher box scoped to one.
 *
 * The result table is deliberately generic - it renders whatever columns ryu returned - because a
 * user database has whatever schema the user gave it. The corpus graph page (`GraphView`) can assume
 * `FileNode`; this one cannot. The same result is also drawn as a graph (`CypherResultGraph`), with
 * the corpus graph's interactions minus its in-view Cypher search.
 */
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../hooks/useI18n";
import { apiClient, type CypherResult, type GraphDatabaseSummary } from "../lib/api";
import { cellDisplayText, graphFromCypherResult } from "../utils/cypher-graph";
import CypherResultGraph from "./CypherResultGraph";
import LoadingSpinner from "./LoadingSpinner";

const DEFAULT_STATEMENT = "MATCH (n) RETURN n LIMIT 25";

/**
 * "Everything in here": every node, each with whatever relationship touches it. `OPTIONAL MATCH`
 * is what makes it all of them - a plain `MATCH (n)-[r]-()` would quietly drop the nodes that
 * happen to have no relationship, which in a freshly imported database is most of them.
 */
const VIEW_ALL_STATEMENT = `MATCH (n)
OPTIONAL MATCH (n)-[r]-()
RETURN n,r`;

/** How the result reads: the table, the graph, or both at once. */
type ViewMode = "table" | "graph" | "split";

const VIEW_MODES: ViewMode[] = ["table", "graph", "split"];

/** The locale key of each mode's button label. */
const VIEW_LABELS: Record<ViewMode, "viewTable" | "viewGraph" | "viewSplit"> = {
	table: "viewTable",
	graph: "viewGraph",
	split: "viewSplit",
};

/**
 * The schema procedures ryu answers, offered as one-click statements.
 *
 * `show_tables()` lists the tables; `table_info` describes one. `FileNode` is the label the corpus
 * graph uses (not `File`), so it doubles as a worked example. `show_connection('Rel')` is the third
 * step for a relationship table, but its result is the endpoints, not columns - the CLI's
 * `backlog graph schema` prints all three together.
 */
const SCHEMA_HINTS = [
	"CALL show_tables() RETURN name, type",
	"CALL table_info('FileNode') RETURN name, type, `primary key`",
] as const;

interface GraphDatabasesProps {
	/**
	 * Bumped by the shell on every `graph-updated` / `graph-ready` broadcast. The corpus database is
	 * held by the graph service in the server process and changes without a page reload, so the row
	 * counts only stay honest if the list is refetched when the graph says it changed.
	 */
	graphVersion?: number;
}

const GraphDatabases: React.FC<GraphDatabasesProps> = ({ graphVersion = 0 }) => {
	const { t } = useI18n();
	const [databases, setDatabases] = useState<GraphDatabaseSummary[] | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [selected, setSelected] = useState<string | null>(null);
	const [statement, setStatement] = useState(DEFAULT_STATEMENT);
	const [result, setResult] = useState<CypherResult | null>(null);
	const [queryError, setQueryError] = useState<string | null>(null);
	const [running, setRunning] = useState(false);
	// How the result reads. A re-run keeps the mode: switching the view is a separate decision
	// from running the statement.
	const [viewMode, setViewMode] = useState<ViewMode>("table");
	// One per successful run: the graph engine fits a token's first build and restores the camera
	// a returning token was left with, so re-running a statement comes back to where it was read.
	const [runId, setRunId] = useState(0);
	// The interactive row cap is a rendering budget, not a limit on the data: a reader who asks
	// for the whole result gets it, and pays for it in a longer, heavier table.
	const [unlimited, setUnlimited] = useState(false);
	// The same result read as a graph: nodes deduplicated, relationships joined to their endpoints,
	// paths expanded. Recomputed per result; the view mode only decides whether it is drawn.
	const resultGraph = useMemo(
		() => (result ? graphFromCypherResult(result) : { nodes: [], edges: [], danglingEdges: 0, fields: [] }),
		[result],
	);
	// Set once a list has arrived. A refresh failure must not blank a populated page, so the error
	// branch only applies to the first load.
	const loadedRef = useRef(false);

	// graphVersion is a refresh trigger, not a value the fetch reads - which is why biome cannot see
	// it as a dependency, and why dropping it would leave the counts silently stale.
	// biome-ignore lint/correctness/useExhaustiveDependencies: graphVersion is a refresh trigger
	useEffect(() => {
		let cancelled = false;
		apiClient
			.listGraphDatabases()
			.then((list) => {
				if (cancelled) return;
				loadedRef.current = true;
				setDatabases(list);
				// Land on a user database once and keep it: `default` is the corpus graph, which has
				// its own page (GraphView), and a refresh must never move the selection out from
				// under the statement the user is editing.
				setSelected((current) => current ?? list.find((db) => db.kind === "user")?.name ?? list[0]?.name ?? null);
			})
			.catch((error: unknown) => {
				// A failed refresh leaves the table up: the counts are stale, not wrong, and blanking
				// the page would throw away the selected database and its result over one blip.
				if (cancelled || loadedRef.current) return;
				setLoadError(error instanceof Error ? error.message : t.databases.error);
			});
		return () => {
			cancelled = true;
		};
	}, [t, graphVersion]);

	/**
	 * Run the box's statement - or an explicit database/statement pair, which is how a row's
	 * action menu works. The menu cannot simply set the state and click Run: `setSelected` and
	 * `setStatement` only land on the next render, so a run queued behind them would read the
	 * previous selection.
	 */
	const run = useCallback(
		async (override?: { db?: string; statement?: string }) => {
			const target = override?.db ?? selected;
			const text = override?.statement ?? statement;
			if (!target || !text.trim()) return;
			setRunning(true);
			setQueryError(null);
			try {
				const next = await apiClient.runDatabaseCypher(target, text, unlimited ? null : undefined);
				setResult(next);
				setRunId((id) => id + 1);
			} catch (error: unknown) {
				setResult(null);
				setQueryError(error instanceof Error ? error.message : t.databases.error);
			} finally {
				setRunning(false);
			}
		},
		[selected, statement, unlimited, t],
	);

	if (loadError) {
		return (
			<div className="p-8">
				<div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
					<p className="text-red-700 dark:text-red-300">{loadError}</p>
				</div>
			</div>
		);
	}

	if (!databases) {
		return (
			<div className="flex flex-col justify-center items-center h-64 space-y-4">
				<LoadingSpinner size="lg" text="" />
				<p className="text-sm text-gray-600 dark:text-gray-400">{t.databases.loading}</p>
			</div>
		);
	}

	const active = databases.find((db) => db.name === selected) ?? null;

	return (
		<div className="p-6 space-y-6">
			<div>
				<h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t.databases.title}</h1>
				<p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t.databases.subtitle}</p>
			</div>

			<div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
				<table className="min-w-full text-sm">
					<thead className="bg-gray-50 dark:bg-gray-900/40">
						<tr>
							<th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-200">
								{t.databases.columnName}
							</th>
							<th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-200">
								{t.databases.columnKind}
							</th>
							<th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-200">
								{t.databases.columnDescription}
							</th>
							<th className="px-4 py-2 text-right font-medium text-gray-700 dark:text-gray-200">
								{t.databases.columnNodes}
							</th>
							<th className="px-4 py-2 text-right font-medium text-gray-700 dark:text-gray-200">
								{t.databases.columnEdges}
							</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-gray-200 dark:divide-gray-700">
						{databases.map((db) => (
							<tr
								key={db.name}
								onClick={() => {
									setSelected(db.name);
									setResult(null);
									setQueryError(null);
								}}
								className={`cursor-pointer ${
									db.name === selected ? "bg-blue-50 dark:bg-blue-600/20" : "hover:bg-gray-50 dark:hover:bg-gray-700/40"
								}`}
							>
								<td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">{db.name}</td>
								<td className="px-4 py-2 text-gray-600 dark:text-gray-300">
									{db.kind === "user" ? t.databases.kindUser : t.databases.kindDerived}
								</td>
								<td className="px-4 py-2 text-gray-600 dark:text-gray-300">{db.description}</td>
								<td className="px-4 py-2 text-right text-gray-700 dark:text-gray-200">
									{db.nodes === null ? t.databases.countsUnavailable : db.nodes}
								</td>
								<td className="px-4 py-2 text-right text-gray-700 dark:text-gray-200">
									{db.edges === null ? t.databases.countsUnavailable : db.edges}
								</td>
							</tr>
						))}
					</tbody>
				</table>
				{databases.length === 0 && (
					<p className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{t.databases.empty}</p>
				)}
			</div>

			<div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 space-y-3">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<label htmlFor="database-cypher" className="text-sm font-medium text-gray-900 dark:text-gray-100">
						{t.databases.cypherLabel}
						{active ? ` · ${active.name}` : ""}
					</label>
					<div className="flex items-center gap-3">
						<label
							htmlFor="database-cypher-all-rows"
							className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300"
						>
							<input
								id="database-cypher-all-rows"
								type="checkbox"
								checked={unlimited}
								onChange={(event) => setUnlimited(event.target.checked)}
								className="h-3.5 w-3.5 rounded border-gray-300 dark:border-gray-600"
							/>
							{t.databases.allRows}
						</label>
						<button
							type="button"
							onClick={() => void run()}
							disabled={running || !active || !statement.trim()}
							className="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{running ? t.databases.running : t.databases.run}
						</button>
					</div>
				</div>
				<textarea
					id="database-cypher"
					value={statement}
					onChange={(event) => setStatement(event.target.value)}
					rows={3}
					spellCheck={false}
					placeholder={t.databases.cypherPlaceholder}
					className="w-full px-3 py-2 font-mono text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>
				<p className="text-xs text-gray-500 dark:text-gray-400">{t.databases.readOnlyNotice}</p>
				{active?.kind === "derived" && (
					<p className="text-xs text-gray-500 dark:text-gray-400">{t.databases.defaultNote}</p>
				)}
				<div className="space-y-1.5">
					<p className="text-xs text-gray-500 dark:text-gray-400">{t.databases.schemaHint}</p>
					<div className="flex flex-wrap gap-2">
						{SCHEMA_HINTS.map((hint) => (
							<button
								key={hint}
								type="button"
								onClick={() => setStatement(hint)}
								className="px-2 py-0.5 font-mono text-xs rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/40"
							>
								{hint}
							</button>
						))}
						<button
							key="view-all"
							type="button"
							title={VIEW_ALL_STATEMENT.replace(/\n/g, " ")}
							onClick={() => {
								// Same beat as clicking Run: fill the box so the reader can see and
								// edit what ran, then run it - against the selected database, which
								// is the one whose row this sits beside.
								setStatement(VIEW_ALL_STATEMENT);
								void run({ statement: VIEW_ALL_STATEMENT });
							}}
							className="rounded-md border border-blue-300 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
						>
							{t.databases.actionViewAll}
						</button>
					</div>
				</div>
			</div>

			{queryError && (
				<div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
					<p className="text-sm text-red-700 dark:text-red-300">{queryError}</p>
				</div>
			)}

			{result && (
				<div className="space-y-3">
					<div className="flex flex-wrap items-center gap-3">
						<span className="text-xs font-medium text-gray-500 dark:text-gray-400">{t.databases.viewLabel}</span>
						<fieldset
							className="inline-flex min-w-0 overflow-hidden rounded-md border border-gray-300 p-0 dark:border-gray-600"
							aria-label={t.databases.viewLabel}
						>
							{VIEW_MODES.map((mode) => (
								<button
									key={mode}
									type="button"
									aria-pressed={viewMode === mode}
									onClick={() => setViewMode(mode)}
									className={`px-3 py-1 text-xs font-medium transition-colors ${
										viewMode === mode
											? "bg-blue-600 text-white"
											: "bg-white text-gray-700 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
									}`}
								>
									{t.databases[VIEW_LABELS[mode]]}
								</button>
							))}
						</fieldset>
					</div>

					{viewMode !== "graph" && (
						<div
							className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-auto ${
								viewMode === "split" ? "max-h-[42vh]" : ""
							}`}
						>
							{result.columns.length === 0 || result.rows.length === 0 ? (
								<p className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{t.databases.noResults}</p>
							) : (
								<table className="min-w-full text-sm">
									<thead className="bg-gray-50 dark:bg-gray-900/40">
										<tr>
											{result.columns.map((column) => (
												<th
													key={column}
													className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap"
												>
													{column}
												</th>
											))}
										</tr>
									</thead>
									<tbody className="divide-y divide-gray-200 dark:divide-gray-700">
										{result.rows.map((row, rowIndex) => (
											// A Cypher row is positional: it has no key of its own.
											// biome-ignore lint/suspicious/noArrayIndexKey: rows are a positional result set
											<tr key={rowIndex}>
												{result.columns.map((column, columnIndex) => (
													<td key={column} className="px-4 py-2 text-gray-700 dark:text-gray-200 whitespace-nowrap">
														{cellDisplayText(row[columnIndex])}
													</td>
												))}
											</tr>
										))}
									</tbody>
								</table>
							)}
							{result.rows.length > 0 && (
								<p className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">
									{t.databases.rowCount.replace("{1}", String(result.rows.length))}
									{result.truncated ? ` · ${t.databases.truncated}` : ""}
								</p>
							)}
						</div>
					)}

					{viewMode !== "table" && (
						<div className={viewMode === "graph" ? "h-[78vh]" : "h-[48vh]"}>
							<CypherResultGraph graph={resultGraph} database={selected ?? "default"} cameraToken={`run:${runId}`} />
						</div>
					)}
				</div>
			)}
		</div>
	);
};

export default GraphDatabases;
