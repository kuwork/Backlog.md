import { useLayoutEffect, useRef, useState } from "react";
import type { EntityAutocompleteCaret } from "./useEntityAutocomplete";

export interface CaretPopupPosition {
	top: number;
	left: number;
}

export interface UseCaretPopupPositionResult {
	/** Attach to the popup element; its offset parent is the positioning anchor. */
	listRef: React.RefObject<HTMLDivElement | null>;
	/** Offset inside the anchor, or null until layout has run (tests have no layout). */
	position: CaretPopupPosition | null;
}

/**
 * Where to park a caret-anchored popup, in coordinates relative to its offset parent. Shared by
 * every autocomplete popup so they all follow the caret the same way for plain textareas and
 * @uiw/react-md-editor's inner textarea alike.
 */
export function useCaretPopupPosition(
	caret: EntityAutocompleteCaret | null,
	textarea: HTMLTextAreaElement | null,
): UseCaretPopupPositionResult {
	const listRef = useRef<HTMLDivElement | null>(null);
	const [position, setPosition] = useState<CaretPopupPosition | null>(null);

	useLayoutEffect(() => {
		const list = listRef.current;
		const anchor = list?.offsetParent as HTMLElement | null;
		if (!list || !anchor || typeof anchor.getBoundingClientRect !== "function" || !textarea || !caret) {
			setPosition(null);
			return;
		}
		const anchorRect = anchor.getBoundingClientRect();
		const textareaRect = textarea.getBoundingClientRect();
		setPosition({
			top: textareaRect.top - anchorRect.top + caret.top + caret.height,
			left: textareaRect.left - anchorRect.left + caret.left,
		});
	}, [caret, textarea]);

	return { listRef, position };
}
