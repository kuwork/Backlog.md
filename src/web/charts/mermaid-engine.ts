import { renderMermaidDiagram } from "../utils/mermaid";
import type { ChartEngine } from "./types";

/** Mermaid is a pure text→SVG engine; it reuses the existing mermaid loader. */
export const mermaidEngine: ChartEngine = {
	id: "mermaid",
	languages: ["mermaid"],
	containerClassName: "mermaid",
	async load() {
		return {
			async render({ container, source, mode }) {
				await renderMermaidDiagram(container, source, { mode });
			},
		};
	},
};
