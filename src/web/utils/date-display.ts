import {
	DATE_TIME_REGEX,
	formatLocalDateKey,
	formatLocalTimeStamp,
	localDateKeyFromStoredUtc,
	localDateTimeToStoredUtc,
	parseStoredUtcDate,
} from "../../utils/date-utc.ts";

export {
	formatLocalDateKey,
	formatLocalTimeStamp,
	localDateKeyFromStoredUtc,
	localDateTimeToStoredUtc as dateTimeLocalToStoredUtc,
	parseStoredUtcDate,
};

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

/**
 * The compact stamp a card footer shows: `M/D` (or `YYYY/M/D` when the value is not from the current
 * year), with `HH:mm` appended when the stored value carries a time.
 *
 * A stored datetime is UTC, so its day and clock are read after conversion; a date-only value names
 * its own calendar day and is read from its digits, so no offset can shift it to the day before. The
 * canonical UTC value stays on hover whenever there is a time to name — the rule every other date on
 * the card follows.
 */
export function formatStoredUtcShortStamp(dateStr: string, now: Date = new Date()): StoredDateDisplay {
	const normalized = dateStr.trim();
	const parsed = parseStoredUtcDate(normalized);
	if (!parsed) return { text: normalized };

	const timed = DATE_TIME_REGEX.test(normalized);
	const year = timed ? parsed.getFullYear() : Number.parseInt(normalized.slice(0, 4), 10);
	const month = timed ? parsed.getMonth() + 1 : Number.parseInt(normalized.slice(5, 7), 10);
	const day = timed ? parsed.getDate() : Number.parseInt(normalized.slice(8, 10), 10);
	const datePart = year === now.getFullYear() ? `${month}/${day}` : `${year}/${month}/${day}`;

	if (!timed) return { text: datePart, title: storedUtcHoverTitle(normalized) };

	const hours = String(parsed.getHours()).padStart(2, "0");
	const minutes = String(parsed.getMinutes()).padStart(2, "0");
	return { text: `${datePart} ${hours}:${minutes}`, title: storedUtcHoverTitle(normalized) };
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
