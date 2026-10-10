/**
 * Interactive multi-line text capture for a TTY-bound CLI command.
 *
 * `readStdinText` cannot be used on an interactive terminal: it awaits EOF, which a TTY never
 * delivers on its own. This helper is the TTY counterpart: it reads keystrokes until the user
 * signals the end of the note, so a bare command can capture a quick multi-line memo.
 *
 * End-of-input signals, in priority order:
 * - EOF (the stream closing — Ctrl+D on Unix/macOS/WSL, where the terminal delivers a real EOF)
 * - a lone Ctrl+D character (`\x04`) anywhere in the stream — the only end key that works in
 *   every terminal, including the VS Code integrated terminal and mintty (Git Bash), which
 *   forward Ctrl+D verbatim but do not deliver a real EOF
 * - a line containing only Ctrl+Z (`\x1a`) — the classic Windows console (cmd/PowerShell)
 *   delivers no EOF at all; cooked mode treats Ctrl+Z as the EOF substitute, so raw mode must
 *   reproduce that. VS Code intercepts Ctrl+Z and mintty repurpose it as SIGTSTP, so this key
 *   only ever fires on the classic console.
 *
 * Ctrl+C arrives as `\x03` while the stream is in raw mode and aborts the capture by throwing
 * `InteractiveCaptureAbortedError`, which callers translate into their usual abort exit code.
 * The raw-mode flag and the abort listener are always restored/removed, so the terminal is
 * left in its prior state either way.
 *
 * Raw mode also disables the terminal's own echo, so typed characters only become visible when
 * the caller passes `echoTarget` (the CLI passes `process.stdout`). Backspace is handled on the
 * current line and echoed as a cursor erase.
 */

export const CTRL_C = "\x03";
export const CTRL_D = "\x04";
export const CTRL_Z = "\x1a";

/** Hint shown before capture starts; written to the hint stream (stderr), never to the body. */
export const INTERACTIVE_CAPTURE_HINT =
	"Type the memo, then end with Ctrl+D (Ctrl+Z on the classic Windows console). Ctrl+C aborts.\n";

export class InteractiveCaptureAbortedError extends Error {
	readonly code = "INTERACTIVE_CAPTURE_ABORTED";

	constructor() {
		super("Interactive capture aborted.");
		this.name = "InteractiveCaptureAbortedError";
	}
}

export interface InteractiveCaptureStream {
	isTTY?: boolean;
	setRawMode?(mode: boolean): unknown;
	[Symbol.asyncIterator](): AsyncIterator<unknown>;
}

export interface InteractiveCaptureHintTarget {
	write(chunk: string): unknown;
}

export interface InteractiveCaptureOptions {
	/** AbortSignal that ends the capture early (same outcome as Ctrl+C). */
	signal?: AbortSignal;
	/**
	 * Where typed characters are echoed. Required on a TTY: raw mode disables the terminal's own
	 * echo, so without this the user types blind. Only used when the stream is a TTY; piped and
	 * fake streams never echo. Pass `process.stdout` from the CLI.
	 */
	echoTarget?: InteractiveCaptureHintTarget;
}

function chunkToText(chunk: unknown): string {
	return Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
}

/**
 * Captures a multi-line body from an interactive stream. Resolves with the captured text
 * (verbatim, line terminators normalized to `\n`) or rejects with
 * `InteractiveCaptureAbortedError` when the user presses Ctrl+C or the signal aborts.
 */
export async function captureInteractiveBody(
	stream: InteractiveCaptureStream,
	hintTarget: InteractiveCaptureHintTarget,
	options: InteractiveCaptureOptions = {},
): Promise<string> {
	hintTarget.write(INTERACTIVE_CAPTURE_HINT);

	const rawCapable = Boolean(stream.isTTY) && typeof stream.setRawMode === "function";
	if (rawCapable) stream.setRawMode?.(true);

	const abortError = new InteractiveCaptureAbortedError();
	let onAbort: (() => void) | undefined;
	const abortPromise = options.signal
		? new Promise<never>((_, reject) => {
				onAbort = () => reject(abortError);
				if (options.signal?.aborted) onAbort();
				else options.signal?.addEventListener("abort", onAbort, { once: true });
			})
		: undefined;

	let body = "";
	let line = "";
	let ended = false;
	const echo = rawCapable && options.echoTarget ? (chunk: string) => options.echoTarget?.write(chunk) : undefined;

	const flushLine = (terminated: boolean) => {
		if (line === CTRL_Z) ended = true;
		else body += terminated ? `${line}\n` : line;
		line = "";
	};

	const backspace = () => {
		if (line.length === 0) return;
		// Drop a full UTF-16 code point: a trailing surrogate pair comes off in one keystroke.
		const last = line.charCodeAt(line.length - 1);
		line = last >= 0xdc00 && last <= 0xdfff ? line.slice(0, -2) : line.slice(0, -1);
		echo?.("\b \b");
	};

	const processText = (text: string) => {
		for (let i = 0; i < text.length && !ended; i += 1) {
			const ch = text.charAt(i);
			if (ch === CTRL_D) {
				flushLine(false);
				ended = true;
			} else if (ch === CTRL_C) {
				throw abortError;
			} else if (ch === "\r") {
				if (text[i + 1] === "\n") i += 1;
				flushLine(true);
				echo?.("\n");
			} else if (ch === "\n") {
				flushLine(true);
				echo?.("\n");
			} else if (ch === "\x7f" || ch === "\b") {
				backspace();
			} else {
				line += ch;
				echo?.(ch);
			}
		}
	};

	const iterator = stream[Symbol.asyncIterator]();
	try {
		while (!ended) {
			const next = abortPromise ? await Promise.race([iterator.next(), abortPromise]) : await iterator.next();
			if (next.done) break;
			processText(chunkToText(next.value));
		}
		if (!ended && line !== "") flushLine(false);
	} finally {
		if (onAbort && options.signal) options.signal.removeEventListener("abort", onAbort);
		if (rawCapable) stream.setRawMode?.(false);
		// Abandon the iterator per protocol so the stream does not keep reading after the capture
		// ends. Deliberately not awaited: some runtimes resolve return() only after the
		// outstanding read settles, which a still-open stream never does. A one-shot CLI that
		// needs the event loop released (e.g. a TTY stdin, which never delivers EOF) should
		// destroy the stream itself after this call.
		iterator.return?.()?.catch(() => undefined);
	}

	// Leave the cursor on a fresh row once the capture ends (raw mode has no trailing newline).
	echo?.("\n");
	return body;
}
