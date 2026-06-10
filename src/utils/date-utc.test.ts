import { describe, expect, it } from "bun:test";
import { localDateTimeToStoredUtc, parseStoredUtcDate } from "./date-utc";

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
