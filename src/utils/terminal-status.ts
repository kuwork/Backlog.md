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
