import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Per-file hash cache and aggregate fingerprint (doc-014 §2.1).
 *
 * The sidecar backlog.kuzu.meta.json stores one {size, mtimeMs, hash} triple per whitelisted file
 * plus the aggregate fingerprint. PARSER_VERSION is mixed into the aggregate so a parser or schema
 * upgrade forces a rebuild even when no file changed. A missing or corrupt cache is treated as a
 * null fingerprint and triggers a full rebuild.
 */

export const PARSER_VERSION = 1;

export interface FileFingerprint {
	size: number;
	mtimeMs: number;
	hash: string;
}

export interface MetaCache {
	parserVersion: number;
	/** Which store backend built the cached graph; a mismatch forces a rebuild. */
	backend: "kuzu" | "memory";
	fingerprint: string | null;
	files: Record<string, FileFingerprint>;
}

export function computeFileHash(content: string): string {
	return createHash("sha256").update(content, "utf8").digest("hex");
}

/** Aggregate = sha256(PARSER_VERSION + sorted "relPath|hash" lines). */
export function computeAggregateFingerprint(
	files: Record<string, FileFingerprint>,
	parserVersion = PARSER_VERSION,
): string {
	const lines = Object.keys(files)
		.sort()
		.map((relPath) => `${relPath}|${files[relPath]?.hash ?? ""}`);
	return createHash("sha256")
		.update(`${parserVersion}\n${lines.join("\n")}`, "utf8")
		.digest("hex");
}

export function loadMetaCache(sidecarPath: string): MetaCache | null {
	let raw: string;
	try {
		raw = readFileSync(sidecarPath, "utf8");
	} catch {
		return null;
	}
	try {
		const parsed = JSON.parse(raw) as MetaCache;
		if (typeof parsed !== "object" || parsed === null || typeof parsed.files !== "object" || parsed.files === null) {
			return null;
		}
		return {
			parserVersion: Number(parsed.parserVersion ?? PARSER_VERSION),
			backend: parsed.backend === "kuzu" ? "kuzu" : "memory",
			fingerprint: parsed.fingerprint ?? null,
			files: parsed.files,
		};
	} catch {
		return null; // corrupt cache == null fingerprint == full rebuild
	}
}

export function saveMetaCache(sidecarPath: string, cache: MetaCache): void {
	mkdirSync(dirname(sidecarPath), { recursive: true });
	const tmpPath = `${sidecarPath}.tmp`;
	writeFileSync(tmpPath, `${JSON.stringify(cache, null, "\t")}\n`, "utf8");
	renameSync(tmpPath, sidecarPath); // atomic-ish swap; a torn write only costs a rebuild
}

/** size+mtime pair check - required because some Windows/network filesystems have 1s mtime granularity. */
export function fingerprintMatches(
	cached: FileFingerprint | undefined,
	scanned: { size: number; mtimeMs: number },
): boolean {
	return cached !== undefined && cached.size === scanned.size && cached.mtimeMs === scanned.mtimeMs;
}
