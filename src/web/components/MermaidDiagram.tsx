import React, { useEffect, useRef } from "react";
import { useOptionalTheme } from "../contexts/ThemeContext";
import { hasMermaidLanguageClass, renderMermaidDiagram, type MermaidMode } from "../utils/mermaid";

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

interface MermaidAwarePreProps extends React.HTMLAttributes<HTMLPreElement> {
	/** hast node injected by react-markdown. */
	node?: unknown;
}

/**
 * `<pre>` override for react-markdown based previews (the Markdown editor's
 * "Live code" / "Preview code" panes), which render markdown themselves and never
 * go through {@link MermaidMarkdown}. Fenced ` ```mermaid ` blocks become diagrams;
 * everything else stays a plain code block.
 */
export function MermaidAwarePre({ node, children, ...rest }: MermaidAwarePreProps) {
	const mode = useOptionalTheme();
	const codeNode = (node as HastNode | undefined)?.children?.[0];

	if (codeNode?.tagName === "code" && hasMermaidLanguageClass(codeNode.properties?.className)) {
		return <MermaidDiagram source={hastText(codeNode)} mode={mode} />;
	}

	return <pre {...rest}>{children}</pre>;
}
