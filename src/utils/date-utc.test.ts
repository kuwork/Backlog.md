import { describe, expect, it } from "bun:test";
import {
	formatLocalDateKey,
	localDateKeyFromStoredUtc,
	localDateTimeToStoredUtc,
	parseStoredUtcDate,
} from "./date-utc";

describe("localDateTimeToStoredUtc", () => {
	it("converts T-separated local datetime to UTC", () => {
		const localDate = new Date(2026, 1, 9, 6, 1, 0);
		expect(localDateTimeToStoredUtc("2026-02-09T06:01")).toBe(localDate.toISOString().slice(0, 16).replace("T", " "));
	});

	it("converts space-separated local datetime to UTC", () => {
		const localDate = new Date(2026, 1, 9, 6, 1, 0);
		expect(localDateTimeToStoredUtc("2026-02-09 06:01")).toBe(localDate.toISOString().slice(0, 16).replace("T", " "));
	});

	it("converts date-only to UTC treating as 00:00 local", () => {
		const localDate = new Date(2026, 1, 9, 0, 0, 0);
		expect(localDateTimeToStoredUtc("2026-02-09")).toBe(localDate.toISOString().slice(0, 16).replace("T", " "));
	});

	it("returns empty string for empty input", () => {
		expect(localDateTimeToStoredUtc("")).toBe("");
	});

	it("returns non-matching strings as-is", () => {
		expect(localDateTimeToStoredUtc("not-a-date")).toBe("not-a-date");
		expect(localDateTimeToStoredUtc("2026-02-09 06:01:00")).toBe("2026-02-09 06:01:00");
	});

	it("is reversible with parseStoredUtcDate for datetime", () => {
		const localStr = "2026-02-09 06:01";
		const stored = localDateTimeToStoredUtc(localStr);
		const parsed = parseStoredUtcDate(stored);
		expect(parsed).not.toBeNull();
		if (!parsed) throw new Error("Expected parsed to be defined");
		const localDate = new Date(2026, 1, 9, 6, 1, 0);
		expect(parsed.toISOString()).toBe(localDate.toISOString());
	});
});

describe("localDateKeyFromStoredUtc", () => {
	it("reads the local day a stored UTC timestamp falls on", () => {
		// Round-tripping a local day through the stored shape must return the same day, whatever the
		// machine's offset: the value is UTC on disk and local again by the time its date is read.
		for (const time of ["00:30", "09:00", "12:00", "23:00"]) {
			const day = "2026-10-01";
			expect(localDateKeyFromStoredUtc(localDateTimeToStoredUtc(`${day} ${time}`))).toBe(day);
		}
	});

	it("holds the day on both ends of a year and of a month", () => {
		for (const day of ["2025-12-31", "2026-01-01", "2026-02-28", "2026-10-01"]) {
			expect(localDateKeyFromStoredUtc(localDateTimeToStoredUtc(`${day} 23:00`))).toBe(day);
			expect(localDateKeyFromStoredUtc(localDateTimeToStoredUtc(`${day} 00:30`))).toBe(day);
		}
	});

	it("leaves a date-only value alone, since it carries no time to shift", () => {
		expect(localDateKeyFromStoredUtc("2026-10-01")).toBe("2026-10-01");
	});

	it("falls back to the literal prefix for an unparsable value", () => {
		expect(localDateKeyFromStoredUtc("2026-10-01 25:99")).toBe("2026-10-01");
		expect(localDateKeyFromStoredUtc("rubbish")).toBe("rubbish");
		expect(localDateKeyFromStoredUtc("")).toBe("");
	});
});

describe("formatLocalDateKey", () => {
	it("renders a Date on the machine's own clock", () => {
		expect(formatLocalDateKey(new Date(2026, 9, 2, 23, 59))).toBe("2026-10-02");
		expect(formatLocalDateKey(new Date(2026, 0, 1, 0, 0))).toBe("2026-01-01");
	});
});
