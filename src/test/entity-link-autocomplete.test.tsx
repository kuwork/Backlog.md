import { afterAll, afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { Decision, Document as BacklogDocument, Task } from "../types/index.ts";
import { buildEntityIndex, type EntityIndex } from "../web/utils/task-id-links.ts";
import {
	ENTITY_AUTOCOMPLETE_DEBOUNCE_MS,
	computeAutocompleteCandidates,
	createCandidateCache,
	queryCandidatesCached,
	useEntityAutocomplete,
} from "../web/hooks/useEntityAutocomplete.ts";
import { EntityLinkAutocompleteMenu } from "../web/components/EntityLinkAutocomplete.tsx";
import { PasteAwareMDEditor } from "../web/components/PasteAwareMDEditor.tsx";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";
import { TaskIdIndexProvider } from "../web/contexts/TaskIdIndexContext.tsx";

const taskFixtures = (...ids: string[]): Task[] =>
	ids.map((id) => ({
		id,
		title: `Task ${id}`,
		status: "To Do",
		assignee: [],
		createdDate: "2026-07-24",
		labels: [],
		dependencies: [],
	}));

const docFixtures = (...ids: string[]): BacklogDocument[] =>
	ids.map((id) => ({
		id,
		title: `Doc ${id}`,
		type: "guide",
		createdDate: "2026-07-24",
		rawContent: "",
	}));

const decisionFixtures = (...ids: string[]): Decision[] =>
	ids.map((id) => ({
		id,
		title: `Decision ${id}`,
		date: "2026-07-24",
		status: "accepted",
		context: "",
		decision: "",
		consequences: "",
		rawContent: "",
	}));

const buildIndex = (overrides: Partial<Parameters<typeof buildEntityIndex>[0]> = {}): EntityIndex =>
	buildEntityIndex({
		tasks: taskFixtures("BACK-1", "BACK-14", "BACK-010", "BACK-0012"),
		docs: docFixtures("doc-1", "doc-9"),
		decisions: decisionFixtures("decision-1"),
		drafts: taskFixtures("DRAFT-104"),
		wikiPaths: ["patterns/cross-link", "patterns/cross-surface", "guides/intro"],
		...overrides,
	});

describe("computeAutocompleteCandidates", () => {
	it("returns hits for a task prefix in ascending ID order", () => {
		const candidates = computeAutocompleteCandidates(buildIndex(), "BACK");

		expect(candidates.map((c) => `${c.kind}:${c.id}`)).toEqual(["task:BACK-1", "task:BACK-10", "task:BACK-12", "task:BACK-14"]);
	});

	it("merges kinds in task/doc/decision/draft order", () => {
		const index: EntityIndex = {
			tasks: new Map(taskFixtures("X-1").map((task): [string, Task] => [task.id, task])),
			docs: new Map(docFixtures("X-2").map((doc): [string, BacklogDocument] => [doc.id, doc])),
			decisions: new Map(decisionFixtures("X-3").map((decision): [string, Decision] => [decision.id, decision])),
			drafts: new Map(taskFixtures("X-4").map((task): [string, Task] => [task.id, task])),
			wikiPaths: [],
		};
		const candidates = computeAutocompleteCandidates(index, "X");

		expect(candidates.map((c) => `${c.kind}:${c.id}`)).toEqual(["task:X-1", "doc:X-2", "decision:X-3", "draft:X-4"]);
	});

	it("caps candidates at five per query, keeping ascending ID order", () => {
		const index: EntityIndex = {
			tasks: new Map(taskFixtures("X-1", "X-2", "X-3", "X-4", "X-5", "X-6").map((task) => [task.id, task])),
			docs: new Map(),
			decisions: new Map(),
			drafts: new Map(),
			wikiPaths: [],
		};
		const candidates = computeAutocompleteCandidates(index, "X-");

		expect(candidates).toHaveLength(5);
		expect(candidates.map((c) => c.id)).toEqual(["X-1", "X-2", "X-3", "X-4", "X-5"]);
		expect(candidates.every((c) => c.kind === "task")).toBe(true);
	});

	it("is zero-padding aware: BACK-1 matches BACK-1/BACK-010/BACK-0012/BACK-14 and BACK-01 is equivalent", () => {
		const byOne = computeAutocompleteCandidates(buildIndex(), "BACK-1");
		const byZeroOne = computeAutocompleteCandidates(buildIndex(), "BACK-01");

		expect(byOne.map((c) => c.id)).toEqual(["BACK-1", "BACK-10", "BACK-12", "BACK-14"]);
		expect(byZeroOne.map((c) => c.id)).toEqual(byOne.map((c) => c.id));
	});

	it("falls back to wiki path prefix matching in dictionary order when no entity ID matches", () => {
		const candidates = computeAutocompleteCandidates(buildIndex(), "pat");

		expect(candidates.map((c) => `${c.kind}:${c.id}:${c.href}`)).toEqual([
			"wiki:patterns/cross-link:/wiki/patterns/cross-link",
			"wiki:patterns/cross-surface:/wiki/patterns/cross-surface",
		]);
	});

	it("queries wiki paths for tokens containing a slash", () => {
		const candidates = computeAutocompleteCandidates(buildIndex(), "patterns/cross-s");

		expect(candidates.map((c) => c.id)).toEqual(["patterns/cross-surface"]);
	});

	it("returns nothing for empty or unmatched tokens", () => {
		const index = buildIndex();
		expect(computeAutocompleteCandidates(index, " ")).toEqual([]);
		expect(computeAutocompleteCandidates(index, "ZZZ-9")).toEqual([]);
	});
});

describe("queryCandidatesCached (negative cache)", () => {
	it("does not re-check a missed token while the index is unchanged", () => {
		const cache = createCandidateCache();
		const index = buildIndex();
		let calls = 0;
		const compute = (idx: EntityIndex, token: string) => {
			calls += 1;
			return computeAutocompleteCandidates(idx, token);
		};

		expect(queryCandidatesCached(cache, index, "ZZZ-9", compute)).toEqual([]);
		expect(queryCandidatesCached(cache, index, "ZZZ-9", compute)).toEqual([]);
		expect(queryCandidatesCached(cache, index, "ZZZ-9", compute)).toEqual([]);
		expect(calls).toBe(1);
	});

	it("caches hits as well and invalidates everything when the index identity changes", () => {
		const cache = createCandidateCache();
		const first = buildIndex();
		const second = buildIndex();
		let calls = 0;
		const compute = (idx: EntityIndex, token: string) => {
			calls += 1;
			return computeAutocompleteCandidates(idx, token);
		};

		const firstHits = queryCandidatesCached(cache, first, "BACK-1", compute);
		expect(queryCandidatesCached(cache, first, "BACK-1", compute)).toEqual(firstHits);
		expect(calls).toBe(1);

		expect(queryCandidatesCached(cache, second, "BACK-1", compute)).toEqual(firstHits);
		expect(calls).toBe(2);
	});
});

// ---------- DOM integration ----------

let activeRoot: Root | null = null;

// Bun runs test files sequentially in one process, so every global this file
// overwrites must be restored afterwards — a leaked fetch mock or JSDOM window
// breaks unrelated suites scheduled after this file.
const GLOBAL_KEYS = ["window", "document", "navigator", "localStorage", "fetch"] as const;
const originalGlobals = new Map<string, unknown>();
let originalsCaptured = false;
const captureOriginalGlobals = () => {
	if (originalsCaptured) return;
	originalsCaptured = true;
	for (const key of GLOBAL_KEYS) {
		originalGlobals.set(key, (globalThis as unknown as Record<string, unknown>)[key]);
	}
};

const setupDom = () => {
	captureOriginalGlobals();
	const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost" });
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as unknown as Document;
	globalThis.navigator = dom.window.navigator as unknown as Navigator;
	globalThis.localStorage = dom.window.localStorage as unknown as Storage;

	// React's legacy input-event polyfill calls attachEvent/detachEvent, which
	// jsdom does not implement; stub them like the other component tests do.
	const htmlElementPrototype = window.HTMLElement.prototype as unknown as {
		attachEvent?: () => void;
		detachEvent?: () => void;
	};
	if (typeof htmlElementPrototype.attachEvent !== "function") {
		htmlElementPrototype.attachEvent = () => {};
	}
	if (typeof htmlElementPrototype.detachEvent !== "function") {
		htmlElementPrototype.detachEvent = () => {};
	}
};

const Harness: React.FC<{
	index: EntityIndex;
	debounceMs?: number;
	onChange?: (value: string) => void;
}> = ({ index, debounceMs, onChange }) => {
	const [textarea, setTextarea] = React.useState<HTMLTextAreaElement | null>(null);
	const { menu, insertCandidate } = useEntityAutocomplete({
		textarea,
		value: textarea?.value ?? "",
		debounceMs,
		index,
		// Apply host-side state back onto the uncontrolled textarea, the way a
		// controlled editor re-renders after onChange.
		onChange: (next) => {
			if (textarea) textarea.value = next;
			onChange?.(next);
		},
	});
	// Uncontrolled on purpose: the hook reads the live DOM value and pushes
	// insertions out through onChange, like it does for a real editor host.
	return (
		<div className="relative">
			<textarea ref={setTextarea} defaultValue="" />
			{menu && <EntityLinkAutocompleteMenu menu={menu} textarea={textarea} onSelect={insertCandidate} />}
		</div>
	);
};

const renderHarness = (
	options: { index?: EntityIndex; debounceMs?: number; onChange?: (value: string) => void } = {},
): HTMLElement => {
	setupDom();
	const container = document.getElementById("root");
	expect(container).toBeTruthy();
	activeRoot = createRoot(container as HTMLElement);
	act(() => {
		activeRoot?.render(
			<Harness index={options.index ?? buildIndex()} debounceMs={options.debounceMs ?? 5} onChange={options.onChange} />,
		);
	});
	return container as HTMLElement;
};

const getTextarea = (container: HTMLElement): HTMLTextAreaElement => {
	const textarea = container.querySelector("textarea");
	expect(textarea).toBeTruthy();
	return textarea as HTMLTextAreaElement;
};

const setTextareaValue = (textarea: HTMLTextAreaElement, value: string, caret?: number) => {
	textarea.value = value;
	textarea.setSelectionRange(caret ?? value.length, caret ?? value.length);
};

/** Simulate the user typing `value` (replacing textarea content) and waiting out the debounce. */
const typeText = async (container: HTMLElement, value: string, debounceMs = 5) => {
	const textarea = getTextarea(container);
	await act(async () => {
		textarea.focus();
		setTextareaValue(textarea, value);
		textarea.dispatchEvent(new window.Event("input", { bubbles: true }));
		await new Promise((resolve) => setTimeout(resolve, debounceMs * 4));
	});
};

const pressKey = async (container: HTMLElement, key: string, init: KeyboardEventInit = {}): Promise<KeyboardEvent> => {
	const textarea = getTextarea(container);
	const event = new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
	await act(async () => {
		textarea.focus();
		textarea.dispatchEvent(event);
		await Promise.resolve();
	});
	return event;
};

/** Real key presses also fire keyup, which schedules a debounced re-evaluation. */
const keyUp = async (container: HTMLElement, key: string): Promise<void> => {
	const textarea = getTextarea(container);
	await act(async () => {
		textarea.dispatchEvent(new window.KeyboardEvent("keyup", { key, bubbles: true, cancelable: true }));
		await Promise.resolve();
	});
};

const waitOutDebounce = async (ms = 40) => {
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, ms));
	});
};

const menuOptions = (container: HTMLElement): string[] =>
	Array.from(container.querySelectorAll('[role="option"]')).map((el) => el.textContent ?? "");

const menuIsOpen = (container: HTMLElement): boolean => container.querySelector('[role="listbox"]') !== null;

const selectedOption = (container: HTMLElement): string | null =>
	container.querySelector('[role="option"][aria-selected="true"]')?.textContent ?? null;

afterEach(() => {
	if (activeRoot) {
		act(() => {
			activeRoot?.unmount();
		});
		activeRoot = null;
	}
});

afterAll(() => {
	for (const key of GLOBAL_KEYS) {
		const original = originalGlobals.get(key);
		if (original === undefined) {
			delete (globalThis as unknown as Record<string, unknown>)[key];
		} else {
			(globalThis as unknown as Record<string, unknown>)[key] = original;
		}
	}
});

describe("useEntityAutocomplete menu", () => {
	it("opens the menu below the caret only after the 200 ms debounce", async () => {
		const container = renderHarness({ debounceMs: ENTITY_AUTOCOMPLETE_DEBOUNCE_MS });
		const textarea = getTextarea(container);

		await act(async () => {
			textarea.focus();
			setTextareaValue(textarea, "Ref BACK-1");
			textarea.dispatchEvent(new window.Event("input", { bubbles: true }));
			await new Promise((resolve) => setTimeout(resolve, 120));
		});
		expect(menuIsOpen(container)).toBe(false);

		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 140));
		});
		expect(menuIsOpen(container)).toBe(true);
		expect(menuOptions(container)[0]).toContain("BACK-1");
	});

	it("shows up to five ascending candidates with kind badges", async () => {
		const container = renderHarness({
			index: buildIndex({ tasks: taskFixtures("BACK-1", "BACK-2", "BACK-3", "BACK-4", "BACK-5", "BACK-6") }),
		});
		await typeText(container, "BACK-");

		const options = menuOptions(container);
		expect(options).toHaveLength(5);
		expect(options[0]).toContain("TASK");
		expect(options.map((o) => o.replace("TASK", "").trim())).toEqual(["BACK-1", "BACK-2", "BACK-3", "BACK-4", "BACK-5"]);
	});

	it("moves the selection with ArrowDown and ArrowUp, wrapping around", async () => {
		const container = renderHarness();
		await typeText(container, "Ref BACK-1");
		expect(selectedOption(container)).toContain("BACK-1");

		await pressKey(container, "ArrowDown");
		expect(selectedOption(container)).toContain("BACK-10");
		await pressKey(container, "ArrowDown");
		expect(selectedOption(container)).toContain("BACK-12");
		await pressKey(container, "ArrowDown");
		expect(selectedOption(container)).toContain("BACK-14");
		await pressKey(container, "ArrowDown");
		expect(selectedOption(container)).toContain("BACK-1");
		await pressKey(container, "ArrowUp");
		expect(selectedOption(container)).toContain("BACK-14");
	});

	it("keeps the arrow-key selection across the keyup debounce re-evaluation", async () => {
		const container = renderHarness();
		await typeText(container, "Ref BACK-1");
		expect(selectedOption(container)).toContain("BACK-1");

		await pressKey(container, "ArrowDown");
		expect(selectedOption(container)).toContain("BACK-10");
		await keyUp(container, "ArrowDown");
		await waitOutDebounce();
		expect(selectedOption(container)).toContain("BACK-10");

		await pressKey(container, "ArrowDown");
		await keyUp(container, "ArrowDown");
		await waitOutDebounce();
		expect(selectedOption(container)).toContain("BACK-12");
	});

	it("inserts a space-padded markdown link on Enter and places the caret after it", async () => {
		const changes: string[] = [];
		const container = renderHarness({ onChange: (value) => changes.push(value) });
		await typeText(container, "See BACK-1");
		await pressKey(container, "ArrowDown");
		expect(selectedOption(container)).toContain("BACK-10");

		const event = await pressKey(container, "Enter");
		expect(event.defaultPrevented).toBe(true);
		expect(changes.at(-1)).toBe("See [BACK-10](/task/010) ");
		expect(menuIsOpen(container)).toBe(false);

		const textarea = getTextarea(container);
		expect(textarea.value).toBe("See [BACK-10](/task/010) ");
		expect(textarea.selectionStart).toBe("See [BACK-10](/task/010) ".length);
	});

	it("inserts the directly-selected candidate when it is the only one (no arrow keys needed)", async () => {
		const container = renderHarness();
		await typeText(container, "Ref BACK-0012");

		const options = menuOptions(container);
		expect(options).toHaveLength(1);

		const event = await pressKey(container, "Enter");
		expect(event.defaultPrevented).toBe(true);
		expect(getTextarea(container).value).toBe("Ref [BACK-12](/task/0012) ");
	});

	it("inserts without a leading space at the start of a line", async () => {
		const container = renderHarness();
		await typeText(container, "BACK-14");
		await pressKey(container, "Enter");

		expect(getTextarea(container).value).toBe("[BACK-14](/task/14) ");
	});

	it("refreshes candidates when typing continues and closes the menu on a non-matching token", async () => {
		const container = renderHarness();
		await typeText(container, "Ref BACK-1");
		expect(menuOptions(container)).toHaveLength(4);

		await typeText(container, "Ref BACK-14");
		expect(menuOptions(container)).toHaveLength(1);
		expect(menuOptions(container)[0]).toContain("BACK-14");

		await typeText(container, "Ref BACK-14x");
		expect(menuIsOpen(container)).toBe(false);
	});

	it("closes on Escape and stops intercepting Enter afterwards", async () => {
		const container = renderHarness();
		await typeText(container, "Ref BACK-1");
		expect(menuIsOpen(container)).toBe(true);

		const escape = await pressKey(container, "Escape");
		expect(escape.defaultPrevented).toBe(true);
		expect(menuIsOpen(container)).toBe(false);

		const enter = await pressKey(container, "Enter");
		expect(enter.defaultPrevented).toBe(false);
		expect(getTextarea(container).value).toBe("Ref BACK-1");
	});

	it("Escape keeps the menu closed across the trailing keyup re-evaluation", async () => {
		const container = renderHarness();
		await typeText(container, "Ref BACK-1");
		expect(menuIsOpen(container)).toBe(true);

		await pressKey(container, "Escape");
		await keyUp(container, "Escape");
		await waitOutDebounce();
		expect(menuIsOpen(container)).toBe(false);

		// Typing again re-opens the menu normally.
		await typeText(container, "Ref BACK-12");
		expect(menuIsOpen(container)).toBe(true);
		expect(selectedOption(container)).toContain("BACK-12");
	});

	it("lets non-menu keys through while the menu is open", async () => {
		const container = renderHarness();
		await typeText(container, "Ref BACK-1");
		const event = await pressKey(container, "a");
		expect(event.defaultPrevented).toBe(false);
		expect(menuIsOpen(container)).toBe(true);
	});

	it("does not intercept keys or open the menu during IME composition", async () => {
		const container = renderHarness();
		const textarea = getTextarea(container);

		await act(async () => {
			setTextareaValue(textarea, "Ref BACK-1");
			const composingInput = new window.Event("input", { bubbles: true });
			Object.defineProperty(composingInput, "isComposing", { value: true });
			textarea.dispatchEvent(composingInput);
			await new Promise((resolve) => setTimeout(resolve, 30));
		});
		expect(menuIsOpen(container)).toBe(false);

		await act(async () => {
			textarea.dispatchEvent(new window.Event("compositionend", { bubbles: true }));
			await new Promise((resolve) => setTimeout(resolve, 30));
		});
		expect(menuIsOpen(container)).toBe(true);

		const enter = await pressKey(container, "Enter", { isComposing: true });
		expect(enter.defaultPrevented).toBe(false);
		expect(getTextarea(container).value).toBe("Ref BACK-1");
		expect(menuIsOpen(container)).toBe(true);
	});

	it("suggests wiki paths for space+text tokens and inserts a wiki link on Enter", async () => {
		const container = renderHarness();
		await typeText(container, "See pat");

		const options = menuOptions(container);
		expect(options).toHaveLength(2);
		expect(options[0]).toContain("WIKI");
		expect(options[0]).toContain("patterns/cross-link");

		await typeText(container, "See patterns/cross-s");
		expect(menuOptions(container)).toHaveLength(1);

		const event = await pressKey(container, "Enter");
		expect(event.defaultPrevented).toBe(true);
		expect(getTextarea(container).value).toBe("See [patterns/cross-surface](/wiki/patterns/cross-surface) ");
	});

	it("inserts via mouse click on a candidate", async () => {
		const container = renderHarness();
		await typeText(container, "See BACK-1");
		const option = container.querySelector('[role="option"] button') as HTMLButtonElement;
		expect(option).toBeTruthy();

		await act(async () => {
			option.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
			await Promise.resolve();
		});
		expect(getTextarea(container).value).toBe("See [BACK-1](/task/1) ");
		expect(menuIsOpen(container)).toBe(false);
	});
});

describe("PasteAwareMDEditor integration", () => {
	const hostApi: { set: ((value: string) => void) | null } = { set: null };

	const EditorHost: React.FC<{ onChange: (value: string) => void }> = ({ onChange }) => {
		const [value, setValue] = React.useState("");
		hostApi.set = setValue;
		return (
			<PasteAwareMDEditor
				value={value}
				onChange={(next) => {
					setValue(next ?? "");
					onChange(next ?? "");
				}}
				preview="edit"
				height={200}
			/>
		);
	};

	const renderEditor = (onChange: (value: string) => void): HTMLElement => {
		captureOriginalGlobals();
		setupDom();
		globalThis.fetch = (async (_input: RequestInfo | URL) => ({
			ok: true,
			status: 200,
			statusText: "OK",
			json: async () => ({ projectName: "T", statuses: ["To Do"], labels: [], dateFormat: "yyyy-mm-dd" }),
		}) as Response) as typeof fetch;
		const container = document.getElementById("root");
		expect(container).toBeTruthy();
		activeRoot = createRoot(container as HTMLElement);
		act(() => {
			activeRoot?.render(
				<I18nProvider initialLocale="en">
					<TaskIdIndexProvider tasks={taskFixtures("BACK-1", "BACK-10")}>
						<EditorHost onChange={onChange} />
					</TaskIdIndexProvider>
				</I18nProvider>,
			);
		});
		return container as HTMLElement;
	};

	const typeInEditor = async (container: HTMLElement, value: string) => {
		const textarea = container.querySelector("textarea.w-md-editor-text-input") as HTMLTextAreaElement;
		expect(textarea).toBeTruthy();
		await act(async () => {
			textarea.focus();
			textarea.value = value;
			textarea.setSelectionRange(value.length, value.length);
			textarea.dispatchEvent(new window.Event("input", { bubbles: true }));
			// Mirror typed text into host state the way MDEditor's own onChange
			// would, so re-renders keep the text (React's synthetic onChange is
			// inert under jsdom's legacy event polyfill).
			hostApi.set?.(value);
			// PasteAwareMDEditor uses the spec'd 200 ms debounce.
			await new Promise((resolve) => setTimeout(resolve, 250));
		});
	};

	it("autocompletes entity IDs in the MDEditor textarea and inserts a link", async () => {
		const changes: string[] = [];
		const container = renderEditor((value) => changes.push(value));

		await typeInEditor(container, "Ref BACK-1");
		expect(menuIsOpen(container)).toBe(true);
		expect(menuOptions(container)[0]).toContain("BACK-1");

		const event = new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
		await act(async () => {
			const textarea = container.querySelector("textarea.w-md-editor-text-input") as HTMLTextAreaElement;
			textarea.dispatchEvent(event);
			await Promise.resolve();
		});
		expect(event.defaultPrevented).toBe(true);
		expect(changes.at(-1)).toBe("Ref [BACK-1](/task/1) ");
	});
});
