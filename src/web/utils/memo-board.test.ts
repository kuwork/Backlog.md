import { describe, expect, test } from "bun:test";
import type { Memo } from "../../core/memos.ts";
import {
	approxInkWidth,
	estimateNoteHeight,
	hashString,
	hitTest,
	layoutBoard,
	layoutInkLines,
	memoInkDepth,
	NOTE_HEIGHT,
	NOTE_INK,
	NOTE_PITCH_X,
	NOTE_PITCH_Y,
	NOTE_TILT,
	NOTE_WIDTH,
	noteVariantFor,
	PAPER_COLORS,
	PIN_COLORS,
	wrapEstimate,
} from "./memo-board.ts";

function memoOf(id: string, content = `Memo ${id}`): Memo {
	return {
		id,
		createdDate: "2026-10-04 05:51",
		tags: [],
		displayTitle: content,
		rawContent: content,
		path: `backlog/memos/${id}.md`,
	};
}

const sample = Array.from({ length: 25 }, (_, i) => memoOf(`20261004-${i + 1}`));

describe("hashString", () => {
	test("is deterministic and id-sensitive", () => {
		expect(hashString("abc")).toBe(hashString("abc"));
		expect(hashString("abc")).not.toBe(hashString("abd"));
	});
});

describe("noteVariantFor", () => {
	test("is stable per memo id", () => {
		expect(noteVariantFor(sample[0] ?? memoOf("x"))).toEqual(noteVariantFor(sample[0] ?? memoOf("x")));
	});

	test("assigns known colors, bounded tilt and both curl outcomes across a sample", () => {
		const curls = new Set<boolean>();
		for (const memo of sample) {
			const variant = noteVariantFor(memo);
			expect(PAPER_COLORS).toContain(variant.paper);
			expect(PIN_COLORS).toContain(variant.pin);
			expect(Math.abs(variant.tilt)).toBeLessThanOrEqual(NOTE_TILT);
			curls.add(variant.curl);
		}
		expect(curls.size).toBe(2);
	});
});

describe("wrapEstimate", () => {
	test("keeps latin words whole but breaks CJK anywhere", () => {
		expect(wrapEstimate("hello world", 1000, 15)).toEqual(["hello world"]);
		// A long unspaced CJK string must wrap into several lines, not overflow.
		const wrapped = wrapEstimate("这是一段没有任何空格的中文句子需要被折行处理", 100, 15);
		expect(wrapped.length).toBeGreaterThan(1);
		for (const line of wrapped) expect(line.length).toBeLessThanOrEqual(8);
	});
});

describe("estimateNoteHeight", () => {
	test("is a fixed height, regardless of how long the memo is", () => {
		expect(estimateNoteHeight(memoOf("a", "短"))).toBe(NOTE_HEIGHT);
		expect(estimateNoteHeight(memoOf("b", "一行便签"))).toBe(NOTE_HEIGHT);
		expect(
			estimateNoteHeight(
				memoOf(
					"c",
					"第一行内容\n第二行内容需要长一些的中文文本来触发折行处理，多写几个字确保一定折行\n第三行还有更多文字继续填充高度\n第四行\n第五行内容",
				),
			),
		).toBe(NOTE_HEIGHT);
	});
});

describe("layoutInkLines", () => {
	const maxWidth = NOTE_WIDTH - NOTE_INK.inset * 2;
	const top = NOTE_INK.pinClearance;
	const bottom = NOTE_HEIGHT - NOTE_INK.bottomReserve;
	const measure = (text: string, fontSize: number, bold: boolean) => approxInkWidth(text, fontSize, bold);

	test("keeps every line of a short memo and is not truncated", () => {
		const layout = layoutInkLines(memoOf("a", "标题\n第一行\n第二行"), maxWidth, top, bottom, measure);
		expect(layout.truncated).toBe(false);
		expect(layout.segments).toHaveLength(3);
		expect(layout.segments[0]?.bold).toBe(true);
		expect(layout.segments.slice(1).every((s) => s.bold === false)).toBe(true);
	});

	test("truncates with an ellipsis when the text overflows the fixed height", () => {
		const long = memoOf(
			"c",
			`标题行\n${Array.from({ length: 12 }, (_, i) => `这是第 ${i + 1} 行较长的中文正文用于触发省略号截断处理`).join("\n")}`,
		);
		const layout = layoutInkLines(long, maxWidth, top, bottom, measure);
		expect(layout.truncated).toBe(true);
		const last = layout.segments.at(-1);
		expect(last?.text.endsWith("…")).toBe(true);
		// The trimmed final line must actually fit the width.
		expect(approxInkWidth(last?.text ?? "", last?.fontSize ?? 0, last?.bold ?? false)).toBeLessThanOrEqual(maxWidth);
	});

	test("never starts a line below the bottom of the fixed box", () => {
		const long = memoOf("d", `标题\n${"内容行持续填充直到超出固定高度为止。\n".repeat(10)}`);
		const layout = layoutInkLines(long, maxWidth, top, bottom, measure);
		let y = top;
		let prevBold = true;
		for (const seg of layout.segments) {
			if (!seg.bold && prevBold) y += 4;
			expect(y).toBeLessThanOrEqual(bottom);
			y += seg.lineHeight;
			prevBold = seg.bold;
		}
	});
});

describe("layoutBoard", () => {
	test("is deterministic for the same input", () => {
		expect(layoutBoard(sample, 1200, 800)).toEqual(layoutBoard(sample, 1200, 800));
	});

	test("keeps every note fully inside the fixed board", () => {
		const { notes } = layoutBoard(sample, 1200, 800);
		expect(notes).toHaveLength(25);
		for (const note of notes) {
			expect(note.x).toBeGreaterThanOrEqual(NOTE_WIDTH / 2);
			expect(note.x).toBeLessThanOrEqual(1200 - NOTE_WIDTH / 2);
			expect(note.y).toBeGreaterThanOrEqual(note.h / 2);
			expect(note.y).toBeLessThanOrEqual(800 - note.h / 2);
		}
	});

	test("keeps base-layer neighbors far enough apart to stay readable", () => {
		const { notes } = layoutBoard(sample, 1200, 800);
		const base = notes.filter((note) => note.layer === 0);
		for (let i = 0; i < base.length; i++) {
			for (let j = i + 1; j < base.length; j++) {
				const a = base[i];
				const b = base[j];
				if (!a || !b) continue;
				const distance = Math.hypot(a.x - b.x, a.y - b.y);
				expect(distance).toBeGreaterThan(NOTE_WIDTH * 0.55);
			}
		}
	});

	test("overflow goes to the gap seams and then the corner pile", () => {
		// A 2x2 board keeps the bottom-right cell for the pile: 3 base notes, 1 gap note, 21 piled.
		const { notes } = layoutBoard(sample, NOTE_PITCH_X * 2, NOTE_PITCH_Y * 2);
		const byLayer = (layer: number) => notes.filter((note) => note.layer === layer);
		expect(byLayer(0)).toHaveLength(3);
		expect(byLayer(1)).toHaveLength(1);
		expect(byLayer(2)).toHaveLength(21);
		for (const note of notes) {
			expect(note.x).toBeLessThanOrEqual(NOTE_PITCH_X * 2 - NOTE_WIDTH / 2);
			expect(note.y).toBeLessThanOrEqual(NOTE_PITCH_Y * 2 - note.h / 2);
		}
	});

	test("leaves no empty cell when nothing needs the pile", () => {
		// 18 memos on a 12-cell board: 12 base + 6 seam notes, no pile, so the base grid stays full.
		const { notes } = layoutBoard(sample.slice(0, 18), 1200, 800);
		expect(notes.filter((note) => note.layer === 0)).toHaveLength(12);
		expect(notes.filter((note) => note.layer === 1)).toHaveLength(6);
		expect(notes.filter((note) => note.layer === 2)).toHaveLength(0);
	});

	test("the corner pile never covers a base note's center", () => {
		const { notes } = layoutBoard(sample, 1200, 800);
		const base = notes.filter((note) => note.layer === 0);
		const pile = notes.filter((note) => note.layer === 2);
		expect(pile.length).toBeGreaterThan(0);
		for (const stacked of pile) {
			for (const cell of base) {
				const coversCenter =
					Math.abs(stacked.x - cell.x) < NOTE_WIDTH / 2 && Math.abs(stacked.y - cell.y) < stacked.h / 2;
				expect(coversCenter).toBe(false);
			}
		}
	});

	test("gap-layer notes may cover footers but never the text of base notes", () => {
		const { notes } = layoutBoard(sample, 1200, 800);
		const base = notes.filter((note) => note.layer === 0);
		const gaps = notes.filter((note) => note.layer === 1);
		expect(gaps.length).toBeGreaterThan(0);
		for (const gap of gaps) {
			const gapTop = gap.y - gap.h / 2;
			const gapBottom = gap.y + gap.h / 2;
			for (const cell of base) {
				// All notes share NOTE_WIDTH, so horizontal overlap is a center-distance check.
				if (Math.abs(gap.x - cell.x) >= NOTE_WIDTH) continue;
				const textTop = cell.y - cell.h / 2 + NOTE_INK.pinClearance;
				const textBottom = cell.y - cell.h / 2 + memoInkDepth(cell.memo);
				const coversText = gapBottom > textTop && gapTop < textBottom;
				expect(coversText).toBe(false);
			}
		}
	});

	test("the corner pile cascades so every note peeks out", () => {
		const { notes } = layoutBoard(sample, 1200, 800);
		const pile = notes.filter((note) => note.layer === 2);
		expect(pile.length).toBeGreaterThan(1);
		for (let i = 1; i < pile.length; i++) {
			const above = pile[i];
			const below = pile[i - 1];
			if (!above || !below) continue;
			expect(above.x).toBeLessThan(below.x);
			expect(above.y).toBeLessThan(below.y);
		}
	});
});

describe("hitTest", () => {
	test("returns the note under its center and null off-board", () => {
		// A board generous enough for a single layer, so no stacked note covers another's center.
		const { notes } = layoutBoard(sample, 5000, 3000);
		const first = notes[0];
		expect(first).toBeDefined();
		if (!first) return;
		expect(hitTest(notes, first.x, first.y)?.memo.id).toBe(first.memo.id);
		expect(hitTest(notes, -500, -500)).toBeNull();
	});

	test("respects the note tilt and height: a corner in the unrotated box can miss", () => {
		const memo = memoOf("tilted-1");
		const h = estimateNoteHeight(memo);
		const tilted = { memo, x: 0, y: 0, h, layer: 0, variant: { ...noteVariantFor(memo), tilt: Math.PI / 4 } };
		// A corner point that an untilted note contains falls outside once the note is rotated 45°.
		expect(hitTest([tilted], (NOTE_WIDTH / 2) * 0.98, (h / 2) * 0.98)).toBeNull();
		expect(hitTest([tilted], 0, 0)).not.toBeNull();
	});

	test("returns the last note (topmost in draw order) when notes overlap", () => {
		const a = { memo: memoOf("a"), x: 0, y: 0, h: NOTE_HEIGHT, layer: 0, variant: noteVariantFor(memoOf("a")) };
		const b = { memo: memoOf("b"), x: 0, y: 0, h: NOTE_HEIGHT, layer: 1, variant: noteVariantFor(memoOf("b")) };
		expect(hitTest([a, b], 0, 0)?.memo.id).toBe("b");
	});
});
