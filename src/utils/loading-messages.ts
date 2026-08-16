import { getDictionary, type Locale, type TranslationDict } from "../web/locales";

type LoadingPhaseKey = keyof TranslationDict["loadingPhases"];

/**
 * Maps the finite set of Core task-loading progress messages
 * (src/core/task-loader.ts, src/core/backlog.ts) to localized templates in
 * the locale files (t.loadingPhases). `{1}`, `{2}` placeholders are replaced
 * with regex captures. When no pattern matches, the original English message
 * is returned unchanged.
 */
const LOADING_PHASE_PATTERNS: Array<{ pattern: RegExp; key: LoadingPhaseKey }> = [
	{ pattern: /^Loading local tasks\.\.\.$/, key: "loadingLocalTasks" },
	{ pattern: /^Loaded tasks$/, key: "loadedTasks" },
	{ pattern: /^Merging tasks\.\.\.$/, key: "mergingTasks" },
	{ pattern: /^Loading drafts\.\.\.$/, key: "loadingDrafts" },
	{ pattern: /^Loading tasks from local branches\.\.\.$/, key: "loadingLocalBranches" },
	{ pattern: /^Loading tasks from local and remote branches\.\.\.$/, key: "loadingLocalAndRemoteBranches" },
	{ pattern: /^Applying latest task states from branch scans\.\.\.$/, key: "applyingTaskStates" },
	{ pattern: /^Remote operations disabled - skipping remote tasks$/, key: "remoteDisabled" },
	{ pattern: /^Fetching remote branches\.\.\.$/, key: "fetchingRemoteBranches" },
	{ pattern: /^No recent remote branches found$/, key: "noRecentRemoteBranches" },
	{ pattern: /^Indexing (\d+) recent remote branches \(last (\d+) days\)\.\.\.$/, key: "indexingRemoteBranches" },
	{ pattern: /^No remote tasks found$/, key: "noRemoteTasks" },
	{ pattern: /^Found (\d+) unique tasks across remote branches$/, key: "foundRemoteTasks" },
	{ pattern: /^Hydrating (\d+) remote candidates\.\.\.$/, key: "hydratingRemoteCandidates" },
	{ pattern: /^Hydrating (\d+) remote tasks\.\.\.$/, key: "hydratingRemoteTasks" },
	{ pattern: /^Loaded (\d+) remote tasks$/, key: "loadedRemoteTasks" },
	{ pattern: /^Indexing (\d+) other local branches\.\.\.$/, key: "indexingLocalBranches" },
	{ pattern: /^Found (\d+) unique tasks in other local branches$/, key: "foundLocalTasks" },
	{ pattern: /^Hydrating (\d+) tasks from other local branches\.\.\.$/, key: "hydratingLocalTasks" },
	{ pattern: /^Loaded (\d+) tasks from other local branches$/, key: "loadedLocalTasks" },
];

/**
 * Translate a Core loading progress message into the given locale.
 * Falls back to the original English message when no pattern matches.
 */
export function translateLoadingMessage(message: string, locale: Locale): string {
	if (locale === "en") return message;
	const t = getDictionary(locale);
	for (const { pattern, key } of LOADING_PHASE_PATTERNS) {
		const match = pattern.exec(message);
		if (match) {
			return t.loadingPhases[key].replace(/\{(\d+)\}/g, (_: string, index: string) => match[Number(index)] ?? "");
		}
	}
	return message;
}
