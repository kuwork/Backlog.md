import { render } from "pele";
import type { ChartEngine, ChartRenderContext, ChartRenderer } from "./types";

/**
 * Pele (pele.run) is Obsidian's open-source Mermaid-syntax renderer. It parses
 * the same diagram grammar as Mermaid 12.1.0 but returns a themeable SVG
 * synchronously and ships with zero runtime dependencies.
 *
 * Unlike Mermaid (which is themed through a global `mermaid.initialize` config),
 * Pele reads its colors from CSS custom properties (`--pele-*`). We set those
 * on the container per render so the diagram tracks the host UI's light/dark
 * mode without re-rendering.
 */
const PALETTES: Record<"light" | "dark", Record<string, string>> = {
	light: {
		"--pele-bg": "transparent",
		"--pele-fg": "#1f2328",
		"--pele-muted": "#59636e",
		"--pele-line": "#1f2328",
		"--pele-surface": "#ffffff",
		"--pele-surface-alt": "#eaeef2",
		"--pele-border": "#8c959f",
	},
	dark: {
		"--pele-bg": "transparent",
		"--pele-fg": "#e6edf3",
		"--pele-muted": "#9198a1",
		// Lines and arrows must stay light on a dark surface, otherwise they
		// collapse into the background (Pele's own fallback is near-black).
		"--pele-line": "#c9d1d9",
		"--pele-surface": "#21262d",
		"--pele-surface-alt": "#30363d",
		"--pele-border": "#8b949e",
	},
};

function applyTheme(container: HTMLElement, mode: "light" | "dark"): void {
	const palette = PALETTES[mode];
	for (const [name, value] of Object.entries(palette)) {
		container.style.setProperty(name, value);
	}
}

let instanceCounter = 0;

export const peleEngine: ChartEngine = {
	id: "pele",
	languages: ["mermaid"],
	containerClassName: "pele",
	async load() {
		const renderer: ChartRenderer = {
			render({ container, source, mode }: ChartRenderContext) {
				if (!source.trim()) return;

				applyTheme(container, mode);

				try {
					const { svg } = render(source, {
						idPrefix: `pele-${instanceCounter++}-`,
					});
					container.innerHTML = svg;
				} catch (err) {
					// Mirror the old mermaid path: never crash the host, surface the
					// source so the author can still see what they wrote.
					console.warn("pele: failed to render diagram", err);
					const pre = document.createElement("pre");
					pre.className = "pele-error";
					pre.textContent = source;
					container.innerHTML = "";
					container.appendChild(pre);
				}
			},
			dispose(container: HTMLElement) {
				container.innerHTML = "";
			},
		};
		return renderer;
	},
};
