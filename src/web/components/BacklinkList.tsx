import { stripAnyPrefix } from "../../utils/prefix-config";
import type { BacklinkSource } from "../utils/backlinks";
import type { EntityRangeEntry } from "../utils/task-id-links";
import EntityIdRangeDropdown from "./EntityIdRangeDropdown";

interface BacklinkListProps {
	/** Tasks that reference the entity on screen, already sorted by task ID. */
	sources: BacklinkSource[];
	/** Static label, e.g. "Referenced by:" — rendered as muted text, not clickable. */
	label: string;
	/** Static count phrase, e.g. (5) => "5 tasks" — rendered as muted text. */
	countLabel: (count: number) => string;
	onTaskClick: (taskId: string) => void;
}

/**
 * "Referenced by": the reverse of the auto-linker. Rendered as plain text
 * `Referenced by: N tasks (BACK-1/2/...)` — a leading link icon plus the static
 * label and count, with only the parenthesized id list as a clickable trigger that
 * opens the same collapsed dropdown as BACK-751, letting the reader scan each
 * referencing task's title before deciding to open it. The first id keeps its prefix;
 * subsequent ids are abbreviated to the bare number (matching the auto-linker's
 * collapsed display). Returns nothing when empty, so the row simply disappears.
 */
export function BacklinkList({ sources, label, countLabel, onTaskClick }: BacklinkListProps) {
	if (sources.length === 0) return null;
	const first = sources[0];
	if (!first) return null;
	const entries: EntityRangeEntry[] = sources.map((source) => ({
		id: source.taskId,
		// A task that names the entity several times collapses to one row; its count
		// is folded into the title so it still reads in the dropdown.
		title: source.occurrences > 1 ? `${source.title} (${source.occurrences}×)` : source.title,
	}));
	// First id keeps its prefix; the rest are abbreviated to the bare number.
	const ids = [first.taskId, ...sources.slice(1).map((source) => stripAnyPrefix(source.taskId))].join("/");
	return (
		<span className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400 transition-colors duration-200">
			<svg aria-hidden="true" className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 1024 1024">
				<path d="M269.312 973.312c-56.32 0-112.128-21.504-155.136-64-41.472-41.472-64-96.256-64-155.136s22.528-113.664 64-155.136l166.4-166.4C322.048 391.168 376.832 368.64 435.712 368.64s113.664 22.528 155.136 64c16.384 16.384 16.384 42.496 0 58.88-16.384 16.384-42.496 16.384-58.88 0-25.6-25.6-59.392-39.424-95.744-39.424S365.568 465.92 340.48 491.52L174.08 657.92c-52.736 52.736-52.736 138.752 0 192 25.6 25.6 59.392 39.424 95.744 39.424s70.656-13.824 95.744-39.424l166.4-166.4c16.384-16.384 42.496-16.384 58.88 0 16.384 16.384 16.384 42.496 0 58.88l-166.4 166.4c-42.496 43.52-98.816 64.512-155.136 64.512z m473.6-382.464l166.4-166.4c85.504-85.504 85.504-224.256 0-309.76-85.504-85.504-224.256-85.504-309.76 0L433.152 281.088c-16.384 16.384-16.384 42.496 0 58.88 16.384 16.384 42.496 16.384 58.88 0l166.4-166.4c25.6-25.6 59.392-39.424 95.744-39.424s70.656 13.824 95.744 39.424c52.736 52.736 52.736 138.752 0 192l-166.4 166.4c-52.736 52.736-138.752 52.736-192 0-16.384-16.384-42.496-16.384-58.88 0-16.384 16.384-16.384 42.496 0 58.88 42.496 42.496 98.816 64 155.136 64s112.128-20.992 155.136-64z" />
			</svg>
			<span>
				{label} {countLabel(sources.length)}
				{" ("}
				<EntityIdRangeDropdown kind="task" token={ids} entries={entries} onTaskClick={onTaskClick} />
				{")"}
			</span>
		</span>
	);
}
