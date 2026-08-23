import { stdout as output } from "node:process";
import type { ListInterface, ScrollableTextInterface } from "neo-neo-bblessed";
import { box, list, scrollabletext } from "neo-neo-bblessed";
import type { Core } from "../core/backlog.ts";
import type { Document } from "../types/index.ts";
import { openHelpPopup } from "./components/help-popup.ts";
import { formatFooterContent } from "./footer-content.ts";
import { createScreen, releaseSharedProgram } from "./tui.ts";

export class TerminalSizeError extends Error {
	constructor() {
		super("Terminal size unavailable");
		this.name = "TerminalSizeError";
	}
}

const FOOTER_CONTENT =
	" {cyan-fg}[←→]{/} Switch pane | {cyan-fg}[↑↓/j k]{/} Navigate | {cyan-fg}[PgUp/PgDn]{/} Page | {cyan-fg}[?]{/} Help | {cyan-fg}[q]{/} Quit";

/**
 * Open an interactive two-pane document browser: list on the left, details on
 * the right. Left/right arrows switch focus; up/down / j k navigate or scroll
 * depending on which pane is active. Esc / q / Ctrl+C exit.
 */
export async function runDocumentListViewer(documents: Document[], core: Core): Promise<void> {
	if (output.isTTY === false) {
		throw new TerminalSizeError();
	}

	const rows = process.stdout.rows || process.stderr.rows || 0;
	const cols = process.stdout.columns || process.stderr.columns || 0;
	if (rows < 3 || cols < 3) {
		throw new TerminalSizeError();
	}

	return new Promise<void>((resolve, reject) => {
		const screen = createScreen({
			style: {},
		});

		// Defensive: if blessed still couldn't get a real size, bail out cleanly.
		if (screen.height < 3 || screen.width < 3) {
			screen.destroy();
			releaseSharedProgram();
			reject(new TerminalSizeError());
			return;
		}

		const close = () => {
			screen.leave();
			screen.destroy();
			releaseSharedProgram();
			resolve();
		};

		const getTerminalWidth = () => (typeof screen.width === "number" ? screen.width : 80);

		const footerFormatted = formatFooterContent(FOOTER_CONTENT, getTerminalWidth());
		const footerHeight = footerFormatted.height;

		box({
			parent: screen,
			bottom: 0,
			left: 0,
			right: 0,
			height: footerHeight,
			content: footerFormatted.content,
			tags: true,
			wrap: true,
			style: { fg: "gray" },
		});

		let listFocused = true;
		let helpOpen = false;

		const focusBorderStyle = { fg: "yellow" };
		const defaultBorderStyle = { fg: "default" };

		const updateBorderColors = () => {
			(listBox.style as { border?: { fg?: string } }).border = listFocused ? focusBorderStyle : defaultBorderStyle;
			(detail.style as { border?: { fg?: string } }).border = listFocused ? defaultBorderStyle : focusBorderStyle;
			screen.render();
		};

		const listBox = list({
			parent: screen,
			label: ` Documents (${documents.length}) `,
			left: 0,
			top: 0,
			width: "35%",
			bottom: footerHeight,
			border: "line",
			items: documents.map((d) => `${d.id} - ${d.title}`),
			keys: true,
			mouse: false,
			scrollable: true,
			style: {
				selected: { inverse: true, bold: true },
				border: { fg: "default" },
			},
		}) as ListInterface & {
			selected: number;
			focus: () => void;
			style: { border?: { fg?: string } };
			on(event: "select item", cb: (item: unknown, index: number) => void): void;
		};

		const detail = scrollabletext({
			parent: screen,
			label: " Details ",
			left: "35%",
			top: 0,
			width: "65%",
			bottom: footerHeight,
			border: "line",
			content: "",
			scrollable: true,
			alwaysScroll: true,
			keys: false,
			mouse: false,
			padding: { left: 1, right: 1 },
			wrap: true,
			scrollbar: { ch: " ", inverse: true },
			style: {
				scrollbar: { bg: "gray" },
				border: { fg: "default" },
			},
		}) as ScrollableTextInterface & {
			scroll?: (offset: number) => void;
			setScroll?: (offset: number) => void;
			setScrollPerc?: (perc: number) => void;
			focus: () => void;
			style: { border?: { fg?: string } };
			key(keys: string[], fn: () => boolean | undefined): void;
		};

		const updateDetail = async (index: number) => {
			const document = documents[index];
			if (!document) return;
			try {
				const text = (await core.getDocumentContent(document.id)) ?? "Document not found";
				detail.setContent(text);
				if (detail.setScroll) {
					detail.setScroll(0);
				}
			} catch {
				detail.setContent("Unable to load document.");
			}
			screen.render();
		};

		listBox.on("select item", (_item, index) => {
			void updateDetail(index);
		});

		// Initialize with the first item.
		void updateDetail(listBox.selected ?? 0);

		// Global exit keys.
		screen.key(["escape", "q", "C-c"], () => {
			if (helpOpen) return false;
			close();
			return false;
		});

		// Left/right arrows switch focus between list and detail pane.
		screen.key(["left", "right"], () => {
			if (helpOpen) return false;
			listFocused = !listFocused;
			if (listFocused) {
				listBox.focus();
			} else {
				detail.focus();
			}
			updateBorderColors();
			return false;
		});

		// Help popup.
		screen.key(["?"], () => {
			if (helpOpen) return false;
			helpOpen = true;
			void openHelpPopup(screen, "document-list").finally(() => {
				helpOpen = false;
				screen.render();
			});
			return false;
		});

		// Detail-pane scrolling keys (active when detail has focus).
		detail.key(["up", "k"], () => {
			if (!listFocused) {
				detail.scroll?.(-1);
				screen.render();
			}
			return false;
		});
		detail.key(["down", "j"], () => {
			if (!listFocused) {
				detail.scroll?.(1);
				screen.render();
			}
			return false;
		});
		detail.key(["pageup", "C-u"], () => {
			if (!listFocused) {
				const page = Math.max(1, screen.height - footerHeight - 3);
				detail.scroll?.(-page);
				screen.render();
			}
			return false;
		});
		detail.key(["pagedown", "C-d"], () => {
			if (!listFocused) {
				const page = Math.max(1, screen.height - footerHeight - 3);
				detail.scroll?.(page);
				screen.render();
			}
			return false;
		});
		detail.key(["home"], () => {
			if (!listFocused) {
				detail.setScroll?.(0);
				screen.render();
			}
			return false;
		});
		detail.key(["end"], () => {
			if (!listFocused) {
				detail.setScrollPerc?.(100);
				screen.render();
			}
			return false;
		});

		// Track focus events to keep border colors in sync even if focus changes
		// through other blessed mechanisms.
		listBox.on("focus", () => {
			listFocused = true;
			updateBorderColors();
		});
		detail.on("focus", () => {
			listFocused = false;
			updateBorderColors();
		});

		listBox.focus();
		updateBorderColors();
		screen.render();
		screen.enter();
	});
}
