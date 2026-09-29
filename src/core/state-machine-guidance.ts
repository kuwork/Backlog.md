import { compileStateMachine, type StatusesInspection } from "./state-machine.ts";

/**
 * Where the runtime-rendered machine goes in a shipped guide text.
 *
 * The guide markdown is compiled into the binary as static text, so it cannot know a project's
 * statuses. The static prose documents the *format*; the placeholder is swapped for the project's
 * own machine when the text is served.
 */
export const STATE_MACHINE_PLACEHOLDER = "{{STATE_MACHINE}}";

/**
 * Something that can read the project's `statuses` and report what the parser rejected.
 * Typed structurally so this module stays free of the file-system layer.
 */
export interface StatusesInspectionSource {
	inspectStatuses(): Promise<StatusesInspection>;
}

/**
 * Render the project's machine for a guide text.
 *
 * `describe()` never throws, so this always produces something usable. A missing inspection means
 * "not readable in this context" and is stated as such rather than silently omitted: the AI must
 * never be left guessing whether a machine exists (doc-19 FR-8).
 */
export function renderStateMachineSection(inspection?: StatusesInspection | null): string {
	if (!inspection) {
		return [
			"## This project's state machine",
			"",
			"No readable `backlog/config.yml` was found for this context, so the project's state machine is not available here.",
			"",
		].join("\n");
	}
	return compileStateMachine(inspection.statuses).describe(inspection.diagnostics);
}

/** Swap {@link STATE_MACHINE_PLACEHOLDER} for the rendered machine. Texts without it pass through. */
export function composeGuideText(staticText: string, inspection?: StatusesInspection | null): string {
	if (!staticText.includes(STATE_MACHINE_PLACEHOLDER)) return staticText;
	const composed = staticText.replace(STATE_MACHINE_PLACEHOLDER, renderStateMachineSection(inspection));
	return composed.replace(/\n{3,}/g, "\n\n");
}

/**
 * Render the project's machine on its own, for callers that inject it into a file (the agent
 * instruction files). Never throws: a source that fails yields the "not available" notice.
 */
export async function renderProjectStateMachine(source?: StatusesInspectionSource | null): Promise<string> {
	if (!source) return renderStateMachineSection(null);
	try {
		return renderStateMachineSection(await source.inspectStatuses());
	} catch {
		return renderStateMachineSection(null);
	}
}

/**
 * Compose a guide text, reading the project itself. A source that fails (unreadable file, no
 * project) still yields the static text plus the "not available" notice - never an error.
 */
export async function composeGuideTextWithProject(
	staticText: string,
	source?: StatusesInspectionSource | null,
): Promise<string> {
	if (!staticText.includes(STATE_MACHINE_PLACEHOLDER)) return staticText;
	let inspection: StatusesInspection | null = null;
	if (source) {
		try {
			inspection = await source.inspectStatuses();
		} catch {
			inspection = null;
		}
	}
	return composeGuideText(staticText, inspection);
}
