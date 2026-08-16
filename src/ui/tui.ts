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
	screen.destroy = () => {
		// The shared program carries every screen's listeners: screen._listenKeys
		// registers a "keypress" handler and component key bindings register "key *"
		// handlers, neither of which screen.destroy removes. A destroyed screen's
		// stale handler then fires on the next screen (e.g. the down arrow after
		// Tab-switching back to the board) and crashes ("Cannot switch a node's
		// screen"). Drop every program input listener; the next screen re-binds.
		const programEvents = (sharedProgram as unknown as { _events?: Record<string, unknown> })._events;
		if (programEvents) {
			for (const eventName of Object.keys(programEvents)) {
				if (eventName.startsWith("key ") || eventName === "keypress") {
					(sharedProgram as unknown as { removeAllListeners(event: string): void }).removeAllListeners(eventName);
				}
			}
		}
		boundKeys.clear();
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

// Display long content in a scrollable viewer.
export async function scrollableViewer(content: string): Promise<void> {
	if (output.isTTY === false) {
		console.log(content);
		return;
	}

	return new Promise<void>((resolve) => {
		const screen = createScreen({
			style: {},
		});

		const viewer = box({
			parent: screen,
			content,
			scrollable: true,
			alwaysScroll: true,
			keys: true,
			vi: true,
			mouse: true,
			width: "100%",
			height: "100%",
			padding: { left: 1, right: 1 },
			wrap: true,
			scrollbar: { ch: " ", inverse: true },
			style: { scrollbar: { bg: "gray" } },
		});

		addScrollKeys(viewer, screen);

		screen.key(["escape", "q", "C-c"], () => {
			screen.destroy();
			resolve();
		});

		viewer.focus();
		screen.render();
	});
}
