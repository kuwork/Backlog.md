/*
 * Lightweight wrapper around the `blessed` terminal UI library.
 *
 * With Bun's `--compile` the dependency is bundled, so we import it
 * directly and only fall back to plain text when not running in a TTY.
 */

import { stdin as input, stdout as output } from "node:process";
import type { ProgramInterface, ScreenInterface, ScreenOptions } from "neo-neo-bblessed";
import { screen as blessedScreen, box, program as createProgram } from "neo-neo-bblessed";

type ErrorConstructor = new () => unknown;

function constructError(value: unknown): Error | undefined {
	if (typeof value !== "function") {
		return undefined;
	}

	try {
		const candidate = new (value as ErrorConstructor)();
		return candidate instanceof Error ? candidate : undefined;
	} catch {
		return undefined;
	}
}

function normalizeToError(value: unknown): Error {
	if (value instanceof Error) {
		return value;
	}

	const constructed = constructError(value);
	if (constructed) {
		return constructed;
	}

	return new Error(String(value ?? "Unknown screen error"));
}

let sharedProgram: (ProgramInterface & { destroyed?: boolean }) | null = null;
const originalProgramDestroy = createProgram.prototype.destroy;

/**
 * Release the shared blessed program and restore the terminal to normal mode.
 * Use between two sequential TUI screens (e.g. a selection list followed by a
 * scrollable viewer) to avoid leaving the terminal in a broken raw-input state
 * on terminals such as PowerShell where reusing the same program across screens
 * can hang after the first screen is destroyed.
 */
export function releaseSharedProgram(): void {
	if (sharedProgram && !sharedProgram.destroyed) {
		try {
			sharedProgram.disableMouse();
		} catch {
			// ignore
		}
		try {
			sharedProgram.showCursor();
		} catch {
			// ignore
		}
		try {
			originalProgramDestroy.call(sharedProgram);
		} catch {
			// ignore
		}
	}
	sharedProgram = null;
}

/** Save the icon and window titles onto the terminal's title stack, the pair OSC 0 sets. */
const PUSH_WINDOW_TITLE = "\x1b[22;0t";
/** Restore the pair the matching push saved. */
const POP_WINDOW_TITLE = "\x1b[23;0t";
/** Clear the title, for terminals that keep no title stack to pop from. */
const CLEAR_WINDOW_TITLE = "\x1b]0;\x07";

/**
 * Write one terminal control sequence straight to the output, wrapping it in the tmux DCS
 * passthrough when inside tmux so the outer terminal receives it rather than tmux itself.
 *
 * blessed's own `_twrite` wraps the same way, but for tmux it defers the write until the
 * output reports bytes written, which Bun never reports, so it falls back to a five second
 * poll. A teardown sequence queued that way is lost as soon as the process exits, which is
 * exactly the case this restore exists for, so these are written raw and synchronously.
 *
 * One sequence per call: the DCS envelope escapes a single leading ESC, so two sequences
 * cannot share one envelope.
 */
function writeTerminalControl(program: ProgramInterface, sequence: string): void {
	program.write(program.tmux ? `\x1bPtmux;\x1b${sequence.replaceAll("\x1b\\", "\x07")}\x1b\\` : sequence);
}

export function createScreen(options: Partial<ScreenOptions> = {}): ScreenInterface {
	// Blessed programs bind process.stdin in raw mode; a fresh program per screen
	// breaks input on the second screen after the first is destroyed (the Tab view
	// switch between kanban and task list). Reuse one program process-wide and keep
	// it alive: screen.destroy() normally destroys its program, which would tear down
	// the shared program under the still-mounted screens. We neutralize that single
	// destroy call so the shared program survives until process exit.
	if (!sharedProgram || sharedProgram.destroyed) {
		sharedProgram = createProgram({ tput: false }) as ProgramInterface & { destroyed?: boolean };
	}

	// Renaming the terminal window must not outlive the session, so save the titles the
	// user had before blessed overwrites them and put them back during teardown.
	const managesWindowTitle = typeof options.title === "string" && options.title.length > 0;
	if (managesWindowTitle) {
		writeTerminalControl(sharedProgram, PUSH_WINDOW_TITLE);
	}

	const screen = blessedScreen({ smartCSR: true, program: sharedProgram, fullUnicode: true, ...options });

	// screen.key registers listeners on the shared program's EventEmitter. A destroyed
	// screen leaves those listeners behind, so a later screen's identical key press
	// (e.g. the down arrow after Tab-switching back to the board) fires the stale
	// handler and can crash ("Cannot switch a node's screen"). Track and unbind them.
	const boundKeys = new Map<string, Set<() => void>>();
	const screenWithUnkey = screen as ScreenInterface & {
		key(keys: string | string[], listener: (...args: unknown[]) => void): void;
		unkey(keys: string | string[], listener: (...args: unknown[]) => void): void;
	};
	const originalKey = screenWithUnkey.key.bind(screenWithUnkey);
	const originalUnkey = screenWithUnkey.unkey.bind(screenWithUnkey);
	screenWithUnkey.key = (keys: string | string[], listener: (...args: unknown[]) => void) => {
		const keyList = typeof keys === "string" ? keys.split(/\s*,\s*/) : keys;
		const wrapped = () => listener();
		for (const keyName of keyList) {
			const listeners = boundKeys.get(keyName) ?? new Set();
			listeners.add(wrapped);
			boundKeys.set(keyName, listeners);
		}
		originalKey(keys, wrapped);
	};
	screenWithUnkey.unkey = (keys: string | string[], listener: (...args: unknown[]) => void) => {
		originalUnkey(keys, listener);
	};
	const originalDestroy = screen.destroy.bind(screen);
	let restoredWindowTitle = false;
	let destroyedOnce = false;
	screen.destroy = () => {
		const firstDestroy = !destroyedOnce;
		destroyedOnce = true;
		// A title-managing screen saves the user's titles on open and must put them back
		// on teardown. Clear first so terminals without a title stack fall back to their
		// own default instead of keeping a stale view name, then pop so terminals that
		// have one restore the exact pair the push saved. blessed emits "destroy" twice
		// per screen, so one push must not be popped twice.
		if (managesWindowTitle && !restoredWindowTitle && sharedProgram) {
			restoredWindowTitle = true;
			writeTerminalControl(sharedProgram, CLEAR_WINDOW_TITLE);
			writeTerminalControl(sharedProgram, POP_WINDOW_TITLE);
		}
		// The shared program carries every screen's listeners: screen._listenKeys
		// registers a "keypress" handler and component key bindings register "key *"
		// handlers, neither of which screen.destroy removes. A destroyed screen's
		// stale handler then fires on the next screen (e.g. the down arrow after
		// Tab-switching back to the board) and crashes ("Cannot switch a node's
		// screen"). Drop every program input listener; the next screen re-binds.
		// blessed can invoke destroy twice per screen; only the first call may strip,
		// or a late second call would wipe the listeners a live screen just re-bound.
		if (firstDestroy) {
			const programEvents = (sharedProgram as unknown as { _events?: Record<string, unknown[]> })._events;
			if (programEvents) {
				for (const eventName of Object.keys(programEvents)) {
					if (eventName.startsWith("key ") || eventName === "keypress") {
						(sharedProgram as unknown as { removeAllListeners(event: string): void }).removeAllListeners(eventName);
					}
				}
			}
			boundKeys.clear();
		}
		// Skip Program.prototype.destroy so the shared program stays bound to stdin.
		createProgram.prototype.destroy = () => {};
		try {
			originalDestroy();
		} finally {
			createProgram.prototype.destroy = originalProgramDestroy;
		}
	};

	// Windows runners occasionally surface file system watcher errors as plain objects
	// (rather than Error instances). Blessed rethrows unhandled "error" events by
	// constructing the first argument, which explodes when it is a string. Attach a
	// defensive handler so these platform-specific events don't crash tests.
	screen.on("error", (err) => {
		const normalizedError = normalizeToError(err);
		if (process.env.DEBUG) {
			console.warn("TUI screen error", normalizedError);
		}
		throw normalizedError;
	});

	return screen;
}

// Ask the user for a single line of input.  Falls back to readline.
export async function promptText(message: string, defaultValue = ""): Promise<string> {
	// Always use readline for simple text input to avoid blessed rendering quirks
	const { createInterface } = await import("node:readline/promises");
	const rl = createInterface({ input, output });
	const answer = (await rl.question(`${message} `)).trim();
	rl.close();
	return answer || defaultValue;
}

/**
 * Add pageup/pagedown/home/end scroll keybindings to a scrollable widget.
 * Blessed's built-in `keys: true` / `vi: true` only handle arrow keys and
 * Ctrl+D/U — this fills in the standard terminal navigation keys.
 */
export function addScrollKeys(
	widget: { height?: number | string; key: (keys: string[], fn: () => boolean | undefined) => void },
	screen: ScreenInterface,
): void {
	const scrollable = widget as unknown as {
		scroll?: (offset: number) => void;
		setScroll?: (offset: number) => void;
		setScrollPerc?: (perc: number) => void;
	};

	const pageAmount = () => {
		const height = typeof widget.height === "number" ? widget.height : 0;
		return height > 0 ? Math.max(1, height - 3) : 0;
	};

	widget.key(["pageup"], () => {
		const delta = pageAmount();
		if (delta > 0) {
			scrollable.scroll?.(-delta);
			screen.render();
		}
		return false;
	});
	widget.key(["pagedown"], () => {
		const delta = pageAmount();
		if (delta > 0) {
			scrollable.scroll?.(delta);
			screen.render();
		}
		return false;
	});
	widget.key(["home"], () => {
		scrollable.setScroll?.(0);
		screen.render();
		return false;
	});
	widget.key(["end"], () => {
		scrollable.setScrollPerc?.(100);
		screen.render();
		return false;
	});
}
/** Remove C0 controls, DEL, and C1 controls so they can never reach the terminal title. */
function stripControlCharacters(value: string): string {
	return Array.from(value)
		.filter((character) => {
			const code = character.codePointAt(0) ?? 0;
			return code > 0x1f && code !== 0x7f && !(code >= 0x80 && code <= 0x9f);
		})
		.join("");
}

/**
 * Terminal/window title for a TUI surface, so parallel terminals can be told apart.
 * Uses the configured project name when it identifies the project, and falls back to a
 * generic "Backlog <view>" title for a blank name or the "Untitled Project" placeholder.
 *
 * The title is emitted as `ESC ] 0 ; <title> BEL`, so the composed string is stripped of
 * control characters: both the project name and the view (search queries, task titles)
 * come from repository files that a clone can control, and an embedded BEL or ESC would
 * otherwise close the title sequence and inject arbitrary escape codes into the terminal.
 */
export function formatTuiTitle(view: string, projectName?: string): string {
	const name = stripControlCharacters(projectName ?? "").trim();
	const usableName = name && name.toLowerCase() !== "untitled project" ? name : "";
	return stripControlCharacters(usableName ? `${usableName} - ${view}` : `Backlog ${view}`);
}

// Display long content in a scrollable viewer.
export async function scrollableViewer(content: string): Promise<void> {
	if (output.isTTY === false) {
		console.log(content);
		return;
	}

	// Some terminals (e.g. VS Code's integrated terminal on Windows) report a
	// broken size or fail to provide it to the blessed program, leaving the
	// scrollable viewer unusable. Fall back to plain output in that case.
	const rows = process.stdout.rows || process.stderr.rows || 0;
	const cols = process.stdout.columns || process.stderr.columns || 0;
	if (rows < 3 || cols < 3) {
		console.log(content);
		return;
	}

	return new Promise<void>((resolve) => {
		const screen = createScreen({
			style: {},
		});

		// Double-check the size blessed actually got; if it's unusable, bail out.
		if (screen.height < 3 || screen.width < 3) {
			screen.destroy();
			console.log(content);
			resolve();
			return;
		}

		const viewer = box({
			parent: screen,
			content,
			scrollable: true,
			alwaysScroll: true,
			keys: true,
			vi: true,
			// Mouse tracking can interfere with arrow-key parsing on Windows terminals.
			mouse: process.platform !== "win32",
			width: "100%",
			height: "100%",
			padding: { left: 1, right: 1 },
			wrap: true,
			scrollbar: { ch: " ", inverse: true },
			style: { scrollbar: { bg: "gray" } },
		}) as unknown as {
			scroll?: (offset: number) => void;
			focus: () => void;
			key: (keys: string[], fn: () => boolean | undefined) => void;
		};

		addScrollKeys(viewer as unknown as Parameters<typeof addScrollKeys>[0], screen);

		// Explicit scrolling keys for terminals where blessed's default box keys
		// (such as PowerShell / VS Code) do not register reliably.
		viewer.key(["up", "k"], () => {
			viewer.scroll?.(-1);
			screen.render();
			return false;
		});
		viewer.key(["down", "j"], () => {
			viewer.scroll?.(1);
			screen.render();
			return false;
		});

		const close = () => {
			// Leave the alternate buffer and restore the cursor before tearing down
			// the screen, so the terminal is usable again on Windows/PowerShell.
			screen.leave();
			screen.destroy();
			// Release the shared program to restore normal terminal state;
			// otherwise raw mode / alternate buffer can persist and hang the shell.
			releaseSharedProgram();
			resolve();
			return false;
		};

		screen.key(["escape", "q", "C-c"], close);
		viewer.key(["escape", "q", "C-c"], close);

		// Ensure the screen enters raw / alternate-buffer mode before focusing the
		// viewer; some terminals (especially on Windows) do not pick it up from
		// render alone.
		screen.enter();
		viewer.focus();
		screen.render();
	});
}
