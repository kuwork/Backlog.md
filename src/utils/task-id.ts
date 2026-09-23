import { escapeRegex, extractAnyPrefix, normalizeId } from "./prefix-config.ts";

/** Default prefix for tasks */
export const DEFAULT_TASK_PREFIX = "task";

/**
 * Normalize a task ID by ensuring the prefix is present (uppercase).
 * If no explicit prefix is provided, preserve any prefix already in the input.
 *
 * @param taskId - The ID to normalize (e.g., "123", "task-123", "TASK-123")
 * @param prefix - The prefix to use (default: "task")
 * @returns Normalized ID with uppercase prefix (e.g., "TASK-123")
 *
 * @example
 * normalizeTaskId("123") // => "TASK-123"
 * normalizeTaskId("task-123") // => "TASK-123"
 * normalizeTaskId("TASK-123") // => "TASK-123"
 * normalizeTaskId("JIRA-456") // => "JIRA-456"
 */
export function normalizeTaskId(taskId: string, prefix: string = DEFAULT_TASK_PREFIX): string {
	const inferredPrefix = extractAnyPrefix(taskId);
	const effectivePrefix = inferredPrefix && prefix === DEFAULT_TASK_PREFIX ? inferredPrefix : prefix;
	return normalizeId(taskId, effectivePrefix);
}

function canonicalDecimalSegment(segment: string): string {
	const withoutLeadingZeroes = segment.replace(/^0+/, "");
	return withoutLeadingZeroes || "0";
}

/**
 * Return the stable identity used to group task IDs: uppercase prefix plus a
 * zero-padding-insensitive dotted-decimal body ("task-0042" and "TASK-42" both
 * canonicalize to "TASK-42"). Unlike normalizeTaskId, this strips leading
 * zeroes so IDs that differ only in padding group as one identity.
 */
export function canonicalTaskId(taskId: string, prefix: string = DEFAULT_TASK_PREFIX): string {
	const trimmed = taskId.trim();
	const inferredPrefix = extractAnyPrefix(trimmed);
	const effectivePrefix = inferredPrefix ?? prefix;
	const body = extractTaskBody(trimmed, effectivePrefix);
	if (body) {
		return `${effectivePrefix.toUpperCase()}-${body.split(".").map(canonicalDecimalSegment).join(".")}`;
	}
	return normalizeTaskId(trimmed, effectivePrefix).toUpperCase();
}

/**
 * Extracts the body (numeric portion) from a task ID.
 *
 * @param value - The value to extract from (e.g., "task-123", "123", "task-5.2.1")
 * @param prefix - The prefix to strip (default: "task")
 * @returns The body portion, or null if invalid format
 *
 * @example
 * extractTaskBody("task-123") // => "123"
 * extractTaskBody("123") // => "123"
 * extractTaskBody("task-5.2.1") // => "5.2.1"
 * extractTaskBody("JIRA-456", "JIRA") // => "456"
 */
export function extractTaskBody(value: string, prefix: string = DEFAULT_TASK_PREFIX): string | null {
	const trimmed = value.trim();
	if (trimmed === "") return "";
	// Build a pattern that optionally matches the prefix
	const prefixPattern = new RegExp(`^(?:${escapeRegex(prefix)}-)?([0-9]+(?:\\.[0-9]+)*)$`, "i");
	const match = trimmed.match(prefixPattern);
	return match?.[1] ?? null;
}

/**
 * Compares two task IDs for equality.
 * Handles numeric comparison to treat "task-1" and "task-01" as equal.
 * Automatically detects prefix from either ID when comparing numeric-only input.
 *
 * @param left - First ID to compare
 * @param right - Second ID to compare
 * @param prefix - The prefix both IDs should have (default: "task")
 * @returns true if IDs are equivalent
 *
 * @example
 * taskIdsEqual("task-123", "TASK-123") // => true
 * taskIdsEqual("task-1", "task-01") // => true (numeric comparison)
 * taskIdsEqual("task-1.2", "task-1.2") // => true
 * taskIdsEqual("358", "BACK-358") // => true (detects prefix from right)
 */
export function taskIdsEqual(left: string, right: string, prefix: string = DEFAULT_TASK_PREFIX): boolean {
	// Detect actual prefix from either ID - if one has a prefix, use it
	const leftPrefix = extractAnyPrefix(left);
	const rightPrefix = extractAnyPrefix(right);
	const effectivePrefix = leftPrefix ?? rightPrefix ?? prefix;

	const leftBody = extractTaskBody(left, effectivePrefix);
	const rightBody = extractTaskBody(right, effectivePrefix);

	if (leftBody && rightBody) {
		const leftSegs = leftBody.split(".").map((seg) => Number.parseInt(seg, 10));
		const rightSegs = rightBody.split(".").map((seg) => Number.parseInt(seg, 10));
		if (leftSegs.length !== rightSegs.length) {
			return false;
		}
		return leftSegs.every((value, index) => value === rightSegs[index]);
	}

	return normalizeTaskId(left, effectivePrefix).toLowerCase() === normalizeTaskId(right, effectivePrefix).toLowerCase();
}
