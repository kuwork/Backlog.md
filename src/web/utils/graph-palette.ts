/**
 * The colour vocabulary for the graph views.
 *
 * Two families live here. The corpus graphs colour eight fixed kinds from a hand-tuned table -
 * the corpus knows what a task, a milestone or a wiki page is, so each one gets a colour chosen
 * for it. The Cypher result graph on the databases page (BACK-794) does not: a user database has
 * whatever labels and properties the user gave it, so its colours come from a ring the buckets
 * walk in order.
 *
 * The rule both families share is that a bucket's colour is a function of its *rank*, never of a
 * hash of its contents. A plain `hash * 31` put Person, Item and Product on the same hue - measured,
 * not imagined - because short labels differ in the bits the modulo throws away; and a colour that
 * changes when a value is spelled differently is worse than no colour at all.
 *
 * The stroke follows the same theme policy throughout: a pale tint reads as a glow on the dark
 * canvas, a darker shade gives a light canvas the classic fill-plus-border read.
 */

/** Node kinds a graph view colours, one per legend entry. */
export type NodeStyle = "task" | "completed" | "draft" | "milestone" | "wiki" | "decision" | "document" | "tag";

/**
 * Blue for open work, amber for drafts, green for completed, purple for milestones; phase 3 adds
 * one hue per knowledge kind plus a low-contrast grey for Tag nodes (doc-15 §7 wants them
 * recessive).
 */
export const NODE_FILL: Record<NodeStyle, string> = {
	task: "#3b82f6",
	completed: "#10b981",
	draft: "#f59e0b",
	milestone: "#a855f7",
	wiki: "#06b6d4",
	decision: "#ec4899",
	document: "#6366f1",
	tag: "#9ca3af",
};

/**
 * Node fill with theme compensation. The tag gray is tuned for light surfaces - on the dark
 * canvas it sinks into the background and the classification nodes read as absent (doc-15 §7
 * asks for recessive, not invisible). Used by the canvas painters and the legend dots alike,
 * so the dot and the node never disagree.
 */
export function nodeFill(style: NodeStyle, theme: string): string {
	return theme === "dark" && style === "tag" ? "#cbd5e1" : NODE_FILL[style];
}

/** Light tint of each fill, so nodes read as tiles instead of flat dots (Neo4j-style). */
export const NODE_STROKE: Record<NodeStyle, string> = {
	task: "#93c5fd",
	completed: "#6ee7b7",
	draft: "#fcd34d",
	milestone: "#d8b4fe",
	wiki: "#67e8f9",
	decision: "#f9a8d4",
	document: "#a5b4fc",
	tag: "#d1d5db",
};

/** Same-hue 700 shade of each fill: a real outline on a light canvas. */
const NODE_STROKE_LIGHT: Record<NodeStyle, string> = {
	task: "#1d4ed8",
	completed: "#047857",
	draft: "#b45309",
	milestone: "#7e22ce",
	wiki: "#0e7490",
	decision: "#be185d",
	document: "#4338ca",
	tag: "#6b7280",
};

/**
 * Node stroke with theme compensation. The pale tints double as a glow on the dark canvas but
 * vanish on a light one, so the light theme switches to a darker shade of the fill — the classic
 * fill-plus-dark-border read. The tag gray stays a step lighter to keep it recessive.
 */
export function nodeStroke(style: NodeStyle, theme: string): string {
	return theme === "dark" ? NODE_STROKE[style] : NODE_STROKE_LIGHT[style];
}

/**
 * Which corpus bucket a node belongs to - the corpus graph's own classification, shared with the
 * result graph so the two pages cannot drift apart.
 *
 * `kind` is the node's declared kind (task / draft / milestone / wiki / decision / document / tag).
 * Only one distinction is not stored on the node: a completed task is still kind `task`, and it is
 * the file's home under `completed/` that says it is done. That is why the path is consulted at
 * all, and why it is consulted only there.
 */
export function corpusNodeStyle(node: { kind?: string; filePath?: string }): NodeStyle {
	switch (node.kind) {
		case "tag":
			return "tag";
		case "milestone":
			return "milestone";
		case "draft":
			return "draft";
		case "wiki":
			return "wiki";
		case "decision":
			return "decision";
		case "document":
			return "document";
		default:
			return (node.filePath ?? "").startsWith("completed/") ? "completed" : "task";
	}
}

/** Hues on the ring, evenly spaced so the first dozen labels are easy to tell apart. */
const PALETTE_SIZE = 12;

/**
 * FNV-1a with a final avalanche. A plain `hash * 31 + char` mod 12 piles short labels onto one
 * hue (Person, Item and Product all landed on the same slot), which is exactly the case this
 * palette exists for; the finalizer mixes the low bits the modulo reads.
 */
function labelHash(label: string): number {
	let hash = 2166136261;
	for (let index = 0; index < label.length; index += 1) {
		hash ^= label.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	hash ^= hash >>> 15;
	hash = Math.imul(hash, 2246822507);
	hash ^= hash >>> 13;
	return hash >>> 0;
}

/** The hue a node label paints with, in degrees. */
export function labelHue(label: string): number {
	return (labelHash(label) % PALETTE_SIZE) * (360 / PALETTE_SIZE);
}

/** True for a `#rrggbb` colour - the only form the colour pickers and the legend store carry. */
export function isHexColor(value: unknown): value is string {
	return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

/** hsl (degrees, percent, percent) as `#rrggbb`, so a resolved colour can feed a colour picker. */
function hslToHex(h: number, s: number, l: number): string {
	const sat = s / 100;
	const light = l / 100;
	const a = sat * Math.min(light, 1 - light);
	const channel = (n: number) => {
		const k = (n + (((h % 360) + 360) % 360) / 30) % 12;
		const value = light - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
		return Math.round(value * 255)
			.toString(16)
			.padStart(2, "0");
	};
	return `#${channel(0)}${channel(8)}${channel(4)}`;
}

/** Fill and stroke for one hue, theme-aware, as hex: the ring every automatic bucket reads from. */
export function hueNodeColors(hue: number, theme: string): { fill: string; stroke: string } {
	return theme === "dark"
		? { fill: hslToHex(hue, 65, 55), stroke: hslToHex(hue, 70, 75) }
		: { fill: hslToHex(hue, 60, 50), stroke: hslToHex(hue, 70, 38) };
}

/** Fill and stroke for one node label, theme-aware. */
export function labelNodeColors(label: string, theme: string): { fill: string; stroke: string } {
	return hueNodeColors(labelHue(label), theme);
}

/**
 * Fill and stroke for the bucket at `rank` of a result's own values - the colour card the panel's
 * "by value" mode walks. The rank, not the value, decides the colour, so the third value of a
 * query is the third swatch today and the third swatch tomorrow: the picture is stable across
 * re-runs, which a content hash cannot promise.
 */
export function categoryNodeColors(rank: number, theme: string): { fill: string; stroke: string } {
	const slot = ((rank % PALETTE_SIZE) + PALETTE_SIZE) % PALETTE_SIZE;
	return hueNodeColors(slot * (360 / PALETTE_SIZE), theme);
}

/**
 * The colour a numeric band is painted: a cool-to-warm ramp walked from the lowest band to the
 * highest, so a reader reads "more" as "warmer" without checking the labels. Bands are a gradient
 * rather than distinct hues because consecutive bands are neighbours on one axis - an even spread
 * of hues would imply categories that are not there.
 */
const RANGE_RAMP = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444"];

function hexToRgb(hex: string): [number, number, number] {
	const value = Number.parseInt(hex.slice(1), 16);
	return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
	const channel = (value: number) =>
		Math.max(0, Math.min(255, Math.round(value)))
			.toString(16)
			.padStart(2, "0");
	return `#${channel(r)}${channel(g)}${channel(b)}`;
}

/** Straight-line mix between two colours in sRGB - good enough for a four-stop ramp. */
function mixRgb(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
	return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[0]) * t, a[2] + (b[2] - a[2]) * t];
}

/** The photographic negative of a colour: every channel flipped (255 - c). */
function invertRgb([r, g, b]: [number, number, number]): [number, number, number] {
	return [255 - r, 255 - g, 255 - b];
}

/**
 * How a quick-add paints its generated rules with a colour segment (BACK-794): `count` colours
 * evenly interpolated between the two endpoints in sRGB. `invert` applies the photographic
 * negative to each sample; `overlayBase` then mixes each sample 50/50 with the type's own base
 * colour, so the subclasses still read as belonging to their type. A single colour lands at the
 * segment's midpoint.
 */
export interface GradientOptions {
	from: string;
	to: string;
	invert?: boolean;
	overlayBase?: string;
}

export function gradientColors(count: number, options: GradientOptions): string[] {
	if (count < 1 || !isHexColor(options.from) || !isHexColor(options.to)) return [];
	const from = hexToRgb(options.from);
	const to = hexToRgb(options.to);
	const overlay =
		options.overlayBase !== undefined && isHexColor(options.overlayBase) ? hexToRgb(options.overlayBase) : null;
	const colors: string[] = [];
	for (let index = 0; index < count; index += 1) {
		const t = count > 1 ? index / (count - 1) : 0.5;
		let rgb = mixRgb(from, to, t);
		if (options.invert) rgb = invertRgb(rgb);
		if (overlay) rgb = mixRgb(rgb, overlay, 0.5);
		colors.push(rgbToHex(rgb));
	}
	return colors;
}

/** The ramp's colour at `t` (0 = lowest band, 1 = highest). */
function rampColor(t: number): string {
	const stops = RANGE_RAMP.map(hexToRgb);
	const clamped = Math.max(0, Math.min(1, t));
	const span = clamped * (stops.length - 1);
	const index = Math.min(stops.length - 2, Math.floor(span));
	const from = stops[index] as [number, number, number];
	const to = stops[index + 1] as [number, number, number];
	return rgbToHex(mixRgb(from, to, span - index));
}

export interface NodeColors {
	fill: string;
	stroke: string;
}

/** Fill and stroke for band `index` of `bands`, theme-aware. */
export function rangeNodeColors(index: number, bands: number, theme: string): NodeColors {
	const fill = rampColor(bands > 1 ? index / (bands - 1) : 0);
	const rgb = hexToRgb(fill);
	const stroke = rgbToHex(theme === "dark" ? mixRgb(rgb, [255, 255, 255], 0.35) : mixRgb(rgb, [0, 0, 0], 0.28));
	return { fill, stroke };
}

/** The hue angle of a `#rrggbb` colour, so an explicit base colour can feed the lightness ramp. */
export function hueOfHex(hex: string): number {
	const [r, g, b] = hexToRgb(hex);
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const delta = max - min;
	if (delta === 0) return 0;
	let hue: number;
	if (max === r) hue = 60 * (((g - b) / delta) % 6);
	else if (max === g) hue = 60 * ((b - r) / delta + 2);
	else hue = 60 * ((r - g) / delta + 4);
	return ((hue % 360) + 360) % 360;
}

/**
 * Fill and stroke for a colour the reader picked outright: the pick itself is the fill, and the
 * stroke follows the same theme policy as the rest of the palette - a pale tint as a glow on the
 * dark canvas, a darker shade as the border on a light one.
 */
export function explicitNodeColors(hex: string, theme: string): NodeColors {
	const rgb = hexToRgb(hex);
	const stroke = rgbToHex(theme === "dark" ? mixRgb(rgb, [255, 255, 255], 0.35) : mixRgb(rgb, [0, 0, 0], 0.28));
	return { fill: hex, stroke };
}

/**
 * The colour of a node the active mode could not place: one that carries no value for the chosen
 * property, and the catch-all bucket that gathers whatever no rule matched. Grey rather than a
 * ring colour, because "unclassified" is not a category.
 */
export function neutralNodeColors(theme: string): NodeColors {
	return theme === "dark" ? { fill: "#9ca3af", stroke: "#cbd5e1" } : { fill: "#9ca3af", stroke: "#6b7280" };
}

/**
 * Colour a (type, field-subclass) combination: the type owns the hue, the subclass owns the
 * lightness. A reader reads "this is a Person" from the hue and "this Person is young or old" from
 * how pale the dot is, so the two dimensions stay separable instead of fighting over one axis. The
 * `rank` is the subclass's position among `count` subclasses (0 = lightest, count-1 = darkest);
 * `count` of 1 means "type only", which lands on a mid lightness so the type hue stands alone.
 */
export function subclassColors(hue: number, rank: number, count: number, theme: string): NodeColors {
	const classes = Math.max(1, count);
	const t = classes > 1 ? Math.max(0, Math.min(1, rank / (classes - 1))) : 0.5;
	const light = theme === "dark" ? 70 - t * 32 : 62 - t * 28;
	const saturation = theme === "dark" ? 62 : 55;
	const strokeLight = theme === "dark" ? Math.min(94, light + 18) : Math.max(18, light - 20);
	return { fill: hslToHex(hue, saturation, light), stroke: hslToHex(hue, saturation, strokeLight) };
}

/**
 * Which band of `bands` a value falls in, between `min` and `max` inclusive. The bands are cut to
 * equal width - the honest default when nothing says where the interesting cut points are - and the
 * highest value belongs to the last band rather than falling off the end.
 */
export function bandIndex(value: number, min: number, max: number, bands: number): number {
	if (!Number.isFinite(value) || bands < 1 || max <= min) return 0;
	const position = Math.floor(((value - min) / (max - min)) * bands);
	return Math.max(0, Math.min(bands - 1, position));
}

/**
 * One band's edges. They are returned rather than derived twice so the label and the test agree -
 * a bucket that says "7 – 11" must hold exactly what the reader expects it to hold.
 */
export function bandEdges(index: number, min: number, max: number, bands: number): { low: number; high: number } {
	const width = (max - min) / Math.max(1, bands);
	return { low: min + index * width, high: min + (index + 1) * width };
}

/**
 * How a band edge reads. Whole numbers by default, because most counts are whole; decimals when
 * the reader asks for them, because a score of 3.00 and a count of 3 want different edges. When
 * rounding would collapse a narrow band to a single number, one decimal is used anyway - an
 * interval that reads "3 – 3" explains nothing.
 */
export function formatBandEdge(value: number, integer: boolean, decimals: number): string {
	if (!integer) return value.toFixed(Math.max(0, decimals));
	const rounded = Math.round(value);
	return String(rounded);
}

/** A band's label: its own interval, e.g. `7 – 11`, rather than an index. */
export function bandLabel(
	index: number,
	min: number,
	max: number,
	bands: number,
	integer: boolean,
	decimals: number,
): string {
	if (max <= min) return formatBandEdge(min, integer, decimals);
	const { low, high } = bandEdges(index, min, max, bands);
	const lowText = formatBandEdge(low, integer, decimals);
	const highText = formatBandEdge(high, integer, decimals);
	return lowText === highText ? formatBandEdge(low, false, integer ? 1 : decimals) : `${lowText} – ${highText}`;
}
