import type React from "react";
import { useEffect, useRef } from "react";
import { getChartEngine } from "../charts/registry";
import { hasMermaidLanguageClass, type MermaidMode, renderMermaidDiagram } from "../utils/mermaid";
import ChartBlock from "./ChartBlock";

interface MermaidDiagramProps {
	/** Fenced code block body, exactly as authored. */
	source: string;
	mode: MermaidMode;
}

/**
 * Renders a single mermaid diagram into a container React owns. The container is
 * left empty on purpose: `renderMermaidDiagram` replaces its content with mermaid's
 * SVG, so React never has to reconcile children it did not create.
 */
export default function MermaidDiagram({ source, mode }: MermaidDiagramProps) {
	const ref = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		const element = ref.current;
		if (!element) return;

		const frameId = requestAnimationFrame(() => {
			void renderMermaidDiagram(element, source, { mode });
		});

		return () => cancelAnimationFrame(frameId);
	}, [source, mode]);

	return <div ref={ref} className="mermaid" />;
}

type HastNode = {
	type?: string;
	value?: string;
	tagName?: string;
	properties?: { className?: string | string[] } & Record<string, unknown>;
	children?: HastNode[];
};

function hastText(node: HastNode | undefined): string {
	if (!node) return "";
	if (node.type === "text") return node.value ?? "";
	if (!Array.isArray(node.children)) return "";
	return node.children.map((child) => hastText(child)).join("");
}

interface ChartAwarePreProps extends React.HTMLAttributes<HTMLPreElement> {
	/** hast node injected by react-markdown. */
	node?: unknown;
}

/**
 * `<pre>` override for react-markdown based previews (the Markdown editor's
 * "Live code" / "Preview code" panes), which render markdown themselves and never
 * go through {@link MermaidMarkdown}. Any fenced block whose language is registered
 * in the chart engine registry (mermaid, echarts, …) renders via ChartBlock;
 * everything else stays a plain code block.
 */
export function ChartAwarePre({ node, children, ...rest }: ChartAwarePreProps) {
	const codeNode = (node as HastNode | undefined)?.children?.[0];
	if (codeNode?.tagName === "code") {
		const className = codeNode.properties?.className;
		const names = Array.isArray(className) ? className : typeof className === "string" ? className.split(/\s+/) : [];
		const lang = names.map((n) => n.replace(/^language-/, "")).find((l) => getChartEngine(l));
		if (lang) {
			return <ChartBlock lang={lang} source={hastText(codeNode)} />;
		}
	}

	return <pre {...rest}>{children}</pre>;
}

// Re-exported for callers that only care about mermaid detection.
export { hasMermaidLanguageClass };
