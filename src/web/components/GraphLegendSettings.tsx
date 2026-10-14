import { useEffect, useRef, useState } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { useI18n } from "../hooks/useI18n";
import type { ResultGraphNode } from "../utils/cypher-graph";
import { edgeStroke } from "../utils/graph-canvas";
import { COMPARE_OPERATORS, expressionError, LOGIC_OPERATORS } from "../utils/graph-expression";
import {
	ARROW_MODES,
	type ArrowMode,
	autoCaptionField,
	DEFAULT_BANDS,
	DEFAULT_DECIMALS,
	fieldKindOf,
	type GenerateOptions,
	type GraphLegendConfig,
	generateRules,
	type LegendBucket,
	LINE_DASH,
	LINE_STYLES,
	type LineStyle,
	MAX_BANDS,
	MAX_DECIMALS,
	MIN_BANDS,
	NEUTRAL_BUCKET,
	newRule,
	OTHER_BUCKET,
	placeholderFor,
	type QuickMethod,
	type RelationStyle,
	type RuleConfig,
	relationStyle,
	type TypeConfig,
} from "../utils/graph-legend-config";
import { gradientColors, hueNodeColors, hueOfHex, isHexColor, labelHue, subclassColors } from "../utils/graph-palette";
import { LegendDot } from "./GraphLegend";

/**
 * The result graph's legend settings (BACK-794, per-type redesign).
 *
 * The panel is an accordion of one card per node type, because everything a colour or a name is
 * made of belongs to the type: a Person's age bands mean nothing to a Project. Each card holds
 * the type's own caption template (empty = the type's fields are guessed), its ordered rule list
 * with a fixed "Other" catch-all at the tail, and a quick-add that *generates* rules from one of
 * the type's own fields - by value with checkboxes for a string, by bands for a number, one click
 * for a boolean. Generated rules are ordinary rules afterwards: the quick-add is a starting
 * point, not a cage, and it appends rather than replacing what the reader already wrote.
 *
 * The card header's colour dot overrides the type's automatic hue (the lightness ramp still
 * applies inside the type); every colour row shows the resolved colour until the reader picks one
 * of their own. The quick-add's parameters (method, band count, checked values) are panel state,
 * never configuration - what persists is the rules they write. The dropdown is the only way to
 * add a field (the brief asked for it explicitly): it inserts at the caret, in a caption as
 * `{{field}}` and in a rule as the bare name.
 */

interface GraphLegendSettingsProps {
	/** The database whose configuration this is. */
	database: string;
	/** Each type's own property names, offered as chips and as field choices. */
	fieldsByType: Map<string, string[]>;
	/** How many nodes each type holds; the cards sort by it, biggest first. */
	typeCounts: Map<string, number>;
	/** The colour buckets as they stand, each with its count. */
	buckets: LegendBucket[];
	/** The relationship types the result carries. */
	edgeTypes: string[];
	/** The result's nodes, used by the quick-add to read a field's kind and values. */
	nodes: ResultGraphNode[];
	config: GraphLegendConfig;
	onChange: (next: GraphLegendConfig) => void;
	/** Back to the defaults for this database; a draft like any other edit until 保存. */
	onReset: () => void;
	/** Persist the draft to storage and close. */
	onSave: () => void;
	/** Discard the draft (back to the configuration the panel opened with) and close. */
	onCancel: () => void;
}

/** Quick-add options the string methods never read; kept so the call sites stay uniform. */
const STRING_OPTIONS: GenerateOptions = {
	bands: DEFAULT_BANDS,
	integer: true,
	decimals: DEFAULT_DECIMALS,
	threshold: 0,
};

export default function GraphLegendSettings({
	database: _database,
	fieldsByType,
	typeCounts,
	buckets,
	edgeTypes,
	nodes,
	config,
	onChange,
	onReset,
	onSave,
	onCancel,
}: GraphLegendSettingsProps) {
	const { t } = useI18n();
	const { theme } = useTheme();
	// null = untouched (the first card opens), "none" = the reader collapsed everything.
	const [openType, setOpenType] = useState<string | null | "none">(null);

	const patch = (changes: Partial<GraphLegendConfig>) => onChange({ ...config, ...changes });
	const typeConfigOf = (label: string): TypeConfig => config.types[label] ?? { caption: "", rules: [] };
	const patchType = (label: string, changes: Partial<TypeConfig>) =>
		patch({ types: { ...config.types, [label]: { ...typeConfigOf(label), ...changes } } });

	const updateRelation = (type: string, changes: Partial<RelationStyle>) => {
		// Merge onto the *effective* style, so changing one knob keeps the cycled defaults of the rest.
		const current = relationStyle(type, config, edgeTypes);
		patch({ relations: { ...config.relations, [type]: { ...current, ...changes } } });
	};

	const toggleBucket = (key: string) => {
		const hidden = new Set(config.hidden);
		if (hidden.has(key)) hidden.delete(key);
		else hidden.add(key);
		patch({ hidden: [...hidden] });
	};

	// Cards sort by size, biggest first: the type that dominates the picture owns the first card.
	const labels = [...typeCounts.entries()]
		.sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
		.map(([label]) => label);
	const expanded = openType === null ? (labels[0] ?? null) : openType === "none" ? null : openType;

	const nodesByType = new Map<string, ResultGraphNode[]>();
	for (const node of nodes) {
		const list = nodesByType.get(node.label) ?? [];
		list.push(node);
		nodesByType.set(node.label, list);
	}

	const hidden = new Set(config.hidden);
	const lineLabels: Record<LineStyle, string> = {
		solid: t.databases.legendLineSolid,
		dashed: t.databases.legendLineDashed,
		dotted: t.databases.legendLineDotted,
		long: t.databases.legendLineLong,
	};
	const arrowLabels: Record<ArrowMode, string> = {
		none: t.databases.legendArrowNone,
		end: t.databases.legendArrowEnd,
		start: t.databases.legendArrowStart,
		both: t.databases.legendArrowBoth,
	};

	return (
		<div className="absolute inset-x-0 top-0 z-20 max-h-full overflow-y-auto border-b border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-800">
			<div className="mb-3 flex items-center justify-between">
				<h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t.databases.legendSettings}</h3>
				<div className="flex items-center gap-3">
					<label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
						<input
							type="checkbox"
							checked={config.captionsVisible}
							onChange={(event) => patch({ captionsVisible: event.target.checked })}
						/>
						{t.databases.legendShowCaptions}
					</label>
					<button
						type="button"
						onClick={onCancel}
						aria-label={t.databases.legendClose}
						title={t.databases.legendClose}
						className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-200"
					>
						<svg
							aria-hidden="true"
							className="h-3.5 w-3.5"
							fill="none"
							stroke="currentColor"
							strokeWidth={2}
							viewBox="0 0 24 24"
						>
							<path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
						</svg>
					</button>
				</div>
			</div>

			<div className="space-y-4">
				{labels.map((label) => (
					<TypeCard
						key={label}
						label={label}
						count={typeCounts.get(label) ?? 0}
						fields={fieldsByType.get(label) ?? []}
						nodes={nodesByType.get(label) ?? []}
						typeConf={typeConfigOf(label)}
						theme={theme}
						expanded={expanded === label}
						onToggle={() => setOpenType(expanded === label ? "none" : label)}
						onChange={(changes) => patchType(label, changes)}
					/>
				))}

				<Section title={t.databases.legendBuckets}>
					<p className="text-xs text-gray-500 dark:text-gray-400">{t.databases.legendBucketsHint}</p>
					<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
						{buckets.map((bucket) => (
							<LegendDot
								key={bucket.key}
								color={bucket.colors.fill}
								label={labelForBucket(bucket, t)}
								count={bucket.count}
								active={!hidden.has(bucket.key)}
								onToggle={() => toggleBucket(bucket.key)}
								hint={bucket.internal ? t.databases.graphInternalHint : t.graphView.filterToggle}
							/>
						))}
					</div>
				</Section>

				{edgeTypes.length > 0 && (
					<Section title={t.databases.legendRelations}>
						<div className="space-y-1.5">
							{edgeTypes.map((type) => {
								const style = relationStyle(type, config, edgeTypes);
								return (
									<div
										key={type}
										className="flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-300"
									>
										<span className="w-28 truncate font-mono" title={type}>
											{type}
										</span>
										<input
											type="text"
											value={style.name ?? ""}
											onChange={(event) => {
												const name = event.target.value.trim();
												updateRelation(type, { name: name.length > 0 ? name : undefined });
											}}
											placeholder={type}
											aria-label={`${type} ${t.databases.legendRelationName}`}
											className="w-28 rounded border border-gray-300 bg-white px-1.5 py-0.5 text-xs dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
										/>
										<LineSample dash={LINE_DASH[style.dash]} arrow={style.arrow} color={style.color} />
										<select
											value={style.dash}
											onChange={(event) => updateRelation(type, { dash: event.target.value as LineStyle })}
											aria-label={`${type} ${t.databases.legendLine}`}
											className="rounded border border-gray-300 bg-white px-1 py-0.5 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
										>
											{LINE_STYLES.map((option) => (
												<option key={option} value={option}>
													{lineLabels[option]}
												</option>
											))}
										</select>
										<select
											value={style.arrow}
											onChange={(event) => updateRelation(type, { arrow: event.target.value as ArrowMode })}
											aria-label={`${type} ${t.databases.legendArrow}`}
											className="rounded border border-gray-300 bg-white px-1 py-0.5 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
										>
											{ARROW_MODES.map((option) => (
												<option key={option} value={option}>
													{arrowLabels[option]}
												</option>
											))}
										</select>
										<ColorInput
											value={style.color}
											effective={edgeStroke(theme)}
											label={t.databases.legendRelationColor}
											onPick={(color) => updateRelation(type, { color })}
											onClear={() => updateRelation(type, { color: undefined })}
										/>
									</div>
								);
							})}
						</div>
					</Section>
				)}
			</div>

			<div className="mt-4 flex items-center justify-end gap-2">
				<button
					type="button"
					onClick={onReset}
					className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
				>
					{t.databases.legendReset}
				</button>
				<button
					type="button"
					onClick={onSave}
					className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
				>
					{t.common.save}
				</button>
				<button
					type="button"
					onClick={onCancel}
					className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
				>
					{t.common.cancel}
				</button>
			</div>
		</div>
	);
}

/** Reads the localised label of one bucket - the catch-all borrows the locale's own word. */
function labelForBucket(bucket: LegendBucket, t: ReturnType<typeof useI18n>["t"]): string {
	if (bucket.key.endsWith(`|${OTHER_BUCKET}`) || bucket.key === NEUTRAL_BUCKET) {
		return bucket.key === NEUTRAL_BUCKET ? bucket.label : t.databases.legendOther;
	}
	return bucket.label;
}

/**
 * One node type's card: its caption template, its rules with the fixed Other row, and the
 * quick-add that appends generated rules. The header carries the type's base colour - the dot
 * opens a colour picker, and while an override is set a small × returns to the automatic hue.
 */
function TypeCard({
	label,
	count,
	fields,
	nodes,
	typeConf,
	theme,
	expanded,
	onToggle,
	onChange,
}: {
	label: string;
	count: number;
	fields: string[];
	nodes: ResultGraphNode[];
	typeConf: TypeConfig;
	theme: string;
	expanded: boolean;
	onToggle: () => void;
	onChange: (changes: Partial<TypeConfig>) => void;
}) {
	const { t } = useI18n();
	const [focusedRule, setFocusedRule] = useState<string | null>(null);
	const captionRef = useRef<HTMLInputElement>(null);

	// The hue every derived colour of this card reads from: the override when one is set, else the
	// label's automatic slot on the ring. Effective fills are what the colour inputs show while no
	// explicit colour is picked, so the picker opens on the colour the picture already uses.
	const hue = typeConf.color !== undefined && isHexColor(typeConf.color) ? hueOfHex(typeConf.color) : labelHue(label);
	const total = typeConf.rules.length + 1;
	const ruleEffective = (index: number) =>
		typeConf.rules[index]?.color ?? subclassColors(hue, index, total, theme).fill;
	const otherEffective = typeConf.otherColor ?? subclassColors(hue, typeConf.rules.length, total, theme).fill;
	const baseFill = typeConf.color ?? hueNodeColors(hue, theme).fill;
	const guessedField = autoCaptionField(fields);

	const updateRule = (id: string, changes: Partial<RuleConfig>) =>
		onChange({ rules: typeConf.rules.map((rule) => (rule.id === id ? { ...rule, ...changes } : rule)) });
	const addRule = () => onChange({ rules: [...typeConf.rules, newRule()] });
	const removeRule = (id: string) => onChange({ rules: typeConf.rules.filter((rule) => rule.id !== id) });
	const moveRule = (index: number, offset: number) => {
		const target = index + offset;
		if (target < 0 || target >= typeConf.rules.length) return;
		const rules = [...typeConf.rules];
		const [moved] = rules.splice(index, 1);
		if (moved) rules.splice(target, 0, moved);
		onChange({ rules });
	};

	/**
	 * Insert text where the caret is - the whole point of the field dropdown. The input is
	 * controlled, so the caret has to be put back after React has written the new value.
	 */
	const insertAtCaret = (
		input: HTMLInputElement | null,
		value: string,
		text: string,
		write: (next: string) => void,
	) => {
		if (!input) {
			write(value + text);
			return;
		}
		const start = input.selectionStart ?? value.length;
		const end = input.selectionEnd ?? start;
		write(value.slice(0, start) + text + value.slice(end));
		const caret = start + text.length;
		requestAnimationFrame(() => {
			input.focus();
			input.setSelectionRange(caret, caret);
		});
	};

	return (
		<div className="rounded border border-gray-200 dark:border-gray-700">
			<div className="flex items-center gap-2 px-2 py-1.5">
				<ColorInput
					value={typeConf.color}
					effective={baseFill}
					label={`${label} ${t.databases.legendTypeColor}`}
					onPick={(color) => onChange({ color })}
					onClear={() => onChange({ color: undefined })}
				/>
				<button
					type="button"
					onClick={onToggle}
					aria-expanded={expanded}
					className="flex flex-1 items-center gap-2 rounded px-1 py-0.5 text-left text-xs font-medium text-gray-800 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
				>
					<span className="font-mono">{label}</span>
					<span className="text-gray-400 dark:text-gray-500">{count}</span>
					<span className="ml-auto text-gray-400 dark:text-gray-500" aria-hidden="true">
						{expanded ? "▾" : "▸"}
					</span>
				</button>
			</div>

			{expanded && (
				<div className="space-y-4 border-t border-gray-200 p-3 dark:border-gray-700">
					<Section
						title={t.databases.legendCaption}
						aside={
							<FieldInsert
								fields={fields}
								onPick={(field) =>
									insertAtCaret(captionRef.current, typeConf.caption, placeholderFor(field), (next) =>
										onChange({ caption: next }),
									)
								}
							/>
						}
					>
						<input
							ref={captionRef}
							type="text"
							value={typeConf.caption}
							onChange={(event) => onChange({ caption: event.target.value })}
							placeholder={guessedField === null ? label : placeholderFor(guessedField)}
							aria-label={`${label} ${t.databases.legendCaption}`}
							className="w-full rounded border border-gray-300 bg-white px-2 py-1 font-mono text-xs text-gray-800 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
						/>
						<p className="text-xs text-gray-500 dark:text-gray-400">{t.databases.legendCaptionHint}</p>
					</Section>

					<Section title={t.databases.legendRules}>
						<p className="text-xs text-gray-500 dark:text-gray-400">{t.databases.legendRulesHint}</p>
						<div className="space-y-2">
							{typeConf.rules.map((rule, index) => (
								<RuleRow
									key={rule.id}
									rule={rule}
									fields={fields}
									colorEffective={ruleEffective(index)}
									expanded={focusedRule === rule.id || (focusedRule === null && index === 0)}
									canMoveUp={index > 0}
									canMoveDown={index < typeConf.rules.length - 1}
									onFocus={() => setFocusedRule(rule.id)}
									onChange={(changes) => updateRule(rule.id, changes)}
									onMove={(offset) => moveRule(index, offset)}
									onRemove={() => removeRule(rule.id)}
								/>
							))}
							<button
								type="button"
								onClick={addRule}
								className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
							>
								{t.databases.legendAddRule}
							</button>
						</div>
						{typeConf.rules.length > 0 && (
							<div className="flex items-center gap-1.5 rounded border border-dashed border-gray-300 px-2 py-1 text-xs text-gray-500 dark:border-gray-600 dark:text-gray-400">
								<ColorInput
									value={typeConf.otherColor}
									effective={otherEffective}
									label={t.databases.legendRuleColor}
									onPick={(color) => onChange({ otherColor: color })}
									onClear={() => onChange({ otherColor: undefined })}
								/>
								<span className="font-medium">{t.databases.legendOther}</span>
								<span>{t.databases.legendOtherHint}</span>
							</div>
						)}
					</Section>

					{fields.length > 0 && (
						<Section title={t.databases.legendQuickAdd}>
							<QuickAdd
								fields={fields}
								nodes={nodes}
								baseColor={baseFill}
								hue={hue}
								existingRules={typeConf.rules.length}
								onAppend={(rules) => onChange({ rules: [...typeConf.rules, ...rules] })}
							/>
						</Section>
					)}
				</div>
			)}
		</div>
	);
}

/**
 * The one-click rule writers of a type card. A field is chosen first; its kind over this type's
 * own nodes decides which form follows - values with checkboxes for a string, a grouping form
 * for a number, one button for a boolean. Everything appends to the rule list, and every
 * parameter here is panel state: what persists is the rules, not how they were made.
 *
 * The colour mode decides how the generated rules are painted. "Lightness" leaves them colourless,
 * so the resolver walks the type's own lightness ramp; "gradient" bakes an explicit colour into
 * each rule, sampled evenly between two endpoint colours - optionally inverted (the photographic
 * negative) and/or overlaid 50/50 on the type's base colour, so the subclasses still read as one
 * family. Baked colours are ordinary rule colours afterwards: editable per rule like any other.
 */
function QuickAdd({
	fields,
	nodes,
	baseColor,
	hue,
	existingRules,
	onAppend,
}: {
	fields: string[];
	nodes: ResultGraphNode[];
	/** The type's effective base fill, used when the gradient is overlaid on the type colour. */
	baseColor: string;
	/** The type's effective hue, for previewing the lightness ramp. */
	hue: number;
	/** Rules the type already carries: the preview shows where new rules land after them. */
	existingRules: number;
	onAppend: (rules: RuleConfig[]) => void;
}) {
	const { t } = useI18n();
	const { theme } = useTheme();
	const [field, setField] = useState("");
	const [colorMode, setColorMode] = useState<"lightness" | "gradient">("lightness");
	const [from, setFrom] = useState("#3b82f6");
	const [to, setTo] = useState("#ef4444");
	const [invert, setInvert] = useState(false);
	const [overlay, setOverlay] = useState(false);
	const kind = fieldKindOf(nodes, field);

	/**
	 * The colours the next `count` appended rules would carry, so the reader sees the picture
	 * before clicking add: the gradient's own samples, or the lightness steps the resolver will
	 * walk once these rules join the ones already there.
	 */
	const colorsFor = (count: number): string[] => {
		if (count < 1) return [];
		if (colorMode === "gradient") {
			return gradientColors(count, { from, to, invert, overlayBase: overlay ? baseColor : undefined });
		}
		const total = existingRules + count + 1;
		return Array.from({ length: count }, (_, index) => subclassColors(hue, existingRules + index, total, theme).fill);
	};

	const append = (rules: RuleConfig[]) => {
		if (colorMode === "gradient" && rules.length > 0) {
			const colors = gradientColors(rules.length, { from, to, invert, overlayBase: overlay ? baseColor : undefined });
			onAppend(rules.map((rule, index) => ({ ...rule, color: colors[index] })));
			return;
		}
		onAppend(rules);
	};

	return (
		<div className="space-y-2">
			<label className="flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
				<span>{t.databases.legendField}</span>
				<select
					value={field}
					onChange={(event) => setField(event.target.value)}
					className="rounded border border-gray-300 bg-white px-1 py-0.5 text-xs dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
				>
					<option value="">—</option>
					{fields.map((name) => (
						<option key={name} value={name}>
							{name}
						</option>
					))}
				</select>
			</label>
			<label className="flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
				<span>{t.databases.legendColorMode}</span>
				<select
					value={colorMode}
					onChange={(event) => setColorMode(event.target.value as "lightness" | "gradient")}
					className="rounded border border-gray-300 bg-white px-1 py-0.5 text-xs dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
				>
					<option value="lightness">{t.databases.legendColorModeLightness}</option>
					<option value="gradient">{t.databases.legendColorModeGradient}</option>
				</select>
			</label>
			{colorMode === "gradient" && (
				<div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 dark:text-gray-300">
					<label className="flex items-center gap-1.5">
						<span>{t.databases.legendGradientFrom}</span>
						<input
							type="color"
							value={from}
							onChange={(event) => setFrom(event.target.value)}
							aria-label={t.databases.legendGradientFrom}
							className="h-5 w-7 cursor-pointer rounded border border-gray-300 bg-white p-0 dark:border-gray-600 dark:bg-gray-900"
						/>
					</label>
					<label className="flex items-center gap-1.5">
						<span>{t.databases.legendGradientTo}</span>
						<input
							type="color"
							value={to}
							onChange={(event) => setTo(event.target.value)}
							aria-label={t.databases.legendGradientTo}
							className="h-5 w-7 cursor-pointer rounded border border-gray-300 bg-white p-0 dark:border-gray-600 dark:bg-gray-900"
						/>
					</label>
					<label className="flex items-center gap-1.5">
						<input type="checkbox" checked={invert} onChange={(event) => setInvert(event.target.checked)} />
						{t.databases.legendInvert}
					</label>
					<label className="flex items-center gap-1.5">
						<input type="checkbox" checked={overlay} onChange={(event) => setOverlay(event.target.checked)} />
						{t.databases.legendOverlay}
					</label>
				</div>
			)}
			{kind === "string" && (
				<StringQuickAdd key={field} field={field} nodes={nodes} colorsFor={colorsFor} onAppend={append} />
			)}
			{kind === "numeric" && (
				<NumericQuickAdd key={field} field={field} nodes={nodes} colorsFor={colorsFor} onAppend={append} />
			)}
			{kind === "boolean" && (
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={() => append(generateRules(field, "bool", STRING_OPTIONS, nodes))}
						className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
					>
						{t.databases.legendAddBool}
					</button>
					<ColorPreview colors={colorsFor(2)} label={t.databases.legendPreview} />
				</div>
			)}
		</div>
	);
}

/**
 * Quick-add for a string field: the type's own values, most frequent first, each with its count
 * and a checkbox (all checked to start). The match mode decides the shape of the expression -
 * equals, contains or starts with - and "add" appends one rule per checked value.
 */
function StringQuickAdd({
	field,
	nodes,
	colorsFor,
	onAppend,
}: {
	field: string;
	nodes: ResultGraphNode[];
	/** The colours the next `n` appended rules would carry - previewed beside each value. */
	colorsFor: (count: number) => string[];
	onAppend: (rules: RuleConfig[]) => void;
}) {
	const { t } = useI18n();
	const [match, setMatch] = useState<"values" | "contains" | "prefix">("values");
	// The same frequency order the generator writes, so the checkboxes and the rules agree.
	const values: Array<[string, number]> = (() => {
		const counts = new Map<string, number>();
		for (const node of nodes) {
			const value = node.properties[field];
			if (typeof value === "string" && value.trim().length > 0) counts.set(value, (counts.get(value) ?? 0) + 1);
		}
		return [...counts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 12);
	})();
	const [checked, setChecked] = useState<Set<string>>(() => new Set(values.map(([value]) => value)));

	const toggle = (value: string) => {
		const next = new Set(checked);
		if (next.has(value)) next.delete(value);
		else next.add(value);
		setChecked(next);
	};
	const allChecked = values.length > 0 && checked.size === values.length;
	// The colour each checked value's rule will carry, in the order the rules are appended.
	const previewColors = colorsFor(checked.size);
	const previewRank = new Map(values.filter(([value]) => checked.has(value)).map(([value], index) => [value, index]));
	const append = () =>
		onAppend(generateRules(field, match, STRING_OPTIONS, nodes).filter((rule) => checked.has(rule.name)));
	const matchLabels = {
		values: t.databases.legendMatchEquals,
		contains: t.databases.legendMatchContains,
		prefix: t.databases.legendMatchPrefix,
	};

	return (
		<div className="space-y-2">
			<label className="flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
				<span>{t.databases.legendMethod}</span>
				<select
					value={match}
					onChange={(event) => setMatch(event.target.value as "values" | "contains" | "prefix")}
					className="rounded border border-gray-300 bg-white px-1 py-0.5 text-xs dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
				>
					{(["values", "contains", "prefix"] as const).map((option) => (
						<option key={option} value={option}>
							{matchLabels[option]}
						</option>
					))}
				</select>
			</label>
			{values.length === 0 ? (
				<p className="text-xs text-gray-400 dark:text-gray-500">{t.databases.legendNoValue}</p>
			) : (
				<div className="space-y-1">
					<label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-300">
						<input
							type="checkbox"
							checked={allChecked}
							onChange={() => setChecked(allChecked ? new Set() : new Set(values.map(([value]) => value)))}
						/>
						{t.databases.legendSelectAll}
					</label>
					{values.map(([value, count]) => {
						const rank = previewRank.get(value);
						return (
							<label key={value} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
								<input type="checkbox" checked={checked.has(value)} onChange={() => toggle(value)} />
								<span
									className="h-2.5 w-2.5 shrink-0 rounded-circle border border-gray-300 dark:border-gray-600"
									style={{ backgroundColor: rank !== undefined ? previewColors[rank] : "transparent" }}
									aria-hidden="true"
								/>
								<span className="font-mono">{value}</span>
								<span className="text-gray-400 dark:text-gray-500">{count}</span>
							</label>
						);
					})}
				</div>
			)}
			<button
				type="button"
				onClick={append}
				disabled={checked.size === 0}
				className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-40 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
			>
				{t.databases.legendAddSelected.replace("{1}", String(checked.size))}
			</button>
		</div>
	);
}

/**
 * Quick-add for a numeric field: equal-width bands, quantiles or a single threshold, with the
 * band count and edge formatting beside it. "Add" appends the generated band rules; the reader
 * edits the expressions afterwards like any other rule.
 */
function NumericQuickAdd({
	field,
	nodes,
	colorsFor,
	onAppend,
}: {
	field: string;
	nodes: ResultGraphNode[];
	/** The colours the next `n` appended rules would carry - previewed below the grouping form. */
	colorsFor: (count: number) => string[];
	onAppend: (rules: RuleConfig[]) => void;
}) {
	const { t } = useI18n();
	const [method, setMethod] = useState<QuickMethod>("bins");
	const [bands, setBands] = useState(DEFAULT_BANDS);
	const [integer, setInteger] = useState(true);
	const [decimals, setDecimals] = useState(DEFAULT_DECIMALS);
	const [threshold, setThreshold] = useState(0);
	const options: GenerateOptions = { bands, integer, decimals, threshold };
	const methodLabels: Partial<Record<QuickMethod, string>> = {
		bins: t.databases.legendMethodBins,
		quantile: t.databases.legendMethodQuantile,
		threshold: t.databases.legendMethodThreshold,
	};

	return (
		<div className="space-y-2">
			<label className="flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
				<span>{t.databases.legendMethod}</span>
				<select
					value={method}
					onChange={(event) => setMethod(event.target.value as QuickMethod)}
					className="rounded border border-gray-300 bg-white px-1 py-0.5 text-xs dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
				>
					{(["bins", "quantile", "threshold"] as const).map((option) => (
						<option key={option} value={option}>
							{methodLabels[option]}
						</option>
					))}
				</select>
			</label>
			{(method === "bins" || method === "quantile") && (
				<label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
					<span>{t.databases.legendBands}</span>
					<input
						type="number"
						min={MIN_BANDS}
						max={MAX_BANDS}
						value={bands}
						onChange={(event) => setBands(Number(event.target.value))}
						className="w-14 rounded border border-gray-300 bg-white px-1 py-0.5 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
					/>
				</label>
			)}
			{method === "threshold" && (
				<label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
					<span>{t.databases.legendThreshold}</span>
					<input
						type="number"
						value={threshold}
						onChange={(event) => setThreshold(Number(event.target.value))}
						className="w-20 rounded border border-gray-300 bg-white px-1 py-0.5 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
					/>
				</label>
			)}
			{method === "bins" && (
				<div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 dark:text-gray-300">
					<label className="flex items-center gap-1.5">
						<input type="checkbox" checked={integer} onChange={(event) => setInteger(event.target.checked)} />
						{t.databases.legendInteger}
					</label>
					<label className="flex items-center gap-1.5">
						<span>{t.databases.legendDecimals}</span>
						<input
							type="number"
							min={0}
							max={MAX_DECIMALS}
							disabled={integer}
							value={decimals}
							onChange={(event) => setDecimals(Number(event.target.value))}
							className="w-14 rounded border border-gray-300 bg-white px-1 py-0.5 disabled:opacity-40 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
						/>
					</label>
				</div>
			)}
			<div className="flex items-center gap-2">
				<button
					type="button"
					onClick={() => onAppend(generateRules(field, method, options, nodes))}
					className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
				>
					{t.databases.legendAddBands}
				</button>
				<ColorPreview colors={colorsFor(method === "threshold" ? 2 : bands)} label={t.databases.legendPreview} />
			</div>
		</div>
	);
}

/** The colours the next add will write, one dot per rule it creates - seen before committing. */
function ColorPreview({ colors, label }: { colors: string[]; label: string }) {
	if (colors.length === 0) return null;
	return (
		<span className="flex items-center gap-1" title={label}>
			{colors.map((color, index) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: preview dots have no identity beyond their position
				<span key={`${index}-${color}`} className="h-2.5 w-2.5 rounded-circle" style={{ backgroundColor: color }} />
			))}
		</span>
	);
}

function Section({
	title,
	aside,
	children,
}: {
	title: string;
	/** An action pinned to the right end of the title row (e.g. the caption's field inserter). */
	aside?: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<section className="space-y-2">
			<div className="flex items-center justify-between gap-2">
				<h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{title}</h4>
				{aside}
			</div>
			<div className="space-y-2">{children}</div>
		</section>
	);
}

function Chip({ label, onClick }: { label: string; onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="rounded-full border border-gray-300 px-2 py-0.5 font-mono text-xs text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
		>
			{label}
		</button>
	);
}

/**
 * A colour picker that shows the resolved colour until the reader picks one of their own. The ×
 * appears only while an override is set and returns the row to the automatic colour.
 */
function ColorInput({
	value,
	effective,
	label,
	onPick,
	onClear,
}: {
	value: string | undefined;
	effective: string;
	label: string;
	onPick: (color: string) => void;
	onClear: () => void;
}) {
	const { t } = useI18n();
	return (
		<span className="flex items-center gap-0.5">
			<input
				type="color"
				value={value ?? effective}
				onChange={(event) => onPick(event.target.value)}
				aria-label={label}
				title={label}
				className="h-5 w-7 shrink-0 cursor-pointer rounded border border-gray-300 bg-white p-0 dark:border-gray-600 dark:bg-gray-900"
			/>
			{value !== undefined && (
				<button
					type="button"
					onClick={onClear}
					aria-label={t.databases.legendColorAuto}
					title={t.databases.legendColorAuto}
					className="rounded px-0.5 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
				>
					×
				</button>
			)}
		</span>
	);
}

/**
 * The only field-picker the panel uses: a button that opens the type's own property names and
 * inserts the chosen one where the caret is. Central to the brief - a dropdown, not a wall of chips.
 */
function FieldInsert({ fields, onPick }: { fields: string[]; onPick: (field: string) => void }) {
	const { t } = useI18n();
	const [open, setOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;
		const onPointerDown = (event: PointerEvent) => {
			if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
		};
		document.addEventListener("pointerdown", onPointerDown);
		return () => document.removeEventListener("pointerdown", onPointerDown);
	}, [open]);

	return (
		<div className="relative inline-block" ref={containerRef}>
			<button
				type="button"
				onClick={() => setOpen((value) => !value)}
				className="rounded border border-gray-300 px-2 py-0.5 font-mono text-xs text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
			>
				{t.databases.legendInsertField} ▾
			</button>
			{open && (
				<div className="absolute z-30 mt-1 max-h-48 w-44 overflow-auto rounded border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-800">
					{fields.length === 0 ? (
						<span className="block px-2 py-1 text-xs text-gray-400 dark:text-gray-500">
							{t.databases.legendNoFields}
						</span>
					) : (
						fields.map((field) => (
							<button
								key={field}
								type="button"
								onClick={() => {
									onPick(field);
									setOpen(false);
								}}
								className="block w-full px-2 py-1 text-left font-mono text-xs text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
							>
								{field}
							</button>
						))
					)}
				</div>
			)}
		</div>
	);
}

/**
 * One rule: a colour, a name, a condition, and - while it has the caret - the field dropdown and
 * operator chips that write the condition. The colour input shows the resolved lightness step
 * until the reader picks a colour of their own; the dropdown belongs to this row (not a shared
 * strip) because a rule's expression is edited in place.
 */
function RuleRow({
	rule,
	fields,
	colorEffective,
	expanded,
	canMoveUp,
	canMoveDown,
	onFocus,
	onChange,
	onMove,
	onRemove,
}: {
	rule: RuleConfig;
	fields: string[];
	/** The fill the resolver gives this rule while it carries no explicit colour. */
	colorEffective: string;
	expanded: boolean;
	canMoveUp: boolean;
	canMoveDown: boolean;
	onFocus: () => void;
	onChange: (changes: Partial<RuleConfig>) => void;
	onMove: (offset: number) => void;
	onRemove: () => void;
}) {
	const { t } = useI18n();
	const inputRef = useRef<HTMLInputElement>(null);
	const error = expressionError(rule.expression);

	const insert = (text: string) => {
		const input = inputRef.current;
		const value = rule.expression;
		if (!input) {
			onChange({ expression: value + text });
			return;
		}
		const start = input.selectionStart ?? value.length;
		const end = input.selectionEnd ?? start;
		onChange({ expression: value.slice(0, start) + text + value.slice(end) });
		const caret = start + text.length;
		requestAnimationFrame(() => {
			input.focus();
			input.setSelectionRange(caret, caret);
		});
	};

	return (
		<div className="space-y-1.5 rounded border border-gray-200 p-2 dark:border-gray-700">
			<div className="flex items-center gap-1.5">
				<ColorInput
					value={rule.color}
					effective={colorEffective}
					label={t.databases.legendRuleColor}
					onPick={(color) => onChange({ color })}
					onClear={() => onChange({ color: undefined })}
				/>
				<input
					type="text"
					value={rule.name}
					onChange={(event) => onChange({ name: event.target.value })}
					placeholder={t.databases.legendRuleName}
					aria-label={t.databases.legendRuleName}
					className="w-28 rounded border border-gray-300 bg-white px-1.5 py-0.5 text-xs dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
				/>
				<div className="flex items-center gap-1">
					<button
						type="button"
						onClick={() => onMove(-1)}
						disabled={!canMoveUp}
						aria-label={t.databases.legendMoveUp}
						title={t.databases.legendMoveUp}
						className="rounded px-1 text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-700"
					>
						↑
					</button>
					<button
						type="button"
						onClick={() => onMove(1)}
						disabled={!canMoveDown}
						aria-label={t.databases.legendMoveDown}
						title={t.databases.legendMoveDown}
						className="rounded px-1 text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-700"
					>
						↓
					</button>
					<button
						type="button"
						onClick={onRemove}
						aria-label={t.databases.legendRemoveRule}
						title={t.databases.legendRemoveRule}
						className="rounded px-1 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
					>
						×
					</button>
				</div>
			</div>
			<input
				ref={inputRef}
				type="text"
				value={rule.expression}
				onChange={(event) => onChange({ expression: event.target.value })}
				onFocus={onFocus}
				placeholder="age >= 30"
				aria-label={t.databases.legendRuleExpression}
				className="w-full rounded border border-gray-300 bg-white px-2 py-1 font-mono text-xs text-gray-800 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
			/>
			{error !== null && (
				<p className="text-xs text-amber-600 dark:text-amber-500" title={error}>
					{t.databases.legendRuleInvalid}
				</p>
			)}
			<div className="flex flex-wrap items-center gap-1.5">
				<span className="text-xs text-gray-500 dark:text-gray-400">{t.databases.legendFields}</span>
				<FieldInsert fields={fields} onPick={(field) => insert(field)} />
				{expanded && (
					<>
						<span className="text-xs text-gray-500 dark:text-gray-400">{t.databases.legendOperators}</span>
						{[...COMPARE_OPERATORS, ...LOGIC_OPERATORS].map((operator) => (
							<Chip key={operator} label={operator} onClick={() => insert(` ${operator} `)} />
						))}
					</>
				)}
			</div>
		</div>
	);
}

/**
 * A sample of the line itself, arrowheads and all - the only honest preview of a style, since a
 * list of names says nothing about how a dotted line reads next to a long-dashed one.
 */
function LineSample({ dash, arrow, color }: { dash: string | null; arrow: ArrowMode; color?: string }) {
	const { theme } = useTheme();
	const stroke = color ?? edgeStroke(theme);
	const startArrow = arrow === "start" || arrow === "both";
	const endArrow = arrow === "end" || arrow === "both";
	const left = startArrow ? 6 : 1;
	const right = endArrow ? 24 : 29;
	return (
		<svg width="30" height="8" aria-hidden="true" className="shrink-0">
			<line x1={left} y1="4" x2={right} y2="4" stroke={stroke} strokeWidth="1" strokeDasharray={dash ?? undefined} />
			{endArrow && <polygon points="24,1.5 29,4 24,6.5" fill={stroke} />}
			{startArrow && <polygon points="6,1.5 1,4 6,6.5" fill={stroke} />}
		</svg>
	);
}
