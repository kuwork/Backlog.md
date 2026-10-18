import type { SqliteCell, SqliteQueryResult } from "../lib/api";

/** The slice of a query result the chart builder needs: column names + row data. */
export type EchartsQueryResult = Pick<SqliteQueryResult, "columns" | "rows">;

interface SimpleChartConfig {
	type: string;
	categoryField?: string;
	valueField?: string;
	title?: string;
	categoryAxisName?: string;
	valueAxisName?: string;
	name?: string;
}

function columnIndex(columns: string[], name: string | undefined): number {
	if (!name) return -1;
	return columns.indexOf(name);
}

/** Result rows as an array of column-name-keyed objects — the shape `@result` injects. */
function toObjectRows(result: EchartsQueryResult): Record<string, SqliteCell>[] {
	return result.rows.map((row) => {
		const obj: Record<string, SqliteCell> = {};
		result.columns.forEach((column, index) => {
			obj[column] = row[index] ?? null;
		});
		return obj;
	});
}

/** One column's values as a flat array — the shape `@result:<column>` injects. */
function columnValues(result: EchartsQueryResult, name: string): SqliteCell[] {
	const index = columnIndex(result.columns, name);
	if (index < 0) return [];
	return result.rows.map((row) => row[index] ?? null);
}

/**
 * Replace a `@result` / `@result:<col>` string in place. Only a value that is *exactly* the
 * placeholder is substituted (no partial-in-string expansion), which keeps the grammar unambiguous
 * and the XSS surface identical to the inline `echarts` fence (pure `JSON.parse`, no functions).
 */
function resolvePlaceholder(value: string, result: EchartsQueryResult): unknown {
	if (value === "@result") return toObjectRows(result);
	const match = /^@result:(.+)$/.exec(value);
	if (match?.[1]) return columnValues(result, match[1]);
	return value;
}

/** Recursively walk the option tree, substituting string placeholders with real result data. */
function substitute(node: unknown, result: EchartsQueryResult): unknown {
	if (typeof node === "string") return resolvePlaceholder(node, result);
	if (Array.isArray(node)) return node.map((child) => substitute(child, result));
	if (node !== null && typeof node === "object") {
		const out: Record<string, unknown> = {};
		for (const [key, child] of Object.entries(node)) out[key] = substitute(child, result);
		return out;
	}
	return node;
}

/**
 * Build an ECharts `option` object from a `view: echarts` block's `chart` JSON and the query result.
 *
 * Two forms:
 * - Advanced: the JSON has an `option` key — a standard ECharts option tree whose string values may
 *   use `@result` / `@result:<column>` placeholders; substituted before return.
 * - Simple: a mapping form (`type` + `categoryField` + `valueField` + optional `title`/`name`/axis
 *   names) that auto-builds the series for the common bar/line/pie/scatter cases.
 *
 * Throws an `Error` with a Chinese message on invalid JSON or a missing required field, so the
 * renderer can surface it inline instead of crashing.
 */
export function buildEchartsOption(chartJson: string, result: EchartsQueryResult): unknown {
	let config: unknown;
	try {
		config = JSON.parse(chartJson);
	} catch {
		throw new Error("chart 配置不是合法 JSON");
	}
	if (typeof config !== "object" || config === null || Array.isArray(config)) {
		throw new Error("chart 配置必须是对象");
	}
	const cfg = config as Record<string, unknown>;

	if (typeof cfg.option !== "undefined") {
		return substitute(cfg.option, result);
	}

	const simple = cfg as Partial<SimpleChartConfig>;
	if (typeof simple.type !== "string" || simple.type.length === 0) {
		throw new Error("简单形式需要 type 字段（如 bar / line / pie）");
	}
	const catIdx = columnIndex(result.columns, simple.categoryField);
	const valIdx = columnIndex(result.columns, simple.valueField);
	const title = typeof simple.title === "string" ? { text: simple.title } : undefined;
	const name = typeof simple.name === "string" ? simple.name : undefined;

	if (simple.type === "pie") {
		if (catIdx < 0 || valIdx < 0) throw new Error("pie 需要 categoryField 与 valueField");
		return {
			...(title ? { title } : {}),
			tooltip: { trigger: "item" },
			legend: {},
			series: [
				{
					type: "pie",
					radius: "60%",
					data: result.rows.map((row) => ({ name: row[catIdx], value: row[valIdx] })),
				},
			],
		};
	}

	if (simple.type === "scatter" || simple.type === "effectScatter") {
		if (catIdx < 0 || valIdx < 0) throw new Error("scatter 需要 categoryField 与 valueField");
		return {
			...(title ? { title } : {}),
			tooltip: { trigger: "item" },
			xAxis: { type: "value", name: simple.categoryAxisName },
			yAxis: { type: "value", name: simple.valueAxisName },
			series: [
				{
					type: simple.type,
					...(name ? { name } : {}),
					data: result.rows.map((row) => [row[catIdx], row[valIdx]]),
				},
			],
		};
	}

	// Default: category xAxis + value yAxis (covers bar, line, and any cartesian series).
	if (catIdx < 0 || valIdx < 0) throw new Error("需要 categoryField 与 valueField");
	return {
		...(title ? { title } : {}),
		tooltip: { trigger: "axis" },
		...(name ? { legend: { data: [name] } } : {}),
		xAxis: { type: "category", name: simple.categoryAxisName, data: result.rows.map((row) => row[catIdx]) },
		yAxis: { type: "value", name: simple.valueAxisName },
		series: [
			{
				type: simple.type,
				...(name ? { name } : {}),
				data: result.rows.map((row) => row[valIdx]),
			},
		],
	};
}
