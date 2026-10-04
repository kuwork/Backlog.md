import type { Memo } from "../../core/memos.ts";

/**
 * Pure board-layout logic for the memos pushpin board (`/memos?view=board`). Kept free of DOM and
 * WebGL so the scatter, the variant assignment, the text wrapping and the hit test are testable on
 * their own. Everything is derived from the memo id by hash, so the same set of memos always lands
 * on the same pins - a reload never reshuffles the board.
 *
 * The board is a FIXED area (a blackboard, not a page). Notes are placed in three tiers:
 *   1. the base grid - one note per evenly divided cell, gaps wider than the paper;
 *   2. the gap layer - pinned on the seams between base cells, where the layer below has no ink;
 *   3. the corner pile - whatever still does not fit cascades into the bottom-right corner, each
 *      note peeking out from under the next, so the stack itself announces there is more to see.
 * Text wrapping is estimated by character width rather than measured with a canvas, so the pure
 * layout and the texture baker always agree on a note's height.
 */

/** World width of a sticky note, in board pixels. The height grows with the memo's text. */
export const NOTE_WIDTH = 220;
/** Shortest a note gets, so even a one-liner still reads as a sticky note. */
export const NOTE_MIN_HEIGHT = 150;
/** Grid pitch; the slack over NOTE_WIDTH keeps the base layer airy and readable. */
export const NOTE_PITCH_X = 245;
export const NOTE_PITCH_Y = 250;
/** Deterministic tilt range, ±radians. */
export const NOTE_TILT = 0.09;
/** Cascading offset between stacked notes in the corner pile. */
export const PILE_STEP = 18;

/** Ink geometry shared by the estimator and the texture baker. */
export const NOTE_INK = {
	inset: 16,
	pinClearance: 42,
	titleLineHeight: 20,
	bodyLineHeight: 18,
	titleFontSize: 15,
	bodyFontSize: 12.5,
	bottomReserve: 30,
} as const;

/** Yellow-paper variants, in the spirit of classic sticky notes. */
export const PAPER_COLORS: readonly string[] = ["#fff3a6", "#ffe98c", "#fdf0a0", "#fff8c4", "#ffdf7e"];
/** Pushpin head colors. */
export const PIN_COLORS: readonly string[] = ["#e5484d", "#30a46c", "#3e63dd", "#f76b15", "#8e4ec6", "#12a594"];

export interface BoardNoteVariant {
	paper: string;
	pin: string;
	/** Whether the bottom-right corner is folded. */
	curl: boolean;
	/** Rotation in radians. */
	tilt: number;
}

export interface BoardNote {
	memo: Memo;
	/** Center of the paper in world coordinates. */
	x: number;
	y: number;
	/** Paper height; the width is always NOTE_WIDTH. */
	h: number;
	/** Stacking tier: 0 is the base grid, 1 the gaps between cells, 2 the corner pile. */
	layer: number;
	variant: BoardNoteVariant;
}

export interface BoardLayout {
	notes: BoardNote[];
}

/** FNV-1a 32-bit: tiny, stable across runs, good enough to scatter notes. */
export function hashString(value: string): number {
	let hash = 0x811c9dc5;
	for (let i = 0; i < value.length; i++) {
		hash ^= value.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193);
	}
	return hash >>> 0;
}

/** One deterministic pseudo-random in [0, 1) for a memo and a stream index. */
function unitFor(id: string, stream: number): number {
	return hashString(`${id}#${stream}`) / 0xffffffff;
}

/** All look-and-feel choices for one memo, hashed from its id. */
export function noteVariantFor(memo: Memo): BoardNoteVariant {
	const id = memo.id;
	return {
		paper: PAPER_COLORS[hashString(`${id}#paper`) % PAPER_COLORS.length] ?? "#fff3a6",
		pin: PIN_COLORS[hashString(`${id}#pin`) % PIN_COLORS.length] ?? "#e5484d",
		curl: unitFor(id, 3) < 0.35,
		tilt: (unitFor(id, 4) * 2 - 1) * NOTE_TILT,
	};
}

/** Strip the markdown markers that would read as noise on a sticky note. */
export function plainLine(line: string): string {
	return line
		.replace(/^\s*(?:>\s*)*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/, "")
		.replace(/^\s*#{1,6}\s+/, "")
		.replace(/[*_`]/g, "")
		.trim();
}

/** Approximate pixel width: CJK glyphs are ~1 em, latin/digits ~0.55 em. */
function textWidthUnits(text: string, fontSize: number): number {
	let units = 0;
	for (const char of text) {
		units += (char.codePointAt(0) ?? 0) > 0x2e7f ? fontSize : fontSize * 0.55;
	}
	return units;
}

/**
 * Wrap `text` by estimated width: latin words stay whole, every other character (CJK included) may
 * break anywhere. The texture baker draws exactly these lines, so the paper height the layout
 * reserves always fits the ink.
 */
export function wrapEstimate(text: string, maxWidth: number, fontSize: number): string[] {
	const tokens = text.match(/[A-Za-z0-9_'-]+|\S/gu) ?? [];
	const lines: string[] = [];
	let current = "";
	let currentWidth = 0;
	for (const token of tokens) {
		const latinJoin = current.length > 0 && /[A-Za-z0-9_'-]$/.test(current) && /^[A-Za-z0-9_'-]/.test(token);
		const tokenWidth = textWidthUnits(token, fontSize) + (latinJoin ? fontSize * 0.3 : 0);
		if (currentWidth + tokenWidth <= maxWidth) {
			current += (latinJoin ? " " : "") + token;
			currentWidth += tokenWidth;
			continue;
		}
		if (current.length > 0) lines.push(current);
		current = token;
		currentWidth = textWidthUnits(token, fontSize);
	}
	if (current.length > 0) lines.push(current);
	return lines;
}

/** The memo's text as note ink lines: first non-empty line is the heading, the rest the body. */
export function memoInkLines(memo: Memo): { title: string; body: string[] } {
	const lines = memo.rawContent
		.split("\n")
		.map(plainLine)
		.filter((line) => line.length > 0);
	const title = lines.shift() ?? memo.displayTitle;
	return { title, body: lines };
}

/** Depth from the paper's top edge to the bottom of the last ink line (text only, no footer). */
export function memoInkDepth(memo: Memo): number {
	const maxWidth = NOTE_WIDTH - NOTE_INK.inset * 2;
	const { title, body } = memoInkLines(memo);
	const titleLines = wrapEstimate(title, maxWidth, NOTE_INK.titleFontSize).length;
	let bodyLines = 0;
	for (const line of body) {
		bodyLines += wrapEstimate(line, maxWidth, NOTE_INK.bodyFontSize).length;
	}
	return (
		NOTE_INK.pinClearance +
		titleLines * NOTE_INK.titleLineHeight +
		(body.length > 0 ? 4 : 0) +
		bodyLines * NOTE_INK.bodyLineHeight
	);
}

/** Paper height that fits the memo's whole text - notes are never clamped to a line count. */
export function estimateNoteHeight(memo: Memo): number {
	return Math.max(NOTE_MIN_HEIGHT, Math.ceil(memoInkDepth(memo) + NOTE_INK.bottomReserve));
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Pin memos onto the fixed `boardW` x `boardH` world in three tiers: the base grid fills its cells
 * first; the gap layer tucks notes onto the seams between cells, just under the text of the row
 * above - the paper may cover that row's date and tag footer, never its text; whatever still does
 * not fit piles into the bottom-right corner as a visible cascade. When a pile is needed at all,
 * the bottom-right cell is left out of the base grid so the stack never swallows a base note.
 */
export function layoutBoard(memos: Memo[], boardW: number, boardH: number): BoardLayout {
	const width = Math.max(boardW, NOTE_PITCH_X);
	const height = Math.max(boardH, NOTE_PITCH_Y);
	const cols = Math.max(1, Math.floor(width / NOTE_PITCH_X));
	const rowsFit = Math.max(1, Math.floor(height / NOTE_PITCH_Y));
	const cellW = width / cols;
	const cellH = height / rowsFit;
	const baseSlots = cols * rowsFit;
	const clampX = (x: number) => clamp(x, NOTE_WIDTH / 2 + 6, width - NOTE_WIDTH / 2 - 6);
	const jitter = (id: string, stream: number, range: number, scale: number) =>
		(unitFor(id, stream) - 0.5) * Math.max(0, range) * scale;

	const build = (baseCapacity: number): BoardNote[] => {
		// Tier 1: the base grid, one note per cell.
		const base: (BoardNote | null)[] = [];
		const baseCount = Math.min(memos.length, baseCapacity);
		for (let i = 0; i < baseCount; i++) {
			const memo = memos[i];
			if (!memo) break;
			const h = estimateNoteHeight(memo);
			const col = i % cols;
			const row = Math.floor(i / cols);
			base.push({
				memo,
				x: clampX(col * cellW + cellW / 2 + jitter(memo.id, 1, cellW - NOTE_WIDTH, 0.3)),
				y: clamp(row * cellH + cellH / 2 + jitter(memo.id, 2, cellH - h, 0.3), h / 2 + 6, height - h / 2 - 6),
				h,
				layer: 0,
				variant: noteVariantFor(memo),
			});
		}
		while (base.length < baseSlots) base.push(null);
		const notes: BoardNote[] = base.filter((note): note is BoardNote => note !== null);

		// Tier 2: the seams between cells. A seam note is top-aligned just below the lowest text line
		// of the two notes above, and must end before the text of the two notes below starts; seams
		// without enough vertical room stay empty.
		const inkBottomOf = (note: BoardNote | null) =>
			note === null ? Number.NEGATIVE_INFINITY : note.y - note.h / 2 + memoInkDepth(note.memo);
		const textTopOf = (note: BoardNote | null) =>
			note === null ? Number.POSITIVE_INFINITY : note.y - note.h / 2 + NOTE_INK.pinClearance;
		let next = baseCount;
		for (let row = 0; row < rowsFit - 1 && next < memos.length; row++) {
			for (let col = 0; col < cols - 1 && next < memos.length; col++) {
				const aboveL = base[row * cols + col] ?? null;
				const aboveR = base[row * cols + col + 1] ?? null;
				if (aboveL === null && aboveR === null) continue;
				const top = Math.max(inkBottomOf(aboveL), inkBottomOf(aboveR)) + 4;
				const bottomLimit =
					Math.min(
						textTopOf(base[(row + 1) * cols + col] ?? null),
						textTopOf(base[(row + 1) * cols + col + 1] ?? null),
					) - 4;
				const memo = memos[next];
				if (!memo) break;
				const h = estimateNoteHeight(memo);
				if (bottomLimit - top < h) continue;
				notes.push({
					memo,
					x: clampX((col + 1) * cellW + jitter(memo.id, 1, 16, 1)),
					y: top + h / 2,
					h,
					layer: 1,
					variant: noteVariantFor(memo),
				});
				next++;
			}
		}

		// Tier 3: the corner pile, stacked in the bottom-right cell (kept free of base notes). Each
		// note shifts up-left from the one below around the cell center, so every sheet's edge stays
		// visible and the stack reads as "there are more notes here". The whole cascade shifts as one
		// if it would cross the board edge, so clamping never flattens the stagger.
		const pileCount = memos.length - next;
		const anchorX = width - cellW / 2;
		const anchorY = height - cellH / 2;
		const pile: BoardNote[] = [];
		for (let k = 0; k < pileCount; k++, next++) {
			const memo = memos[next];
			if (!memo) break;
			const h = estimateNoteHeight(memo);
			const offset = ((pileCount - 1) / 2 - k) * PILE_STEP;
			pile.push({ memo, x: anchorX + offset, y: anchorY + offset, h, layer: 2, variant: noteVariantFor(memo) });
		}
		let shiftX = 0;
		let shiftY = 0;
		for (const note of pile) {
			shiftX = Math.max(shiftX, note.x - (width - NOTE_WIDTH / 2 - 6));
			shiftY = Math.max(shiftY, note.y - (height - note.h / 2 - 6));
		}
		for (const note of pile) {
			note.x = Math.max(NOTE_WIDTH / 2 + 6, note.x - shiftX);
			note.y = Math.max(note.h / 2 + 6, note.y - shiftY);
			notes.push(note);
		}
		return notes;
	};

	const full = build(baseSlots);
	const hasPile = full.some((note) => note.layer === 2);
	return { notes: hasPile && baseSlots > 1 ? build(baseSlots - 1) : full };
}

/**
 * The topmost note containing the world-space point, or null. Notes render in array order, so the
 * last hit in the array is the one on top. The point is un-rotated into the note's frame before
 * the half-extent test.
 */
export function hitTest(notes: BoardNote[], x: number, y: number): BoardNote | null {
	const halfW = NOTE_WIDTH / 2;
	for (let i = notes.length - 1; i >= 0; i--) {
		const note = notes[i];
		if (!note) continue;
		const dx = x - note.x;
		const dy = y - note.y;
		const cos = Math.cos(-note.variant.tilt);
		const sin = Math.sin(-note.variant.tilt);
		const lx = dx * cos - dy * sin;
		const ly = dx * sin + dy * cos;
		if (Math.abs(lx) <= halfW && Math.abs(ly) <= note.h / 2) return note;
	}
	return null;
}
