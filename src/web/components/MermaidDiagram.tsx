import type React from "react";
import { getChartEngine } from "../charts/registry";
import ChartBlock from "./ChartBlock";

interface MermaidDiagramProps {
	/** Fenced code block body, exactly as authored. */
	source: string;
	/**
	 * Retained for backward compatibility: `StateMachineEditor` still passes the
	 * color mode it resolved from `useOptionalTheme`. The actual mode is now read
	 * from `ThemeContext` inside `ChartBlock`, so this prop is ignored.
	 */
	mode?: "light" | "dark";
}

/**
 * Renders a single Mermaid-syntax diagram. The diagram is owned by the unified
 * chart engine registry (`mermaid` language → Pele), so theming and rendering
 * flow through {@link ChartBlock} like every other chart type.
 */
export default function MermaidDiagram({ source }: MermaidDiagramProps) {
	return <ChartBlock lang="mermaid" source={source} />;
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
