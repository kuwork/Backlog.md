import { useSyncExternalStore } from "react";

/**
 * Which backend renders ` ```mermaid ` blocks. `pele` is the lightweight,
 * themeable default; `mermaid` is the classic Mermaid engine (opt-in via
 * Settings). The value is reactive so flipping it in Settings re-renders every
 * mounted diagram without a reload.
 */
export type DiagramEngineId = "pele" | "mermaid";

/** Coerce any stored value to a valid engine id; defaults to `pele`. */
export function normalizeDiagramEngine(value: unknown): DiagramEngineId {
	return value === "mermaid" ? "mermaid" : "pele";
}

let activeEngine: DiagramEngineId = "pele";
const listeners = new Set<() => void>();

export function getActiveDiagramEngine(): DiagramEngineId {
	return activeEngine;
}

export function setActiveDiagramEngine(id: DiagramEngineId): void {
	if (activeEngine === id) return;
	activeEngine = id;
	for (const listener of listeners) {
		listener();
	}
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

/**
 * Subscribe a component to the active diagram engine. Used by `ChartBlock` so a
 * Settings change immediately re-renders diagrams with the new backend.
 */
export function useDiagramEngine(): DiagramEngineId {
	return useSyncExternalStore(subscribe, getActiveDiagramEngine, getActiveDiagramEngine);
}
