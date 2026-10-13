/**
 * The colour vocabulary for graphs whose node kinds are not known in advance.
 *
 * The corpus graph colours eight fixed kinds from a hand-tuned table (GraphLegend's NODE_FILL).
 * A user database has whatever labels the user gave it, so there is no table to tune: each label
 * is hashed onto a hue ring instead. Two labels can share a hue - the legend spells every label
 * out next to its dot and count, so the colour is a grouping cue, not an identity - and the same
 * label always lands on the same hue, so a re-run of a query paints the same picture.
 *
 * The stroke follows the same theme policy as the corpus palette: a pale tint reads as a glow on
 * the dark canvas, a darker shade gives a light canvas the classic fill-plus-border read.
 */

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

/** Fill and stroke for one node label, theme-aware. */
export function labelNodeColors(label: string, theme: string): { fill: string; stroke: string } {
	const hue = labelHue(label);
	return theme === "dark"
		? { fill: `hsl(${hue}, 65%, 55%)`, stroke: `hsl(${hue}, 70%, 75%)` }
		: { fill: `hsl(${hue}, 60%, 50%)`, stroke: `hsl(${hue}, 70%, 38%)` };
}
