import { useCallback, useEffect, useRef, useState } from "react";
import { type EntityAutocompleteCaret, getTextareaCaretCoordinates } from "./useEntityAutocomplete";

/** Shorter than the entity lookup: topic candidates come from a list already in memory. */
export const TOPIC_AUTOCOMPLETE_DEBOUNCE_MS = 120;
/** Cap on the rows the topic menu shows. */
const MAX_TOPIC_CANDIDATES = 6;

/** An unclosed `#topic` run sitting immediately before the caret. */
export interface OpenTopic {
	/** Offset of the opening `#` within the value. */
	hashIndex: number;
	/** What has been typed inside the topic so far; empty right after the `#`. */
	token: string;
}

/**
 * The unclosed topic at the caret, or null when the caret is not inside one.
 *
 * The text left of the caret is walked once, tracking a single open run: a `#` opens a run (and a
 * second `#`, once something has been typed, closes it again), and whitespace ends any run - which
 * is exactly why `# Heading` is a heading and not a topic. A run is only "open" when the caret is
 * still inside it, so a fully typed `#topic#` reports null.
 */
export function findOpenTopicAtCaret(value: string, caret: number): OpenTopic | null {
	const before = value.slice(0, caret);
	let open: OpenTopic | null = null;
	for (let i = 0; i < before.length; i += 1) {
		const char = before[i] ?? "";
		if (char === "#") {
			// The second hash closes the run, but only once it holds text - `##` is not a topic.
			open = open && open.token.length > 0 ? null : { hashIndex: i, token: "" };
			continue;
		}
		if (/\s/.test(char)) {
			open = null;
			continue;
		}
		if (open) open.token += char;
	}
	return open;
}

/** Suggestions matching what has been typed: prefix hits first, then substring hits. */
export function filterTopicSuggestions(
	suggestions: string[],
	token: string,
	limit: number = MAX_TOPIC_CANDIDATES,
): string[] {
	const needle = token.trim().toLowerCase();
	if (!needle) return suggestions.slice(0, limit);
	const prefix: string[] = [];
	const substring: string[] = [];
	for (const item of suggestions) {
		const lower = item.toLowerCase();
		if (lower.startsWith(needle)) prefix.push(item);
		else if (lower.includes(needle)) substring.push(item);
	}
	return [...prefix, ...substring].slice(0, limit);
}

export interface TopicCandidate {
	/** The topic text, without the wrapping hashes. */
	topic: string;
	/** True when the vocabulary does not hold it yet - picking it is what creates it. */
	isNew: boolean;
}

/**
 * Candidates for the run under the caret: the matching known topics first, then - once something
 * has been typed that no known topic equals - the typed text itself as a "create" row.
 *
 * The create row is what makes a first-time topic completable: with an empty vocabulary there is
 * nothing to match, so without it typing a brand new topic would raise no menu at all and the user
 * would have to type both hashes by hand.
 */
export function buildTopicCandidates(
	suggestions: string[],
	token: string,
	limit: number = MAX_TOPIC_CANDIDATES,
): TopicCandidate[] {
	const matches = filterTopicSuggestions(suggestions, token, limit).map((topic) => ({
		topic,
		isNew: false,
	}));
	const typed = token.trim();
	// Nothing typed yet: offer the vocabulary only, there is no new topic to create.
	if (!typed) return matches;
	const alreadyKnown = suggestions.some((item) => item.toLowerCase() === typed.toLowerCase());
	if (alreadyKnown) return matches;
	return [...matches, { topic: typed, isNew: true }];
}

export interface TopicAutocompleteMenuState {
	/** Topics offered for the run under the caret. */
	candidates: TopicCandidate[];
	selectedIndex: number;
	caret: EntityAutocompleteCaret | null;
}

export interface UseTopicAutocompleteOptions {
	/** The bound textarea; works for plain textareas and MDEditor's inner textarea. */
	textarea: HTMLTextAreaElement | null;
	value: string;
	onChange?: (value: string) => void;
	/** Topics already in use; the menu is only offered when one of them matches. */
	suggestions?: string[];
	debounceMs?: number;
}

export interface UseTopicAutocompleteResult {
	menu: TopicAutocompleteMenuState | null;
	/** Replace the open run with a closed `#topic#` and put the caret after it. */
	selectCandidate: (topic: string) => void;
}

/**
 * Weibo-style topic input for markdown textareas. Typing `#` opens a run; while the caret sits in
 * an unclosed run the menu offers topics already in use that match what has been typed, plus - once
 * the typed text matches nothing - the typed text itself as a row that creates the topic. So a
 * topic being used for the very first time is still completable, and Enter/Tab/click insert it
 * **closed** (`#topic#`), which is the whole point - a topic only counts once a hash closes it.
 *
 * Nothing is auto-closed on Space or blur on purpose: a bare `PR #268` left mid-sentence must stay
 * plain text, and silently appending a hash there would resurrect the very mis-read the closed
 * syntax exists to prevent. Space, Escape and blur only dismiss the menu. The menu does offer
 * `#268#` as a new topic while the caret sits in that run, but only an explicit Enter/Tab/click
 * turns it into one - typing on never rewrites the reference.
 *
 * While the menu is open, Arrow/Enter/Tab/Escape are intercepted at the textarea in the capture
 * phase so the editor's own key handling never sees them; IME composition is left alone.
 */
export function useTopicAutocomplete({
	textarea,
	onChange,
	suggestions,
	debounceMs = TOPIC_AUTOCOMPLETE_DEBOUNCE_MS,
}: UseTopicAutocompleteOptions): UseTopicAutocompleteResult {
	const [menu, setMenu] = useState<TopicAutocompleteMenuState | null>(null);
	const menuRef = useRef<TopicAutocompleteMenuState | null>(null);
	const textareaRef = useRef<HTMLTextAreaElement | null>(null);
	const onChangeRef = useRef(onChange);
	const suggestionsRef = useRef(suggestions);
	const debounceRef = useRef(debounceMs);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const dismissedRef = useRef(false);

	textareaRef.current = textarea;
	onChangeRef.current = onChange;
	suggestionsRef.current = suggestions;
	debounceRef.current = debounceMs;

	const updateMenu = useCallback((next: TopicAutocompleteMenuState | null) => {
		menuRef.current = next;
		setMenu(next);
	}, []);

	/** Replace `[start, end)` with `text` and park the caret `caretOffset` characters into it. */
	const replaceRange = useCallback(
		(start: number, end: number, text: string, caretOffset: number) => {
			const el = textareaRef.current;
			const change = onChangeRef.current;
			updateMenu(null);
			if (!el || !change) return;
			change(el.value.slice(0, start) + text + el.value.slice(end));
			const next = start + caretOffset;
			el.focus();
			el.setSelectionRange(next, next);
			const raf = el.ownerDocument.defaultView?.requestAnimationFrame ?? ((cb: () => void) => setTimeout(cb, 0));
			raf(() => el.setSelectionRange(next, next));
		},
		[updateMenu],
	);

	/**
	 * Close the open run as `#topic#`. The trailing space is forced so the caret lands back in
	 * prose; a topic always arrives closed, so it needs no follow-up keystroke.
	 */
	const selectCandidate = useCallback(
		(topic: string) => {
			const el = textareaRef.current;
			if (!el) return;
			const caret = el.selectionStart ?? el.value.length;
			const open = findOpenTopicAtCaret(el.value, caret);
			if (!open) return;
			const closed = `#${topic}# `;
			replaceRange(open.hashIndex, caret, closed, closed.length);
		},
		[replaceRange],
	);

	const selectRef = useRef(selectCandidate);
	selectRef.current = selectCandidate;

	useEffect(() => {
		if (!textarea) return undefined;

		const evaluate = () => {
			const caret = textarea.selectionStart ?? 0;
			const open = findOpenTopicAtCaret(textarea.value, caret);
			if (!open) {
				updateMenu(null);
				return;
			}
			const candidates = buildTopicCandidates(suggestionsRef.current ?? [], open.token);
			// A bare `#` with nothing in the vocabulary has no row to show, so no panel.
			if (candidates.length === 0) {
				updateMenu(null);
				return;
			}
			const previous = menuRef.current;
			const selectedIndex =
				previous && previous.candidates === candidates ? Math.min(previous.selectedIndex, candidates.length - 1) : 0;
			updateMenu({ candidates, selectedIndex, caret: getTextareaCaretCoordinates(textarea, caret) });
		};

		const schedule = () => {
			if (dismissedRef.current) return;
			if (timerRef.current) clearTimeout(timerRef.current);
			timerRef.current = setTimeout(() => {
				timerRef.current = null;
				evaluate();
			}, debounceRef.current);
		};

		const onInput = (event: Event) => {
			if ((event as InputEvent).isComposing) return;
			dismissedRef.current = false;
			schedule();
		};
		const onKeyUp = () => schedule();
		const onClick = () => {
			dismissedRef.current = false;
			schedule();
		};
		const onBlur = () => updateMenu(null);
		const onCompositionEnd = () => {
			dismissedRef.current = false;
			schedule();
		};

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.isComposing) return;
			const current = menuRef.current;
			if (!current || current.candidates.length === 0) return;
			switch (event.key) {
				case "ArrowDown":
					event.preventDefault();
					event.stopPropagation();
					updateMenu({ ...current, selectedIndex: (current.selectedIndex + 1) % current.candidates.length });
					break;
				case "ArrowUp":
					event.preventDefault();
					event.stopPropagation();
					updateMenu({
						...current,
						selectedIndex: (current.selectedIndex - 1 + current.candidates.length) % current.candidates.length,
					});
					break;
				case "Enter":
				case "Tab": {
					const candidate = current.candidates[current.selectedIndex];
					if (!candidate) return;
					event.preventDefault();
					event.stopPropagation();
					selectRef.current(candidate.topic);
					break;
				}
				case "Escape":
					event.preventDefault();
					event.stopPropagation();
					// Swallow the trailing keyup re-evaluation so the menu stays closed.
					dismissedRef.current = true;
					updateMenu(null);
					break;
				default:
					break;
			}
		};

		textarea.addEventListener("keydown", onKeyDown, { capture: true });
		textarea.addEventListener("input", onInput);
		textarea.addEventListener("keyup", onKeyUp);
		textarea.addEventListener("click", onClick);
		textarea.addEventListener("blur", onBlur);
		textarea.addEventListener("compositionend", onCompositionEnd);
		return () => {
			if (timerRef.current) clearTimeout(timerRef.current);
			textarea.removeEventListener("keydown", onKeyDown, { capture: true });
			textarea.removeEventListener("input", onInput);
			textarea.removeEventListener("keyup", onKeyUp);
			textarea.removeEventListener("click", onClick);
			textarea.removeEventListener("blur", onBlur);
			textarea.removeEventListener("compositionend", onCompositionEnd);
		};
	}, [textarea, updateMenu]);

	return { menu, selectCandidate };
}
