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
/** Fixed paper height: the board fills the ink to this and truncates the rest with an ellipsis. */
export const NOTE_HEIGHT = 150;
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
 * Wrap `text` by width: latin words stay whole, every other character (CJK included) may break
 * anywhere. A closed `#topic#` is one token - a chip has to stay on one line to be a chip, so it is
 * never broken the way a CJK run is. Width comes from `measure` when given (the canvas baker's real
 * font metrics) and from the character-width estimate otherwise; the two must agree on where a line
 * breaks, or a line the estimate thinks fits is drawn wider than the paper and spills out of it.
 * `bold` only matters when `measure` is given - it is the baker's own weight flag.
 */
export function wrapEstimate(
	text: string,
	maxWidth: number,
	fontSize: number,
	measure?: (text: string, fontSize: number, bold: boolean) => number,
	bold = false,
): string[] {
	const widthOf = measure
		? (token: string) => measure(token, fontSize, bold)
		: (token: string) => textWidthUnits(token, fontSize);
	const tokens = text.match(/#(?:[^\s#`]+)#|[A-Za-z0-9_'-]+|\S/gu) ?? [];
	const lines: string[] = [];
	let current = "";
	let currentWidth = 0;
	for (const token of tokens) {
		const latinJoin = current.length > 0 && /[A-Za-z0-9_'-]$/.test(current) && /^[A-Za-z0-9_'-]/.test(token);
		const tokenWidth = widthOf(token) + (latinJoin ? fontSize * 0.3 : 0);
		if (currentWidth + tokenWidth <= maxWidth) {
			current += (latinJoin ? " " : "") + token;
			currentWidth += tokenWidth;
			continue;
		}
		if (current.length > 0) lines.push(current);
		current = token;
		currentWidth = widthOf(token);
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

/**
 * The closed `#topic#` form - the same shape the feed lifts into tags and chips, so a note's ink
 * and a card's body read the same way. Closing it with a second hash is what keeps an ordinary
 * reference (`PR #268`) out of the chip pass.
 */
const INK_TOPIC_PATTERN = /#([^\s#`]+)#/g;

/** One run of ink on a note: plain text, or a `#topic#` that the baker dresses with a chip. */
export interface InkRun {
	text: string;
	/** The topic the run stands for, or null for plain ink. */
	tag: string | null;
}

/**
 * Split an already-wrapped ink line into plain runs and topic runs. The baker draws them left to
 * right with the measured widths, so a chip can be painted behind a run without knowing the font.
 */
export function splitInkRuns(line: string): InkRun[] {
	if (line.length === 0) return [];
	const runs: InkRun[] = [];
	let cursor = 0;
	INK_TOPIC_PATTERN.lastIndex = 0;
	for (let match = INK_TOPIC_PATTERN.exec(line); match; match = INK_TOPIC_PATTERN.exec(line)) {
		const tag = match[1];
		if (!tag) continue;
		if (match.index > cursor) runs.push({ text: line.slice(cursor, match.index), tag: null });
		runs.push({ text: match[0], tag });
		cursor = match.index + match[0].length;
	}
	if (cursor < line.length) runs.push({ text: line.slice(cursor), tag: null });
	return runs.length > 0 ? runs : [{ text: line, tag: null }];
}

/** One laid-out ink line for the pinboard: bold heading or regular body, at its own font/size. */
export interface InkSegment {
	text: string;
	/** `text` split into plain and topic runs; drawn left to right, widths measured per run. */
	runs: InkRun[];
	bold: boolean;
	fontSize: number;
	lineHeight: number;
}

/** One run placed on its line: where the baker paints the chip and then draws the text. */
export interface InkBox {
	text: string;
	tag: string | null;
	/** Left edge, in the same coordinates the line is drawn at. */
	x: number;
	width: number;
	/** True when the run's tag is one the view is narrowed by. */
	on: boolean;
}

/**
 * Place a segment's runs left to right from `startX`. The baker walks the result: a chip behind
 * every box that carries a tag, then the run's own text - so nothing here needs to know the font.
 */
export function inkRunBoxes(
	segment: InkSegment,
	startX: number,
	measure: (text: string, fontSize: number, bold: boolean) => number,
	activeTags: ReadonlySet<string>,
): InkBox[] {
	const active = new Set([...activeTags].map((tag) => tag.toLowerCase()));
	const runs = segment.runs.length > 0 ? segment.runs : [{ text: segment.text, tag: null }];
	const boxes: InkBox[] = [];
	let x = startX;
	for (const run of runs) {
		const width = measure(run.text, segment.fontSize, segment.bold);
		boxes.push({
			text: run.text,
			tag: run.tag,
			x,
			width,
			on: run.tag ? active.has(run.tag.toLowerCase()) : false,
		});
		x += width;
	}
	return boxes;
}

/** One tag in the footer's list, placed right-to-left against the paper's inner right edge. */
export interface FooterTagBox {
	text: string;
	tag: string;
	/** Left edge, in the same coordinates the footer is drawn at. */
	x: number;
	width: number;
	/** True when this tag is one the view is narrowed by. */
	on: boolean;
}

/** How many tags the footer has room for. */
export const FOOTER_TAG_LIMIT = 2;
/** Space between two footer tags. */
export const FOOTER_TAG_GAP = 6;

/**
 * Lay the footer's tag list out from the right: `#tag` labels in memo order, right-aligned as a
 * block. Only the tags the view is narrowed by come back `on` - the rest are tags, not highlights.
 */
export function footerTagBoxes(
	tags: string[],
	rightEdge: number,
	measure: (text: string) => number,
	activeTags: ReadonlySet<string>,
): FooterTagBox[] {
	const active = new Set([...activeTags].map((tag) => tag.toLowerCase()));
	const shown = tags.slice(0, FOOTER_TAG_LIMIT);
	const labels = shown.map((tag) => `#${tag}`);
	const widths = labels.map((label) => measure(label));
	const total = widths.reduce((sum, item) => sum + item, 0) + FOOTER_TAG_GAP * (labels.length - 1);
	const boxes: FooterTagBox[] = [];
	let x = rightEdge - total;
	for (let i = 0; i < labels.length; i++) {
		const tag = shown[i] ?? "";
		const width = widths[i] ?? 0;
		boxes.push({
			text: labels[i] ?? "",
			tag,
			x,
			width,
			on: active.has(tag.toLowerCase()),
		});
		x += width + FOOTER_TAG_GAP;
	}
	return boxes;
}

/** The result of fitting a memo's ink into a fixed-height box. */
export interface InkLayout {
	segments: InkSegment[];
	/** True when the last segment was trimmed and an ellipsis appended. */
	truncated: boolean;
}

/** Approximate ink width, mirroring `wrapEstimate`, for layouts without a live canvas. */
export function approxInkWidth(text: string, fontSize: number, _bold: boolean): number {
	return textWidthUnits(text, fontSize);
}

/**
 * Lay the memo's ink (bold heading + body) into the band between `top` and `bottom` at `maxWidth`,
 * wrapping exactly the way `wrapEstimate` does. As many leading lines as fit are returned; if ink
 * is left over, the final segment is trimmed to fit and an ellipsis appended, and `truncated` is
 * true. `measureWidth` is injected so the same logic serves both the canvas baker and unit tests.
 */
export function layoutInkLines(
	memo: Memo,
	maxWidth: number,
	top: number,
	bottom: number,
	measureWidth: (text: string, fontSize: number, bold: boolean) => number,
): InkLayout {
	const { title, body } = memoInkLines(memo);
	// Wrap with the injected measure so the line breaks here match what the baker actually draws:
	// estimating the break and then drawing with real glyph widths is what let a line the estimate
	// called "fits" spill past the paper's right edge.
	const wrapTitle = (line: string) => wrapEstimate(line, maxWidth, NOTE_INK.titleFontSize, measureWidth, true);
	const wrapBody = (line: string) => wrapEstimate(line, maxWidth, NOTE_INK.bodyFontSize, measureWidth);
	const titleLines = wrapTitle(title);
	const bodyLines: string[] = [];
	for (const sourceLine of body) {
		for (const line of wrapBody(sourceLine)) {
			bodyLines.push(line);
		}
	}
	const withRuns = (line: string) => ({ text: line, runs: splitInkRuns(line) });
	const segments: InkSegment[] = [
		...titleLines.map((line) => ({
			...withRuns(line),
			bold: true,
			fontSize: NOTE_INK.titleFontSize,
			lineHeight: NOTE_INK.titleLineHeight,
		})),
		...bodyLines.map((line) => ({
			...withRuns(line),
			bold: false,
			fontSize: NOTE_INK.bodyFontSize,
			lineHeight: NOTE_INK.bodyLineHeight,
		})),
	];

	const laid: InkSegment[] = [];
	let cursor = top;
	let passedTitle = false;
	let truncated = false;

	// Trim a line to `maxWidth` with an ellipsis, using the same measure the baker draws with.
	// Needed for a token that cannot break (a long latin word, a `#topic#`): wrapping leaves it
	// alone even when it alone is wider than the paper, so it has to be cut here. Pass
	// `ellipsis: true` to force one (the height-truncation case always cuts the line short).
	const clampLine = (seg: InkSegment, forceEllipsis = false): InkSegment => {
		let text = seg.text;
		let clipped = forceEllipsis;
		if (forceEllipsis && !text.endsWith("…")) text = `${text}…`;
		if (measureWidth(text, seg.fontSize, seg.bold) > maxWidth) {
			clipped = true;
			let trimmed = seg.text;
			for (;;) {
				const width = measureWidth(`${trimmed}…`, seg.fontSize, seg.bold);
				if (trimmed.length === 0 || width <= maxWidth) break;
				trimmed = trimmed.slice(0, -1);
			}
			text = `${trimmed}…`;
		}
		return clipped ? { ...seg, text, runs: splitInkRuns(text) } : seg;
	};

	for (let i = 0; i < segments.length; i++) {
		const seg = segments[i];
		if (!seg) break;
		if (!passedTitle && i === titleLines.length) {
			cursor += 4;
			passedTitle = true;
		}
		if (cursor + seg.lineHeight > bottom) {
			// Past the bottom: the line is cut short, so it always ends with an ellipsis.
			laid.push(clampLine(seg, true));
			truncated = true;
			break;
		}
		const fitted = clampLine(seg);
		laid.push(fitted);
		if (fitted.text !== seg.text) truncated = true;
		cursor += seg.lineHeight;
	}
	return { segments: laid, truncated };
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

/** Fixed paper height, independent of the memo's length - overflow is truncated with an ellipsis. */
export function estimateNoteHeight(_memo: Memo): number {
	return NOTE_HEIGHT;
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
			note === null
				? Number.NEGATIVE_INFINITY
				: Math.min(note.y - note.h / 2 + memoInkDepth(note.memo), note.y + note.h / 2);
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
