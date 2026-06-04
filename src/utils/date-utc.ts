export const DATE_ONLY_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
export const DATE_TIME_REGEX = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/;

export function parseIntStrict(value: string): number {
	return Number.parseInt(value, 10);
}

export function parseStoredUtcDate(dateStr: string): Date | null {
	if (typeof dateStr !== "string") return null;
	const normalized = dateStr.trim();
	if (!normalized) return null;

	const dateTimeMatch = normalized.match(DATE_TIME_REGEX);
	if (dateTimeMatch) {
		const y = dateTimeMatch[1];
		const m = dateTimeMatch[2];
		const d = dateTimeMatch[3];
		const hh = dateTimeMatch[4];
		const mm = dateTimeMatch[5];
		if (!y || !m || !d || !hh || !mm) return null;
		const year = parseIntStrict(y);
		const month = parseIntStrict(m);
		const day = parseIntStrict(d);
		const hours = parseIntStrict(hh);
		const minutes = parseIntStrict(mm);
		const date = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));

		if (
			date.getUTCFullYear() !== year ||
			date.getUTCMonth() !== month - 1 ||
			date.getUTCDate() !== day ||
			date.getUTCHours() !== hours ||
			date.getUTCMinutes() !== minutes
		) {
			return null;
		}

		return date;
	}

	const dateOnlyMatch = normalized.match(DATE_ONLY_REGEX);
	if (dateOnlyMatch) {
		const y = dateOnlyMatch[1];
		const m = dateOnlyMatch[2];
		const d = dateOnlyMatch[3];
		if (!y || !m || !d) return null;
		const year = parseIntStrict(y);
		const month = parseIntStrict(m);
		const day = parseIntStrict(d);
		const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));

		if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
			return null;
		}

		return date;
	}

	return null;
}

export function getStoredUtcTimestamp(dateStr: string): number {
	if (typeof dateStr !== "string") return 0;
	const parsed = parseStoredUtcDate(dateStr);
	return parsed ? parsed.getTime() : 0;
}

/**
 * Converts a user-local datetime string to a stored UTC string.
 *
 * Supports:
 *   - YYYY-MM-DD        (treated as 00:00 local time)
 *   - YYYY-MM-DD HH:MM
 *   - YYYY-MM-DDTHH:MM
 *
 * Non-matching strings are returned as-is.
 */
export function localDateTimeToStoredUtc(dateStr: string): string {
	if (typeof dateStr !== "string") return String(dateStr ?? "");
	const normalized = dateStr.trim();
	if (!normalized) return "";

	// datetime format: YYYY-MM-DD HH:MM or YYYY-MM-DDTHH:MM
	const dateTimeMatch = normalized.match(DATE_TIME_REGEX);
	if (dateTimeMatch) {
		const y = dateTimeMatch[1];
		const m = dateTimeMatch[2];
		const d = dateTimeMatch[3];
		const hh = dateTimeMatch[4];
		const mm = dateTimeMatch[5];
		if (!y || !m || !d || !hh || !mm) return normalized;
		const year = parseIntStrict(y);
		const month = parseIntStrict(m) - 1;
		const day = parseIntStrict(d);
		const hours = parseIntStrict(hh);
		const minutes = parseIntStrict(mm);
		const date = new Date(year, month, day, hours, minutes, 0);
		return date.toISOString().slice(0, 16).replace("T", " ");
	}

	// date-only format: YYYY-MM-DD — treated as 00:00 local time
	const dateOnlyMatch = normalized.match(DATE_ONLY_REGEX);
	if (dateOnlyMatch) {
		const y = dateOnlyMatch[1];
		const m = dateOnlyMatch[2];
		const d = dateOnlyMatch[3];
		if (!y || !m || !d) return normalized;
		const year = parseIntStrict(y);
		const month = parseIntStrict(m) - 1;
		const day = parseIntStrict(d);
		const date = new Date(year, month, day, 0, 0, 0);
		return date.toISOString().slice(0, 16).replace("T", " ");
	}

	return normalized;
}
