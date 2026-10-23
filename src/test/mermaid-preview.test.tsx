import { describe, expect, it } from "bun:test";
import { renderToString } from "react-dom/server";
import { ChartAwarePre } from "../web/components/MermaidDiagram.tsx";
import { PasteAwareMDEditor } from "../web/components/PasteAwareMDEditor.tsx";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";

function preNode(language: string, code: string) {
	return {
		type: "element",
		tagName: "pre",
		properties: {},
		children: [
			{
				type: "element",
				tagName: "code",
				properties: { className: [`language-${language}`] },
				children: [{ type: "text", value: code }],
			},
		],
	};
}

const renderPre = (language: string, code: string) => renderToString(<ChartAwarePre node={preNode(language, code)} />);

describe("ChartAwarePre", () => {
	it("turns a mermaid fence into a diagram container", () => {
		const html = renderPre("mermaid", "graph TD\nA --> B");

		expect(html).toContain('class="pele"');
		expect(html).not.toContain("<pre");
	});

	it("keeps the fence language casing irrelevant", () => {
		const lower = renderPre("mermaid", "graph TD\nA --> B");
		const upper = renderPre("Mermaid", "graph TD\nA --> B");

		expect(lower).toContain('class="pele"');
		expect(upper).toContain('class="pele"');
	});

	it("leaves other code blocks untouched", () => {
		const html = renderToString(
			<ChartAwarePre node={preNode("typescript", "const a = 1;")}>
				<code className="language-typescript">const a = 1;</code>
			</ChartAwarePre>,
		);

		expect(html).toContain("<pre");
		expect(html).toContain("language-typescript");
		expect(html).toContain("const a = 1;");
		expect(html).not.toContain('class="pele"');
	});
});

describe("PasteAwareMDEditor preview panes", () => {
	const source = "Intro\n\n```mermaid\ngraph TD\nA --> B\n```\n\n```js\nconst a = 1;\n```\n";

	const renderEditor = (preview: "preview" | "live") =>
		renderToString(
			<I18nProvider initialLocale="en">
				<PasteAwareMDEditor value={source} preview={preview} height={300} />
			</I18nProvider>,
		);

	it("renders diagrams in the 'Preview code' pane", () => {
		const html = renderEditor("preview");

		expect(html).toContain("w-md-editor-show-preview");
		expect(html).toContain('class="pele"');
	});

	it("renders diagrams in the 'Live code' pane too", () => {
		const html = renderEditor("live");

		expect(html).toContain("w-md-editor-show-live");
		expect(html).toContain('class="pele"');
	});

	it("keeps non-mermaid code blocks highlighted in the preview", () => {
		const html = renderEditor("preview");

		expect(html).toContain("language-js");
		expect(html).not.toContain("language-mermaid");
	});
});
