import { DATE_TIME_REGEX, localDateTimeToStoredUtc, parseStoredUtcDate } from "../../utils/date-utc.ts";

export { localDateTimeToStoredUtc as dateTimeLocalToStoredUtc, parseStoredUtcDate };

/** A rendered stored date: the visible text plus, when the record has a time, the canonical UTC value for hover. */
export interface StoredDateDisplay {
	text: string;
	title?: string;
}

/**
 * The hover value: the canonical stored value marked as UTC.
 *
 * Absent for date-only, empty and unparsable values, so a tooltip never claims a time the record does not have.
 */
export function storedUtcHoverTitle(dateStr: string | undefined): string | undefined {
	if (typeof dateStr !== "string") return undefined;
	const normalized = dateStr.trim();
	if (!normalized || !DATE_TIME_REGEX.test(normalized)) return undefined;
	return parseStoredUtcDate(normalized) ? `${normalized} (UTC)` : undefined;
}

export function formatStoredUtcDateForDisplay(dateStr: string): StoredDateDisplay {
	const parsed = parseStoredUtcDate(dateStr);
	if (!parsed) return { text: dateStr };

	if (DATE_TIME_REGEX.test(dateStr.trim())) {
		return {
			text: parsed.toLocaleString(undefined, {
				dateStyle: "medium",
				timeStyle: "short",
			}),
			title: storedUtcHoverTitle(dateStr),
		};
	}

	return { text: parsed.toLocaleDateString() };
}

export function storedUtcToDateTimeLocal(dateStr: string): string {
	const parsed = parseStoredUtcDate(dateStr);
	if (!parsed) return dateStr.replace(" ", "T");

	const year = parsed.getFullYear();
	const month = String(parsed.getMonth() + 1).padStart(2, "0");
	const day = String(parsed.getDate()).padStart(2, "0");
	const hours = String(parsed.getHours()).padStart(2, "0");
	const minutes = String(parsed.getMinutes()).padStart(2, "0");

	return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function formatStoredUtcDateForCompactDisplay(dateStr: string, now: Date = new Date()): StoredDateDisplay {
	const normalized = dateStr.trim();
	if (!normalized) return { text: "—" };

	const parsed = parseStoredUtcDate(normalized);
	if (!parsed) return { text: normalized };

	const title = storedUtcHoverTitle(normalized);
	const diffMs = now.getTime() - parsed.getTime();
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

	if (diffDays >= 0) {
		if (diffDays === 0) return { text: "today", title };
		if (diffDays === 1) return { text: "yesterday", title };
		if (diffDays < 7) return { text: `${diffDays}d ago`, title };
	}

	return { text: parsed.toLocaleDateString(), title };
}
