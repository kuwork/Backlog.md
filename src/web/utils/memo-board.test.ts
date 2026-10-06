import { describe, expect, test } from "bun:test";
import type { Memo } from "../../core/memos.ts";
import type { InkSegment } from "./memo-board.ts";
import {
	approxInkWidth,
	estimateNoteHeight,
	FOOTER_TAG_GAP,
	FOOTER_TAG_LIMIT,
	footerTagBoxes,
	hashString,
	hitTest,
	inkRunBoxes,
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
	splitInkRuns,
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

	test("keeps a closed #topic# on one line, since a chip split across lines is not a chip", () => {
		// Narrow enough that the topic has to move to the next line rather than break inside.
		const wrapped = wrapEstimate("前面有一些文字铺垫 #灵感# 后面还有", 60, 15);
		expect(wrapped.some((line) => line === "#灵感#")).toBe(true);
		for (const line of wrapped) {
			// A hash appears on a line only as part of the whole topic: never a half of one.
			expect(line.includes("#")).toBe(line === "#灵感#");
		}
	});
});

describe("footerTagBoxes", () => {
	// 6px per character is close enough to lay the list out; the geometry is what is under test.
	const measure = (text: string) => text.length * 6;
	const rightEdge = 200;

	test("lays the tags out right to left and right-aligns the block", () => {
		const boxes = footerTagBoxes(["todo", "done"], rightEdge, measure, new Set());
		expect(boxes.map((box) => box.text)).toEqual(["#todo", "#done"]);
		// The block ends exactly at the inset, with the gap between the two labels.
		const last = boxes.at(-1);
		expect((last?.x ?? 0) + (last?.width ?? 0)).toBe(rightEdge);
		expect(boxes[1]?.x).toBe((boxes[0]?.x ?? 0) + (boxes[0]?.width ?? 0) + FOOTER_TAG_GAP);
	});

	test("marks only the tag the view is narrowed by - a filter is not a blanket highlight", () => {
		const boxes = footerTagBoxes(["todo", "done", "idea"], rightEdge, measure, new Set(["todo"]));
		// Only the first FOOTER_TAG_LIMIT tags are shown at all.
		expect(boxes).toHaveLength(FOOTER_TAG_LIMIT);
		expect(boxes.map((box) => box.on)).toEqual([true, false]);
		// Nothing is on when nothing is selected.
		expect(footerTagBoxes(["todo", "done"], rightEdge, measure, new Set()).some((box) => box.on)).toBe(false);
	});
});

describe("inkRunBoxes", () => {
	const measure = (text: string, fontSize: number, bold: boolean) => approxInkWidth(text, fontSize, bold);
	const segmentOf = (text: string): InkSegment => {
		const layout = layoutInkLines(memoOf("f", `标题\n${text}`), 400, 42, 120, measure);
		const seg = layout.segments.find((item) => !item.bold);
		if (!seg) throw new Error(`no body segment was laid out for: ${text}`);
		return seg;
	};

	test("places each run after the one before it, so a chip lands behind its own text", () => {
		// No spaces in the fixture: the ink wrapper drops them the way it always has, and a run's
		// placement is what is under test here.
		const boxes = inkRunBoxes(segmentOf("第#todo#尾"), 16, measure, new Set());
		expect(boxes.map((box) => box.text)).toEqual(["第", "#todo#", "尾"]);
		expect(boxes[0]?.x).toBe(16);
		expect(boxes[1]?.x).toBe(16 + (boxes[0]?.width ?? 0));
		expect(boxes[2]?.x).toBe(16 + (boxes[0]?.width ?? 0) + (boxes[1]?.width ?? 0));
		// Only the topic is dressed; the rest is plain ink.
		expect(boxes.map((box) => box.tag)).toEqual([null, "todo", null]);
	});

	test("marks a run on only when its tag is the one the view is narrowed by", () => {
		const seg = segmentOf("#todo# #done#");
		expect(inkRunBoxes(seg, 0, measure, new Set(["todo"])).map((box) => box.on)).toEqual([true, false]);
		// Case-insensitive, like the filter itself.
		expect(inkRunBoxes(seg, 0, measure, new Set(["TODO"])).map((box) => box.on)).toEqual([true, false]);
		// With nothing selected nothing is on - including a run with no tag at all.
		expect(inkRunBoxes(seg, 0, measure, new Set()).some((box) => box.on)).toBe(false);
	});
});

describe("splitInkRuns", () => {
	test("splits a line into plain runs and one run per closed topic", () => {
		expect(splitInkRuns("tasks #todo# and #done#")).toEqual([
			{ text: "tasks ", tag: null },
			{ text: "#todo#", tag: "todo" },
			{ text: " and ", tag: null },
			{ text: "#done#", tag: "done" },
		]);
	});

	test("leaves a line without a topic as a single plain run", () => {
		expect(splitInkRuns("just ink")).toEqual([{ text: "just ink", tag: null }]);
		expect(splitInkRuns("")).toEqual([]);
	});

	test("leaves an unclosed token alone, so an ordinary reference is never chipped", () => {
		expect(splitInkRuns("审查 PR #268，还有 #todo 没写").every((run) => run.tag === null)).toBe(true);
	});

	test("chips CJK topics and a topic alone on its line", () => {
		expect(splitInkRuns("#标签#")).toEqual([{ text: "#标签#", tag: "标签" }]);
	});

	test("keeps the run text summing back to the line it came from", () => {
		const line = "开 #todo# 中 #done# 收";
		expect(
			splitInkRuns(line)
				.map((run) => run.text)
				.join(""),
		).toBe(line);
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

	test("gives every segment runs that add back up to its text, chip or not", () => {
		const layout = layoutInkLines(
			memoOf("e", "标题 #标题标签#\n正文 #todo# 与未闭合 #268"),
			maxWidth,
			top,
			bottom,
			measure,
		);
		for (const seg of layout.segments) {
			expect(seg.runs.map((run) => run.text).join("")).toBe(seg.text);
		}
		// The baker walks the runs to place chips, so a topic has to survive into them.
		const body = layout.segments.filter((seg) => !seg.bold).flatMap((seg) => seg.runs);
		expect(body.filter((run) => run.tag !== null).map((run) => run.tag)).toEqual(["todo"]);
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
