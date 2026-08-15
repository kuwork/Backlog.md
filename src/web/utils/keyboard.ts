interface TypableElement {
	tagName: string;
	isContentEditable: boolean;
}

/**
 * Determine whether a keyboard event originated while the user is typing
 * into a text-input element (input, textarea, select, or contenteditable).
 * Uses closest() so nested descendants of content-editable elements count.
 */
export function isTypingTarget(event: KeyboardEvent): boolean {
	const target = event.target as unknown;
	if (!target || typeof target !== "object") return false;

	const el = target as TypableElement;
	const tag = typeof el.tagName === "string" ? el.tagName.toUpperCase() : "";

	if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
		return true;
	}

	// contenteditable is inherited by descendants, which jsdom does not expose
	// via isContentEditable; walk ancestors via closest when available.
	const element = target as Element;
	if (typeof element.closest === "function") {
		return element.closest('[contenteditable="true"], [contenteditable=""]') !== null;
	}

	return el.isContentEditable === true;
}
