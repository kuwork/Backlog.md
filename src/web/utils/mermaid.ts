// Type definitions for Mermaid API
interface MermaidAPI {
	initialize: (config: MermaidConfig) => void;
	run?: (options?: MermaidRunOptions) => Promise<void>;
	render: (id: string, text: string) => Promise<MermaidRenderResult>;
}

interface MermaidConfig {
	startOnLoad?: boolean;
	securityLevel?: "strict" | "loose" | "antiscript" | "sandbox";
	theme?: "base" | "default" | "dark" | "forest" | "neutral" | "null";
	logLevel?: number;
	[key: string]: unknown;
}

interface MermaidRunOptions {
	nodes?: HTMLElement[];
	querySelector?: string;
	suppressErrors?: boolean;
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

/** Renders one diagram into an already attached `.mermaid` container. */
async function renderDiagram(m: MermaidModule, wrapper: HTMLElement, diagramText: string): Promise<void> {
	try {
		if (m?.default?.run) {
			try {
				await m.default.run({ nodes: [wrapper] });
				return;
			} catch {
				// Continue to render fallback if run fails
			}
		}

		if (m?.default?.render) {
			const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`;
			try {
				const result = await m.default.render(id, diagramText);
				wrapper.innerHTML = result.svg;

				// Bind interactive functions if available (for click events, etc.)
				if (result.bindFunctions) {
					result.bindFunctions(wrapper);
				}
				return;
			} catch {
				// Continue to next fallback if render fails
			}
		}

		// If none of the above worked, log warning
		console.warn("mermaid: no compatible render method found, leaving raw code block");
	} catch (err) {
		console.warn("mermaid render failed", err);
	}
}

/**
 * Renders one diagram into a container owned by the caller. Unlike
 * {@link renderMermaidIn} the container is not replaced, which keeps it safe to
 * call from a React effect on an element React owns.
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

	try {
		const m = await ensureMermaid();
		await initializeMermaid(m.default, mode);

		container.classList.add("mermaid");
		container.textContent = diagramText;
		await renderDiagram(m, container, diagramText);
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
