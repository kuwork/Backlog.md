import { useMemo, useState } from "react";
import { AI_POLICIES, compileStateMachine, STATUS_CATEGORIES } from "../../core/state-machine.ts";
import type {
	AiPolicy,
	StatusCategory,
	StatusDefinition,
	StatusExitChannel,
	StatusTransition,
	StatusesConfig,
} from "../../types/index.ts";
import { useI18n } from "../hooks/useI18n";
import { useOptionalTheme } from "../contexts/ThemeContext";
import MermaidDiagram from "./MermaidDiagram";
import TabButton from "./TabButton";
import { buildStateMachineTreeSource } from "../utils/state-machine-tree.ts";

interface StateMachineEditorProps {
	/** Current (possibly unsaved) `statuses` value from the settings form. */
	statuses: StatusesConfig;
	onChange: (statuses: StatusesConfig) => void;
	/** Discard unsaved edits: reload what is actually saved in config.yml. */
	onReload: () => void;
	/** Overwrite the saved machine with the agreed seven-column default. */
	onRestoreDefault: () => Promise<void>;
	dirty: boolean;
}

const FIELD_CLASS =
	"w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-stone-500 dark:focus:ring-stone-400 transition-colors duration-200";
const LABEL_CLASS = "block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1";

/** The two panes of the editor. They share one strip because side by side each column is too
 *  narrow for a status card (three fields wide) or for the transition tree. */
type EditorTab = "statuses" | "preview";
const tabId = (tab: EditorTab) => `state-machine-tab-${tab}`;

/** Empty text inputs mean "not declared", so they are stored as undefined and never written back. */
function optionalText(value: string): string | undefined {
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Turn any `statuses` shape into editor rows. A plain string array has nothing to edit beyond
 * the names, so it is reported as `null` and offered as a conversion instead.
 */
function asDefinitions(statuses: StatusesConfig): StatusDefinition[] | null {
	if (!statuses.some((entry) => typeof entry !== "string")) return null;
	return statuses.map((entry) => (typeof entry === "string" ? { name: entry } : entry));
}

/** Convert a legacy string array into the object form, deriving categories from the compiler. */
function convertToDefinitions(statuses: StatusesConfig): StatusDefinition[] {
	const machine = compileStateMachine(statuses);
	return statuses.map((entry) => {
		const name = typeof entry === "string" ? entry : entry.name;
		if (typeof entry !== "string") return entry;
		const definition: StatusDefinition = { name, category: machine.categoryOf(name) };
		const exit = machine.exitChannel(name);
		if (exit) definition.exit = exit;
		return definition;
	});
}

export default function StateMachineEditor({
	statuses,
	onChange,
	onReload,
	onRestoreDefault,
	dirty,
}: StateMachineEditorProps) {
	const { t } = useI18n();
	const mode = useOptionalTheme();
	const [confirmingDefault, setConfirmingDefault] = useState(false);
	const [restoring, setRestoring] = useState(false);
	const [tab, setTab] = useState<EditorTab>("statuses");

	const definitions = useMemo(() => asDefinitions(statuses), [statuses]);
	const machine = useMemo(() => compileStateMachine(statuses), [statuses]);
	const lint = useMemo(() => machine.validate(), [machine]);
	const treeSource = useMemo(
		() => (definitions ? buildStateMachineTreeSource(definitions, machine.initialStatus()) : ""),
		[definitions, machine],
	);
	const names = machine.names();
	const transitionCount = (definitions ?? []).reduce((total, status) => total + (status.next?.length ?? 0), 0);

	const replace = (next: StatusDefinition[]) => onChange(next as StatusesConfig);

	const updateStatus = (index: number, patch: Partial<StatusDefinition>) => {
		if (!definitions) return;
		const next = definitions.map((status, position) => (position === index ? { ...status, ...patch } : status));
		// Keep transitions pointing at a renamed status instead of dangling (the rename is the
		// user's intent; M1 never blocks, but dangling edges would be lint noise).
		const previousName = definitions[index]?.name;
		const nextName = patch.name;
		if (previousName && nextName && previousName !== nextName) {
			for (const status of next) {
				status.next = status.next?.map((transition) =>
					transition.to === previousName ? { ...transition, to: nextName } : transition,
				);
			}
		}
		replace(next);
	};

	const updateTransition = (statusIndex: number, transitionIndex: number, patch: Partial<StatusTransition>) => {
		if (!definitions) return;
		replace(
			definitions.map((status, position) =>
				position === statusIndex
					? {
							...status,
							next: (status.next ?? []).map((transition, tPosition) =>
								tPosition === transitionIndex ? { ...transition, ...patch } : transition,
							),
						}
					: status,
			),
		);
	};

	const addTransition = (statusIndex: number) => {
		if (!definitions) return;
		replace(
			definitions.map((status, position) =>
				position === statusIndex
					? { ...status, next: [...(status.next ?? []), { to: names.find((name) => name !== status.name) ?? "" }] }
					: status,
			),
		);
	};

	const removeTransition = (statusIndex: number, transitionIndex: number) => {
		if (!definitions) return;
		replace(
			definitions.map((status, position) =>
				position === statusIndex
					? { ...status, next: (status.next ?? []).filter((_, tPosition) => tPosition !== transitionIndex) }
					: status,
			),
		);
	};

	const addStatus = () => {
		if (!definitions) return;
		replace([...definitions, { name: t.stateMachine.newStatusName, category: "active", next: [] }]);
	};

	const removeStatus = (index: number) => {
		if (!definitions) return;
		replace(definitions.filter((_, position) => position !== index));
	};

	const handleRestoreDefault = async () => {
		setRestoring(true);
		try {
			await onRestoreDefault();
		} finally {
			setRestoring(false);
			setConfirmingDefault(false);
		}
	};

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<p className="text-sm text-gray-500 dark:text-gray-400">{t.stateMachine.description}</p>
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={onReload}
						disabled={!dirty}
						className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors duration-200"
						title={t.stateMachine.resetDesc}
					>
						{t.stateMachine.reset}
					</button>
					<button
						type="button"
						onClick={() => setConfirmingDefault(true)}
						disabled={restoring}
						className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors duration-200"
						title={t.stateMachine.restoreDefaultDesc}
					>
						{t.stateMachine.restoreDefault}
					</button>
				</div>
			</div>

			{confirmingDefault && (
				<div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
					<p className="text-sm text-amber-800 dark:text-amber-300 mb-2">{t.stateMachine.restoreDefaultConfirm}</p>
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={handleRestoreDefault}
							className="px-3 py-1.5 text-sm bg-amber-500 dark:bg-amber-600 text-white rounded-lg hover:bg-amber-600 dark:hover:bg-amber-700 transition-colors duration-200"
						>
							{t.common.confirm}
						</button>
						<button
							type="button"
							onClick={() => setConfirmingDefault(false)}
							className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:underline"
						>
							{t.common.cancel}
						</button>
					</div>
				</div>
			)}

			<div role="tablist" aria-label={t.stateMachine.tabsLabel} className="flex flex-wrap gap-1">
				<TabButton
					id={tabId("statuses")}
					label={t.stateMachine.statusSettings}
					count={definitions?.length ?? 0}
					active={tab === "statuses"}
					onSelect={() => setTab("statuses")}
				/>
				<TabButton
					id={tabId("preview")}
					label={t.stateMachine.preview}
					count={transitionCount}
					active={tab === "preview"}
					onSelect={() => setTab("preview")}
				/>
			</div>

			{tab === "statuses" && (
				<div role="tabpanel" id="state-machine-panel-statuses" aria-labelledby={tabId("statuses")} className="space-y-4">

					{!definitions && (
						<div className="p-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg">
							<p className="text-sm text-gray-700 dark:text-gray-200">{t.stateMachine.legacyTitle}</p>
							<p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t.stateMachine.legacyDesc}</p>
							<ol className="mt-2 text-sm text-gray-600 dark:text-gray-300 list-decimal pl-5">
								{names.map((name) => (
									<li key={`legacy-${name}`}>{name}</li>
								))}
							</ol>
							<button
								type="button"
								onClick={() => replace(convertToDefinitions(statuses))}
								className="mt-3 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
							>
								{t.stateMachine.convert}
							</button>
						</div>
					)}

					{definitions?.map((status, statusIndex) => (
						<div
							key={`status-${statusIndex}`}
							className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg space-y-3"
						>
							<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
								<div>
									<label className={LABEL_CLASS} htmlFor={`status-name-${statusIndex}`}>
										{t.stateMachine.name}
									</label>
									<input
										id={`status-name-${statusIndex}`}
										type="text"
										value={status.name}
										onChange={(event) => updateStatus(statusIndex, { name: event.target.value })}
										className={FIELD_CLASS}
									/>
								</div>
								<div>
									<label className={LABEL_CLASS} htmlFor={`status-category-${statusIndex}`}>
										{t.stateMachine.category}
									</label>
									<select
										id={`status-category-${statusIndex}`}
										value={status.category ?? ""}
										onChange={(event) =>
											updateStatus(statusIndex, {
												category: (event.target.value || undefined) as StatusCategory | undefined,
											})
										}
										className={FIELD_CLASS}
									>
										<option value="">{t.stateMachine.unset}</option>
										{STATUS_CATEGORIES.map((category) => (
											<option key={category} value={category}>
												{category} · {t.stateMachine.categoryLabels[category]}
											</option>
										))}
									</select>
								</div>
								<div>
									<label className={LABEL_CLASS} htmlFor={`status-exit-${statusIndex}`}>
										{t.stateMachine.exit}
									</label>
									<select
										id={`status-exit-${statusIndex}`}
										value={status.exit ?? ""}
										onChange={(event) =>
											updateStatus(statusIndex, {
												exit: (event.target.value || undefined) as StatusExitChannel | undefined,
											})
										}
										className={FIELD_CLASS}
									>
										<option value="">{t.stateMachine.unset}</option>
										<option value="complete">complete</option>
										<option value="archive">archive</option>
									</select>
								</div>
							</div>

							<div className="flex flex-wrap items-center gap-2">
								<input
									id={`status-display-${statusIndex}`}
									type="checkbox"
									checked={status.display !== false}
									onChange={(event) =>
										updateStatus(statusIndex, { display: event.target.checked ? undefined : false })
									}
									className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-stone-600 dark:text-stone-400 focus:ring-stone-500 dark:focus:ring-stone-400"
								/>
								<label htmlFor={`status-display-${statusIndex}`} className="text-sm text-gray-700 dark:text-gray-200">
									{t.stateMachine.display}
								</label>
								<span className="text-xs text-gray-400 dark:text-gray-500">{t.stateMachine.displayHint}</span>
							</div>

							<div className="space-y-3">
								<div className="flex items-center justify-between">
									<span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
										{t.stateMachine.transitions}
									</span>
									<button
										type="button"
										onClick={() => removeStatus(statusIndex)}
										className="text-sm text-red-600 dark:text-red-400 hover:underline"
									>
										{t.common.remove}
									</button>
								</div>

								{(status.next ?? []).map((transition, transitionIndex) => (
									<div
										key={`transition-${statusIndex}-${transitionIndex}`}
										className="p-3 bg-gray-50 dark:bg-gray-700/40 rounded-lg space-y-2"
									>
										<div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
											<div>
												<label className={LABEL_CLASS} htmlFor={`to-${statusIndex}-${transitionIndex}`}>
													{t.stateMachine.to}
												</label>
												<select
													id={`to-${statusIndex}-${transitionIndex}`}
													value={transition.to}
													onChange={(event) =>
														updateTransition(statusIndex, transitionIndex, { to: event.target.value })
													}
													className={FIELD_CLASS}
												>
													<option value="">{t.stateMachine.unset}</option>
													{names.map((name) => (
														<option key={`target-${name}`} value={name}>
															{name}
														</option>
													))}
												</select>
											</div>
											<div>
												<label className={LABEL_CLASS} htmlFor={`ai-${statusIndex}-${transitionIndex}`}>
													{t.stateMachine.ai}
												</label>
												<select
													id={`ai-${statusIndex}-${transitionIndex}`}
													value={transition.ai ?? ""}
													onChange={(event) =>
														updateTransition(statusIndex, transitionIndex, {
															ai: (event.target.value || undefined) as AiPolicy | undefined,
														})
													}
													className={FIELD_CLASS}
												>
													<option value="">{t.stateMachine.unset}</option>
													{AI_POLICIES.map((policy) => (
														<option key={policy} value={policy}>
															{policy} · {t.stateMachine.aiLabels[policy]}
														</option>
													))}
												</select>
											</div>
											<div>
												<label className={LABEL_CLASS} htmlFor={`requires-${statusIndex}-${transitionIndex}`}>
													{t.stateMachine.requires}
												</label>
												<input
													id={`requires-${statusIndex}-${transitionIndex}`}
													type="text"
													value={transition.requires ?? ""}
													onChange={(event) =>
														updateTransition(statusIndex, transitionIndex, {
															requires: optionalText(event.target.value),
														})
													}
													className={FIELD_CLASS}
												/>
											</div>
										</div>
										<div>
											<label className={LABEL_CLASS} htmlFor={`when-${statusIndex}-${transitionIndex}`}>
												{t.stateMachine.when}
											</label>
											<input
												id={`when-${statusIndex}-${transitionIndex}`}
												type="text"
												value={transition.when ?? ""}
												onChange={(event) =>
													updateTransition(statusIndex, transitionIndex, { when: optionalText(event.target.value) })
												}
												className={FIELD_CLASS}
											/>
										</div>
										<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
											<div>
												<label className={LABEL_CLASS} htmlFor={`if-${statusIndex}-${transitionIndex}`}>
													{t.stateMachine.if}
												</label>
												<input
													id={`if-${statusIndex}-${transitionIndex}`}
													type="text"
													value={transition.if ?? ""}
													onChange={(event) =>
														updateTransition(statusIndex, transitionIndex, { if: optionalText(event.target.value) })
													}
													className={FIELD_CLASS}
												/>
											</div>
											<div>
												<label className={LABEL_CLASS} htmlFor={`evidence-${statusIndex}-${transitionIndex}`}>
													{t.stateMachine.evidence}
												</label>
												<input
													id={`evidence-${statusIndex}-${transitionIndex}`}
													type="text"
													value={transition.evidence ?? ""}
													onChange={(event) =>
														updateTransition(statusIndex, transitionIndex, {
															evidence: optionalText(event.target.value),
														})
													}
													className={FIELD_CLASS}
												/>
											</div>
										</div>
										<button
											type="button"
											onClick={() => removeTransition(statusIndex, transitionIndex)}
											className="text-sm text-red-600 dark:text-red-400 hover:underline"
										>
											{t.common.remove}
										</button>
									</div>
								))}

								<button
									type="button"
									onClick={() => addTransition(statusIndex)}
									className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
								>
									+ {t.stateMachine.addTransition}
								</button>
							</div>
						</div>
					))}

					{definitions && (
						<button
							type="button"
							onClick={addStatus}
							className="inline-flex items-center px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
						>
							+ {t.stateMachine.addStatus}
						</button>
					)}
				</div>
			)}

			{tab === "preview" && (
				<div
					role="tabpanel"
					id="state-machine-panel-preview"
					aria-labelledby={tabId("preview")}
					className="space-y-3"
				>
					<div className="p-3 border border-gray-200 dark:border-gray-600 rounded-lg overflow-x-auto">
						{definitions && treeSource.includes("-->") ? (
							<MermaidDiagram source={treeSource} mode={mode} />
						) : (
							<p className="text-sm text-gray-500 dark:text-gray-400">{t.stateMachine.noTransitions}</p>
						)}
					</div>
				</div>
			)}

			{lint.length > 0 && (
				<div className="p-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg">
					<h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t.stateMachine.lintTitle}</h3>
					<ul className="mt-2 space-y-1">
						{lint.map((issue, index) => (
							<li key={`lint-${index}`} className="text-sm text-amber-700 dark:text-amber-300">
								{renderLintMessage(t, issue)}
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
}

type LintTranslator = ReturnType<typeof useI18n>["t"];

function renderLintMessage(t: LintTranslator, issue: { code: string; args: { status?: string; target?: string; value?: string } }) {
	const status = issue.args.status ?? "";
	const target = issue.args.target ?? "";
	const value = issue.args.value ?? "";
	switch (issue.code) {
		case "notAnArray":
			return t.stateMachine.lint.notAnArray;
		case "invalidEntry":
			return t.stateMachine.lint.invalidEntry;
		case "duplicateName":
			return t.stateMachine.lint.duplicateName(status);
		case "invalidCategory":
			return t.stateMachine.lint.invalidCategory(status, value);
		case "terminalMissingExit":
			return t.stateMachine.lint.terminalMissingExit(status);
		case "unknownTarget":
			return t.stateMachine.lint.unknownTarget(status, target);
		case "missingWhen":
			return t.stateMachine.lint.missingWhen(status, target);
		case "initialAsTarget":
			return t.stateMachine.lint.initialAsTarget(target);
		case "allowedIntoTerminal":
			return t.stateMachine.lint.allowedIntoTerminal(target);
		case "allowedIfMissingIf":
			return t.stateMachine.lint.allowedIfMissingIf(status, target);
		case "invalidAi":
			return t.stateMachine.lint.invalidAi(status, target, value);
		default:
			return issue.code;
	}
}
