/**
 * Startup progress lines shaped like an IDE console: local wall-clock time, then a tag.
 *
 *   18:18:07.123 [cache] restored index main (local) @ 9ad9b06 (883 entries)
 *
 * A browser boot is silent for seconds at a time, so every line has to say when it happened
 * without the reader matching it against a clock. The tag stays the grep key.
 */
/**
 * Progress lines describe a long-running boot. One-shot CLI commands print machine-readable
 * output, so they must not get cache chatter mixed into stdout until the command asks for it.
 */
let progressEnabled = false;

/** Turn progress lines on for this process (the browser command and the Web server do this). */
export function enableProgressLogs(): void {
	progressEnabled = true;
}

export function logLine(tag: string, message: string): void {
	if (!progressEnabled) return;
	const now = new Date();
	const pad = (value: number, width = 2) => String(value).padStart(width, "0");
	const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.${pad(now.getMilliseconds(), 3)}`;
	console.log(`${time} [${tag}] ${message}`);
}

/** Same shape on stderr, so failures stay separable from progress when stdout is redirected. */
export function logError(tag: string, message: string, error?: unknown): void {
	const now = new Date();
	const pad = (value: number, width = 2) => String(value).padStart(width, "0");
	const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.${pad(now.getMilliseconds(), 3)}`;
	if (error === undefined) {
		console.error(`${time} [${tag}] ${message}`);
	} else {
		console.error(`${time} [${tag}] ${message}`, error);
	}
}
