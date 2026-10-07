import type { BaseType, Selection } from "d3-selection";
import { interrupt as d3Interrupt } from "d3-transition";

/**
 * d3-zoom's zoom.transform() calls selection.interrupt(), a prototype patch that d3-transition
 * installs. Bun's bundler can duplicate d3-selection across a bundle, so the patch may land on a
 * different Selection class than the selections a view creates. This gives the selections we hold
 * an interrupt that operates on the DOM node directly, which works regardless of which class
 * instance it came from.
 */
export function ensureZoomInterrupt<GElement extends BaseType>(
	selection: Selection<GElement, unknown, null, undefined>,
): void {
	const proto = Object.getPrototypeOf(selection) as { interrupt?: (name?: string) => unknown };
	if (typeof proto.interrupt !== "function") {
		proto.interrupt = function (name?: string) {
			return (this as unknown as { each: (cb: (this: Element) => void) => unknown }).each(function (this: Element) {
				d3Interrupt(this, name);
			});
		};
	}
}

/**
 * Shared Canvas 2D paint helpers for the graph views (GraphView and TaskDependencyGraph). Both
 * views draw the same visual language - rim-trimmed edges with arrowheads, dashed relation styles,
 * caption plates - so the canvas path code lives here exactly once. All geometry is in graph space;
 * the caller sets the transform and passes the live zoom factor k for constant-screen-size maths.
 */

/** Node circles keep a constant screen size across zooms, clamped so extreme zooms stay sane. */
export function scaledRadius(radius: number, k: number): number {
	return Math.max(2.5, Math.min(30, radius / k));
}

/**
 * Rounded-rect path via arcTo. ctx.roundRect would do this in one call, but it is missing from
 * older canvas implementations (Chrome < 99, older WebView2), and a throw inside a draw unmounts
 * the whole view.
 */
export function platePath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.arcTo(x + w, y, x + w, y + h, r);
	ctx.arcTo(x + w, y + h, x, y + h, r);
	ctx.arcTo(x, y + h, x, y, r);
	ctx.arcTo(x, y, x + w, y, r);
	ctx.closePath();
}

/** A dash string like "6 3" rescaled for the current zoom, as canvas setLineDash segments. */
export function dashAtZoom(dash: string | undefined, k: number): number[] {
	return dash ? dash.split(" ").map((value) => Number(value) / k) : [];
}

export interface EdgeStrokeOptions {
	/** Zoom factor: stroke width, dashes and the arrowhead are rescaled to constant screen size. */
	k: number;
	/** Radius of the target node's circle on screen scale (already passed through scaledRadius). */
	targetRadius: number;
	/** Screen-space gap between the arrowhead tip and the target's rim. */
	arrowGap: number;
	/** Screen-space arrowhead size; 0 draws no arrowhead (e.g. BelongsToMilestone stays plain). */
	arrowSize: number;
	stroke: string;
	dash?: string;
	alpha: number;
}

/**
 * One directed edge: the line stops at the target's rim plus a small gap so the arrowhead tip
 * lands just outside the circle instead of being buried under it, and the arrowhead is drawn
 * explicitly (canvas has no marker elements).
 */
export function strokeEdge(
	ctx: CanvasRenderingContext2D,
	sx: number,
	sy: number,
	tx: number,
	ty: number,
	{ k, targetRadius, arrowGap, arrowSize, stroke, dash, alpha }: EdgeStrokeOptions,
): void {
	const length = Math.hypot(tx - sx, ty - sy);
	const trim = targetRadius + arrowGap / k;
	const u = length > 0 ? Math.max(0, (length - trim) / length) : 1;
	const ex = sx + (tx - sx) * u;
	const ey = sy + (ty - sy) * u;
	ctx.globalAlpha = alpha;
	ctx.setLineDash(dashAtZoom(dash, k));
	ctx.strokeStyle = stroke;
	ctx.lineWidth = Math.max(0.35, 1 / k);
	ctx.beginPath();
	ctx.moveTo(sx, sy);
	ctx.lineTo(ex, ey);
	ctx.stroke();
	ctx.setLineDash([]);
	if (arrowSize > 0 && length > 0) {
		const size = arrowSize / k;
		const ux = (tx - sx) / length;
		const uy = (ty - sy) / length;
		ctx.fillStyle = stroke;
		ctx.beginPath();
		ctx.moveTo(ex, ey);
		ctx.lineTo(ex - ux * size - uy * size * 0.5, ey - uy * size + ux * size * 0.5);
		ctx.lineTo(ex - ux * size + uy * size * 0.5, ey - uy * size - ux * size * 0.5);
		ctx.closePath();
		ctx.fill();
	}
}

/**
 * One reusable edge slot for a batched paint. The view keeps one item per link and rewrites the
 * fields on every frame, so a repaint allocates nothing; `ex`/`ey`/`ux`/`uy` are filled in by
 * `strokeEdgeBatch` for its arrowhead pass.
 */
export interface EdgeBatchItem {
	sx: number;
	sy: number;
	tx: number;
	ty: number;
	/** Radius of the target node's circle on screen scale (already passed through scaledRadius). */
	targetRadius: number;
	/** Screen-space arrowhead size; 0 draws no arrowhead. */
	arrowSize: number;
	/** Trimmed line end and unit direction, written by the batch painter. */
	ex: number;
	ey: number;
	ux: number;
	uy: number;
}

/**
 * Every edge of one style in a single path: `strokeEdge` costs one `beginPath`+`stroke`+`fill`
 * per edge, which is a frame's whole budget once a corpus carries a few thousand relations.
 * Batching collapses that to one stroke and one fill per (dash, alpha) group, all with the same
 * geometry (the line still stops at the target's rim, the arrowhead still sits just outside it).
 */
export function strokeEdgeBatch(
	ctx: CanvasRenderingContext2D,
	items: EdgeBatchItem[],
	{ k, arrowGap, stroke, dash, alpha }: { k: number; arrowGap: number; stroke: string; dash?: string; alpha: number },
): void {
	if (items.length === 0) return;
	ctx.globalAlpha = alpha;
	ctx.setLineDash(dashAtZoom(dash, k));
	ctx.strokeStyle = stroke;
	ctx.lineWidth = Math.max(0.35, 1 / k);
	ctx.beginPath();
	for (const item of items) {
		const dx = item.tx - item.sx;
		const dy = item.ty - item.sy;
		const length = Math.hypot(dx, dy);
		const u = length > 0 ? Math.max(0, (length - (item.targetRadius + arrowGap / k)) / length) : 1;
		item.ex = item.sx + dx * u;
		item.ey = item.sy + dy * u;
		item.ux = length > 0 ? dx / length : 0;
		item.uy = length > 0 ? dy / length : 0;
		ctx.moveTo(item.sx, item.sy);
		ctx.lineTo(item.ex, item.ey);
	}
	ctx.stroke();
	ctx.setLineDash([]);
	// Second pass: one fill covers every arrowhead of the batch.
	ctx.fillStyle = stroke;
	ctx.beginPath();
	let heads = 0;
	for (const item of items) {
		if (item.arrowSize <= 0 || (item.ux === 0 && item.uy === 0)) continue;
		const size = item.arrowSize / k;
		ctx.moveTo(item.ex, item.ey);
		ctx.lineTo(item.ex - item.ux * size - item.uy * size * 0.5, item.ey - item.uy * size + item.ux * size * 0.5);
		ctx.lineTo(item.ex - item.ux * size + item.uy * size * 0.5, item.ey - item.uy * size - item.ux * size * 0.5);
		ctx.closePath();
		heads += 1;
	}
	if (heads > 0) ctx.fill();
}

/** One reusable node slot for a batched paint: a circle at graph-space `x`/`y`. */
export interface NodeBatchItem {
	x: number;
	y: number;
	radius: number;
}

/**
 * Every circle of one style in a single path: fill and stroke once for the whole batch instead of
 * per node. `moveTo` before each `arc` keeps sub-paths separate - without it canvas would draw a
 * chord from the previous circle's end to this one's start.
 */
export function paintNodeBatch(
	ctx: CanvasRenderingContext2D,
	items: NodeBatchItem[],
	{ fill, stroke, lineWidth, alpha }: { fill: string; stroke: string; lineWidth: number; alpha: number },
): void {
	if (items.length === 0) return;
	ctx.globalAlpha = alpha;
	ctx.beginPath();
	for (const item of items) {
		ctx.moveTo(item.x + item.radius, item.y);
		ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2);
	}
	ctx.fillStyle = fill;
	ctx.fill();
	ctx.lineWidth = lineWidth;
	ctx.strokeStyle = stroke;
	ctx.stroke();
}

/** The relation name along an edge: rotated with the line, flipped so it never reads upside-down. */
export function drawEdgeLabel(
	ctx: CanvasRenderingContext2D,
	label: string,
	sx: number,
	sy: number,
	tx: number,
	ty: number,
	k: number,
	lift: number,
	alpha: number,
	color: string,
	fontSize: number,
): void {
	let angle = Math.atan2(ty - sy, tx - sx);
	if (angle > Math.PI / 2 || angle < -Math.PI / 2) angle += Math.PI;
	ctx.save();
	ctx.globalAlpha = alpha;
	ctx.font = `${fontSize / k}px sans-serif`;
	ctx.textAlign = "center";
	ctx.textBaseline = "alphabetic";
	ctx.fillStyle = color;
	ctx.translate((sx + tx) / 2, (sy + ty) / 2);
	ctx.rotate(angle);
	ctx.fillText(label, 0, lift / k);
	ctx.restore();
}

/** A caption on a rounded plate under the node, at constant screen size (all inputs graph-space). */
export function drawCaption(
	ctx: CanvasRenderingContext2D,
	text: string,
	x: number,
	y: number,
	rim: number,
	plateWidth: number,
	k: number,
	alpha: number,
	colors: { plateFill: string; plateStroke: string; label: string },
): void {
	const fontSize = 10.5 / k;
	const plateHeight = 16 / k;
	const width = plateWidth / k;
	ctx.globalAlpha = alpha;
	platePath(ctx, x - width / 2, y + rim + 4 / k, width, plateHeight, 8 / k);
	ctx.fillStyle = colors.plateFill;
	ctx.fill();
	ctx.lineWidth = Math.max(0.35, 1 / k);
	ctx.strokeStyle = colors.plateStroke;
	ctx.stroke();
	ctx.font = `${fontSize}px sans-serif`;
	ctx.textAlign = "center";
	ctx.textBaseline = "alphabetic";
	ctx.fillStyle = colors.label;
	ctx.fillText(text, x, y + rim + plateHeight);
}

/** Plate and label colors follow the app theme; canvas has no stylesheet to do it. */
export function canvasThemeColors(theme: string): { plateFill: string; plateStroke: string; label: string } {
	return theme === "dark"
		? { plateFill: "#111827E6", plateStroke: "#4B5563", label: "#d1d5db" }
		: { plateFill: "#FFFFFFE6", plateStroke: "#D1D5DB", label: "#374151" };
}
