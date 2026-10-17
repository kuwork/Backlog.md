import type { ResultGraphNode } from "./cypher-graph.ts";
import { type CompiledExpression, compileExpression, type ExprValue } from "./graph-expression.ts";
import {
	explicitNodeColors,
	hueNodeColors,
	hueOfHex,
	isHexColor,
	labelHue,
	type NodeColors,
	subclassColors,
} from "./graph-palette.ts";

/**
 * The result graph's legend, as data (BACK-794, per-type redesign).
 *
 * Everything is configured per node type (the table label): each type carries its own caption
 * template, its own optional base colour, and its own ordered rule list - a Person's age bands
 * mean nothing to a Project, so the second colour axis lives inside the type it describes. A
 * node's colour still combines the same two dimensions: the type owns the hue (automatic from
 * the label, or overridden by the type's base colour), and within the type the rule that matched
 * owns the lightness step - or an outright colour, when the rule carries one.
 *
 * The rule list is first-match-wins plus an implicit catch-all ("Other") for whatever no rule
 * matched, so a reader never has to enumerate the cases. A "quick method" - equal-width bins,
 * quantiles, by value, and so on - only *generates* rules from one field of one type's nodes;
 * the generated expressions are ordinary rules the reader then edits by hand.
 *
 * An empty caption template guesses: the first of `name/title/key/label/id` the type's nodes
 * carry, rendered as `{{field}}`, falling back to the node's own title. With no configuration
 * at all the picture is already a knowledge graph: one hue per type, sensible names.
 *
 * Everything lives per database in localStorage, and the description is tolerant of a partial,
 * hand-edited or pre-redesign store: a missing field degrades to "type only", a broken rule to
 * "does not match", and a store written before types existed resets to the defaults.
 */

/** The database Backlog.md maintains for the corpus. Kept for callers that special-case it. */
export const CORPUS_DATABASE = "default";

/** How many numeric bands a range starts with, and how far the reader may push it. */
export const DEFAULT_BANDS = 4;
export const MIN_BANDS = 2;
export const MAX_BANDS = 8;

/** How many decimals a band edge may carry. */
export const DEFAULT_DECIMALS = 2;
export const MAX_DECIMALS = 4;

/** The relationship line styles, in the order the panel offers them. */
export const LINE_STYLES = ["solid", "dashed", "dotted", "long"] as const;
export type LineStyle = (typeof LINE_STYLES)[number];

/** Where a relationship's arrowheads sit. */
export const ARROW_MODES = ["none", "end", "start", "both"] as const;
export type ArrowMode = (typeof ARROW_MODES)[number];

/**
 * The dash each line style carries, in graph units. The corpus graph's own relation vocabulary
 * (solid for DependsOn, a fine dotted line for TaggedWith) is the same set - a reader who has
 * learned that page has already learned this one.
 */
export const LINE_DASH: Record<LineStyle, string | null> = {
	solid: null,
	dashed: "6 3",
	dotted: "1 2",
	long: "10 4",
};

/** The quick classification methods a field can be split by. */
export type QuickMethod = "bins" | "quantile" | "threshold" | "values" | "contains" | "prefix" | "bool";

/** Which quick methods suit which field kind, offered by the panel's quick-add. */
export const NUMERIC_METHODS: QuickMethod[] = ["bins", "quantile", "threshold"];
export const STRING_METHODS: QuickMethod[] = ["values", "contains", "prefix"];
export const BOOLEAN_METHODS: QuickMethod[] = ["bool"];

/** The bucket key of the catch-all: nodes no rule matched. Appended by the engine, not stored. */
export const OTHER_BUCKET = "rule:other";

/** Bucket key holding the nodes when a type has no rules (colour by type alone). */
export const NEUTRAL_BUCKET = "type:only";

let ruleCounter = 0;

/** A fresh rule: a name the reader will overwrite and an empty condition. */
export function newRule(): RuleConfig {
	ruleCounter += 1;
	return { id: `r${Date.now().toString(36)}${ruleCounter}`, name: "", expression: "" };
}

/** One colour rule of a type: a name and a condition. First match wins. */
export interface RuleConfig {
	id: string;
	name: string;
	/** A boolean expression over the node's properties; empty matches nothing. */
	expression: string;
	/** A `#rrggbb` colour the reader picked for this subclass; absent = the lightness ramp decides. */
	color?: string;
}

/** One node type's own legend settings. */
export interface TypeConfig {
	/** Caption template; empty guesses from the type's fields (see AUTO_CAPTION_FIELDS). */
	caption: string;
	/** Base colour (`#rrggbb`); absent = the label's automatic hue. */
	color?: string;
	/** Colour of the catch-all bucket; absent = the type's deepest lightness step. */
	otherColor?: string;
	/** The type's subclasses, ordered; first match wins, the rest land in the catch-all. */
	rules: RuleConfig[];
}

/** How one relationship type is drawn. */
export interface RelationStyle {
	dash: LineStyle;
	arrow: ArrowMode;
	/** Line colour (`#rrggbb`); absent = the theme's default grey. */
	color?: string;
	/** Display name replacing the raw type in the legend and on the edge; absent = the type itself. */
	name?: string;
}

export interface GraphLegendConfig {
	/** False hides every caption outright - a cleaner picture when the colours carry the meaning. */
	captionsVisible: boolean;
	/** Per node type (table label); a type with no entry is fully automatic. */
	types: Record<string, TypeConfig>;
	/** Per relationship type; a type the reader has not touched draws as a solid arrowed line. */
	relations: Record<string, RelationStyle>;
	/** Bucket keys the reader has switched off. */
	hidden: string[];
}

/** What the panel starts from: one automatic hue per type, guessed captions, nothing hidden. */
export function defaultLegendConfig(_database: string): GraphLegendConfig {
	return {
		captionsVisible: true,
		types: {},
		relations: {},
		hidden: [],
	};
}

/* ------------------------------------------------------------------ validation */

function asString(value: unknown, fallback: string): string {
	return typeof value === "string" ? value : fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
	return typeof value === "boolean" ? value : fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asRules(value: unknown): RuleConfig[] {
	if (!Array.isArray(value)) return [];
	const rules: RuleConfig[] = [];
	for (const entry of value) {
		const record = asRecord(entry);
		const id = asString(record.id, "");
		if (id.length === 0) continue;
		const rule: RuleConfig = { id, name: asString(record.name, ""), expression: asString(record.expression, "") };
		if (isHexColor(record.color)) rule.color = record.color;
		rules.push(rule);
	}
	return rules;
}

function asTypes(value: unknown): Record<string, TypeConfig> {
	const types: Record<string, TypeConfig> = {};
	for (const [label, entry] of Object.entries(asRecord(value))) {
		const record = asRecord(entry);
		const type: TypeConfig = { caption: asString(record.caption, ""), rules: asRules(record.rules) };
		if (isHexColor(record.color)) type.color = record.color;
		if (isHexColor(record.otherColor)) type.otherColor = record.otherColor;
		types[label] = type;
	}
	return types;
}

function asRelations(value: unknown): Record<string, RelationStyle> {
	const relations: Record<string, RelationStyle> = {};
	for (const [type, entry] of Object.entries(asRecord(value))) {
		const record = asRecord(entry);
		const relation: RelationStyle = { dash: asLineStyle(record.dash), arrow: asArrowMode(record.arrow) };
		if (isHexColor(record.color)) relation.color = record.color;
		const name = asString(record.name, "").trim();
		if (name.length > 0) relation.name = name;
		relations[type] = relation;
	}
	return relations;
}

function asLineStyle(value: unknown): LineStyle {
	return typeof value === "string" && (LINE_STYLES as readonly string[]).includes(value)
		? (value as LineStyle)
		: "solid";
}

function asArrowMode(value: unknown): ArrowMode {
	return typeof value === "string" && (ARROW_MODES as readonly string[]).includes(value) ? (value as ArrowMode) : "end";
}

function asKeys(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return [...new Set(value.filter((entry): entry is string => typeof entry === "string"))];
}

/**
 * Rebuild a configuration from whatever is in storage, keeping the parts that still make sense and
 * dropping the rest. A schema change, a half-written entry or a hand-edited one must degrade to the
 * defaults, never throw - a pane that refuses to open is worse than one that forgot a colour. A
 * store written before the per-type redesign has no `types` and resets to the defaults wholesale:
 * its global field and rules describe a shape nothing reads any more.
 */
export function normalizeLegendConfig(value: unknown, _database: string): GraphLegendConfig {
	const fallback = defaultLegendConfig(_database);
	const record = asRecord(value);
	if (!("types" in record)) return fallback;
	return {
		captionsVisible: asBoolean(record.captionsVisible, fallback.captionsVisible),
		types: asTypes(record.types),
		relations: asRelations(record.relations),
		hidden: asKeys(record.hidden),
	};
}

/* ------------------------------------------------------------------ save-time pinning */

/**
 * The same configuration with every type's automatic colour pinned as an explicit one.
 *
 * A type without an explicit colour paints with its label's slot on the hue ring: the canvas and
 * the colour pickers both show it, but the stored file never said so - a reader who tuned the
 * legend and saved it got a file recording captions and rules while the colours they had been
 * looking at existed only as a hash of the type name. Saving pins them, so the file records the
 * picture. A type that already carries an explicit colour is left alone (and the panel's × still
 * returns one to automatic), the ramp-driven colours of rules and the catch-all stay derived -
 * they are meant to re-flow as rules come and go, which pinning would freeze - and pinning what
 * was already pinned changes nothing.
 */
export function pinAutomaticTypeColors(config: GraphLegendConfig, theme: string): GraphLegendConfig {
	const types: Record<string, TypeConfig> = {};
	for (const [label, typeConf] of Object.entries(config.types)) {
		types[label] = isHexColor(typeConf.color)
			? typeConf
			: { ...typeConf, color: hueNodeColors(labelHue(label), theme).fill };
	}
	return { ...config, types };
}

/* ------------------------------------------------------------------ persistence */

/**
 * Deep, key-order-insensitive equality for legend configs. A broadcast or a fetch that lands with
 * the config the panel is already showing must not repaint the graph - an unchanged legend is not
 * a change - so callers compare before adopting.
 */
export function legendConfigsEqual(a: GraphLegendConfig, b: GraphLegendConfig): boolean {
	return stableStringify(a) === stableStringify(b);
}

/** JSON.stringify with object keys sorted, so equal content compares equal regardless of order. */
function stableStringify(value: unknown): string {
	return JSON.stringify(value, (_key, val) => {
		if (val && typeof val === "object" && !Array.isArray(val)) {
			const source = val as Record<string, unknown>;
			return Object.keys(source)
				.sort()
				.reduce<Record<string, unknown>>((sorted, key) => {
					sorted[key] = source[key];
					return sorted;
				}, {});
		}
		return val;
	});
}

const STORAGE_PREFIX = "backlog.graph.";
const STORAGE_SUFFIX = ".legend";

/** The localStorage key one database's configuration lives under. Exported for tests. */
export function legendStorageKey(database: string): string {
	return `${STORAGE_PREFIX}${database}${STORAGE_SUFFIX}`;
}

/** localStorage is not always there - a private window, a test, a server - and must never throw. */
function storage(): Storage | null {
	try {
		return globalThis.localStorage ?? null;
	} catch {
		return null;
	}
}

/** The stored configuration for one database, or the defaults when there is nothing usable. */
export function loadLegendConfig(database: string): GraphLegendConfig {
	const store = storage();
	if (!store) return defaultLegendConfig(database);
	let raw: string | null = null;
	try {
		raw = store.getItem(legendStorageKey(database));
	} catch {
		return defaultLegendConfig(database);
	}
	if (raw === null) return defaultLegendConfig(database);
	try {
		return normalizeLegendConfig(JSON.parse(raw), database);
	} catch {
		return defaultLegendConfig(database);
	}
}

/** Write a configuration through to storage. A failure here is not worth interrupting the reader. */
export function saveLegendConfig(database: string, config: GraphLegendConfig): void {
	const store = storage();
	if (!store) return;
	try {
		store.setItem(legendStorageKey(database), JSON.stringify(config));
	} catch {
		// Quota or a blocked store: the pane keeps the configuration in memory for this visit.
	}
}

/** Drop a database's stored configuration - what the panel's reset asks for. */
export function clearLegendConfig(database: string): void {
	const store = storage();
	if (!store) return;
	try {
		store.removeItem(legendStorageKey(database));
		store.removeItem(legendPendingKey(database));
	} catch {
		// Nothing to do: the entry is simply not going away.
	}
}

/* ------------------------------------------------------------------ push tracking */

/**
 * The key marking a database's stored configuration as edited but not yet pushed to the server.
 *
 * A save marks the copy pending before its PUT and clears the mark when the PUT lands. A failed
 * PUT leaves the mark behind on purpose: the local copy is then the newest truth there is, and
 * the next mount pushes it up instead of letting the (older) server copy win. Without the mark,
 * a save that never reached the server used to be silently reverted on the next visit - the
 * reader saw their colour again for one session and then watched it disappear.
 */
function legendPendingKey(database: string): string {
	return `${legendStorageKey(database)}.pending`;
}

/** Mark a database's stored configuration as still owing the server a push. */
export function markLegendPending(database: string): void {
	const store = storage();
	if (!store) return;
	try {
		store.setItem(legendPendingKey(database), "1");
	} catch {
		// A blocked store: the mark is best-effort, and the copy itself is already at risk.
	}
}

/** Drop the mark after a successful push (or a reset). */
export function clearLegendPending(database: string): void {
	const store = storage();
	if (!store) return;
	try {
		store.removeItem(legendPendingKey(database));
	} catch {
		// Nothing to do.
	}
}

/** Whether a database's stored configuration still owes the server a push. */
export function hasLegendPending(database: string): boolean {
	const store = storage();
	if (!store) return false;
	try {
		return store.getItem(legendPendingKey(database)) !== null;
	} catch {
		return false;
	}
}

/** Whether a stored (non-default) legend configuration exists in localStorage for this database. */
export function hasLegendConfig(database: string): boolean {
	const store = storage();
	if (!store) return false;
	try {
		return store.getItem(legendStorageKey(database)) !== null;
	} catch {
		return false;
	}
}

/* ------------------------------------------------------------------ captions */

const PLACEHOLDER = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g;

/** Leftover separators where a placeholder had no value: `Foo · ` reads `Foo`, not `Foo ·`. */
const DANGLING = /^[\s·|/,\-—]+|[\s·|/,\-—]+$/g;

/**
 * Write one node's caption from a template. A placeholder whose property the node does not carry
 * contributes nothing, and if nothing is left the extraction's own guess takes over - a template
 * written for one result degrades into a named circle on the next, not into an empty plate.
 */
export function renderCaption(template: string, properties: Record<string, ExprValue>, fallback: string): string {
	const text = template.replace(PLACEHOLDER, (_match, name: string) => textOf(properties[name]));
	const cleaned = text.replace(/\s+/g, " ").replace(DANGLING, "");
	return cleaned.length > 0 ? cleaned : fallback;
}

/** The placeholder text one field inserts. */
export function placeholderFor(field: string): string {
	return `{{${field}}}`;
}

/**
 * Fields that name a node, best first. The automatic caption of a type is the first of these its
 * nodes carry; a type with none of them falls back to the node's own title.
 */
const AUTO_CAPTION_FIELDS = ["name", "title", "key", "label", "id"];

/** The field one type's automatic caption reads, or null when the type carries none of them. */
export function autoCaptionField(fields: readonly string[]): string | null {
	for (const field of AUTO_CAPTION_FIELDS) {
		if (fields.includes(field)) return field;
	}
	return null;
}

/* ------------------------------------------------------------------ fields */

/** What a field looks like across the result: numeric, textual, boolean, or absent. */
export type FieldKind = "numeric" | "string" | "boolean" | "none";

function numericOfValue(value: ExprValue | undefined): number | null {
	if (typeof value === "number") return Number.isFinite(value) ? value : null;
	if (typeof value !== "string" || value.trim().length === 0) return null;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : null;
}

/**
 * The kind a field reads as, decided by the values it actually carries in this result. A field a
 * result never touches is `none`; a field some nodes carry and others do not is judged on the
 * nodes that do. This is what lets the panel offer the right quick methods - bins for a numeric
 * field, by-value for a textual one. The panel passes one type's nodes, so the kind and the
 * values are the type's own.
 */
export function fieldKindOf(nodes: readonly ResultGraphNode[], field: string): FieldKind {
	if (field.length === 0) return "none";
	const present = nodes.filter((node) => {
		const value = node.properties[field];
		return value !== undefined && value !== null;
	});
	if (present.length === 0) return "none";
	if (present.every((node) => node.properties[field] === true || node.properties[field] === false)) return "boolean";
	if (present.every((node) => numericOfValue(node.properties[field]) !== null)) return "numeric";
	return "string";
}

/** The quick methods a field kind supports. */
export function methodsForKind(kind: FieldKind): QuickMethod[] {
	switch (kind) {
		case "numeric":
			return NUMERIC_METHODS;
		case "string":
			return STRING_METHODS;
		case "boolean":
			return BOOLEAN_METHODS;
		default:
			return [];
	}
}

/** A sensible default method for a freshly chosen field. */
export function defaultMethodForKind(kind: FieldKind): QuickMethod {
	const methods = methodsForKind(kind);
	return methods[0] ?? "bins";
}

/**
 * The property names of each node type, sorted. The panel offers a type's own fields in its
 * caption template and rule editors, and the resolver reads the same union to guess the
 * automatic caption - the two can never disagree about what a type carries.
 */
export function fieldsByType(nodes: readonly ResultGraphNode[]): Map<string, string[]> {
	const byType = new Map<string, Set<string>>();
	for (const node of nodes) {
		let fields = byType.get(node.label);
		if (!fields) {
			fields = new Set();
			byType.set(node.label, fields);
		}
		for (const key of Object.keys(node.properties)) fields.add(key);
	}
	return new Map([...byType.entries()].map(([label, fields]) => [label, [...fields].sort()]));
}

/* ------------------------------------------------------------------ rule generation */

/** Trim a number to `decimals` places and drop the trailing zeros a band edge should not keep. */
function trimNumber(value: number, decimals: number): string {
	if (!Number.isFinite(value)) return "0";
	if (Number.isInteger(value)) return String(value);
	return String(Number(value.toFixed(Math.max(0, decimals))));
}

/** A value quoted for an expression: `JSON.stringify` handles inner quotes and escaping. */
function quote(value: string): string {
	return JSON.stringify(value);
}

function numericValues(nodes: readonly ResultGraphNode[], field: string): number[] {
	return nodes.map((node) => numericOfValue(node.properties[field])).filter((value): value is number => value !== null);
}

function quantile(sorted: number[], q: number): number {
	if (sorted.length === 0) return 0;
	const position = (sorted.length - 1) * q;
	const low = Math.floor(position);
	const high = Math.ceil(position);
	if (low === high) return sorted[low] as number;
	const weight = position - low;
	return (sorted[low] as number) + ((sorted[high] as number) - (sorted[low] as number)) * weight;
}

/** Equal-width bands from the field's own min/max. The last band is inclusive at the top. */
function numericBands(
	field: string,
	bands: number,
	integer: boolean,
	decimals: number,
	nodes: readonly ResultGraphNode[],
): RuleConfig[] {
	const values = numericValues(nodes, field);
	if (values.length === 0) return [];
	const min = Math.min(...values);
	const max = Math.max(...values);
	const width = (max - min) / Math.max(1, bands);
	const rules: RuleConfig[] = [];
	for (let index = 0; index < bands; index += 1) {
		const low = min + index * width;
		const high = min + (index + 1) * width;
		const lowText = integer ? String(Math.round(low)) : trimNumber(low, decimals);
		const highText = integer ? String(Math.round(high)) : trimNumber(high, decimals);
		if (index < bands - 1) {
			rules.push({
				id: newRule().id,
				name: `${lowText} – ${highText}`,
				expression: `${field} >= ${lowText} && ${field} < ${highText}`,
			});
		} else {
			rules.push({ id: newRule().id, name: `${lowText} +`, expression: `${field} >= ${lowText}` });
		}
	}
	return rules;
}

/** Bands at the data's own quantiles, so each band holds a similar number of nodes. */
function numericQuantiles(field: string, bands: number, nodes: readonly ResultGraphNode[]): RuleConfig[] {
	const values = numericValues(nodes, field);
	if (values.length === 0) return [];
	const sorted = [...values].sort((left, right) => left - right);
	const edges: number[] = [];
	for (let index = 0; index <= bands; index += 1) edges.push(quantile(sorted, index / Math.max(1, bands)));
	const rules: RuleConfig[] = [];
	for (let index = 0; index < bands; index += 1) {
		const low = edges[index] as number;
		const high = edges[index + 1] as number;
		if (index < bands - 1) {
			rules.push({
				id: newRule().id,
				name: `${trimNumber(low, 2)} – ${trimNumber(high, 2)}`,
				expression: `${field} >= ${trimNumber(low, 2)} && ${field} < ${trimNumber(high, 2)}`,
			});
		} else {
			rules.push({
				id: newRule().id,
				name: `${trimNumber(low, 2)} +`,
				expression: `${field} >= ${trimNumber(low, 2)}`,
			});
		}
	}
	return rules;
}

/** Two bands either side of one threshold. */
function numericThreshold(field: string, threshold: number, _nodes: readonly ResultGraphNode[]): RuleConfig[] {
	const t = trimNumber(threshold, 2);
	return [
		{ id: newRule().id, name: `≤ ${t}`, expression: `${field} <= ${t}` },
		{ id: newRule().id, name: `> ${t}`, expression: `${field} > ${t}` },
	];
}

/** One rule per distinct textual value, the most frequent first, capped so the list stays usable. */
function stringByValue(field: string, nodes: readonly ResultGraphNode[]): RuleConfig[] {
	const counts = new Map<string, number>();
	for (const node of nodes) {
		const value = node.properties[field];
		if (typeof value === "string" && value.trim().length > 0) {
			counts.set(value, (counts.get(value) ?? 0) + 1);
		}
	}
	return [...counts.entries()]
		.sort((left, right) => (right[1] as number) - (left[1] as number))
		.slice(0, 12)
		.map(([value]) => ({ id: newRule().id, name: value, expression: `${field} == ${quote(value)}` }));
}

/** One `contains` rule per frequent textual value - handy when values share a substring. */
function stringContains(field: string, nodes: readonly ResultGraphNode[]): RuleConfig[] {
	return stringByValue(field, nodes).map((rule) => ({
		...rule,
		expression: `${field} contains ${quote(rule.name)}`,
	}));
}

/** One `startsWith` rule per frequent textual value. */
function stringPrefix(field: string, nodes: readonly ResultGraphNode[]): RuleConfig[] {
	return stringByValue(field, nodes).map((rule) => ({
		...rule,
		expression: `${field} startsWith ${quote(rule.name)}`,
	}));
}

/** Two rules: the field is true, and the field is false. */
function booleanRules(field: string): RuleConfig[] {
	return [
		{ id: newRule().id, name: "true", expression: `${field} == true` },
		{ id: newRule().id, name: "false", expression: `${field} == false` },
	];
}

export interface GenerateOptions {
	bands: number;
	integer: boolean;
	decimals: number;
	threshold: number;
}

/**
 * Build a rule list from a field and a quick method, over the nodes handed in - the panel passes
 * one type's nodes, so the bands and value frequencies are the type's own. The list is what the
 * panel then hands to the reader to edit - the method is a generator, not a cage: the expressions
 * it writes are ordinary conditions and any of them can be rewritten afterwards. Returns `[]`
 * when the field is empty or the method does not suit the field's kind.
 */
export function generateRules(
	field: string,
	method: QuickMethod,
	options: GenerateOptions,
	nodes: readonly ResultGraphNode[],
): RuleConfig[] {
	if (field.length === 0) return [];
	const kind = fieldKindOf(nodes, field);
	if (!methodsForKind(kind).includes(method)) return [];
	switch (method) {
		case "bins":
			return numericBands(field, options.bands, options.integer, options.decimals, nodes);
		case "quantile":
			return numericQuantiles(field, options.bands, nodes);
		case "threshold":
			return numericThreshold(field, options.threshold, nodes);
		case "values":
			return stringByValue(field, nodes);
		case "contains":
			return stringContains(field, nodes);
		case "prefix":
			return stringPrefix(field, nodes);
		case "bool":
			return booleanRules(field);
		default:
			return [];
	}
}

/* ------------------------------------------------------------------ resolution */

function textOf(value: ExprValue | undefined): string {
	return value === null || value === undefined ? "" : String(value);
}

/** The type part of a combination key (`t:Person|s:0`). */
export function typeOfKey(key: string): string {
	const split = key.indexOf("|");
	return split < 0 ? key : key.slice(0, split).slice(2);
}

/** The subclass part of a combination key, as a sortable rank. */
export function subclassRankOf(key: string): number {
	const split = key.indexOf("|");
	if (split < 0) return 0;
	const suffix = key.slice(split + 1);
	if (suffix === NEUTRAL_BUCKET) return 0;
	if (suffix === OTHER_BUCKET) return Number.POSITIVE_INFINITY;
	return Number(suffix.slice(1));
}

/** One colour bucket: identity, label, colour and how many nodes fell into it. */
export interface LegendBucket {
	/** `t:<type>|s:<subclass>`: the type the engine colours by hue, the subclass by lightness. */
	key: string;
	/** The bucket's own name: a type (no rules), a rule's name, or empty for the catch-all. */
	label: string;
	colors: NodeColors;
	count: number;
	/** True when the bucket holds nodes Backlog.md wrote for itself rather than user data. */
	internal?: boolean;
	/** Set by the corpus/knowledge graph, which colours by a reader-facing kind rather than type. */
	corpus?: import("./graph-palette.ts").NodeStyle;
}

export interface ResolvedLegend {
	buckets: LegendBucket[];
	/** Bucket key per node id. */
	bucketOf: Map<string, string>;
	/** Caption text per node id; empty when captions are switched off. */
	captionOf: Map<string, string>;
}

/** A rule as the resolver wants it; a broken condition compiles to "matches nothing". */
function compileRule(rule: RuleConfig): { name: string; color?: string; test: CompiledExpression["test"] } {
	try {
		return { name: rule.name, color: rule.color, test: compileExpression(rule.expression).test };
	} catch {
		return { name: rule.name, color: rule.color, test: () => false };
	}
}

/** One type's configuration, readied: its hue and its compiled rules. */
interface TypeResolution {
	typeConf?: TypeConfig;
	hue: number;
	compiled: { name: string; color?: string; test: CompiledExpression["test"] }[];
}

/**
 * Resolve a configuration against a result. Pure, and cheap enough to run on every keystroke: one
 * pass to place each node in a (type, subclass) bucket, one to colour the buckets, one to write
 * captions. The two colour axes stay separate - the type decides the hue (or an explicit base
 * colour), the matched rule decides the lightness step (or an explicit colour) - so a Person
 * under 30 and a Person over 60 are the same hue at different lightness, never two hues fighting
 * over "which kind".
 */
export function resolveLegend(
	nodes: readonly ResultGraphNode[],
	config: GraphLegendConfig,
	theme: string,
): ResolvedLegend {
	const fieldsPerType = fieldsByType(nodes);

	const typeCache = new Map<string, TypeResolution>();
	const typeResolution = (label: string): TypeResolution => {
		let entry = typeCache.get(label);
		if (!entry) {
			const typeConf = config.types[label];
			const base = typeConf?.color;
			entry = {
				typeConf,
				hue: base !== undefined && isHexColor(base) ? hueOfHex(base) : labelHue(label),
				compiled: (typeConf?.rules ?? []).map(compileRule),
			};
			typeCache.set(label, entry);
		}
		return entry;
	};

	/** The colours one bucket key paints with: explicit where the reader picked, derived otherwise. */
	const colorsFor = (label: string, suffix: string): NodeColors => {
		const { hue, typeConf, compiled } = typeResolution(label);
		if (suffix === NEUTRAL_BUCKET) {
			const base = typeConf?.color;
			return base !== undefined && isHexColor(base) ? explicitNodeColors(base, theme) : hueNodeColors(hue, theme);
		}
		const total = compiled.length + 1;
		if (suffix === OTHER_BUCKET) {
			const other = typeConf?.otherColor;
			return other !== undefined && isHexColor(other)
				? explicitNodeColors(other, theme)
				: subclassColors(hue, compiled.length, total, theme);
		}
		const index = Number(suffix.slice(1));
		const explicit = compiled[index]?.color;
		return explicit !== undefined && isHexColor(explicit)
			? explicitNodeColors(explicit, theme)
			: subclassColors(hue, index, total, theme);
	};

	const counts = new Map<
		string,
		{ count: number; suffix: string; label: string; typeLabel: string; internal: boolean }
	>();
	const bucketOf = new Map<string, string>();

	for (const node of nodes) {
		const { compiled } = typeResolution(node.label);
		let suffix = NEUTRAL_BUCKET;
		let label = node.label;
		if (compiled.length > 0) {
			const index = compiled.findIndex((entry) => entry.test(node.properties));
			if (index >= 0) {
				suffix = `r${index}`;
				label = compiled[index]?.name ?? "";
			} else {
				suffix = OTHER_BUCKET;
				label = "";
			}
		}
		const key = `t:${node.label}|s:${suffix}`;
		bucketOf.set(node.id, key);
		const entry = counts.get(key) ?? { count: 0, suffix, label, typeLabel: node.label, internal: false };
		entry.count += 1;
		entry.internal = entry.internal || node.internal;
		counts.set(key, entry);
	}

	const buckets: LegendBucket[] = [...counts.entries()].map(([key, info]) => ({
		key,
		label: info.label,
		colors: colorsFor(info.typeLabel, info.suffix),
		count: info.count,
		internal: info.internal,
	}));

	// Listed by type, then by subclass rank - the catch-all after the rules it gathers.
	buckets.sort((left, right) => {
		const byType = typeOfKey(left.key).localeCompare(typeOfKey(right.key));
		return byType !== 0 ? byType : subclassRankOf(left.key) - subclassRankOf(right.key);
	});

	const captionOf = new Map<string, string>();
	for (const node of nodes) {
		if (!config.captionsVisible) {
			captionOf.set(node.id, "");
			continue;
		}
		const template = config.types[node.label]?.caption ?? "";
		if (template.length > 0) {
			captionOf.set(node.id, renderCaption(template, node.properties, node.title));
			continue;
		}
		const guessed = autoCaptionField(fieldsPerType.get(node.label) ?? []);
		captionOf.set(
			node.id,
			guessed === null ? node.title : renderCaption(placeholderFor(guessed), node.properties, node.title),
		);
	}
	return { buckets, bucketOf, captionOf };
}

/* ------------------------------------------------------------------ relations */

/**
 * How one relationship type is drawn. A type the reader has not configured takes the automatic
 * style: line styles cycle over the result's sorted type list (solid, dashed, dotted, long, solid,
 * ...) so neighbouring types read differently without any setup, with an arrowhead at the target -
 * close to what the pane drew before it had any settings at all. Without the type list the first
 * style (solid) is the default, as before.
 */
export function relationStyle(type: string, config: GraphLegendConfig, order?: readonly string[]): RelationStyle {
	const configured = config.relations[type];
	if (configured) return configured;
	const index = order ? Math.max(0, order.indexOf(type)) : 0;
	return { dash: LINE_STYLES[index % LINE_STYLES.length] as LineStyle, arrow: "end" };
}
