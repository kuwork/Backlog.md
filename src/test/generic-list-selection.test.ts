import { describe, expect, it } from "bun:test";
import type { ListInterface, ScreenInterface } from "neo-neo-bblessed";
import { GenericList } from "../ui/components/generic-list.ts";
import { createScreen } from "../ui/tui.ts";

type RenderedList = ListInterface & {
	emit: (event: string, ch?: string, key?: { name: string }) => boolean;
	ritems: string[];
};

function withTtyScreen(run: (screen: ScreenInterface) => void): void {
	const originalIsTTY = process.stdout.isTTY;
	if (process.stdout.isTTY === false) {
		Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });
	}
	const screen = createScreen({ smartCSR: false });
	try {
		run(screen);
	} finally {
		if (process.stdout.isTTY !== originalIsTTY) {
			Object.defineProperty(process.stdout, "isTTY", { value: originalIsTTY, configurable: true });
		}
		screen.destroy();
	}
}

describe("GenericList selection rendering", () => {
	it("syncs highlighted content when the blessed list selection changes", () => {
		withTtyScreen((screen) => {
			const highlighted: number[] = [];
			const list = new GenericList({
				parent: screen,
				items: [{ id: "TASK-1" }, { id: "TASK-2" }],
				itemRenderer: (item) => `{cyan-fg}${item.id}{/}`,
				onHighlight: (_item, index) => {
					highlighted.push(index);
				},
				showHelp: false,
			});

			const listBox = list.getListBox() as RenderedList;
			expect(listBox.ritems[0]).toBe("TASK-1");
			expect(listBox.ritems[1]).toBe("{cyan-fg}TASK-2{/}");

			listBox.select(1);

			expect(listBox.ritems[0]).toBe("{cyan-fg}TASK-1{/}");
			expect(listBox.ritems[1]).toBe("TASK-2");
			expect(list.getSelectedIndex()).toBe(1);
			expect(highlighted.at(-1)).toBe(1);

			list.destroy();
		});
	});

	it("moves the selection with pageup/pagedown/home/end keys", () => {
		withTtyScreen((screen) => {
			const highlighted: number[] = [];
			const list = new GenericList({
				parent: screen,
				items: Array.from({ length: 20 }, (_, i) => ({ id: `TASK-${i + 1}` })),
				itemRenderer: (item) => item.id,
				onHighlight: (_item, index) => {
					highlighted.push(index);
				},
				showHelp: false,
			});

			const listBox = list.getListBox() as RenderedList;
			expect(list.getSelectedIndex()).toBe(0);

			// pagedown moves by roughly one page (height-derived)
			listBox.emit("key pagedown", "", { name: "pagedown" });
			expect(list.getSelectedIndex()).toBeGreaterThan(0);

			// home jumps to the first item
			listBox.emit("key home", "", { name: "home" });
			expect(list.getSelectedIndex()).toBe(0);

			// end jumps to the last item
			listBox.emit("key end", "", { name: "end" });
			expect(list.getSelectedIndex()).toBe(19);

			// pageup moves back up
			listBox.emit("key pageup", "", { name: "pageup" });
			expect(list.getSelectedIndex()).toBeLessThan(19);

			list.destroy();
		});
	});
});
