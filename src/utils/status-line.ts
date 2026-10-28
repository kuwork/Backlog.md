/**
 * A single pinned status line for a TTY. The heartbeat (and anything else that wants a live
 * bottom line) calls `update()`; every other console log calls `lift()` first so the status
 * line is pushed up into the scrollback instead of being overwritten by an interleaving line.
 *
 * This is what makes "ContentStore periodic rescan completed" stay on the bottom line in a live
 * server console instead of stacking: the server shares the terminal with watcher error/warn
 * logs and request logs, so without the lift any other line would shove the in-place rewrite
 * onto the wrong line and leave the old one stranded.
 *
 * Activation is intentionally conservative:
 *  - A genuine TTY (`process.stdout.isTTY`) — macOS Terminal / iTerm, Linux, Windows Terminal
 *    (ConPTY), and any interactive terminal that reports isTTY — uses the pinned line directly.
 *  - Git Bash / MSYS2 (mintty) wraps native binaries (node/bun) in winpty, which reports
 *    `isTTY === false` even though the output is a real, ANSI-capable terminal. winpty cannot be
 *    detected reliably (it also makes stdin a pipe, so a DSR probe gets no reply, and its env
 *    markers like MSYSTEM are also present in non-interactive/redirected runs). Auto-enabling on
 *    those markers would spray ANSI into CI logs, test output, and `> file` captures. So for
 *    winpty the pinned line is OFF by default and turned on via `BACKLOG_STATUS_LINE=1` (or the
 *    `backlog browser --status-line` flag). `BACKLOG_STATUS_LINE=0` forces it off.
 *  - Any non-TTY (piped / captured / tests) falls back to a normal line and `lift()` is a no-op,
 *    so piped logs stay clean.
 */

import * as fs from "node:fs";

class StatusLine {
	private last = "";

	/**
	 * Whether the pinned status line should be used. True for a genuine TTY, or when explicitly
	 * forced on via the `BACKLOG_STATUS_LINE` env var / `--status-line` flag.
	 */
	get active(): boolean {
		const forced = forcedStatusLine();
		if (forced !== null) return forced;
		return Boolean(process.stdout.isTTY);
	}

	/** Push the current status line up into the scrollback so the next log prints above it. */
	lift(): void {
		if (!this.active || !this.last) return;
		// The status text is already drawn on the bottom line with no trailing newline. Drop to a
		// fresh line so the incoming log (and the next status re-draw) sit below it. We do NOT
		// re-print `last` — it is already on screen — which avoids duplicating it.
		process.stdout.write("\n");
		this.last = "";
	}

	/** Write or refresh the pinned bottom line in place (TTY) or as a normal line (non-TTY). */
	update(text: string): void {
		if (!this.active) {
			// Call console.log dynamically (not the cached rawLog) so it still goes through any
			// installed console wrapper and honors a logger that has been replaced in tests.
			console.log(text);
			this.last = text;
			return;
		}
		// \r returns to column 0; \x1b[K clears to end of line; no trailing newline keeps it pinned.
		process.stdout.write(`\r\x1b[K${text}`);
		this.last = text;
	}

	/** Erase the pinned line (e.g. on shutdown) so it does not linger under the next prompt. */
	clear(): void {
		if (!this.active) return;
		process.stdout.write("\r\x1b[K");
		this.last = "";
	}
}

let rawLog = (...args: unknown[]): void => console.log(...args);
let rawError = (...args: unknown[]): void => console.error(...args);
let rawWarn = (...args: unknown[]): void => console.warn(...args);

let installed = false;
let busy = false;

/**
 * Wrap console.log/error/warn so any output lifts the pinned status line first. Re-entrancy safe:
 * if a wrapped call (or something it calls) logs again, the inner call bypasses the wrapper via
 * the captured raw methods and the `busy` guard, so there is no infinite loop regardless of other
 * console wrappers in the process.
 */
export function installStatusLineHooks(): void {
	if (installed) return;
	installed = true;
	rawLog = console.log.bind(console);
	rawError = console.error.bind(console);
	rawWarn = console.warn.bind(console);

	const wrap = (key: "log" | "error" | "warn", fn: (...args: unknown[]) => void) => {
		const original = console[key];
		console[key] = ((...args: unknown[]) => {
			if (busy) {
				fn(...args);
				return;
			}
			busy = true;
			try {
				statusLine.lift();
				fn(...args);
			} finally {
				busy = false;
			}
		}) as typeof original;
	};

	wrap("log", rawLog);
	wrap("error", rawError);
	wrap("warn", rawWarn);
}

export const statusLine = new StatusLine();

/**
 * Explicit override: `BACKLOG_STATUS_LINE=1|true|on` forces the status line on,
 * `0|false|off` forces it off. Anything else is undefined (fall back to isTTY).
 */
function forcedStatusLine(): boolean | null {
	const v = process.env.BACKLOG_STATUS_LINE?.toLowerCase().trim();
	if (v === "1" || v === "true" || v === "on" || v === "yes") return true;
	if (v === "0" || v === "false" || v === "off" || v === "no") return false;
	return null;
}

/** True when stdout fd 1 is a regular file (e.g. `backlog browser > log.txt`), not a terminal. */
function isRedirectedToFile(): boolean {
	try {
		return fs.fstatSync(1).isFile();
	} catch {
		return false;
	}
}

/**
 * Whether the `backlog browser` command should auto-enable the pinned status line. Git Bash /
 * MSYS2 (mintty) wraps native binaries (node/bun) in winpty, which reports `isTTY === false`
 * even though the output is a real, ANSI-capable terminal — so the heartbeat would otherwise fall
 * back to `console.log` and stack. We enable it here (and only here) when we can confidently treat
 * the environment as an interactive winpty terminal:
 *  - an explicit override already wins (don't second-guess it),
 *  - never decorate CI logs,
 *  - never when stdout is a genuine TTY (already handled) or redirected to a file (keep clean),
 *  - and only on Windows with a mintty/MSYS marker.
 * Other server entry points (mcp, direct `server.start()` in tests) intentionally do NOT call
 * this, so their logs stay clean.
 */
export function shouldAutoEnableStatusLineForBrowser(): boolean {
	if (process.env.BACKLOG_STATUS_LINE) return false;
	if (process.env.CI) return false;
	if (process.platform !== "win32") return false;
	if (process.stdout.isTTY) return false;
	if (isRedirectedToFile()) return false;
	return Boolean(
		(process.env.MSYSTEM && /^(MINGW|MSYS|CYGWIN)/.test(process.env.MSYSTEM)) ||
			(process.env.TERM && process.env.TERM !== "dumb"),
	);
}
