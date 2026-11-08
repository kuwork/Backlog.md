import { logLine } from "./log.ts";

/**
 * One switch that turns off every disk cache read for the lifetime of the process.
 *
 * The startup caches are pure derived state (branch index/bundles rebuilt from git, parsed tasks
 * rebuilt from files), so ignoring them can never change what the UI shows -- it only changes how
 * long the boot takes and which lines the log prints. That makes the flag useful for two things:
 * measuring a genuine cold start while a warm cache sits on disk, and ruling out a suspected stale
 * or corrupt cache without deleting directories under the platform cache root (see cache-dir.ts).
 *
 * Env-var based rather than threaded through constructors, so a cache layer added later cannot
 * silently keep reading disk just because nobody plumbed the option to it. The flag only suppresses
 * reads: rebuilds are still written, so the run after `--no-cache` is warm again.
 */
export const NO_CACHE_ENV = "BACKLOG_NO_CACHE";

export function isCacheDisabled(): boolean {
	const raw = process.env[NO_CACHE_ENV]?.trim().toLowerCase();
	return raw === "1" || raw === "true" || raw === "yes";
}

/** Turn the policy on (and announce it, so the cold path is explainable in the log) or off. */
export function setCacheDisabled(disabled: boolean): void {
	if (disabled) {
		process.env[NO_CACHE_ENV] = "1";
		logLine("cache", "disabled by --no-cache: ignoring local caches and rebuilding them");
		return;
	}
	delete process.env[NO_CACHE_ENV];
}
