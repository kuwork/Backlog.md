import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	archiveMemo,
	createMemo,
	deleteMemo,
	getMemo,
	listMemos,
	listMemosPage,
	type Memo,
	memoArchiveDir,
	memoDir,
	nextMemoId,
	updateMemo,
} from "../core/memos.ts";
import { parseFrontmatter, stringifyFrontmatter } from "../markdown/frontmatter.ts";
import { formatLocalDateKey, localDateTimeToStoredUtc } from "../utils/date-utc.ts";

/**
 * Memo storage tests run against a scratch project built with mkdtemp OUTSIDE the repo. The scratch
 * project must contain backlog/config.yml, otherwise anything that resolves a project root walks up
 * the tree, finds the real repository and writes into its real backlog/ folder.
 */
describe("memo storage", () => {
	let root: string;

	beforeEach(async () => {
		root = await mkdtemp(join(tmpdir(), "backlog-memos-"));
		await Bun.write(join(root, "backlog", "config.yml"), "project_name: Memo Test\n");
	});

	afterEach(async () => {
		await rm(root, { recursive: true, force: true });
	});

	/** The machine-local day - which is the day the feed's `date` filter and the calendar ask about. */
	function today(): string {
		return formatLocalDateKey(new Date());
	}

	/** The UTC `YYYYMMDD` an id is allocated under. Deliberately not the local day - see nextMemoId. */
	function todayStamp(): string {
		return new Date().toISOString().slice(0, 10).replace(/-/g, "");
	}

	/** A local day `offsetDays` before today, for the "another day" fixtures. */
	function daysAgo(offsetDays: number): string {
		const date = new Date();
		date.setDate(date.getDate() - offsetDays);
		return formatLocalDateKey(date);
	}

	/**
	 * A stored value whose LOCAL day is `day`. Stored timestamps are UTC, so hand-writing
	 * `${day} 09:00` would land on `day` only on a UTC machine; going through the same conversion the
	 * app uses keeps the assertion true everywhere - and is exactly the conversion being tested.
	 */
	function storedAt(day: string, time: string): string {
		return localDateTimeToStoredUtc(`${day} ${time}`);
	}

	const pastDay = daysAgo(3);
	const pastStamp = pastDay.replace(/-/g, "");

	/** Writes a memo file by hand so tests can pin createdDate instead of "now". */
	async function seedMemo(id: string, createdDate: string, body: string, tags: string[] = []): Promise<Memo> {
		const dir = memoDir(root);
		const file = join(dir, `${id}.md`);
		await Bun.write(
			file,
			stringifyFrontmatter(body.replace(/\r\n/g, "\n"), {
				id,
				created_date: createdDate,
				updated_date: createdDate,
				...(tags.length > 0 && { tags }),
			}),
		);
		const memo = await getMemo(root, id);
		if (!memo) throw new Error(`seed failed for ${id}`);
		return memo;
	}

	it("resolves the memo directory under backlog/memos", () => {
		expect(memoDir(root)).toBe(join(root, "backlog", "memos"));
	});

	it("sequences ids per day and restarts on a new day", async () => {
		await seedMemo(`${pastStamp}-5`, storedAt(pastDay, "09:00"), "past note");

		expect(await nextMemoId(root)).toBe(`${todayStamp()}-1`);

		const first = await createMemo(root, "first note");
		expect(first.id).toBe(`${todayStamp()}-1`);

		expect(await nextMemoId(root)).toBe(`${todayStamp()}-2`);

		const second = await createMemo(root, "second note");
		expect(second.id).toBe(`${todayStamp()}-2`);

		const all = await listMemos(root);
		expect(all.map((memo) => memo.id).sort()).toEqual([`${pastStamp}-5`, `${todayStamp()}-1`, `${todayStamp()}-2`]);
	});

	it("creates the memos directory when it does not exist and writes LF endings", async () => {
		expect(existsSync(memoDir(root))).toBe(false);

		const memo = await createMemo(root, "line one\r\nline two\r\n", ["idea"]);

		expect(existsSync(memoDir(root))).toBe(true);
		const raw = await Bun.file(memo.path).text();
		expect(raw.includes("\r")).toBe(false);
		expect(raw.endsWith("\n")).toBe(true);
		expect(raw.endsWith("\n\n")).toBe(false);
		expect(memo.rawContent).toBe("line one\nline two");
	});

	it("round-trips through parseFrontmatter with tags, dates and body intact", async () => {
		const created = await createMemo(root, "body text", ["idea", "meeting"]);

		const raw = await Bun.file(created.path).text();
		const { data, content } = parseFrontmatter(raw);
		expect(data.id).toBe(created.id);
		expect(data.created_date).toBe(created.createdDate);
		expect(data.updated_date).toBe(created.updatedDate);
		expect(data.tags).toEqual(["idea", "meeting"]);
		expect(data.title).toBeUndefined();
		expect(content.trim()).toBe("body text");

		const reread = await getMemo(root, created.id);
		expect(reread?.tags).toEqual(["idea", "meeting"]);
		expect(reread?.rawContent).toBe("body text");
		expect(reread?.createdDate).toBe(created.createdDate);
	});

	it("omits tags from frontmatter when there are none", async () => {
		const memo = await createMemo(root, "a body without a label");
		const raw = await Bun.file(memo.path).text();
		expect(raw).not.toContain("tags");
		expect(memo.tags).toEqual([]);
	});

	it("derives displayTitle from the first non-empty line, else the first 40 characters", async () => {
		const headed = await createMemo(root, "Meeting note about memos\n\n- bullet");
		expect(headed.displayTitle).toBe("Meeting note about memos");

		const blankStart = await createMemo(root, "\n\n   \nbody after blanks");
		expect(blankStart.displayTitle).toBe("body after blanks");

		// Body starts blank, so there is no heading line: fall back to a 40-character preview.
		const preview = await seedMemo(`${todayStamp()}-90`, storedAt(today(), "08:00"), `\n\n${"x".repeat(80)}`);
		expect(preview.displayTitle).toBe("x".repeat(40));
	});

	it("sorts newest first with id as tiebreaker", async () => {
		await seedMemo(`${todayStamp()}-1`, storedAt(today(), "08:00"), "oldest");
		await seedMemo(`${todayStamp()}-2`, storedAt(today(), "09:00"), "newest");
		await seedMemo(`${todayStamp()}-3`, storedAt(today(), "09:00"), "same minute, higher id");
		await seedMemo(`${pastStamp}-1`, storedAt(pastDay, "09:00"), "another day");

		const all = await listMemos(root);
		expect(all.map((memo) => memo.id)).toEqual([
			`${todayStamp()}-3`,
			`${todayStamp()}-2`,
			`${todayStamp()}-1`,
			`${pastStamp}-1`,
		]);
	});

	it("paginates with limit and offset and reports hasMore", async () => {
		await seedMemo(`${todayStamp()}-1`, storedAt(today(), "08:00"), "one");
		await seedMemo(`${todayStamp()}-2`, storedAt(today(), "09:00"), "two");
		await seedMemo(`${todayStamp()}-3`, storedAt(today(), "10:00"), "three");

		const firstPage = await listMemosPage(root, { limit: 2 });
		expect(firstPage.items.map((memo) => memo.id)).toEqual([`${todayStamp()}-3`, `${todayStamp()}-2`]);
		expect(firstPage.total).toBe(3);
		expect(firstPage.offset).toBe(0);
		expect(firstPage.hasMore).toBe(true);

		const secondPage = await listMemosPage(root, { limit: 2, offset: 2 });
		expect(secondPage.items.map((memo) => memo.id)).toEqual([`${todayStamp()}-1`]);
		expect(secondPage.offset).toBe(2);
		expect(secondPage.hasMore).toBe(false);

		const wholeSet = await listMemosPage(root, { limit: 3 });
		expect(wholeSet.items).toHaveLength(3);
		expect(wholeSet.hasMore).toBe(false);
	});

	it("defaults the page size and returns an empty page when there are no memos", async () => {
		const empty = await listMemosPage(root);
		expect(empty.items).toEqual([]);
		expect(empty.total).toBe(0);
		expect(empty.hasMore).toBe(false);
	});

	it("treats a project with no memo directory as empty instead of throwing", async () => {
		expect(existsSync(memoDir(root))).toBe(false);

		expect(await listMemos(root)).toEqual([]);
		expect(await nextMemoId(root)).toBe(`${todayStamp()}-1`);
		expect((await listMemosPage(root)).items).toEqual([]);

		// Reading must not create the directory as a side effect.
		expect(existsSync(memoDir(root))).toBe(false);
	});

	it("filters by date", async () => {
		await seedMemo(`${todayStamp()}-1`, storedAt(today(), "08:00"), "today one");
		await seedMemo(`${todayStamp()}-2`, storedAt(today(), "09:00"), "today two");
		await seedMemo(`${pastStamp}-1`, storedAt(pastDay, "09:00"), "another day");

		const todayPage = await listMemosPage(root, { date: today() });
		expect(todayPage.items.map((memo) => memo.id)).toEqual([`${todayStamp()}-2`, `${todayStamp()}-1`]);
		expect(todayPage.hasMore).toBe(false);

		const onePerPage = await listMemosPage(root, { date: today(), limit: 1 });
		expect(onePerPage.items.map((memo) => memo.id)).toEqual([`${todayStamp()}-2`]);
		expect(onePerPage.hasMore).toBe(true);

		const pastPage = await listMemosPage(root, { date: pastDay });
		expect(pastPage.items.map((memo) => memo.id)).toEqual([`${pastStamp}-1`]);

		const nonePage = await listMemosPage(root, { date: "2020-01-01" });
		expect(nonePage.items).toEqual([]);
	});

	/**
	 * The shape the bug was reported in: a note captured late in the evening is stored under the NEXT
	 * UTC date, so anything reading the stored string's prefix files it under tomorrow and the day the
	 * user wrote it looks empty. Both the calendar and the feed mean the local day.
	 *
	 * `bun test` runs in UTC, where the two dates coincide and this cannot fail - the pinned-zone cases
	 * in memo-local-day-timezone.test.ts are what actually force the difference. This keeps the shape
	 * on record next to the rest of the storage suite.
	 */
	it("matches the local day, not the stored UTC date, when the two differ", async () => {
		const lateDay = daysAgo(1);
		const lateStamp = lateDay.replace(/-/g, "");
		const stored = storedAt(lateDay, "23:00");
		await seedMemo(`${lateStamp}-1`, stored, "late note");

		expect((await listMemosPage(root, { date: lateDay })).items.map((memo) => memo.id)).toEqual([`${lateStamp}-1`]);

		// On a UTC machine the two dates coincide and there is nothing to tell apart; anywhere else the
		// stored prefix is a different day and must no longer match.
		const utcDay = stored.slice(0, 10);
		if (utcDay !== lateDay) {
			expect((await listMemosPage(root, { date: utcDay })).items).toEqual([]);
		}
	});

	it("names a memo after its stored UTC date, not the local day the feed files it under", async () => {
		const lateDay = daysAgo(1);
		const stored = storedAt(lateDay, "23:00");
		// An id is a filename and stays stable, so it keeps the UTC date the value is stored under;
		// `lateDay` is what the feed and the calendar use, and the two differ west of Greenwich.
		expect(await nextMemoId(root, stored)).toBe(`${stored.slice(0, 10).replace(/-/g, "")}-1`);
	});

	it("filters by tags, case-insensitively, matching any of the given tags", async () => {
		await seedMemo(`${todayStamp()}-1`, storedAt(today(), "08:00"), "idea note", ["Idea"]);
		await seedMemo(`${todayStamp()}-2`, storedAt(today(), "09:00"), "cli note", ["cli", "tool"]);
		await seedMemo(`${todayStamp()}-3`, storedAt(today(), "10:00"), "untagged");

		const ideaPage = await listMemosPage(root, { tags: ["idea"] });
		expect(ideaPage.items.map((memo) => memo.id)).toEqual([`${todayStamp()}-1`]);

		const multiPage = await listMemosPage(root, { tags: ["IDEA", "cli"] });
		expect(multiPage.items.map((memo) => memo.id)).toEqual([`${todayStamp()}-2`, `${todayStamp()}-1`]);

		const nonePage = await listMemosPage(root, { tags: ["missing"] });
		expect(nonePage.items).toEqual([]);

		const taggedToday = await listMemosPage(root, { date: today(), tags: ["tool"] });
		expect(taggedToday.items.map((memo) => memo.id)).toEqual([`${todayStamp()}-2`]);
	});

	it("skips memo files without a usable id instead of listing a blank row", async () => {
		await seedMemo(`${todayStamp()}-1`, storedAt(today(), "08:00"), "real note");
		await Bun.write(
			join(memoDir(root), "corrupt.md"),
			stringifyFrontmatter("Acceptance Criteria\n\n- [x] junk", { id: "", created_date: "" }),
		);

		const memos = await listMemos(root);
		expect(memos.map((memo) => memo.id)).toEqual([`${todayStamp()}-1`]);
		expect((await listMemosPage(root)).items.map((memo) => memo.id)).toEqual([`${todayStamp()}-1`]);
	});

	it("updateMemo bumps updatedDate while preserving id and createdDate", async () => {
		const created = await createMemo(root, "original body", ["idea"]);
		const updatedAtCreation = created.updatedDate;

		const updated = await updateMemo(root, created.id, { content: "replaced body", tags: ["done"] });

		expect(updated).not.toBeNull();
		expect(updated?.id).toBe(created.id);
		expect(updated?.createdDate).toBe(created.createdDate);
		expect(updated?.updatedDate).toBeDefined();
		expect(updated?.rawContent).toBe("replaced body");
		expect(updated?.tags).toEqual(["done"]);

		const raw = await Bun.file(created.path).text();
		expect(raw.includes("\r")).toBe(false);
		const { data } = parseFrontmatter(raw);
		expect(data.id).toBe(created.id);
		expect(data.created_date).toBe(created.createdDate);
		expect(String(data.updated_date) >= String(updatedAtCreation)).toBe(true);

		const missing = await updateMemo(root, "20991231-9", { content: "nope" });
		expect(missing).toBeNull();
	});

	it("updateMemo keeps the existing body when only tags change", async () => {
		const created = await createMemo(root, "keep me");
		const updated = await updateMemo(root, created.id, { tags: ["later"] });
		expect(updated?.rawContent).toBe("keep me");
		expect(updated?.tags).toEqual(["later"]);
	});

	it("deleteMemo removes the file and reports whether it existed", async () => {
		const created = await createMemo(root, "to be deleted");

		expect(await deleteMemo(root, created.id)).toBe(true);
		expect(await Bun.file(created.path).exists()).toBe(false);
		expect(await getMemo(root, created.id)).toBeNull();

		expect(await deleteMemo(root, created.id)).toBe(false);
	});

	it("archiveMemo moves the file to the archive folder and drops it from the listing", async () => {
		const created = await createMemo(root, "put me away", ["later"]);
		const body = await Bun.file(created.path).text();

		const archived = await archiveMemo(root, created.id);
		expect(archived).not.toBe("missing");
		expect(archived).not.toBe("collision");
		const moved = archived as Memo;

		expect(moved.id).toBe(created.id);
		expect(moved.rawContent).toBe("put me away");
		expect(moved.tags).toEqual(["later"]);
		expect(await Bun.file(created.path).exists()).toBe(false);
		expect(await Bun.file(join(memoArchiveDir(root), `${created.id}.md`)).exists()).toBe(true);
		// The move is a rename, not a rewrite: the bytes and the frontmatter survive untouched.
		expect(await Bun.file(moved.path).text()).toBe(body);
		expect(await listMemos(root)).toEqual([]);
	});

	it("archiveMemo reports an unknown id and never overwrites an archived memo", async () => {
		expect(await archiveMemo(root, "20991231-1")).toBe("missing");

		const created = await createMemo(root, "first");
		await archiveMemo(root, created.id);
		// The same id captured again is a different file in the active folder.
		const recreated = await createMemo(root, "second");
		expect(await archiveMemo(root, recreated.id)).toBe("collision");
		expect(await Bun.file(join(memoDir(root), `${recreated.id}.md`)).exists()).toBe(true);
	});

	it("getMemo returns null for an unknown id", async () => {
		expect(await getMemo(root, "20991231-1")).toBeNull();
	});
});

/**
 * A project that has chosen the hidden `.backlog/` directory (via `--backlog-dir .backlog` or an
 * upgrade that wrote there) must keep its memos under `.backlog/memos`, not the conventional
 * `backlog/memos`. This guards the regression where the memo watcher and writers hardcoded `backlog`
 * and therefore looked in the wrong folder for relocated projects (see startMemoWatcher).
 */
describe("memo storage with a hidden .backlog directory", () => {
	let root: string;

	beforeEach(async () => {
		root = await mkdtemp(join(tmpdir(), "backlog-memos-hidden-"));
		await Bun.write(join(root, ".backlog", "config.yml"), "project_name: Hidden Memo Test\n");
	});

	afterEach(async () => {
		await rm(root, { recursive: true, force: true });
	});

	it("resolves the memo directory under .backlog/memos", () => {
		expect(memoDir(root)).toBe(join(root, ".backlog", "memos"));
		expect(memoArchiveDir(root)).toBe(join(root, ".backlog", "archive", "memos"));
	});

	it("writes and reads memos inside the hidden directory", async () => {
		const memo = await createMemo(root, "hidden note");
		expect(memo.path.startsWith(join(root, ".backlog", "memos"))).toBe(true);
		expect(await Bun.file(memo.path).exists()).toBe(true);
		expect((await getMemo(root, memo.id))?.rawContent).toBe("hidden note");
	});
});
