import { useCallback, useEffect, useRef, useState } from "react";
import { useTaskIdIndex } from "../contexts/TaskIdIndexContext";
import {
	type EntityIndex,
	type EntityKind,
	entityHref,
	queryEntityPrefix,
	queryWikiPathPrefix,
	resolveEntityReference,
} from "../utils/task-id-links";

/** Debounce between the last keystroke and the candidate lookup. */
export const ENTITY_AUTOCOMPLETE_DEBOUNCE_MS = 200;
/** Per-entity-kind cap when querying the canonical index. */
const PER_KIND_LIMIT = 5;
/** Total candidates shown in the insert-link menu. */
const MAX_CANDIDATES = 5;
/** Display order of entity kinds in the merged candidate list. */
const KIND_ORDER: readonly EntityKind[] = ["task", "doc", "decision", "draft"];

export type AutocompleteCandidateKind = EntityKind | "wiki";

export interface AutocompleteCandidate {
	type: "entity" | "wiki";
	kind: AutocompleteCandidateKind;
	/** Canonical entity ID or wiki page path; doubles as the inserted link text. */
	id: string;
	href: string;
}

/**
 * Merge per-kind prefix queries into the menu candidate list: sorted by
 * (entity kind, ID ascending), capped at MAX_CANDIDATES overall. Tokens that
 * contain "/" (or match no entity ID) fall back to wiki path prefix matching.
 * Read-only over the in-memory index; never touches list APIs.
 */
export function computeAutocompleteCandidates(index: EntityIndex, token: string): AutocompleteCandidate[] {
	const prefix = token.trim();
	if (!prefix) return [];
	const candidates: AutocompleteCandidate[] = [];
	if (!prefix.includes("/")) {
		for (const kind of KIND_ORDER) {
			for (const id of queryEntityPrefix(index, kind, prefix, PER_KIND_LIMIT)) {
				// Href uses the entity's stored ID (zero-padding preserved); the
				// canonical key stays as the displayed link text.
				const storedId = resolveEntityReference(index, kind, id)?.id ?? id;
				candidates.push({ type: "entity", kind, id, href: entityHref(kind, storedId) });
			}
		}
	}
	if (candidates.length === 0) {
		for (const path of queryWikiPathPrefix(index.wikiPaths, prefix, PER_KIND_LIMIT)) {
			candidates.push({ type: "wiki", kind: "wiki", id: path, href: `/wiki/${path}` });
		}
	}
	return candidates.slice(0, MAX_CANDIDATES);
}

/** Token immediately before the caret, bounded on the left by whitespace or line start. */
export interface TokenBeforeCaret {
	token: string;
	start: number;
}

export function extractTokenBeforeCaret(value: string, caret: number): TokenBeforeCaret | null {
	let start = caret;
	while (start > 0 && !/\s/.test(value.charAt(start - 1))) start -= 1;
	if (start === caret) return null;
	return { token: value.slice(start, caret), start };
}

interface CandidateCache {
	index: EntityIndex | null;
	entries: Map<string, AutocompleteCandidate[]>;
}

export function createCandidateCache(): CandidateCache {
	return { index: null, entries: new Map() };
}

/**
 * Candidate lookup with whole-cache negative caching: both hits and misses are
 * remembered per candidate token, so key presses and debounce ticks never
 * re-check the same token. The cache is bound to the index object identity —
 * a corpus update (new index reference) invalidates everything at once.
 */
export function queryCandidatesCached(
	cache: CandidateCache,
	index: EntityIndex,
	token: string,
	compute: (index: EntityIndex, token: string) => AutocompleteCandidate[] = computeAutocompleteCandidates,
): AutocompleteCandidate[] {
	if (cache.index !== index) {
		cache.index = index;
		cache.entries.clear();
	}
	const key = token.trim();
	if (!key) return [];
	const cached = cache.entries.get(key);
	if (cached) return cached;
	const result = compute(index, token);
	cache.entries.set(key, result);
	return result;
}

/** Caret offset relative to the textarea's top-left border box. */
export interface EntityAutocompleteCaret {
	top: number;
	left: number;
	height: number;
}

const MIRROR_STYLE_PROPS = [
	"boxSizing",
	"paddingTop",
	"paddingRight",
	"paddingBottom",
	"paddingLeft",
	"borderTopWidth",
	"borderRightWidth",
	"borderBottomWidth",
	"borderLeftWidth",
	"fontFamily",
	"fontSize",
	"fontStyle",
	"fontWeight",
	"fontVariant",
	"letterSpacing",
	"lineHeight",
	"textIndent",
	"textTransform",
	"wordSpacing",
	"tabSize",
] as const;

function toPixelValue(value: string | undefined): number {
	const parsed = Number.parseInt(value ?? "", 10);
	return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Caret coordinates inside a textarea via a mirrored off-screen div (works for
 * plain textareas and @uiw/react-md-editor's textarea). Degrades to zeros in
 * environments without layout (tests), where only presence of the menu matters.
 */
export function getTextareaCaretCoordinates(textarea: HTMLTextAreaElement, position: number): EntityAutocompleteCaret {
	const doc = textarea.ownerDocument;
	const win = doc.defaultView;
	const computed = win?.getComputedStyle(textarea);
	const mirror = doc.createElement("div");
	for (const prop of MIRROR_STYLE_PROPS) {
		mirror.style.setProperty(
			prop.replace(/[A-Z]/g, (ch) => `-${ch.toLowerCase()}`),
			computed?.getPropertyValue(prop) ?? "",
		);
	}
	mirror.style.setProperty("white-space", "pre-wrap");
	mirror.style.setProperty("word-wrap", "break-word");
	mirror.style.setProperty("position", "absolute");
	mirror.style.setProperty("visibility", "hidden");
	mirror.style.setProperty("top", "-9999px");
	mirror.style.setProperty("left", "-9999px");
	mirror.style.setProperty("width", `${textarea.clientWidth}px`);
	mirror.textContent = textarea.value.substring(0, position);
	const marker = doc.createElement("span");
	marker.textContent = "​";
	mirror.appendChild(marker);
	doc.body.appendChild(mirror);
	const top =
		marker.offsetTop - textarea.scrollTop + toPixelValue(computed?.borderTopWidth) + toPixelValue(computed?.paddingTop);
	const left =
		marker.offsetLeft -
		textarea.scrollLeft +
		toPixelValue(computed?.borderLeftWidth) +
		toPixelValue(computed?.paddingLeft);
	const height = marker.offsetHeight > 0 ? marker.offsetHeight : toPixelValue(computed?.lineHeight);
	doc.body.removeChild(mirror);
	return { top, left, height };
}

export interface EntityAutocompleteMenuState {
	candidates: AutocompleteCandidate[];
	selectedIndex: number;
	caret: EntityAutocompleteCaret | null;
}

export interface UseEntityAutocompleteOptions {
	/** The bound textarea element; works for plain textareas and MDEditor's inner textarea. */
	textarea: HTMLTextAreaElement | null;
	value: string;
	onChange?: (value: string) => void;
	/** Override the entity index; defaults to the TaskIdIndex context. */
	index?: EntityIndex;
	/** Test hook; defaults to the spec'd 200 ms debounce. */
	debounceMs?: number;
}

export interface UseEntityAutocompleteResult {
	/** Menu state, or null when the menu is closed. */
	menu: EntityAutocompleteMenuState | null;
	/** Insert the candidate's markdown link at the caret, replacing the token before it. */
	insertCandidate: (candidate: AutocompleteCandidate) => void;
}

/**
 * Input-side "insert link" hint for markdown textareas. After the user pauses
 * typing, the whitespace/line-start bounded token before the caret is matched
 * (zero-padding aware) against the shared canonical entity index and, when no
 * entity ID matches, against the wiki path corpus. While the menu is open,
 * Enter/ArrowUp/ArrowDown/Escape are intercepted at the textarea in the capture
 * phase (so library key handlers never see them); everything else passes
 * through. IME composition events neither open the menu nor get intercepted.
 */
export function useEntityAutocomplete({
	textarea,
	onChange,
	index,
	debounceMs = ENTITY_AUTOCOMPLETE_DEBOUNCE_MS,
}: UseEntityAutocompleteOptions): UseEntityAutocompleteResult {
	const contextIndex = useTaskIdIndex();
	const entityIndex = index ?? contextIndex;
	const [menu, setMenu] = useState<EntityAutocompleteMenuState | null>(null);
	const menuRef = useRef<EntityAutocompleteMenuState | null>(null);
	const textareaRef = useRef<HTMLTextAreaElement | null>(null);
	const cacheRef = useRef<CandidateCache>(createCandidateCache());
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const escapeRef = useRef(false);
	const onChangeRef = useRef(onChange);
	const indexRef = useRef(entityIndex);
	const debounceRef = useRef(debounceMs);

	textareaRef.current = textarea;
	onChangeRef.current = onChange;
	indexRef.current = entityIndex;
	debounceRef.current = debounceMs;

	const updateMenu = useCallback((next: EntityAutocompleteMenuState | null) => {
		menuRef.current = next;
		setMenu(next);
	}, []);

	// The corpus changed: rebind the cache to the new index and drop any stale open menu.
	useEffect(() => {
		cacheRef.current = createCandidateCache();
		cacheRef.current.index = entityIndex;
		updateMenu(null);
	}, [entityIndex, updateMenu]);

	const insertCandidate = useCallback(
		(candidate: AutocompleteCandidate) => {
			const el = textareaRef.current;
			const change = onChangeRef.current;
			updateMenu(null);
			if (!el || !change) return;
			const caret = el.selectionStart ?? el.value.length;
			const tokenInfo = extractTokenBeforeCaret(el.value, caret);
			const tokenStart = tokenInfo ? tokenInfo.start : caret;
			// The token's left boundary (whitespace or line start) stays in place,
			// so the inserted link is always separated from preceding text; the
			// trailing space is forced and the caret lands right after it.
			const linkText = `[${candidate.id}](${candidate.href}) `;
			change(el.value.slice(0, tokenStart) + linkText + el.value.slice(caret));
			const nextCaret = tokenStart + linkText.length;
			el.focus();
			el.setSelectionRange(nextCaret, nextCaret);
			const raf = el.ownerDocument.defaultView?.requestAnimationFrame ?? ((cb: () => void) => setTimeout(cb, 0));
			raf(() => {
				el.setSelectionRange(nextCaret, nextCaret);
			});
		},
		[updateMenu],
	);

	const insertRef = useRef(insertCandidate);
	insertRef.current = insertCandidate;

	useEffect(() => {
		if (!textarea) return undefined;

		const evaluate = () => {
			const caretPos = textarea.selectionStart ?? 0;
			const tokenInfo = extractTokenBeforeCaret(textarea.value, caretPos);
			if (!tokenInfo) {
				updateMenu(null);
				return;
			}
			const candidates = queryCandidatesCached(cacheRef.current, indexRef.current, tokenInfo.token);
			if (candidates.length === 0) {
				updateMenu(null);
				return;
			}
			// Same token re-evaluation (debounce/keyup after navigation keys): the
			// cache returns the identical array, so keep the user's selection
			// instead of snapping back to the first candidate.
			const previous = menuRef.current;
			const selectedIndex =
				previous && previous.candidates === candidates ? Math.min(previous.selectedIndex, candidates.length - 1) : 0;
			updateMenu({
				candidates,
				selectedIndex,
				caret: getTextareaCaretCoordinates(textarea, caretPos),
			});
		};

		const schedule = () => {
			if (escapeRef.current) return;
			if (timerRef.current) clearTimeout(timerRef.current);
			timerRef.current = setTimeout(() => {
				timerRef.current = null;
				evaluate();
			}, debounceRef.current);
		};

		const onInput = (event: Event) => {
			if ((event as InputEvent).isComposing) return;
			escapeRef.current = false;
			schedule();
		};
		const onKeyUp = () => schedule();
		const onClick = () => {
			escapeRef.current = false;
			schedule();
		};
		const onBlur = () => updateMenu(null);
		const onCompositionEnd = () => {
			escapeRef.current = false;
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
					updateMenu({
						...current,
						selectedIndex: (current.selectedIndex + 1) % current.candidates.length,
					});
					break;
				case "ArrowUp":
					event.preventDefault();
					event.stopPropagation();
					updateMenu({
						...current,
						selectedIndex: (current.selectedIndex - 1 + current.candidates.length) % current.candidates.length,
					});
					break;
				case "Enter": {
					event.preventDefault();
					event.stopPropagation();
					const candidate = current.candidates[current.selectedIndex];
					if (candidate) {
						insertRef.current(candidate);
					}
					break;
				}
				case "Escape":
					event.preventDefault();
					event.stopPropagation();
					// Swallow the trailing keyup's re-evaluation so the menu stays
					// closed; the next real input/click clears the flag.
					escapeRef.current = true;
					updateMenu(null);
					break;
				default:
					break;
			}
		};

		// Capture phase on the element itself runs before React's root-level
		// delegated handlers, so MDEditor's own key handling never fires while
		// the menu is open.
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

	return { menu, insertCandidate };
}
