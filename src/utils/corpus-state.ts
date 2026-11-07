/**
 * Wire shape and decision rule for the corpus digest carried by WebSocket broadcasts.
 *
 * The digest describes the server's ContentStore snapshot, never a query result and never the
 * client's derived view. Both ends must agree on the message shape, so the formatter and parser
 * live together here.
 */
export const CORPUS_STATE_MESSAGE_TYPE = "corpus-state";
export const CORPUS_DIGEST_HEADER = "X-Corpus-Digest";

export function formatCorpusStateMessage(digest: string): string {
	return JSON.stringify({ type: CORPUS_STATE_MESSAGE_TYPE, digest });
}

export function parseCorpusStateMessage(data: unknown): string | null {
	if (typeof data !== "string") return null;
	try {
		const parsed: unknown = JSON.parse(data);
		if (typeof parsed !== "object" || parsed === null) return null;
		const record = parsed as { type?: unknown; digest?: unknown };
		return record.type === CORPUS_STATE_MESSAGE_TYPE && typeof record.digest === "string" ? record.digest : null;
	} catch {
		return null;
	}
}

/**
 * A refresh may be skipped only when both sides are known and agree. Anything unknown (first
 * load, a reconnect that missed broadcasts, an older server without the header) fails open and
 * still refreshes.
 */
export function shouldSkipCorpusRefresh(serverDigest: string | null, syncedDigest: string | null): boolean {
	return serverDigest !== null && syncedDigest !== null && serverDigest === syncedDigest;
}
