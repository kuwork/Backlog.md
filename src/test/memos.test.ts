import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	createMemo,
	deleteMemo,
	getMemo,
	listMemos,
	listMemosPage,
	type Memo,
	memoDir,
	nextMemoId,
	updateMemo,
} from "../core/memos.ts";
import { parseFrontmatter, stringifyFrontmatter } from "../markdown/frontmatter.ts";

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

	function today(): string {
		return new Date().toISOString().slice(0, 10);
	}

	function todayStamp(): string {
		return today().replace(/-/g, "");
	}

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
		await seedMemo("20260930-5", "2026-09-30 09:00", "yesterday note");

		expect(await nextMemoId(root)).toBe(`${todayStamp()}-1`);

		const first = await createMemo(root, "first note");
		expect(first.id).toBe(`${todayStamp()}-1`);

		expect(await nextMemoId(root)).toBe(`${todayStamp()}-2`);

		const second = await createMemo(root, "second note");
		expect(second.id).toBe(`${todayStamp()}-2`);

		const all = await listMemos(root);
		expect(all.map((memo) => memo.id).sort()).toEqual(["20260930-5", `${todayStamp()}-1`, `${todayStamp()}-2`]);
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
		const preview = await seedMemo(`${todayStamp()}-90`, `${today()} 08:00`, `\n\n${"x".repeat(80)}`);
		expect(preview.displayTitle).toBe("x".repeat(40));
	});

	it("sorts newest first with id as tiebreaker", async () => {
		await seedMemo(`${todayStamp()}-1`, `${today()} 08:00`, "oldest");
		await seedMemo(`${todayStamp()}-2`, `${today()} 09:00`, "newest");
		await seedMemo(`${todayStamp()}-3`, `${today()} 09:00`, "same minute, higher id");
		await seedMemo("20260930-1", "2026-09-30 09:00", "yesterday");

		const all = await listMemos(root);
		expect(all.map((memo) => memo.id)).toEqual([
			`${todayStamp()}-3`,
			`${todayStamp()}-2`,
			`${todayStamp()}-1`,
			"20260930-1",
		]);
	});

	it("paginates with limit and cursor and returns nextCursor null at the end", async () => {
		await seedMemo(`${todayStamp()}-1`, `${today()} 08:00`, "one");
		await seedMemo(`${todayStamp()}-2`, `${today()} 09:00`, "two");
		await seedMemo(`${todayStamp()}-3`, `${today()} 10:00`, "three");

		const firstPage = await listMemosPage(root, { limit: 2 });
		expect(firstPage.items.map((memo) => memo.id)).toEqual([`${todayStamp()}-3`, `${todayStamp()}-2`]);
		expect(firstPage.nextCursor).toBe(`${todayStamp()}-2`);

		const secondPage = await listMemosPage(root, { limit: 2, cursor: firstPage.nextCursor ?? undefined });
		expect(secondPage.items.map((memo) => memo.id)).toEqual([`${todayStamp()}-1`]);
		expect(secondPage.nextCursor).toBeNull();

		const wholeSet = await listMemosPage(root, { limit: 3 });
		expect(wholeSet.items).toHaveLength(3);
		expect(wholeSet.nextCursor).toBeNull();
	});

	it("defaults the page size and returns an empty page when there are no memos", async () => {
		const empty = await listMemosPage(root);
		expect(empty.items).toEqual([]);
		expect(empty.nextCursor).toBeNull();
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
		await seedMemo(`${todayStamp()}-1`, `${today()} 08:00`, "today one");
		await seedMemo(`${todayStamp()}-2`, `${today()} 09:00`, "today two");
		await seedMemo("20260930-1", "2026-09-30 09:00", "yesterday");

		const todayPage = await listMemosPage(root, { date: today() });
		expect(todayPage.items.map((memo) => memo.id)).toEqual([`${todayStamp()}-2`, `${todayStamp()}-1`]);
		expect(todayPage.nextCursor).toBeNull();

		const onePerPage = await listMemosPage(root, { date: today(), limit: 1 });
		expect(onePerPage.items.map((memo) => memo.id)).toEqual([`${todayStamp()}-2`]);
		expect(onePerPage.nextCursor).toBe(`${todayStamp()}-2`);

		const pastPage = await listMemosPage(root, { date: "2026-09-30" });
		expect(pastPage.items.map((memo) => memo.id)).toEqual(["20260930-1"]);

		const nonePage = await listMemosPage(root, { date: "2020-01-01" });
		expect(nonePage.items).toEqual([]);
	});

	it("filters by tags, case-insensitively, matching any of the given tags", async () => {
		await seedMemo(`${todayStamp()}-1`, `${today()} 08:00`, "idea note", ["Idea"]);
		await seedMemo(`${todayStamp()}-2`, `${today()} 09:00`, "cli note", ["cli", "tool"]);
		await seedMemo(`${todayStamp()}-3`, `${today()} 10:00`, "untagged");

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
		await seedMemo(`${todayStamp()}-1`, `${today()} 08:00`, "real note");
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

	it("getMemo returns null for an unknown id", async () => {
		expect(await getMemo(root, "20991231-1")).toBeNull();
	});
});
