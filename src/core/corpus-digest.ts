import { createHash } from "node:crypto";
import type { ContentSnapshot } from "./content-store.ts";

/**
 * A content digest of the server corpus, used to tell a genuine data change from the several
 * watcher/in-process echoes of one write. It is deliberately derived from ContentStore's
 * snapshot rather than from a /api/search result set (which varies with query parameters) or
 * from ContentStoreEvent.version (an in-memory event counter that advances on echo, resets on
 * restart and differs across server instances).
 *
 * Records are compared on the whole parsed entity, not just its markdown body: Task.rawContent
 * excludes frontmatter, so status, priority, labels and dates would otherwise be invisible and a
 * metadata-only edit would look like an echo. Volatile provenance keys are dropped so an
 * in-memory upsert and a later watcher re-read of the same file produce the same digest.
 */
const VOLATILE_KEYS = new Set(["source", "filePath", "mtime", "mtimeMs"]);

function stableRecord(value: unknown): string {
	if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
	if (Array.isArray(value)) return `[${value.map(stableRecord).join(",")}]`;
	const record = value as Record<string, unknown>;
	const keys = Object.keys(record)
		.filter((key) => !VOLATILE_KEYS.has(key))
		.sort();
	return `{${keys.map((key) => `${JSON.stringify(key)}:${stableRecord(record[key])}`).join(",")}}`;
}

function collection(label: string, items: readonly unknown[]): string {
	const rows = items.map((item) => {
		const record = (item ?? {}) as Record<string, unknown>;
		const id = typeof record.id === "string" ? record.id : "";
		return `${id}\u0000${stableRecord(item)}`;
	});
	rows.sort();
	return `${label}\u0000${rows.join("\u0000")}`;
}

export function computeCorpusDigest(snapshot: ContentSnapshot): string {
	return createHash("sha256")
		.update(
			[
				collection("tasks", snapshot.tasks),
				collection("completed", snapshot.taskCorpus?.completedTasks ?? []),
				collection("documents", snapshot.documents),
				collection("decisions", snapshot.decisions),
				collection("wikis", snapshot.wikis),
			].join("\n"),
			"utf8",
		)
		.digest("hex")
		.slice(0, 32);
}
