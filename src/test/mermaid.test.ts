import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import type { JSDOM } from "jsdom";
import { renderMermaidDiagram, renderMermaidIn } from "../web/utils/mermaid";

let dom: JSDOM;

function createContainerWithMermaid(code = "graph TD\nA --> B", language = "language-mermaid") {
	const container = dom.window.document.createElement("div");
	const pre = dom.window.document.createElement("pre");
	const codeEl = dom.window.document.createElement("code");
	codeEl.className = language;
	codeEl.textContent = code;
	pre.appendChild(codeEl);
	container.appendChild(pre);
	dom.window.document.body.appendChild(container);
	return { container, codeEl };
}

describe("renderMermaidIn", () => {
	beforeEach(async () => {
		const { JSDOM } = await import("jsdom");
		dom = new JSDOM("<!doctype html><html><body></body></html>");
		// attach globals
		// biome-ignore lint/suspicious/noExplicitAny: Testing environment setup
		globalThis.window = dom.window as any;
		// biome-ignore lint/suspicious/noExplicitAny: Testing environment setup
		globalThis.document = dom.window.document as any;
		// remove any mock if present
		// biome-ignore lint/suspicious/noExplicitAny: Mock cleanup
		delete (globalThis as any).__MERMAID_MOCK__;
	});

	afterEach(() => {
		// cleanup
		// biome-ignore lint/suspicious/noExplicitAny: Mock cleanup
		delete (globalThis as any).__MERMAID_MOCK__;
		// biome-ignore lint/suspicious/noExplicitAny: Testing environment cleanup
		delete (globalThis as any).window;
		// biome-ignore lint/suspicious/noExplicitAny: Testing environment cleanup
		delete (globalThis as any).document;
		dom.window.close();
	});

	it("uses run API when available", async () => {
		// biome-ignore lint/suspicious/noExplicitAny: Mock needed for testing
		(globalThis as any).__MERMAID_MOCK__ = {
			default: {
				// biome-ignore lint/suspicious/noExplicitAny: Mock signature flexibility
				run: async ({ nodes }: any) => {
					const el = nodes?.[0] || dom.window.document.querySelector(".mermaid");
					if (el) {
						el.innerHTML = "<svg><text>mock-run</text></svg>";
					}
				},
				initialize: () => {},
			},
		};

		const { container } = createContainerWithMermaid();
		await renderMermaidIn(container as HTMLElement);

		const mermaidDiv = container.querySelector(".mermaid");
		expect(mermaidDiv).toBeTruthy();
		expect(mermaidDiv?.innerHTML).toContain("mock-run");
	});

	it("falls back to render API when run is not available", async () => {
		// biome-ignore lint/suspicious/noExplicitAny: Mock needed for testing
		(globalThis as any).__MERMAID_MOCK__ = {
			default: {
				render: async (_id: string, _txt: string) => ({
					svg: "<svg>rendered</svg>",
				}),
				initialize: () => {},
			},
		};

		const { container } = createContainerWithMermaid();
		await renderMermaidIn(container as HTMLElement);

		const mermaidDiv = container.querySelector(".mermaid");
		expect(mermaidDiv).toBeTruthy();
		expect(mermaidDiv?.innerHTML).toContain("rendered");
	});

	it("does not throw when mermaid is missing", async () => {
		const { container } = createContainerWithMermaid();
		await expect(renderMermaidIn(container as HTMLElement)).resolves.toBeUndefined();
		const mermaidDiv = container.querySelector(".mermaid");
		expect(mermaidDiv).toBeTruthy();
	});

	it("renders blocks whose fence language keeps its original casing", async () => {
		// biome-ignore lint/suspicious/noExplicitAny: Mock needed for testing
		(globalThis as any).__MERMAID_MOCK__ = {
			default: {
				initialize: () => {},
				// biome-ignore lint/suspicious/noExplicitAny: Mock signature flexibility
				run: async ({ nodes }: any) => {
					nodes?.[0]?.setAttribute("data-mocked", "true");
				},
			},
		};

		const { container } = createContainerWithMermaid("sequenceDiagram\nA->>B: hi", "language-Mermaid");
		await renderMermaidIn(container as HTMLElement);

		const mermaidDiv = container.querySelector(".mermaid");
		expect(mermaidDiv).toBeTruthy();
		expect(mermaidDiv?.getAttribute("data-mocked")).toBe("true");
	});

	it("ignores other fenced code blocks", async () => {
		// biome-ignore lint/suspicious/noExplicitAny: Mock needed for testing
		(globalThis as any).__MERMAID_MOCK__ = {
			default: {
				initialize: () => {},
				run: async () => {
					throw new Error("should not be called");
				},
			},
		};

		const container = dom.window.document.createElement("div");
		container.innerHTML = '<pre><code class="language-typescript">const a = 1;</code></pre>';
		dom.window.document.body.appendChild(container);
		await renderMermaidIn(container as HTMLElement);

		expect(container.querySelector(".mermaid")).toBeNull();
		expect(container.querySelector("code")?.textContent).toBe("const a = 1;");
	});

	describe("color mode", () => {
		// biome-ignore lint/suspicious/noExplicitAny: Mock signature flexibility
		const configs: Record<string, any>[] = [];

		function installMock() {
			configs.length = 0;
			// biome-ignore lint/suspicious/noExplicitAny: Mock needed for testing
			(globalThis as any).__MERMAID_MOCK__ = {
				default: {
					// biome-ignore lint/suspicious/noExplicitAny: Mock signature flexibility
					initialize: (config: Record<string, any>) => {
						configs.push(config);
					},
					// biome-ignore lint/suspicious/noExplicitAny: Mock signature flexibility
					run: async ({ nodes }: any) => {
						nodes?.[0]?.setAttribute("data-mocked", "true");
					},
				},
			};
		}

		it("uses mermaid's default theme for light mode", async () => {
			installMock();
			const { container } = createContainerWithMermaid();
			await renderMermaidIn(container as HTMLElement, { mode: "light" });

			expect(configs).toHaveLength(1);
			expect(configs[0]?.theme).toBe("default");
			expect(configs[0]?.securityLevel).toBe("strict");
		});

		it("uses mermaid's dark theme for dark mode", async () => {
			installMock();
			const { container } = createContainerWithMermaid();
			await renderMermaidIn(container as HTMLElement, { mode: "dark" });

			expect(configs).toHaveLength(1);
			expect(configs[0]?.theme).toBe("dark");
		});

		it("keeps the same initialization until the mode changes", async () => {
			installMock();

			await renderMermaidIn(createContainerWithMermaid().container as HTMLElement, { mode: "light" });
			await renderMermaidIn(createContainerWithMermaid().container as HTMLElement, { mode: "light" });
			expect(configs).toHaveLength(1);

			await renderMermaidIn(createContainerWithMermaid().container as HTMLElement, { mode: "dark" });
			expect(configs).toHaveLength(2);
			expect(configs[1]?.theme).toBe("dark");
		});

		it("defaults to light mode when no mode is given", async () => {
			installMock();
			const { container } = createContainerWithMermaid();
			await renderMermaidIn(container as HTMLElement);

			expect(configs[0]?.theme).toBe("default");
		});
	});

	describe("renderMermaidDiagram", () => {
		// biome-ignore lint/suspicious/noExplicitAny: Mock signature flexibility
		const configs: Record<string, any>[] = [];

		function installMock() {
			configs.length = 0;
			// biome-ignore lint/suspicious/noExplicitAny: Mock needed for testing
			(globalThis as any).__MERMAID_MOCK__ = {
				default: {
					// biome-ignore lint/suspicious/noExplicitAny: Mock signature flexibility
					initialize: (config: Record<string, any>) => {
						configs.push(config);
					},
					// biome-ignore lint/suspicious/noExplicitAny: Mock signature flexibility
					run: async ({ nodes }: any) => {
						const el = nodes?.[0];
						if (el) el.innerHTML = `<svg><text>${el.textContent.trim().slice(0, 8)}</text></svg>`;
					},
				},
			};
		}

		function createContainer() {
			const container = dom.window.document.createElement("div");
			dom.window.document.body.appendChild(container);
			return container;
		}

		it("renders into the caller's container without replacing it", async () => {
			installMock();
			const container = createContainer();
			await renderMermaidDiagram(container as HTMLElement, "graph TD\nA --> B");

			expect(dom.window.document.body.contains(container)).toBe(true);
			expect(container.className).toBe("mermaid");
			expect(container.innerHTML).toContain("graph TD");
		});

		it("passes the requested color mode through", async () => {
			installMock();
			const container = createContainer();
			await renderMermaidDiagram(container as HTMLElement, "graph TD\nA --> B", { mode: "dark" });

			expect(configs[0]?.theme).toBe("dark");
		});

		it("leaves an empty container untouched", async () => {
			installMock();
			const container = createContainer();
			await renderMermaidDiagram(container as HTMLElement, "   ");

			expect(container.className).toBe("");
			expect(container.innerHTML).toBe("");
			expect(configs).toHaveLength(0);
		});
	});
});
