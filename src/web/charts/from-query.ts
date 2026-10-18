import type { ChartQueryResult } from "./types";

export type FromQueryResolution = { ok: true; option: unknown } | { ok: false; error: string };

/** The whole result as column-name-keyed objects (ECharts `dataset.source`). */
function objectRows(result: ChartQueryResult): Record<string, unknown>[] {
	return result.rows.map((row) => {
		const obj: Record<string, unknown> = {};
		result.columns.forEach((column, index) => {
			obj[column] = row[index] ?? null;
		});
		return obj;
	});
}

/** One column's values as a flat array. */
function columnValues(result: ChartQueryResult, name: string): unknown[] {
	const index = result.columns.indexOf(name);
	if (index < 0) return [];
	return result.rows.map((row) => row[index] ?? null);
}

/**
 * Resolve `fromQuery` references inside an ECharts option tree against the query-result registry
 * (Approach A, doc-30 §8.3.A). Two shapes are supported, both pure data substitution — nothing is
 * executed:
 *
 * - Dataset: `{ "dataset": { "fromQuery": "q" } }` → `{ "dataset": { "source": objectRows } }`.
 * - Series:  `{ "type": "bar", "fromQuery": "q", "categoryField": "day", "valueField": "cnt" }`
 *   → `{ "type": "bar", "data": values }` (`pie` becomes `{ name, value }` pairs). When the option
 *   has no `xAxis`, a category axis is added from the first resolved series' `categoryField`.
 *
 * A `fromQuery` naming an id absent from the registry fails the whole resolution with a message
 * (never a crash); the caller renders that inline.
 */
export function resolveFromQuery(
	option: unknown,
	resolve: (id: string) => ChartQueryResult | undefined,
): FromQueryResolution {
	let missingId: string | null = null;
	let axisSeed: { result: ChartQueryResult; categoryField: string } | null = null;

	const walk = (value: unknown): unknown => {
		if (Array.isArray(value)) return value.map(walk);
		if (value === null || typeof value !== "object") return value;

		const obj = value as Record<string, unknown>;
		if (typeof obj.fromQuery === "string") {
			const fromQuery = obj.fromQuery;
			const result = resolve(fromQuery);
			if (!result) {
				missingId = fromQuery;
				return obj;
			}

			const rest: Record<string, unknown> = {};
			for (const [key, child] of Object.entries(obj)) {
				if (key === "fromQuery" || key === "categoryField" || key === "valueField") continue;
				rest[key] = child;
			}

			if (typeof obj.categoryField === "string" && typeof obj.valueField === "string") {
				if (!axisSeed) axisSeed = { result, categoryField: obj.categoryField };
				const catIndex = result.columns.indexOf(obj.categoryField);
				const valIndex = result.columns.indexOf(obj.valueField);
				const data =
					obj.type === "pie"
						? result.rows.map((row) => ({ name: row[catIndex] ?? null, value: row[valIndex] ?? null }))
						: result.rows.map((row) => row[valIndex] ?? null);
				return walk({ ...rest, data });
			}

			return walk({ ...rest, source: objectRows(result) });
		}

		const out: Record<string, unknown> = {};
		for (const [key, child] of Object.entries(obj)) out[key] = walk(child);
		return out;
	};

	const resolved = walk(option);
	if (missingId) return { ok: false, error: `未找到查询 id: ${missingId}` };

	// The assignment happens inside the `walk` closure, which control-flow analysis does not track,
	// so `axisSeed` looks `null` here; widen it back to its declared type.
	const seed = axisSeed as { result: ChartQueryResult; categoryField: string } | null;
	if (
		seed &&
		resolved !== null &&
		typeof resolved === "object" &&
		!Array.isArray(resolved) &&
		(resolved as Record<string, unknown>).xAxis === undefined
	) {
		(resolved as Record<string, unknown>).xAxis = {
			type: "category",
			data: columnValues(seed.result, seed.categoryField),
		};
	}

	return { ok: true, option: resolved };
}
