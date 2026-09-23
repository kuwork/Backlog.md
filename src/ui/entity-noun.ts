/**
 * How the TUI words whatever a surface is acting on.
 *
 * A draft is not a task, and the task list, the board's notices and the create window all act on
 * both: the drafts session lists drafts, its edit key opens one, and its create key makes one. The
 * titled form labels a window or starts a sentence, the plain form sits inside one.
 */
export type EntityNounKind = "task" | "draft";

export function entityNoun(kind: EntityNounKind | undefined): { plain: string; titled: string } {
	if (kind === "draft") {
		return { plain: "draft", titled: "Draft" };
	}
	return { plain: "task", titled: "Task" };
}
