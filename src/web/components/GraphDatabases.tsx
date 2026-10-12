/**
 * Graph database browser: every database in the project, and a read-only Cypher box scoped to one.
 *
 * The result table is deliberately generic - it renders whatever columns ryu returned - because a
 * user database has whatever schema the user gave it. The corpus graph page (`GraphView`) can assume
 * `FileNode`; this one cannot.
 */
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { useI18n } from "../hooks/useI18n";
import { apiClient, type CypherResult, type GraphDatabaseSummary } from "../lib/api";
import LoadingSpinner from "./LoadingSpinner";

const DEFAULT_STATEMENT = "MATCH (n) RETURN n LIMIT 25";

/** Render one result cell: text as-is, anything structured as compact JSON. */
function cellText(value: unknown): string {
	if (value === null || value === undefined) return "";
	if (typeof value === "object") return JSON.stringify(value);
	return String(value);
}

const GraphDatabases: React.FC = () => {
	const { t } = useI18n();
	const [databases, setDatabases] = useState<GraphDatabaseSummary[] | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [selected, setSelected] = useState<string | null>(null);
	const [statement, setStatement] = useState(DEFAULT_STATEMENT);
	const [result, setResult] = useState<CypherResult | null>(null);
	const [queryError, setQueryError] = useState<string | null>(null);
	const [running, setRunning] = useState(false);

	useEffect(() => {
		let cancelled = false;
		apiClient
			.listGraphDatabases()
			.then((list) => {
				if (cancelled) return;
				setDatabases(list);
				// Land on a user database: `default` costs a corpus rebuild, so it should be a choice.
				setSelected((current) => current ?? list.find((db) => db.kind === "user")?.name ?? list[0]?.name ?? null);
			})
			.catch((error: unknown) => {
				if (!cancelled) setLoadError(error instanceof Error ? error.message : t.databases.error);
			});
		return () => {
			cancelled = true;
		};
	}, [t]);

	const run = useCallback(async () => {
		if (!selected || !statement.trim()) return;
		setRunning(true);
		setQueryError(null);
		try {
			setResult(await apiClient.runDatabaseCypher(selected, statement));
		} catch (error: unknown) {
			setResult(null);
			setQueryError(error instanceof Error ? error.message : t.databases.error);
		} finally {
			setRunning(false);
		}
	}, [selected, statement, t]);

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
									{db.nodes === null ? t.databases.derivedCountsUnknown : db.nodes}
								</td>
								<td className="px-4 py-2 text-right text-gray-700 dark:text-gray-200">
									{db.edges === null ? t.databases.derivedCountsUnknown : db.edges}
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
				<div className="flex items-center justify-between gap-4">
					<label htmlFor="database-cypher" className="text-sm font-medium text-gray-900 dark:text-gray-100">
						{t.databases.cypherLabel}
						{active ? ` · ${active.name}` : ""}
					</label>
					<button
						type="button"
						onClick={run}
						disabled={running || !active || !statement.trim()}
						className="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{running ? t.databases.running : t.databases.run}
					</button>
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
			</div>

			{queryError && (
				<div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
					<p className="text-sm text-red-700 dark:text-red-300">{queryError}</p>
				</div>
			)}

			{result && (
				<div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-auto">
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
												{cellText(row[columnIndex])}
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
		</div>
	);
};

export default GraphDatabases;
