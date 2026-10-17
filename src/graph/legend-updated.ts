/**
 * The `graph-legend-updated` broadcast's wire shape (BACK-806 / M-16).
 *
 * Mirrors `graph/updated.ts`: the message used to be a bare string, but legend edits target a
 * specific database, and other open tabs must know *which* database changed to avoid reloading the
 * wrong config. The server stringifies `{ type, database }`; the web shell parses it and
 * re-dispatches it as a window event, because the only legend consumer (CypherResultGraph) sits
 * deep inside a rendered document and cannot receive the shell's props.
 */

/** The WebSocket message `type` the server sends when a legend config changed. */
export const GRAPH_LEGEND_UPDATED_MESSAGE_TYPE = "graph-legend-updated";

/** The window event the web shell re-dispatches for in-document consumers (CypherResultGraph). */
export const GRAPH_LEGEND_UPDATED_EVENT = "backlog-graph-legend-updated";

export interface GraphLegendUpdatedDetail {
	/** The changed database's registry name ("default" is the markdown-derived corpus graph). */
	database: string;
}

export function encodeGraphLegendUpdatedMessage(database: string): string {
	return JSON.stringify({ type: GRAPH_LEGEND_UPDATED_MESSAGE_TYPE, database });
}

/** Parse a raw WebSocket frame; returns null for every other message (loading states, plain strings). */
export function parseGraphLegendUpdatedMessage(data: unknown): GraphLegendUpdatedDetail | null {
	if (typeof data !== "string") return null;
	try {
		const value = JSON.parse(data) as { type?: unknown; database?: unknown } | null;
		if (value?.type === GRAPH_LEGEND_UPDATED_MESSAGE_TYPE && typeof value.database === "string") {
			return { database: value.database };
		}
	} catch {
		// Not JSON: the legacy bare-string broadcasts and the other plain-string messages land here.
	}
	return null;
}
