import { describe, expect, it } from "bun:test";
import type { ContentSnapshot } from "../core/content-store.ts";
import { computeCorpusDigest } from "../core/corpus-digest.ts";
import { formatCorpusStateMessage, parseCorpusStateMessage, shouldSkipCorpusRefresh } from "../utils/corpus-state.ts";

const snapshotOf = (tasks: unknown[], completedTasks: unknown[] = []): ContentSnapshot =>
	({
		tasks,
		documents: [],
		decisions: [],
		wikis: [],
		taskCorpus: { activeTasks: [], completedTasks },
	}) as unknown as ContentSnapshot;

const task = (id: string, body: string, extra: Record<string, unknown> = {}) => ({
	id,
	rawContent: body,
	...extra,
});

describe("corpus state wire helpers", () => {
	it("round-trips a digest and ignores anything else on the socket", () => {
		expect(parseCorpusStateMessage(formatCorpusStateMessage("abc123"))).toBe("abc123");
		expect(parseCorpusStateMessage("tasks-updated")).toBeNull();
		expect(parseCorpusStateMessage('{"type":"graph-updated","database":"default"}')).toBeNull();
		expect(parseCorpusStateMessage("not json")).toBeNull();
		expect(parseCorpusStateMessage(null)).toBeNull();
	});
});

describe("corpus digest", () => {
	it("is deterministic and independent of collection order", () => {
		const first = snapshotOf([task("A", "one"), task("B", "two")]);
		const reversed = snapshotOf([task("B", "two"), task("A", "one")]);
		expect(computeCorpusDigest(first)).toBe(computeCorpusDigest(first));
		expect(computeCorpusDigest(first)).toBe(computeCorpusDigest(reversed));
	});

	it("changes with content, including the completed bucket", () => {
		const before = snapshotOf([task("A", "one")], [task("C", "old")]);
		expect(computeCorpusDigest(before)).not.toBe(
			computeCorpusDigest(snapshotOf([task("A", "one changed")], [task("C", "old")])),
		);
		expect(computeCorpusDigest(before)).not.toBe(
			computeCorpusDigest(snapshotOf([task("A", "one")], [task("C", "new")])),
		);
	});

	it("ignores provenance fields so an in-memory upsert and a watcher re-read agree", () => {
		const upsert = snapshotOf([task("A", "same", { source: "local", filePath: "d:/repo/a.md" })]);
		const reread = snapshotOf([task("A", "same", { source: "completed", filePath: "d:/repo/a.md" })]);
		expect(computeCorpusDigest(upsert)).toBe(computeCorpusDigest(reread));
	});

	it("sees frontmatter-only edits whose markdown body is unchanged", () => {
		// Task.rawContent excludes frontmatter; a status/priority/labels edit must still change
		// the digest or the client would skip the refresh and keep showing stale metadata.
		const before = snapshotOf([task("A", "same body", { status: "To Do", priority: "high" })]);
		const after = snapshotOf([task("A", "same body", { status: "Done", priority: "low" })]);
		expect(computeCorpusDigest(before)).not.toBe(computeCorpusDigest(after));
	});
});

describe("refresh gate", () => {
	it("skips only when both digests are known and equal", () => {
		expect(shouldSkipCorpusRefresh("d1", "d1")).toBe(true);
		expect(shouldSkipCorpusRefresh("d2", "d1")).toBe(false);
		expect(shouldSkipCorpusRefresh(null, "d1")).toBe(false);
		expect(shouldSkipCorpusRefresh("d1", null)).toBe(false);
		expect(shouldSkipCorpusRefresh(null, null)).toBe(false);
	});

	it("collapses three echo broadcasts of one write into a single refresh", () => {
		// Mirrors the WebSocket timeline: onSaved fires before any new broadcast, then three
		// tasks-updated messages all carry the same post-write digest.
		let synced = "before";
		let server = "before";
		let refreshes = 0;
		const onRefresh = () => {
			refreshes += 1;
			synced = server;
		};
		const handleBroadcast = (digest: string) => {
			server = digest;
			if (!shouldSkipCorpusRefresh(server, synced)) onRefresh();
		};

		// The write's own onSaved callback is gated too: no new digest has arrived yet.
		if (!shouldSkipCorpusRefresh(server, synced)) onRefresh();
		expect(refreshes).toBe(0);

		for (let echo = 0; echo < 3; echo += 1) handleBroadcast("after");
		expect(refreshes).toBe(1);
		expect(synced).toBe("after");
	});
});
