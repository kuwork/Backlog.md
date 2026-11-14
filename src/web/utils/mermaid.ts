// Type definitions for Mermaid API
interface MermaidAPI {
	initialize: (config: MermaidConfig) => void;
	render: (id: string, text: string) => Promise<MermaidRenderResult>;
}

interface MermaidConfig {
	startOnLoad?: boolean;
	securityLevel?: "strict" | "loose" | "antiscript" | "sandbox";
	theme?: "base" | "default" | "dark" | "forest" | "neutral" | "null";
	logLevel?: number;
	[key: string]: unknown;
}

interface MermaidRenderResult {
	svg: string;
	bindFunctions?: (element: HTMLElement) => void;
}

interface MermaidModule {
	default: MermaidAPI;
}

type MermaidGlobal = typeof globalThis & {
	__MERMAID_MOCK__?: MermaidModule;
};

/** App color mode. Mermaid diagrams are rendered with a matching built-in theme. */
export type MermaidMode = "light" | "dark";

const MERMAID_THEME_BY_MODE: Record<MermaidMode, MermaidConfig["theme"]> = {
	light: "default",
	dark: "dark",
};

/**
 * `treeView-beta` is an experimental Mermaid diagram whose palette is hardcoded
 * to black in its own stylesheet — it ignores the active Mermaid theme. Its
 * stylesheet reads the palette from `themeVariables.treeView` (not the top-level
 * `treeView` config, which only controls layout), so override it there to keep
 * the tree readable on a dark surface instead of rendering black-on-dark.
 */
const DARK_TREE_VIEW_COLORS = {
	labelColor: "#e6edf3",
	lineColor: "#c9d1d9",
	iconColor: "#9198a1",
	descriptionColor: "#7ee787",
};

export interface RenderMermaidOptions {
	/** Color mode of the host UI. Defaults to `light`. */
	mode?: MermaidMode;
}

let mermaidModule: MermaidModule | null = null;
let mockedModule: MermaidModule | null = null;
let initializedMode: MermaidMode | null = null;

export async function ensureMermaid(): Promise<MermaidModule> {
	const mock = (globalThis as MermaidGlobal).__MERMAID_MOCK__;
	if (mock) {
		// Reset cached initialization whenever a different mock shows up so that
		// each one can configure itself.
		if (mockedModule !== mock) {
			mockedModule = mock;
			initializedMode = null;
		}
		return mock;
	}

	if (mermaidModule) return mermaidModule;

	// Import Mermaid's prebuilt browser bundle so the single-file CLI build
	// keeps Mermaid embedded without traversing the parser dependency graph.
	mermaidModule = (await import("mermaid/dist/mermaid.esm.mjs")) as unknown as MermaidModule;
	return mermaidModule;
}

async function initializeMermaid(mermaid: MermaidAPI, mode: MermaidMode): Promise<void> {
	// Mermaid stores its configuration globally, so a different color mode needs a
	// fresh initialize() call instead of a per-render option.
	if (initializedMode === mode) {
		return;
	}

	// Initialize with secure settings
	// Use 'strict' for production to prevent XSS attacks
	mermaid.initialize({
		startOnLoad: false,
		securityLevel: "strict",
		theme: MERMAID_THEME_BY_MODE[mode],
		...(mode === "dark" ? { themeVariables: { treeView: DARK_TREE_VIEW_COLORS } } : {}),
	});

	initializedMode = mode;
}

const MERMAID_LANGUAGE_CLASS = "language-mermaid";

/**
 * Whether a code block's class list marks it as a mermaid diagram. The fence info
 * string is carried over verbatim (` ```Mermaid ` becomes `language-Mermaid`) and
 * class selectors are case-sensitive, so compare case-insensitively.
 */
export function hasMermaidLanguageClass(className: string | string[] | null | undefined): boolean {
	const names = Array.isArray(className) ? className : typeof className === "string" ? className.split(/\s+/) : [];
	return names.some((name) => name.toLowerCase() === MERMAID_LANGUAGE_CLASS);
}

function isMermaidCodeBlock(node: Element): boolean {
	return hasMermaidLanguageClass(Array.from(node.classList));
}

/**
 * Each container keeps the generation of its newest render. A theme switch
 * re-renders every diagram at once, but React's effect cleanup cannot cancel a
 * render already in flight; without this guard the older render can finish last
 * and overwrite the newer SVG.
 */
const renderGeneration = new WeakMap<HTMLElement, number>();
let nextGeneration = 0;
let diagramCounter = 0;

/**
 * Renders one diagram into an already attached container. `render()` takes the
 * source as a string, unlike `run()` which reads `element.innerHTML` — that
 * matters when two renders overlap on one container, because `run()` would
 * parse the previous SVG as diagram source.
 */
async function renderDiagram(
	m: MermaidModule,
	wrapper: HTMLElement,
	diagramText: string,
	isCurrent: () => boolean = () => true,
): Promise<void> {
	try {
		if (!m?.default?.render) {
			console.warn("mermaid: no compatible render method found");
			return;
		}
		// Mermaid derives SVG ids and temporary DOM ids from this. A gallery can
		// render dozens of diagrams in the same tick, so the id must be unique.
		const id = `backlog-mermaid-${++diagramCounter}-${Math.random().toString(36).slice(2, 7)}`;
		const result = await m.default.render(id, diagramText);
		if (!isCurrent()) return;
		wrapper.innerHTML = result.svg;
		result.bindFunctions?.(wrapper);
	} catch (err) {
		console.warn("mermaid render failed", err);
		// Keep the previous SVG on a failed re-render; on a first render there is
		// nothing to keep, so surface the source instead of an empty box.
		if (isCurrent() && !wrapper.firstChild) {
			wrapper.textContent = diagramText;
		}
	}
}

/**
 * Renders one diagram into a container owned by the caller. Unlike
 * {@link renderMermaidIn} the container is not replaced, which keeps it safe to
 * call from a React effect on an element React owns.
 *
 * The previous SVG stays until the new one is ready. Clearing the container
 * first made a whole gallery collapse and jump while a theme switch re-rendered
 * its diagrams one by one.
 */
export async function renderMermaidDiagram(
	container: HTMLElement,
	diagramText: string,
	options: RenderMermaidOptions = {},
): Promise<void> {
	if (!diagramText.trim()) {
		return;
	}

	const mode = options.mode ?? "light";
	const generation = ++nextGeneration;
	renderGeneration.set(container, generation);
	const isCurrent = () => renderGeneration.get(container) === generation;

	try {
		const m = await ensureMermaid();
		if (!isCurrent()) return;
		await initializeMermaid(m.default, mode);
		if (!isCurrent()) return;

		container.classList.add("mermaid");
		await renderDiagram(m, container, diagramText, isCurrent);
	} catch (err) {
		console.warn("Failed to load mermaid", err);
	}
}

export async function renderMermaidIn(element: HTMLElement, options: RenderMermaidOptions = {}): Promise<void> {
	// Check for mermaid blocks before touching the heavy library so plain markdown stays fast.
	const codeBlocks = Array.from(element.querySelectorAll("pre > code")).filter((node) =>
		isMermaidCodeBlock(node),
	) as HTMLElement[];
	if (codeBlocks.length === 0) {
		return;
	}

	const mode = options.mode ?? "light";

	try {
		const m = await ensureMermaid();
		await initializeMermaid(m.default, mode);

		// Find mermaid code blocks and render each into a generated div
		for (const codeEl of codeBlocks) {
			const parent = codeEl.parentElement as HTMLElement;
			if (!parent) continue;
			const diagramText = codeEl.textContent || "";

			// Create container for mermaid
			const wrapper = document.createElement("div");
			wrapper.className = "mermaid";
			wrapper.textContent = diagramText;

			// Replace the code block's parent (pre) with our wrapper so it's in the DOM
			parent.replaceWith(wrapper);

			// Ensure wrapper is attached to document before rendering
			if (!document.body.contains(wrapper)) {
				// try to append to the element as a last resort
				element.appendChild(wrapper);
			}

			await renderDiagram(m, wrapper, diagramText);
		}
	} catch (err) {
		console.warn("Failed to load mermaid", err);
	}
}
