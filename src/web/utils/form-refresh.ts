export const areJsonEqual = (first: unknown, second: unknown): boolean =>
	JSON.stringify(first) === JSON.stringify(second);

/**
 * Three-way merge for form fields during a same-record data refresh: adopt the
 * incoming value only when the user has not edited the field away from the
 * previous baseline; otherwise keep the user's in-progress edit.
 */
export const preserveDirtyRefreshValue = <T>(
	current: T,
	previous: T,
	next: T,
	isEqual: (first: T, second: T) => boolean = Object.is,
): T => (isEqual(current, previous) ? next : current);
