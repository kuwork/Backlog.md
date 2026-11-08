import { homedir } from "node:os";
import { join } from "node:path";

/**
 * One place that decides where Backlog.md keeps its caches.
 *
 * The platform conventions differ enough that each caller guessing on its own produced three
 * different answers: Windows uses `%LOCALAPPDATA%`, macOS uses `~/Library/Caches` (not `~/.cache`,
 * which is where a naive fallback lands), and Linux uses `$XDG_CACHE_HOME` or `~/.cache`. Two of
 * the caches had inherited the Windows/Linux-only form, so on macOS the same project was cached
 * under both roots depending on which layer wrote it.
 *
 * `$XDG_CACHE_HOME` wins over every platform default because a user who sets it expects all caches
 * to follow it; otherwise Windows uses `%LOCALAPPDATA%`, macOS `~/Library/Caches` and Linux `~/.cache`.
 */
export function resolveCacheBaseDir(): string {
	// An explicit XDG setting wins everywhere: a user who exports it expects every cache to follow.
	if (process.env.XDG_CACHE_HOME) return process.env.XDG_CACHE_HOME;
	if (process.platform === "win32") {
		return process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local");
	}
	return process.platform === "darwin" ? join(homedir(), "Library", "Caches") : join(homedir(), ".cache");
}

/** A directory under the shared `<cache>/backlog.md` namespace, e.g. `backlogCacheDir("task-cache")`. */
export function backlogCacheDir(...segments: string[]): string {
	return join(resolveCacheBaseDir(), "backlog.md", ...segments);
}
