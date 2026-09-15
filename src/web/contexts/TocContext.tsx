import {
	createContext,
	type ReactNode,
	type RefObject,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import { useTocItems } from "../hooks/useToc";
import type { TocItem } from "../utils/toc";

/**
 * The active read-only page publishes its rendered headings here so the header
 * outline button can show them. Registration is a single slot: only one reading
 * page is mounted at a time, and the last one to mount owns the slot.
 */
interface TocRegistration {
	items: TocItem[];
	containerRef: RefObject<HTMLElement | null> | null;
}

interface TocContextValue {
	registration: TocRegistration;
	register: (registration: TocRegistration) => void;
	unregister: (containerRef: RefObject<HTMLElement | null>) => void;
}

const NO_REGISTRATION: TocRegistration = { items: [], containerRef: null };

const TocContext = createContext<TocContextValue | null>(null);

export function TocProvider({ children }: { children: ReactNode }) {
	const [registration, setRegistration] = useState<TocRegistration>(NO_REGISTRATION);

	const register = useCallback((next: TocRegistration) => {
		setRegistration((previous) =>
			previous.items === next.items && previous.containerRef === next.containerRef ? previous : next,
		);
	}, []);

	// Only the page that currently owns the slot may clear it: the replacing page
	// mounts before the unmounting one cleans up.
	const unregister = useCallback((containerRef: RefObject<HTMLElement | null>) => {
		setRegistration((previous) => (previous.containerRef === containerRef ? NO_REGISTRATION : previous));
	}, []);

	const value = useMemo(() => ({ registration, register, unregister }), [registration, register, unregister]);

	return <TocContext.Provider value={value}>{children}</TocContext.Provider>;
}

export function useTocRegistry(): TocContextValue {
	const context = useContext(TocContext);
	if (!context) throw new Error("useTocRegistry must be used inside a TocProvider");
	return context;
}

/**
 * Publish the headings of a read-only page to the header outline. Pass a null
 * `contentKey` while editing so the outline empties out with the preview.
 */
export function usePageToc(containerRef: RefObject<HTMLElement | null>, contentKey?: unknown): void {
	const items = useTocItems(containerRef, contentKey);
	const { register, unregister } = useTocRegistry();

	useEffect(() => {
		register({ items, containerRef });
		return () => unregister(containerRef);
	}, [items, containerRef, register, unregister]);
}
