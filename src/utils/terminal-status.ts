import { compileStateMachine, statusNames } from "../core/state-machine.ts";
import type { StatusesConfig } from "../types/index.ts";

type StatusInput = readonly (string | StatusesConfig[number])[];

/**
 * Every terminal status of a project.
 *
 * A config that declares categories (`done` / `dropped`) names them explicitly, so there can be
 * more than one. Everything else keeps the legacy rule — the last column is the terminal one —
 * which is also the fallback when an object form declares no terminal category, so a project can
 * never end up with nothing to complete.
 */
export function getTerminalStatuses(statuses: StatusInput): string[] {
	const names = statusNames(statuses as StatusesConfig);
	if (names.length === 0) return [];
	const declared = compileStateMachine(statuses as StatusesConfig).terminalStatuses();
	return declared.length > 0 ? declared : [names[names.length - 1] ?? ""];
}

/**
 * The single status a cleanup/complete command should name: the terminal whose exit channel is
 * `complete` (the canonical "done"), else the first terminal. Legacy string-array configs declare
 * no channel, so this collapses to the same last-column answer {@link getTerminalStatuses} gives.
 */
export function getTerminalStatus(statuses: StatusInput): string | null {
	const terminals = getTerminalStatuses(statuses).filter((name) => name.trim().length > 0);
	if (terminals.length === 0) return null;
	const machine = compileStateMachine(statuses as StatusesConfig);
	const completed = terminals.find((name) => machine.exitChannel(name) === "complete");
	return completed ?? terminals[0] ?? null;
}

function normalizeStatusForComparison(status: string | null | undefined): string {
	return (status ?? "").trim().toLowerCase();
}

export function isTerminalStatus(status: string | null | undefined, statuses: StatusInput): boolean {
	return getTerminalStatuses(statuses).some(
		(terminal) => normalizeStatusForComparison(status) === normalizeStatusForComparison(terminal),
	);
}

/**
 * Membership test against a terminal list that was **already derived**.
 *
 * {@link isTerminalStatus} takes a raw `statuses` config and derives the terminal set itself; handing
 * it a derived list makes it derive twice, and the second pass reads `["Done", "Dropped"]` as a
 * two-column machine whose last column is the only terminal one — so `Done` stops matching. Anything
 * that received the set rather than the config uses this instead.
 */
export function isTerminalStatusName(
	status: string | null | undefined,
	terminalNames: readonly (string | null | undefined)[] | null | undefined,
): boolean {
	return (terminalNames ?? []).some(
		(terminal) => normalizeStatusForComparison(status) === normalizeStatusForComparison(terminal),
	);
}
