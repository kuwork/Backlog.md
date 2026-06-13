import { afterEach, describe, expect, it, mock } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import MermaidMarkdown from "../web/components/MermaidMarkdown.tsx";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";
import { ImageLightboxProvider } from "../web/contexts/ImageLightboxContext.tsx";

let activeRoot: Root | null = null;
const originalFetch = globalThis.fetch;

const setupDom = () => {
	const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost" });
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as unknown as Document;
	globalThis.navigator = dom.window.navigator as unknown as Navigator;
	globalThis.localStorage = dom.window.localStorage as unknown as Storage;
	globalThis.fetch = (() => Promise.resolve(new Response("{}", { status: 200 }))) as unknown as typeof fetch;

	globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => setTimeout(callback, 0) as unknown as number;
	globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);

	if (!window.matchMedia) {
		window.matchMedia = () =>
			({
				matches: false,
				media: "",
				onchange: null,
				addListener: () => {},
				removeListener: () => {},
				addEventListener: () => {},
				removeEventListener: () => {},
				dispatchEvent: () => false,
			}) as MediaQueryList;
	}
};

const renderStatic = (children: React.ReactNode) =>
	renderToString(
		<I18nProvider initialLocale="en">
			<ImageLightboxProvider>{children}</ImageLightboxProvider>
		</I18nProvider>,
	);

const renderInteractive = (children: React.ReactNode) => {
	setupDom();
	const container = document.getElementById("root");
	expect(container).toBeTruthy();
	activeRoot = createRoot(container as HTMLElement);
	act(() => {
		activeRoot?.render(
			<I18nProvider initialLocale="en">
				<ImageLightboxProvider>{children}</ImageLightboxProvider>
			</I18nProvider>,
		);
	});
	return container as HTMLElement;
};

const clickElement = async (element: Element) => {
	await act(async () => {
		element.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
		await Promise.resolve();
	});
};

const pressKey = async (key: string) => {
	await act(async () => {
		document.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true }));
		await Promise.resolve();
	});
};

afterEach(() => {
	globalThis.fetch = originalFetch;
	if (activeRoot) {
		act(() => {
			activeRoot?.unmount();
		});
		activeRoot = null;
	}
});

describe("ImageLightbox", () => {
	it("renders markdown images with lightbox markers", () => {
		setupDom();
		const html = renderStatic(<MermaidMarkdown source="![alt text](/assets/sample.png)" />);
		expect(html).toContain("data-lightbox-img");
		expect(html).toContain("cursor-zoom-in");
		expect(html).toContain("/assets/sample.png");
	});

	it("opens lightbox and shows the clicked image", async () => {
		const container = renderInteractive(<MermaidMarkdown source="![first](/assets/a.png) ![second](/assets/b.png)" />);

		const images = container.querySelectorAll("[data-lightbox-img]");
		expect(images.length).toBe(2);

		await clickElement(images[0] as HTMLImageElement);

		const overlay = document.querySelector(".fixed.inset-0.bg-black\\/90");
		expect(overlay).toBeTruthy();
		const lightboxImg = document.querySelector(".fixed.inset-0 img");
		expect(lightboxImg?.getAttribute("src")).toBe("/assets/a.png");
	});

	it("closes lightbox on Escape", async () => {
		const container = renderInteractive(<MermaidMarkdown source="![only](/assets/c.png)" />);
		const image = container.querySelector<HTMLImageElement>("[data-lightbox-img]");
		expect(image).toBeTruthy();
		if (!image) throw new Error("Lightbox image not rendered");
		await clickElement(image);

		expect(document.querySelector(".fixed.inset-0.bg-black\\/90")).toBeTruthy();

		await pressKey("Escape");

		expect(document.querySelector(".fixed.inset-0.bg-black\\/90")).toBeNull();
	});

	it("zooms image with mouse wheel", async () => {
		const container = renderInteractive(<MermaidMarkdown source="![only](/assets/c.png)" />);
		const image = container.querySelector<HTMLImageElement>("[data-lightbox-img]");
		expect(image).toBeTruthy();
		if (!image) throw new Error("Lightbox image not rendered");
		await clickElement(image);

		const lightboxImg = document.querySelector(".fixed.inset-0 img") as HTMLElement;
		expect(lightboxImg?.style.transform).toBe("translate(0px, 0px) scale(1) rotate(0deg)");

		await act(async () => {
			lightboxImg.dispatchEvent(new window.WheelEvent("wheel", { deltaY: -10, bubbles: true }));
			await Promise.resolve();
		});

		expect(lightboxImg.style.transform).not.toBe("translate(0px, 0px) scale(1) rotate(0deg)");
	});

	it("rotates image with bottom controls", async () => {
		const container = renderInteractive(<MermaidMarkdown source="![only](/assets/c.png)" />);
		const image = container.querySelector<HTMLImageElement>("[data-lightbox-img]");
		expect(image).toBeTruthy();
		if (!image) throw new Error("Lightbox image not rendered");
		await clickElement(image);

		const rotateRight = document.querySelector("[aria-label='Rotate right']");
		expect(rotateRight).toBeTruthy();
		if (!rotateRight) throw new Error("Rotate right button not rendered");
		await clickElement(rotateRight);

		const lightboxImg = document.querySelector(".fixed.inset-0 img") as HTMLElement;
		expect(lightboxImg.style.transform).toContain("rotate(90deg)");
	});

	it("switches images with arrow keys and resets scale", async () => {
		const container = renderInteractive(<MermaidMarkdown source="![first](/assets/a.png) ![second](/assets/b.png)" />);
		const images = container.querySelectorAll("[data-lightbox-img]");
		await clickElement(images[0] as HTMLImageElement);

		const getLightboxSrc = () => document.querySelector(".fixed.inset-0 img")?.getAttribute("src");
		expect(getLightboxSrc()).toBe("/assets/a.png");

		await pressKey("ArrowRight");
		expect(getLightboxSrc()).toBe("/assets/b.png");

		const scaledImg = document.querySelector(".fixed.inset-0 img") as HTMLElement;
		expect(scaledImg?.style.transform).toBe("translate(0px, 0px) scale(1) rotate(0deg)");

		await pressKey("ArrowLeft");
		expect(getLightboxSrc()).toBe("/assets/a.png");
		expect((document.querySelector(".fixed.inset-0 img") as HTMLElement)?.style.transform).toBe(
			"translate(0px, 0px) scale(1) rotate(0deg)",
		);
	});

	it("pans image while zoomed in", async () => {
		const container = renderInteractive(<MermaidMarkdown source="![only](/assets/c.png)" />);
		const image = container.querySelector<HTMLImageElement>("[data-lightbox-img]");
		expect(image).toBeTruthy();
		if (!image) throw new Error("Lightbox image not rendered");
		await clickElement(image);

		const lightboxImg = document.querySelector(".fixed.inset-0 img") as HTMLImageElement;

		await act(async () => {
			lightboxImg.dispatchEvent(new window.WheelEvent("wheel", { deltaY: -300, bubbles: true }));
			await Promise.resolve();
		});

		expect(lightboxImg.style.transform).not.toContain("scale(1)");

		await act(async () => {
			lightboxImg.dispatchEvent(new window.MouseEvent("mousedown", { clientX: 100, clientY: 100, bubbles: true }));
			await Promise.resolve();
		});

		await act(async () => {
			window.dispatchEvent(new window.MouseEvent("mousemove", { clientX: 150, clientY: 120, bubbles: true }));
			await Promise.resolve();
		});

		await act(async () => {
			window.dispatchEvent(new window.MouseEvent("mouseup", { bubbles: true }));
			await Promise.resolve();
		});

		const transform = lightboxImg.style.transform;
		expect(transform).toMatch(/translate\([^)]+\) scale\([^)]+\) rotate\(0deg\)/);
		expect(transform).not.toBe("translate(0px, 0px) scale(1) rotate(0deg)");
	});

	it("zooms around the cursor without drift", async () => {
		const container = renderInteractive(<MermaidMarkdown source="![only](/assets/c.png)" />);
		const image = container.querySelector<HTMLImageElement>("[data-lightbox-img]");
		expect(image).toBeTruthy();
		if (!image) throw new Error("Lightbox image not rendered");
		await clickElement(image);

		const lightboxImg = document.querySelector(".fixed.inset-0 img") as HTMLElement;
		const cx = window.innerWidth / 2;
		const cy = window.innerHeight / 2;

		await act(async () => {
			lightboxImg.dispatchEvent(
				new window.WheelEvent("wheel", { deltaY: -10, clientX: cx, clientY: cy, bubbles: true }),
			);
			await Promise.resolve();
		});

		expect(lightboxImg.style.transform).toContain("translate(0px, 0px)");

		await act(async () => {
			lightboxImg.dispatchEvent(
				new window.WheelEvent("wheel", { deltaY: -10, clientX: cx + 100, clientY: cy, bubbles: true }),
			);
			await Promise.resolve();
		});

		expect(lightboxImg.style.transform).toMatch(/translate\(-\d+(\.\d+)?px, 0px\)/);
	});

	it("shows a dot indicator and switches images by clicking dots", async () => {
		const container = renderInteractive(<MermaidMarkdown source="![first](/assets/a.png) ![second](/assets/b.png) ![third](/assets/c.png)" />);
		const images = container.querySelectorAll("[data-lightbox-img]");
		await clickElement(images[0] as HTMLImageElement);

		const dots = document.querySelectorAll("[aria-label^='Go to image']");
		expect(dots.length).toBe(3);

		const getLightboxSrc = () => document.querySelector(".fixed.inset-0 img")?.getAttribute("src");
		expect(getLightboxSrc()).toBe("/assets/a.png");

		const activeDotScale = window.getComputedStyle(dots[0] as HTMLElement).transform;
		const inactiveDotScale = window.getComputedStyle(dots[1] as HTMLElement).transform;
		expect(activeDotScale).not.toBe(inactiveDotScale);

		await clickElement(dots[2] as HTMLElement);
		expect(getLightboxSrc()).toBe("/assets/c.png");
	});

	it("stops ESC propagation while open so parent modals stay open", async () => {
		const container = renderInteractive(<MermaidMarkdown source="![only](/assets/c.png)" />);
		const image = container.querySelector<HTMLImageElement>("[data-lightbox-img]");
		expect(image).toBeTruthy();
		if (!image) throw new Error("Lightbox image not rendered");
		await clickElement(image);

		const bubbleListener = mock(() => {});
		document.addEventListener("keydown", bubbleListener);

		await pressKey("Escape");

		expect(bubbleListener).not.toHaveBeenCalled();

		document.removeEventListener("keydown", bubbleListener);
	});
});
