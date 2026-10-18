import type React from "react";

/** App color mode. Charts render with a matching built-in theme. */
export type ChartColorMode = "light" | "dark";

/** A query result as a chart sees it: column names + scalar rows. */
export interface ChartQueryResult {
	columns: string[];
	rows: (string | number | boolean | null)[][];
}

export interface ChartRenderContext {
	/** Container React owns; the engine draws into it and must clean it up on dispose. */
	container: HTMLElement;
	/** Raw fenced block body, exactly as authored. */
	source: string;
	mode: ChartColorMode;
	/**
	 * Resolves a `fromQuery` reference to the named query-block's result (Approach A, BACK-814).
	 * Absent when no registry is mounted; a `fromQuery` then impossible to satisfy is reported by
	 * the engine as a fallback message, never a crash.
	 */
	resolveQuery?: (id: string) => ChartQueryResult | undefined;
}

export interface ChartRenderer {
	render(ctx: ChartRenderContext): void | Promise<void>;
	/** Tear down listeners / instances tied to the container. */
	dispose?(container: HTMLElement): void;
}

/**
 * A chart backend keyed by the fence language it owns. Adding a new chart type
 * (PlantUML, vega, …) is one `registerChartEngine` call — no render component
 * changes.
 */
export interface ChartEngine {
	id: string;
	/** Fence languages this engine owns, matched case-insensitively. */
	languages: string[];
	/** Class on the render container so SSR / preview markup matches the engine. */
	containerClassName?: string;
	/** Inline style on the render container (e.g. min-height for canvas charts). */
	containerStyle?: React.CSSProperties;
	/** Lazily load the renderer; cache the heavy dependency import inside. */
	load(): Promise<ChartRenderer>;
}
