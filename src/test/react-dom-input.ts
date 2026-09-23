/**
 * Set a controlled input's value the way a real keystroke does: through the native value setter
 * (React overrides the prototype setter to track changes) followed by an input event.
 */
export function setNativeInputValue(input: HTMLInputElement, value: string): void {
	const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
	if (!valueSetter) {
		throw new Error("HTMLInputElement.prototype.value setter not found");
	}
	valueSetter.call(input, value);
	input.dispatchEvent(new window.Event("input", { bubbles: true }));
}
