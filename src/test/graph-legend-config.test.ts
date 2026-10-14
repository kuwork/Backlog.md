import { afterEach, describe, expect, it } from "bun:test";
import type { ResultGraphNode } from "../web/utils/cypher-graph.ts";
import {
	autoCaptionField,
	defaultLegendConfig,
	fieldKindOf,
	fieldsByType,
	type GraphLegendConfig,
	generateRules,
	legendStorageKey,
	loadLegendConfig,
	normalizeLegendConfig,
	relationStyle,
	renderCaption,
	resolveLegend,
	saveLegendConfig,
} from "../web/utils/graph-legend-config.ts";
import { explicitNodeColors, hueOfHex, isHexColor, labelHue, subclassColors } from "../web/utils/graph-palette.ts";

/**
 * The per-type legend configuration (BACK-794, redesign): every node type carries its own caption
 * template, base colour and rule list; the resolver combines them into the buckets and captions
 * the pane draws. These tests pin the new shape: tolerant normalization (a pre-redesign store
 * resets to defaults), per-type rule resolution with explicit colours and the catch-all, and the
 * automatic caption guess.
 */

/** Build a node for tests without caring about caption/title bookkeeping. */
function node(id: string, label: string, properties: Record<string, unknown> = {}): ResultGraphNode {
	return { id, label, internal: false, caption: "", title: id, properties: properties as never };
}

const nodes: ResultGraphNode[] = [
	node("1", "Person", { age: 20, name: "Ann" }),
	node("2", "Person", { age: 45, name: "Bob" }),
	node("3", "Person", { age: 70, name: "Cyd" }),
	node("4", "Project", { budget: 5, name: "Alpha" }),
	node("5", "Project", { budget: 50, name: "Beta" }),
];

/** A config with one type's rules set; everything else default. */
function withType(label: string, type: Partial<GraphLegendConfig["types"][string]>): GraphLegendConfig {
	return {
		...defaultLegendConfig("demo"),
		types: { [label]: { caption: "", rules: [], ...type } },
	};
}

describe("fieldKindOf", () => {
	it("detects numeric, string, boolean and absent fields", () => {
		expect(fieldKindOf(nodes, "age")).toBe("numeric");
		expect(fieldKindOf(nodes, "name")).toBe("string");
		expect(fieldKindOf(nodes, "")).toBe("none");
		expect(fieldKindOf([node("1", "X", { done: true }), node("2", "X", { done: false })], "done")).toBe("boolean");
		expect(fieldKindOf(nodes, "missing")).toBe("none");
	});
});

describe("fieldsByType", () => {
	it("collects each type's own property names, sorted", () => {
		const byType = fieldsByType(nodes);
		expect(byType.get("Person")).toEqual(["age", "name"]);
		expect(byType.get("Project")).toEqual(["budget", "name"]);
	});
});

describe("autoCaptionField", () => {
	it("picks the first naming field a type carries", () => {
		expect(autoCaptionField(["age", "name"])).toBe("name");
		expect(autoCaptionField(["id", "age"])).toBe("id");
		expect(autoCaptionField(["title", "name"])).toBe("name");
		expect(autoCaptionField(["age"])).toBeNull();
	});
});

describe("generateRules", () => {
	it("returns nothing without a field or a usable method", () => {
		expect(generateRules("", "bins", { bands: 4, integer: true, decimals: 2, threshold: 0 }, nodes)).toEqual([]);
		expect(generateRules("name", "bins", { bands: 4, integer: true, decimals: 2, threshold: 0 }, nodes)).toEqual([]);
	});

	it("makes equal-width bins from a numeric field", () => {
		const rules = generateRules("age", "bins", { bands: 3, integer: true, decimals: 2, threshold: 0 }, nodes);
		expect(rules).toHaveLength(3);
		expect(rules[0]?.expression).toContain("age >=");
		expect(rules[0]?.expression).toContain("&&");
		// The last band is inclusive at the top.
		expect(rules[2]?.expression).toBe("age >= 53");
	});

	it("makes a value rule per distinct string value", () => {
		const rules = generateRules("name", "values", { bands: 4, integer: true, decimals: 2, threshold: 0 }, nodes);
		expect(rules.map((rule) => rule.name).sort()).toEqual(["Alpha", "Ann", "Beta", "Bob", "Cyd"]);
		expect(rules[0]?.expression).toMatch(/name == ".*"/);
	});

	it("splits on the nodes handed in, so a type subset gives the type's own bands", () => {
		const persons = nodes.filter((entry) => entry.label === "Person");
		const rules = generateRules("age", "bins", { bands: 2, integer: true, decimals: 2, threshold: 0 }, persons);
		expect(rules).toHaveLength(2);
		// Person ages span 20..70: the cut is the Person midpoint, untouched by Project budgets.
		expect(rules[0]?.expression).toBe("age >= 20 && age < 45");
		expect(rules[1]?.expression).toBe("age >= 45");
	});

	it("makes boolean rules", () => {
		const boolNodes = [node("1", "X", { done: true }), node("2", "X", { done: false })];
		const rules = generateRules("done", "bool", { bands: 4, integer: true, decimals: 2, threshold: 0 }, boolNodes);
		expect(rules).toHaveLength(2);
		expect(rules[0]?.expression).toBe("done == true");
		expect(rules[1]?.expression).toBe("done == false");
	});

	it("makes a two-band threshold", () => {
		const rules = generateRules("age", "threshold", { bands: 4, integer: true, decimals: 2, threshold: 40 }, nodes);
		expect(rules).toHaveLength(2);
		expect(rules[0]?.name).toBe("≤ 40");
		expect(rules[0]?.expression).toBe("age <= 40");
		expect(rules[1]?.name).toBe("> 40");
		expect(rules[1]?.expression).toBe("age > 40");
	});
});

describe("normalizeLegendConfig", () => {
	it("defaults when storage is empty", () => {
		const config = normalizeLegendConfig(null, "demo");
		expect(config).toEqual(defaultLegendConfig("demo"));
	});

	it("resets a pre-redesign store (no `types`) to the defaults", () => {
		const old = {
			caption: { template: "{{name}}", visible: true },
			field: "age",
			method: "bins",
			bands: 99,
			rules: [{ id: "r1", name: "low", expression: "age < 30" }],
			relations: { KNOWS: { dash: "dashed", arrow: "none" } },
			hidden: ["t:Meta|s:type:only"],
		};
		expect(normalizeLegendConfig(old, "demo")).toEqual(defaultLegendConfig("demo"));
	});

	it("keeps a valid configuration and drops malformed rules and colours", () => {
		const config = normalizeLegendConfig(
			{
				captionsVisible: false,
				types: {
					Person: {
						caption: "{{name}}!",
						color: "#ff0000",
						otherColor: "not-a-colour",
						rules: [
							{ id: "r1", name: "low", expression: "age < 30", color: "#00ff00" },
							{ name: "bad" },
							{ id: "r2", name: "mid", expression: "age < 50", color: "red" },
						],
					},
				},
				relations: { KNOWS: { dash: "dashed", arrow: "none", color: "#123456" }, BROKEN: { dash: "wavy" } },
				hidden: ["t:Meta|s:type:only"],
			},
			"demo",
		);
		expect(config.captionsVisible).toBe(false);
		expect(config.types.Person?.caption).toBe("{{name}}!");
		expect(config.types.Person?.color).toBe("#ff0000");
		expect(config.types.Person?.otherColor).toBeUndefined();
		expect(config.types.Person?.rules).toHaveLength(2);
		expect(config.types.Person?.rules[0]?.color).toBe("#00ff00");
		expect(config.types.Person?.rules[1]?.color).toBeUndefined();
		expect(config.relations.KNOWS).toEqual({ dash: "dashed", arrow: "none", color: "#123456" });
		expect(config.relations.BROKEN).toEqual({ dash: "solid", arrow: "end" });
		expect(config.hidden).toEqual(["t:Meta|s:type:only"]);
	});

	it("keeps a relation's display name, dropping blank ones", () => {
		const config = normalizeLegendConfig(
			{ types: {}, relations: { KNOWS: { dash: "solid", arrow: "end", name: " 认识 " }, LIKES: { name: "  " } } },
			"demo",
		);
		expect(config.relations.KNOWS?.name).toBe("认识");
		expect(config.relations.LIKES?.name).toBeUndefined();
	});
});

describe("relation styles", () => {
	it("cycles line styles over the result's sorted types when nothing is configured", () => {
		const config = defaultLegendConfig("demo");
		const order = ["DependsOn", "Knows", "LinksTo", "ParentOf", "TaggedWith"];
		expect(relationStyle("DependsOn", config, order).dash).toBe("solid");
		expect(relationStyle("Knows", config, order).dash).toBe("dashed");
		expect(relationStyle("LinksTo", config, order).dash).toBe("dotted");
		expect(relationStyle("ParentOf", config, order).dash).toBe("long");
		expect(relationStyle("TaggedWith", config, order).dash).toBe("solid");
		expect(relationStyle("Knows", config, order).arrow).toBe("end");
	});

	it("lets an explicit configuration override the cycle, and keeps the display name", () => {
		const config = defaultLegendConfig("demo");
		config.relations.Knows = { dash: "long", arrow: "both", name: "认识" };
		const order = ["DependsOn", "Knows"];
		expect(relationStyle("Knows", config, order)).toEqual({ dash: "long", arrow: "both", name: "认识" });
		expect(relationStyle("DependsOn", config, order).dash).toBe("solid");
	});

	it("falls back to solid without the type list, as before", () => {
		expect(relationStyle("Knows", defaultLegendConfig("demo")).dash).toBe("solid");
	});
});

describe("legend storage", () => {
	const originalLocalStorage = (globalThis as { localStorage?: Storage }).localStorage;

	afterEach(() => {
		(globalThis as { localStorage?: Storage }).localStorage = originalLocalStorage;
	});

	it("round-trips a configuration through localStorage", () => {
		const store = new Map<string, string>();
		(globalThis as { localStorage?: Storage }).localStorage = {
			getItem: (key: string) => store.get(key) ?? null,
			setItem: (key: string, value: string) => void store.set(key, value),
			removeItem: (key: string) => void store.delete(key),
		} as unknown as Storage;
		const config = withType("Person", { rules: [{ id: "r1", name: "young", expression: "age < 30" }] });
		saveLegendConfig("demo", config);
		expect(store.has(legendStorageKey("demo"))).toBe(true);
		expect(loadLegendConfig("demo")).toEqual(config);
	});
});

describe("resolveLegend", () => {
	const theme = "light";

	it("colours by node type alone when nothing is configured", () => {
		const resolved = resolveLegend(nodes, defaultLegendConfig("demo"), theme);
		const keys = resolved.buckets.map((bucket) => bucket.key).sort();
		expect(keys).toEqual(["t:Person|s:type:only", "t:Project|s:type:only"]);
		const person = resolved.buckets.find((bucket) => bucket.key === "t:Person|s:type:only");
		const project = resolved.buckets.find((bucket) => bucket.key === "t:Project|s:type:only");
		expect(person?.label).toBe("Person");
		expect(person?.colors.fill).not.toBe(project?.colors.fill);
	});

	it("guesses captions from the type's fields and falls back to the title", () => {
		const resolved = resolveLegend(nodes, defaultLegendConfig("demo"), theme);
		expect(resolved.captionOf.get("1")).toBe("Ann");
		expect(resolved.captionOf.get("5")).toBe("Beta");
		// No naming field at all: the extraction's own title (here the id) takes over.
		const resolved2 = resolveLegend([node("9", "Reading", { value: 3 })], defaultLegendConfig("demo"), theme);
		expect(resolved2.captionOf.get("9")).toBe("9");
	});

	it("writes no caption when captions are switched off", () => {
		const config: GraphLegendConfig = { ...defaultLegendConfig("demo"), captionsVisible: false };
		const resolved = resolveLegend(nodes, config, theme);
		expect(resolved.captionOf.get("1")).toBe("");
	});

	it("applies a type's rules to that type alone, with an Other catch-all", () => {
		const config = withType("Person", {
			rules: [
				{ id: "r1", name: "young", expression: "age < 30" },
				{ id: "r2", name: "old", expression: "age >= 60" },
			],
		});
		const resolved = resolveLegend(nodes, config, theme);
		const keys = resolved.buckets.map((bucket) => bucket.key).sort();
		expect(keys).toEqual(["t:Person|s:r0", "t:Person|s:r1", "t:Person|s:rule:other", "t:Project|s:type:only"]);
		expect(resolved.bucketOf.get("1")).toBe("t:Person|s:r0");
		expect(resolved.bucketOf.get("2")).toBe("t:Person|s:rule:other");
		expect(resolved.bucketOf.get("3")).toBe("t:Person|s:r1");
		// Project has no rules: its nodes stay colour-by-type even though Person's rules exist.
		expect(resolved.bucketOf.get("4")).toBe("t:Project|s:type:only");
		// The three Person buckets share one hue at three lightness steps.
		const fills = ["t:Person|s:r0", "t:Person|s:r1", "t:Person|s:rule:other"].map(
			(key) => resolved.buckets.find((bucket) => bucket.key === key)?.colors.fill as string,
		);
		expect(new Set(fills).size).toBe(3);
	});

	it("lets a rule's explicit colour win over the lightness ramp", () => {
		const config = withType("Person", {
			rules: [{ id: "r1", name: "young", expression: "age < 30", color: "#ff0000" }],
		});
		const resolved = resolveLegend(nodes, config, theme);
		const bucket = resolved.buckets.find((entry) => entry.key === "t:Person|s:r0");
		expect(bucket?.colors).toEqual(explicitNodeColors("#ff0000", theme));
	});

	it("lets the type base colour and the Other colour be overridden", () => {
		const config = withType("Person", {
			color: "#ff0000",
			otherColor: "#00ff00",
			rules: [{ id: "r1", name: "young", expression: "age < 30" }],
		});
		const resolved = resolveLegend(nodes, config, theme);
		// The unmatched rule still steps down the overridden hue's ramp.
		const rule = resolved.buckets.find((entry) => entry.key === "t:Person|s:r0");
		expect(rule?.colors).toEqual(subclassColors(hueOfHex("#ff0000"), 0, 2, theme));
		const other = resolved.buckets.find((entry) => entry.key === "t:Person|s:rule:other");
		expect(other?.colors).toEqual(explicitNodeColors("#00ff00", theme));
		// A rule-free type with a base colour paints with it directly.
		const config2 = withType("Project", { color: "#0000ff" });
		const resolved2 = resolveLegend(nodes, config2, theme);
		const project = resolved2.buckets.find((entry) => entry.key === "t:Project|s:type:only");
		expect(project?.colors).toEqual(explicitNodeColors("#0000ff", theme));
	});

	it("treats a broken rule as matching nothing instead of throwing", () => {
		const config = withType("Person", { rules: [{ id: "r1", name: "broken", expression: "age >= >" }] });
		const resolved = resolveLegend(nodes, config, theme);
		expect(resolved.bucketOf.get("1")).toBe("t:Person|s:rule:other");
	});

	it("renders a type's caption template per node", () => {
		const config = withType("Person", { caption: "{{name}} ({{age}})" });
		const resolved = resolveLegend(nodes, config, theme);
		expect(resolved.captionOf.get("1")).toBe("Ann (20)");
		// Project keeps the automatic guess.
		expect(resolved.captionOf.get("4")).toBe("Alpha");
	});
});

describe("renderCaption", () => {
	it("replaces placeholders and drops empty separators", () => {
		expect(renderCaption("{{name}} · {{status}}", { name: "Ann", status: "" }, "fallback")).toBe("Ann");
		expect(renderCaption("{{name}}", { name: "Ann" }, "fallback")).toBe("Ann");
		expect(renderCaption("{{missing}}", {}, "fallback")).toBe("fallback");
	});
});

describe("palette colour picks", () => {
	it("recognises only #rrggbb colours", () => {
		expect(isHexColor("#a0B1c2")).toBe(true);
		expect(isHexColor("red")).toBe(false);
		expect(isHexColor("#abc")).toBe(false);
		expect(isHexColor(42)).toBe(false);
	});

	it("reads the hue back out of a hex colour", () => {
		expect(hueOfHex("#ff0000")).toBe(0);
		expect(hueOfHex("#00ff00")).toBe(120);
		expect(hueOfHex("#0000ff")).toBe(240);
		expect(hueOfHex("#808080")).toBe(0);
	});

	it("paints an explicit colour with the theme's stroke policy", () => {
		expect(explicitNodeColors("#3b82f6", "light").fill).toBe("#3b82f6");
		expect(explicitNodeColors("#3b82f6", "dark").stroke).not.toBe(explicitNodeColors("#3b82f6", "light").stroke);
	});

	it("derives a rule's ramp colour from the overridden type hue", () => {
		// The override hue feeds the same ramp the automatic hue would: same lightness steps.
		expect(subclassColors(0, 0, 2, "light").fill).toBe(subclassColors(hueOfHex("#ff0000"), 0, 2, "light").fill);
		expect(subclassColors(labelHue("Person"), 0, 2, "light").fill).not.toBe(subclassColors(0, 0, 2, "light").fill);
	});
});
