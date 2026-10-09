import { describe, expect, it } from "bun:test";
import {
	dateTimeLocalToStoredUtc,
	formatStoredUtcDateForCompactDisplay,
	formatStoredUtcDateForDisplay,
	formatStoredUtcShortStamp,
	parseStoredUtcDate,
	storedUtcHoverTitle,
	storedUtcToDateTimeLocal,
} from "./date-display";

describe("parseStoredUtcDate", () => {
	it("parses stored UTC datetime strings", () => {
		const parsed = parseStoredUtcDate("2026-02-09 06:01");
		expect(parsed).not.toBeNull();
		expect(parsed?.toISOString()).toBe("2026-02-09T06:01:00.000Z");
	});

	it("parses date-only strings as UTC midnight", () => {
		const parsed = parseStoredUtcDate("2026-02-09");
		expect(parsed).not.toBeNull();
		expect(parsed?.toISOString()).toBe("2026-02-09T00:00:00.000Z");
	});

	it("returns null for invalid date values", () => {
		expect(parseStoredUtcDate("2026-02-31 06:01")).toBeNull();
		expect(parseStoredUtcDate("not-a-date")).toBeNull();
	});
});

describe("storedUtcHoverTitle", () => {
	it("marks the canonical stored value as UTC", () => {
		expect(storedUtcHoverTitle("2026-02-09 06:01")).toBe("2026-02-09 06:01 (UTC)");
		expect(storedUtcHoverTitle("  2026-02-09 06:01  ")).toBe("2026-02-09 06:01 (UTC)");
	});

	it("stays absent when the record has no time to claim", () => {
		expect(storedUtcHoverTitle("2026-02-09")).toBeUndefined();
		expect(storedUtcHoverTitle("")).toBeUndefined();
		expect(storedUtcHoverTitle(undefined)).toBeUndefined();
	});

	it("stays absent for unparsable values", () => {
		expect(storedUtcHoverTitle("not-a-date")).toBeUndefined();
		expect(storedUtcHoverTitle("2026-02-31 06:01")).toBeUndefined();
	});
});

describe("formatStoredUtcDateForDisplay", () => {
	it("formats datetime values in local timezone and keeps the UTC value for hover", () => {
		const expected = new Date(Date.UTC(2026, 1, 9, 6, 1, 0)).toLocaleString(undefined, {
			dateStyle: "medium",
			timeStyle: "short",
		});
		expect(formatStoredUtcDateForDisplay("2026-02-09 06:01")).toEqual({
			text: expected,
			title: "2026-02-09 06:01 (UTC)",
		});
	});

	it("formats date-only values as local dates with no hover", () => {
		const expected = new Date(Date.UTC(2026, 1, 9, 0, 0, 0)).toLocaleDateString();
		expect(formatStoredUtcDateForDisplay("2026-02-09")).toEqual({ text: expected });
	});

	it("falls back to original value when parsing fails", () => {
		expect(formatStoredUtcDateForDisplay("not-a-date")).toEqual({ text: "not-a-date" });
		expect(formatStoredUtcDateForDisplay("2026-02-31 06:01")).toEqual({ text: "2026-02-31 06:01" });
	});
});

describe("formatStoredUtcDateForCompactDisplay", () => {
	const now = new Date(Date.UTC(2026, 1, 21, 12, 0, 0));

	it("formats recent values as relative days", () => {
		expect(formatStoredUtcDateForCompactDisplay("2026-02-21", now)).toEqual({ text: "today" });
		expect(formatStoredUtcDateForCompactDisplay("2026-02-20", now)).toEqual({ text: "yesterday" });
		expect(formatStoredUtcDateForCompactDisplay("2026-02-18", now)).toEqual({ text: "3d ago" });
	});

	it("keeps the UTC value on hover for relative labels of timestamps", () => {
		expect(formatStoredUtcDateForCompactDisplay("2026-02-21 06:00", now)).toEqual({
			text: "today",
			title: "2026-02-21 06:00 (UTC)",
		});
		expect(formatStoredUtcDateForCompactDisplay("2026-02-19 06:00", now)).toEqual({
			text: "2d ago",
			title: "2026-02-19 06:00 (UTC)",
		});
	});

	it("formats older values as short date, keeping the hover", () => {
		const expected = new Date(Date.UTC(2026, 1, 10, 0, 0, 0)).toLocaleDateString();
		expect(formatStoredUtcDateForCompactDisplay("2026-02-10", now)).toEqual({ text: expected });
		expect(formatStoredUtcDateForCompactDisplay("2026-02-10 08:15", now)).toEqual({
			text: expected,
			title: "2026-02-10 08:15 (UTC)",
		});
	});

	it("handles missing and invalid values gracefully", () => {
		expect(formatStoredUtcDateForCompactDisplay("", now)).toEqual({ text: "—" });
		expect(formatStoredUtcDateForCompactDisplay("not-a-date", now)).toEqual({ text: "not-a-date" });
	});
});

describe("formatStoredUtcShortStamp", () => {
	const now = new Date(2026, 6, 1); // local 1 Jul 2026

	it("drops the year when the stamp falls in the current year, and reads the clock locally", () => {
		const parsed = parseStoredUtcDate("2026-06-15 12:00");
		if (!parsed) throw new Error("expected parse");
		const clock = `${String(parsed.getHours()).padStart(2, "0")}:${String(parsed.getMinutes()).padStart(2, "0")}`;
		expect(formatStoredUtcShortStamp("2026-06-15 12:00", now)).toEqual({
			text: `${parsed.getMonth() + 1}/${parsed.getDate()} ${clock}`,
			title: "2026-06-15 12:00 (UTC)",
		});
	});

	it("keeps the year when the stamp falls in another year", () => {
		const parsed = parseStoredUtcDate("2019-06-15 12:00");
		if (!parsed) throw new Error("expected parse");
		const clock = `${String(parsed.getHours()).padStart(2, "0")}:${String(parsed.getMinutes()).padStart(2, "0")}`;
		expect(formatStoredUtcShortStamp("2019-06-15 12:00", now).text).toBe(
			`2019/${parsed.getMonth() + 1}/${parsed.getDate()} ${clock}`,
		);
	});

	it("renders a date-only value without a clock and without shifting its day", () => {
		expect(formatStoredUtcShortStamp("2026-02-09", now)).toEqual({ text: "2/9" });
		expect(formatStoredUtcShortStamp("2019-02-09", now)).toEqual({ text: "2019/2/9" });
	});

	it("passes empty and unparsable values through", () => {
		expect(formatStoredUtcShortStamp("", now)).toEqual({ text: "" });
		expect(formatStoredUtcShortStamp("not-a-date", now)).toEqual({ text: "not-a-date" });
	});
});

describe("storedUtcToDateTimeLocal", () => {
	it("converts stored UTC datetime to local datetime-local format", () => {
		const result = storedUtcToDateTimeLocal("2026-02-09 06:01");
		const [datePart, timePart] = result.split("T");
		expect(datePart).toBe("2026-02-09");
		expect(timePart).toBeDefined();
		if (!timePart) throw new Error("Expected timePart to be defined");
		const [hours, minutes] = timePart.split(":");
		expect(hours).toBeDefined();
		expect(minutes).toBeDefined();
		if (!hours || !minutes) throw new Error("Expected hours and minutes to be defined");
		const localDate = new Date(2026, 1, 9, Number.parseInt(hours, 10), Number.parseInt(minutes, 10), 0);
		expect(localDate.toISOString()).toBe("2026-02-09T06:01:00.000Z");
	});

	it("returns empty string for empty input", () => {
		expect(storedUtcToDateTimeLocal("")).toBe("");
	});

	it("falls back to T replacement for invalid input", () => {
		expect(storedUtcToDateTimeLocal("not-a-date")).toBe("not-a-date");
	});
});

describe("dateTimeLocalToStoredUtc", () => {
	it("converts local datetime-local to stored UTC format", () => {
		const utcDate = new Date(Date.UTC(2026, 1, 9, 6, 1, 0));
		const localStr = `${utcDate.getFullYear()}-${String(utcDate.getMonth() + 1).padStart(2, "0")}-${String(utcDate.getDate()).padStart(2, "0")}T${String(utcDate.getHours()).padStart(2, "0")}:${String(utcDate.getMinutes()).padStart(2, "0")}`;
		expect(dateTimeLocalToStoredUtc(localStr)).toBe("2026-02-09 06:01");
	});

	it("returns empty string for empty input", () => {
		expect(dateTimeLocalToStoredUtc("")).toBe("");
	});

	it("converts space-separated local datetime to stored UTC format", () => {
		const localDate = new Date(2026, 1, 9, 6, 1, 0);
		expect(dateTimeLocalToStoredUtc("2026-02-09 06:01")).toBe(localDate.toISOString().slice(0, 16).replace("T", " "));
	});
});
