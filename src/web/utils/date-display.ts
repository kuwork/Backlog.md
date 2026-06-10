import { DATE_TIME_REGEX, localDateTimeToStoredUtc, parseStoredUtcDate } from "../../utils/date-utc.ts";

export { localDateTimeToStoredUtc as dateTimeLocalToStoredUtc, parseStoredUtcDate };

export function formatStoredUtcDateForDisplay(dateStr: string): string {
	const parsed = parseStoredUtcDate(dateStr);
	if (!parsed) return dateStr;

	if (DATE_TIME_REGEX.test(dateStr.trim())) {
		return parsed.toLocaleString(undefined, {
			dateStyle: "medium",
			timeStyle: "short",
		});
	}

	return parsed.toLocaleDateString();
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

export function formatStoredUtcDateForCompactDisplay(dateStr: string, now: Date = new Date()): string {
	const normalized = dateStr.trim();
	if (!normalized) return "—";

	const parsed = parseStoredUtcDate(normalized);
	if (!parsed) return normalized;

	const diffMs = now.getTime() - parsed.getTime();
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

	if (diffDays >= 0) {
		if (diffDays === 0) return "today";
		if (diffDays === 1) return "yesterday";
		if (diffDays < 7) return `${diffDays}d ago`;
	}

	return parsed.toLocaleDateString();
}
