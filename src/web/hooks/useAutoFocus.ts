import { useEffect, useRef } from "react";

/**
 * Focus an element when it mounts, without the `autoFocus` attribute.
 * Mount-time focus is what the UI wants; the attribute is what hurts
 * accessibility, because it moves focus before screen readers announce
 * the surrounding context.
 */
export function useAutoFocus<T extends HTMLElement>() {
	const ref = useRef<T>(null);
	useEffect(() => {
		ref.current?.focus();
	}, []);
	return ref;
}
