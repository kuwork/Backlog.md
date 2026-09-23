import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { formatDateForStats } from "../ui/overview-tui.ts";

const sourceUrl = pathToFileURL(join(import.meta.dir, "..", "ui", "overview-tui.ts")).href;

interface Probe {
	out: string;
	ref: string;
}

/**
 * Renders a value through formatDateForStats in a child process pinned to `timezone`.
 * The probe also renders the same calendar day as local midnight, so the caller can
 * assert "the day as written" without depending on the locale formatting of this machine.
 */
function renderInTimezone(dateStr: string, timezone: string): Probe {
	const dir = mkdtempSync(join(tmpdir(), "overview-date-"));
	const script = join(dir, "probe.ts");
	const probeSource = `import { formatDateForStats } from ${JSON.stringify(sourceUrl)};
const value = process.argv[2];
const [y, m, d] = value.split("-").map(Number);
console.log(JSON.stringify({ out: formatDateForStats(value), ref: new Date(y, m - 1, d).toLocaleDateString() }));
`;
	writeFileSync(script, probeSource);
	try {
		const proc = Bun.spawnSync({
			cmd: [process.execPath, "run", script, dateStr],
			env: { ...process.env, TZ: timezone },
			stdout: "pipe",
			stderr: "pipe",
		});
		if (proc.exitCode !== 0) throw new Error(proc.stderr.toString());
		return JSON.parse(proc.stdout.toString().trim()) as Probe;
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

describe("formatDateForStats", () => {
	// A due date is a calendar day: 2026-09-05 must render as the 5th in every timezone.
	// The old UTC-midnight parse rendered it as the 4th in western timezones (UTC-8).
	it("renders a date-only value as the day as written in a western timezone (-8)", () => {
		const probe = renderInTimezone("2026-09-05", "America/Los_Angeles");
		expect(probe.out).toBe(probe.ref);
	});

	it("renders a date-only value as the day as written in a far-eastern timezone (+14)", () => {
		const probe = renderInTimezone("2026-09-05", "Pacific/Kiritimati");
		expect(probe.out).toBe(probe.ref);
	});

	it("keeps the UTC parsing for values that carry a time (stored UTC timestamps)", () => {
		expect(formatDateForStats("2026-02-09 06:01")).toBe(new Date("2026-02-09T06:01:00Z").toLocaleDateString());
		expect(formatDateForStats("2026-02-09T06:01")).toBe(new Date("2026-02-09T06:01:00Z").toLocaleDateString());
	});
});
