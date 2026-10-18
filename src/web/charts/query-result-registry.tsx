import { createContext, type ReactNode, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ChartQueryResult } from "./types";

export interface QueryResultRegistryApi {
	/** Record (or overwrite) the result published under `id`. */
	set(id: string, result: ChartQueryResult): void;
	/** Read the latest result for `id`, if any. */
	get(id: string): ChartQueryResult | undefined;
	/** Monotonic counter; bumps on every `set` so subscribers re-render. */
	version: number;
}

const QueryResultContext = createContext<QueryResultRegistryApi | null>(null);

/**
 * Shares query-block results with `echarts` blocks in the same document (Approach A, BACK-814).
 * Mount one Provider per rendered markdown body: ids are unique within that body only, so the same
 * `id` in a different document never collides.
 */
export function QueryResultProvider({ children }: { children: ReactNode }) {
	const store = useRef(new Map<string, ChartQueryResult>());
	const [version, setVersion] = useState(0);

	const set = useCallback((id: string, result: ChartQueryResult) => {
		if (store.current.has(id)) {
			console.warn(
				`[echarts fromQuery] duplicate query-block id "${id}" in this document; the later result overwrites`,
			);
		}
		store.current.set(id, result);
		setVersion((value) => value + 1);
	}, []);

	const get = useCallback((id: string) => store.current.get(id), []);

	const api = useMemo(() => ({ set, get, version }), [set, get, version]);
	return <QueryResultContext.Provider value={api}>{children}</QueryResultContext.Provider>;
}

/** The registry API, or null when no Provider is mounted (blocks still render standalone). */
export function useQueryResultRegistry(): QueryResultRegistryApi | null {
	return useContext(QueryResultContext);
}
