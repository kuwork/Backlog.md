/**
 * The `graph-updated` broadcast's wire shape (BACK-804).
 *
 * The message used to be the bare string "graph-updated" with no indication of *which* database
 * changed - tolerable when only the corpus graph existed, but `cypher-query` blocks with
 * `refresh: auto` must match the broadcast against their `source`, so the payload now carries the
 * changed database's registry name. The server stringifies it; the web shell parses it and
 * re-dispatches it as a window event, because a query block sits deep inside a rendered markdown
 * document and cannot receive the shell's props.
 */

/** The WebSocket message `type` the server sends when a graph database changed. */
export const GRAPH_UPDATED_MESSAGE_TYPE = "graph-updated";

/** The window event the web shell re-dispatches for in-document consumers (query blocks). */
export const GRAPH_UPDATED_EVENT = "backlog-graph-updated";

export interface GraphUpdatedDetail {
	/** The changed database's registry name ("default" is the markdown-derived corpus graph). */
	database: string;
}

export function encodeGraphUpdatedMessage(database: string): string {
	return JSON.stringify({ type: GRAPH_UPDATED_MESSAGE_TYPE, database });
}

/** Parse a raw WebSocket frame; returns null for every other message (loading states, plain strings). */
export function parseGraphUpdatedMessage(data: unknown): GraphUpdatedDetail | null {
	if (typeof data !== "string") return null;
	try {
		const value = JSON.parse(data) as { type?: unknown; database?: unknown } | null;
		if (value?.type === GRAPH_UPDATED_MESSAGE_TYPE && typeof value.database === "string") {
			return { database: value.database };
		}
	} catch {
		// Not JSON: the legacy bare-string broadcast and the other plain-string messages land here.
	}
	return null;
}
