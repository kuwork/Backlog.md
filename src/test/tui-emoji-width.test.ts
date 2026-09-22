import { describe, expect, it } from "bun:test";
import blessed from "neo-neo-bblessed";

const unicode = (blessed as unknown as { unicode: { strWidth(s: string): number; chars: { all: RegExp } } }).unicode;

// Pins the width tables the TUI renders through. Terminals draw emoji two cells wide, so a library
// that counts them as one drifts the kanban column borders and leaves stale cells behind whenever
// a region is re-drawn. The tables live in the rendering library rather than in src/ui, which is why
// this regression test is the thing that keeps the widths honest across future dependency bumps.
describe("emoji widths in the TUI rendering library", () => {
	it("measures default-emoji-presentation codepoints as 2 cells", () => {
		for (const emoji of ["🚀", "😀", "🐛", "✨", "✅", "🔧", "🔍", "🐞", "⭐"]) {
			expect(unicode.strWidth(emoji)).toBe(2);
		}
	});

	it("measures VS16 emoji sequences as 2 cells", () => {
		expect(unicode.strWidth("⚠️")).toBe(2);
		expect(unicode.strWidth("❤️")).toBe(2);
		// A redundant VS16 after an already-wide emoji adds nothing.
		expect(unicode.strWidth("✅️")).toBe(2);
	});

	it("keeps text-presentation, ASCII, and CJK widths unchanged", () => {
		expect(unicode.strWidth("⚠")).toBe(1);
		expect(unicode.strWidth("🌡")).toBe(1);
		expect(unicode.strWidth("A")).toBe(1);
		expect(unicode.strWidth("hello")).toBe(5);
		expect(unicode.strWidth("中")).toBe(2);
	});

	it("marks emoji as wide in the layout regexes", () => {
		expect("🚀".match(unicode.chars.all)).toBeTruthy();
		expect("✅".match(unicode.chars.all)).toBeTruthy();
		expect("中".match(unicode.chars.all)).toBeTruthy();
		expect("A".match(unicode.chars.all)).toBeNull();
	});
});
