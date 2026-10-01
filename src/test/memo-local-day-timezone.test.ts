import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * The memo day contract, pinned to a timezone.
 *
 * `created_date` is stored UTC, but the calendar grid and the feed's `?date=` filter are local-day
 * questions. The two dates only differ away from UTC, and `bun test` runs in UTC - so a test that
 * relied on the ambient zone would pass against the old "read the stored string's prefix"
 * implementation and prove nothing. Each case therefore runs in a child process pinned to a zone
 * where the two days genuinely differ.
 *
 * The id is the deliberate exception: it is a filename that stays stable for the life of the memo, so
 * it is named for the stored UTC date. The cases below pin both rules at once.
 */

const sourceUrl = (relative: string): string => pathToFileURL(join(import.meta.dir, "..", relative)).href;

interface Probe {
	zone: string;
	stored: string;
	localDayOfStored: string;
	onLocalDay: string[];
	onStoredDay: string[];
	idPrefix: string;
}

/**
 * Seeds a memo that was captured at `time` on `localDay`, then asks the day-shaped surfaces what day
 * it belongs to, plus how it is named - all in a child process pinned to `zone`.
 */
function probeDay(zone: string, localDay: string, time: string): Probe {
	const dir = mkdtempSync(join(tmpdir(), "memo-tz-"));
	const script = join(dir, "probe.ts");
	const probeSource = `import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listMemosPage, memoDir, nextMemoId } from ${JSON.stringify(sourceUrl("core/memos.ts"))};
import { stringifyFrontmatter } from ${JSON.stringify(sourceUrl("markdown/frontmatter.ts"))};
import { localDateKeyFromStoredUtc, localDateTimeToStoredUtc } from ${JSON.stringify(sourceUrl("utils/date-utc.ts"))};

const [localDay, time] = process.argv.slice(2);
const stored = localDateTimeToStoredUtc(\`\${localDay} \${time}\`);
const root = await mkdtemp(join(tmpdir(), "memo-tz-project-"));
await Bun.write(join(root, "backlog", "config.yml"), "project_name: Memo TZ\\n");
await Bun.write(
	join(memoDir(root), "note.md"),
	stringifyFrontmatter("late note\\n", { id: "20261001-1", created_date: stored, updated_date: stored }),
);

const ids = async (date) => (await listMemosPage(root, { date })).items.map((memo) => memo.id);
console.log(
	JSON.stringify({
		zone: process.env.TZ,
		stored,
		localDayOfStored: localDateKeyFromStoredUtc(stored),
		onLocalDay: await ids(localDay),
		onStoredDay: await ids(stored.slice(0, 10)),
		idPrefix: await nextMemoId(root, stored),
	}),
);
`;
	writeFileSync(script, probeSource);
	try {
		const proc = Bun.spawnSync({
			cmd: [process.execPath, "run", script, localDay, time],
			env: { ...process.env, TZ: zone },
			stdout: "pipe",
			stderr: "pipe",
		});
		if (proc.exitCode !== 0) throw new Error(`${zone}: ${proc.stderr.toString()}`);
		return JSON.parse(proc.stdout.toString().trim()) as Probe;
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

describe("memo day is the local day", () => {
	it("keeps a late-evening capture on its own day in a western zone (-7)", () => {
		// 23:00 on the 1st in Los Angeles is 06:00 on the 2nd UTC: the stored date is the next day.
		const probe = probeDay("America/Los_Angeles", "2026-10-01", "23:00");
		expect(probe.zone).toBe("America/Los_Angeles");
		expect(probe.stored.slice(0, 10)).toBe("2026-10-02");
		expect(probe.localDayOfStored).toBe("2026-10-01");
		expect(probe.onLocalDay).toEqual(["20261001-1"]);
		expect(probe.onStoredDay).toEqual([]);
		// The id keeps the UTC date, not the day the grid files the memo under.
		expect(probe.idPrefix).toBe("20261002-1");
	});

	it("keeps an early-morning capture on its own day in a far-eastern zone (+9)", () => {
		// 00:30 on the 2nd in Tokyo is 15:30 on the 1st UTC: the stored date is the previous day.
		const probe = probeDay("Asia/Tokyo", "2026-10-02", "00:30");
		expect(probe.stored.slice(0, 10)).toBe("2026-10-01");
		expect(probe.localDayOfStored).toBe("2026-10-02");
		expect(probe.onLocalDay).toEqual(["20261001-1"]);
		expect(probe.onStoredDay).toEqual([]);
		expect(probe.idPrefix).toBe("20261001-1");
	});

	it("still reads the day as written in UTC, where the two dates coincide", () => {
		const probe = probeDay("UTC", "2026-10-01", "23:00");
		expect(probe.stored.slice(0, 10)).toBe("2026-10-01");
		expect(probe.localDayOfStored).toBe("2026-10-01");
		expect(probe.onLocalDay).toEqual(["20261001-1"]);
		expect(probe.idPrefix).toBe("20261001-1");
	});
});
