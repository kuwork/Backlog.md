import type { Task } from "../../types";
import { compareTaskIds } from "../../utils/task-sorting";
import { canonicalEntityId, type EntityIndex, type EntityKind, scanEntityReferences } from "./task-id-links";

/** One task that mentions an entity, and how many times it mentions it. */
export interface BacklinkSource {
	taskId: string;
	title: string;
	status: string;
	occurrences: number;
}

/** Canonical entity key (`doc:DOC-1`) -> the tasks referencing it. */
export type BacklinkIndex = Map<string, BacklinkSource[]>;

/** Kinds whose backlinks the document and decision pages show. */
const BACKLINK_KINDS: readonly EntityKind[] = ["doc", "decision"];

const FENCED_CODE = /^[ \t]{0,3}(?:```|~~~)[^\n]*\n[\s\S]*?(?:^[ \t]{0,3}(?:```|~~~)[^\n]*$|$)/gm;
const INDENTED_CODE = /^(?: {4}|\t)[^\n]*$/gm;
const INLINE_CODE = /`[^`\n]*`/g;
const INDENTED_LINE = /^(?: {4}|\t)\S/m;

/**
 * Cheap gate: a body with no `doc-12` / `decision-3` shaped token cannot reference
 * either kind. Deliberately narrower than a bare "doc" search — English prose says
 * "document" constantly, and matching that would defeat the gate.
 */
const MENTIONS_BACKLINK_KIND = /\b(?:doc|decision)[-_ ]?\d/i;

/**
 * Markdown with code removed. The render-side linker never links inside code, so a
 * reference there is not a reference: counting it would list a task that shows no
 * link to this entity at all. Fenced blocks go first, so backticks inside them
 * cannot open a bogus inline-code span.
 */
export function stripCodeBlocks(markdown: string): string {
	if (!markdown.includes("`") && !markdown.includes("~~~") && !INDENTED_LINE.test(markdown)) return markdown;
	return markdown.replace(FENCED_CODE, "\n").replace(INDENTED_CODE, "").replace(INLINE_CODE, "");
}

/** The body text of a task: raw markdown when loaded, otherwise the structured fields. */
function taskBodyText(task: Task): string {
	if (task.rawContent) return task.rawContent;
	return [
		task.description ?? "",
		task.implementationPlan ?? "",
		task.implementationNotes ?? "",
		task.finalSummary ?? "",
		...(task.comments ?? []).map((comment) => comment.body),
	].join("\n");
}

/**
 * Every piece of a task that can name an entity, as separate scan targets. The
 * body is scanned with code removed (the linker never links inside code, so a
 * reference there is not a reference); the `documentation:` frontmatter field is
 * scanned verbatim. Its entries are usually paths or URLs that carry no entity ID,
 * but when one does name a document or decision — including a range (`doc-10~12`)
 * or slash-list (`doc-10/11/12`) — it is a deliberate reference and must count as a
 * backlink too.
 */
function collectReferenceText(task: Task): string[] {
	const sources: string[] = [];
	const body = taskBodyText(task);
	if (body) sources.push(stripCodeBlocks(body));
	const docs = task.documentation;
	if (docs && docs.length > 0) {
		for (const entry of docs) {
			if (entry) sources.push(entry);
		}
	}
	return sources;
}

/** Canonical key under which an entity's backlinks are stored. */
export function entityBacklinkKey(kind: EntityKind, reference: string): string {
	return `${kind}:${canonicalEntityId(kind, reference)}`;
}

/**
 * Reverse index of entity -> tasks that mention it, built by scanning the task
 * bodies already held in memory. Pure: no API calls, no writes, so the same input
 * always yields the same index and it can be asserted without a DOM.
 */
export function buildBacklinkIndex(tasks: Iterable<Task>, index: EntityIndex): BacklinkIndex {
	const backlinks: BacklinkIndex = new Map();
	for (const task of tasks) {
		const sources = collectReferenceText(task);
		if (sources.length === 0) continue;
		// Per task, one entry per entity: a task that names a document five times is
		// one row with a count, not five rows.
		const counted = new Map<string, BacklinkSource>();
		for (const text of sources) {
			if (!MENTIONS_BACKLINK_KIND.test(text)) continue;
			for (const reference of scanEntityReferences(text, index)) {
				if (!BACKLINK_KINDS.includes(reference.kind)) continue;
				const key = entityBacklinkKey(reference.kind, reference.id);
				const existing = counted.get(key);
				if (existing) existing.occurrences += 1;
				else counted.set(key, { taskId: task.id, title: task.title, status: task.status, occurrences: 1 });
			}
		}
		for (const [key, source] of counted) {
			const list = backlinks.get(key);
			if (list) list.push(source);
			else backlinks.set(key, [source]);
		}
	}
	for (const list of backlinks.values()) {
		list.sort((left, right) => compareTaskIds(left.taskId, right.taskId));
	}
	return backlinks;
}

/** Backlinks of one entity, empty when nothing references it. */
export function findBacklinks(backlinks: BacklinkIndex, kind: EntityKind, id: string): BacklinkSource[] {
	return backlinks.get(entityBacklinkKey(kind, id)) ?? [];
}
