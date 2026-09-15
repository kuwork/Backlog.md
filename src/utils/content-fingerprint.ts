/**
 * A small, dependency-free fingerprint of a document body.
 *
 * The web viewer cannot tell an external edit from an unrelated refresh: both arrive as a
 * fresh document list over the websocket. Comparing this fingerprint against the body
 * already on screen lets the viewer reload only when the text really changed, and keep the
 * rendered DOM (so the reader's scroll position survives) when it did not.
 *
 * The same function runs in Bun and in the browser, so keep it pure and free of runtime
 * specific APIs. It is a change detector, not a security primitive.
 */
export function contentFingerprint(text: string): string {
	let hash = 0x811c9dc5;
	for (let index = 0; index < text.length; index += 1) {
		hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193);
	}
	// The length guards against the (astronomically unlikely) 32-bit collision.
	return `${text.length.toString(36)}-${(hash >>> 0).toString(36)}`;
}
