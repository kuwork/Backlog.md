import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { FileSystem } from "../file-system/operations.ts";
import { serializeTask } from "../markdown/serializer.ts";
import type { Task } from "../types/index.ts";
import { type AmbiguousIdError, isAmbiguousIdError } from "../utils/entity-id.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

const DRAFTS_DIR = () => join(TEST_DIR, "backlog", "drafts");

function draft(id: string, title: string): Task {
	return {
		id,
		title,
		status: "Draft",
		assignee: [],
		createdDate: "2026-01-01 00:00",
		labels: [],
		dependencies: [],
	};
}

describe("draft identity fails closed", () => {
	let filesystem: FileSystem;

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("draft-identity");
		filesystem = new FileSystem(TEST_DIR);
		await filesystem.ensureBacklogStructure();
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {
			// Ignore cleanup errors
		}
	});

	async function writeDraftFile(filename: string, content: string): Promise<string> {
		await mkdir(DRAFTS_DIR(), { recursive: true });
		const path = join(DRAFTS_DIR(), filename);
		await Bun.write(path, content);
		return path;
	}

	async function writeValidDraft(filename: string, task: Task): Promise<string> {
		return await writeDraftFile(filename, serializeTask(task));
	}

	async function captureAmbiguity(run: () => Promise<unknown>): Promise<AmbiguousIdError> {
		try {
			await run();
		} catch (error) {
			if (isAmbiguousIdError(error)) return error;
			throw error;
		}
		throw new Error("Expected an AmbiguousIdError, but the call resolved.");
	}

	describe("resolveDraftFilePath", () => {
		it("resolves a draft through padding-insensitive matching", async () => {
			const expected = await writeValidDraft("draft-1 - Alpha.md", draft("DRAFT-1", "Alpha"));

			expect(await filesystem.resolveDraftFilePath("DRAFT-01")).toBe(expected);
			expect(await filesystem.resolveDraftFilePath("draft-1")).toBe(expected);
		});

		it("returns null for an id that matches nothing", async () => {
			await writeValidDraft("draft-1 - Alpha.md", draft("DRAFT-1", "Alpha"));

			expect(await filesystem.resolveDraftFilePath("DRAFT-9")).toBeNull();
		});

		it("fails closed when two filenames claim one identity", async () => {
			await writeValidDraft("draft-1 - Alpha.md", draft("DRAFT-1", "Alpha"));
			await writeValidDraft("draft-01 - Beta.md", draft("DRAFT-01", "Beta"));

			const error = await captureAmbiguity(() => filesystem.resolveDraftFilePath("draft-1"));

			expect(error.candidates).toEqual(["draft-01 - Beta.md", "draft-1 - Alpha.md"]);
			expect(error.message).toContain("draft-1 - Alpha.md");
			expect(error.message).toContain("Rename one file to a distinct numeric id");
		});

		it("fails closed for dotted padding duplicates", async () => {
			await writeValidDraft("draft-1.1 - Alpha.md", draft("DRAFT-1.1", "Alpha"));
			await writeValidDraft("draft-1.01 - Beta.md", draft("DRAFT-1.01", "Beta"));

			const error = await captureAmbiguity(() => filesystem.resolveDraftFilePath("DRAFT-1.1"));

			expect(error.candidates).toEqual(["draft-1.01 - Beta.md", "draft-1.1 - Alpha.md"]);
		});
	});

	describe("read paths", () => {
		it("loads a unique draft through the same resolver", async () => {
			await writeValidDraft("draft-1 - Alpha.md", draft("DRAFT-1", "Alpha"));

			const loaded = await filesystem.loadDraft("DRAFT-01");

			expect(loaded?.id).toBe("DRAFT-1");
			expect(loaded?.title).toBe("Alpha");
		});

		it("surfaces the conflict instead of guessing which twin to return", async () => {
			const first = await writeValidDraft("draft-1 - Alpha.md", draft("DRAFT-1", "Alpha"));
			const second = await writeValidDraft("draft-01 - Beta.md", draft("DRAFT-01", "Beta"));
			const firstBefore = await Bun.file(first).text();
			const secondBefore = await Bun.file(second).text();

			const error = await captureAmbiguity(() => filesystem.loadDraft("draft-1"));

			expect(error.id).toBe("DRAFT-1");
			// Neither file is rewritten or removed by a read that could not pick a winner.
			expect(await Bun.file(first).text()).toBe(firstBefore);
			expect(await Bun.file(second).text()).toBe(secondBefore);
		});
	});

	describe("whole-file operations", () => {
		it("refuses to promote when the identity is ambiguous", async () => {
			const first = await writeValidDraft("draft-2 - Alpha.md", draft("DRAFT-2", "Alpha"));
			const second = await writeValidDraft("draft-02 - Beta.md", draft("DRAFT-02", "Beta"));

			const error = await captureAmbiguity(() => filesystem.promoteDraft("DRAFT-2"));

			expect(error.candidates).toHaveLength(2);
			expect(await Bun.file(first).exists()).toBe(true);
			expect(await Bun.file(second).exists()).toBe(true);
		});

		it("refuses to archive when the identity is ambiguous", async () => {
			await writeValidDraft("draft-3 - Alpha.md", draft("DRAFT-3", "Alpha"));
			await writeValidDraft("draft-03 - Beta.md", draft("DRAFT-03", "Beta"));

			const error = await captureAmbiguity(() => filesystem.archiveDraft("DRAFT-3"));

			expect(error.candidates).toHaveLength(2);
			expect((await readdir(DRAFTS_DIR())).sort()).toEqual(["draft-03 - Beta.md", "draft-3 - Alpha.md"]);
		});
	});

	describe("withDraftLock", () => {
		it("fails fast while a draft is locked and succeeds once released", async () => {
			const filePath = await writeValidDraft("draft-4 - Locked.md", draft("DRAFT-4", "Locked"));
			const reference = { filePath, canonicalId: "DRAFT-4" };

			let releaseLock: () => void = () => {};
			let markAcquired: () => void = () => {};
			const acquired = new Promise<void>((resolve) => {
				markAcquired = resolve;
			});
			const held = filesystem.withDraftLock(reference, async () => {
				markAcquired();
				await new Promise<void>((resolve) => {
					releaseLock = resolve;
				});
			});
			await acquired;

			await expect(filesystem.withDraftLock(reference, async () => "second")).rejects.toThrow(
				/being modified by another process/,
			);

			releaseLock();
			await held;
			expect(await filesystem.withDraftLock(reference, async () => "third")).toBe("third");
		});
	});

	describe("saveDraft convergence", () => {
		it("collapses an existing same-identity file into the saved one", async () => {
			await writeValidDraft("draft-5 - Old Title.md", draft("DRAFT-5", "Old Title"));

			const saved = await filesystem.saveDraft(draft("DRAFT-5", "New Title"));

			expect(await readdir(DRAFTS_DIR())).toEqual(["draft-5 - New-Title.md"]);
			expect(await Bun.file(saved).exists()).toBe(true);
		});

		it("never deletes a same-identity candidate that cannot be parsed", async () => {
			const damaged = await writeDraftFile("draft-6 - Damaged.md", "---\nid: [unclosed\n---\n\nbody\n");

			await filesystem.saveDraft(draft("DRAFT-6", "Healthy"));

			// The unvalidated file survives; a second identity claim would be reported as ambiguous
			// rather than silently overwritten.
			expect(await Bun.file(damaged).exists()).toBe(true);
			expect((await readdir(DRAFTS_DIR())).sort()).toEqual(["draft-6 - Damaged.md", "draft-6 - Healthy.md"]);
		});
	});

	describe("identity accounting", () => {
		it("counts filename-derived ids even when a file cannot be parsed", async () => {
			await writeValidDraft("draft-7 - Healthy.md", draft("DRAFT-7", "Healthy"));
			await writeDraftFile("draft-8 - Damaged.md", "---\nid: [unclosed\n---\n\nbody\n");

			const occupied = await filesystem.listOccupiedDraftFileIds();

			expect(occupied.sort()).toEqual(["DRAFT-7", "DRAFT-8"]);
		});
	});

	describe("diagnoseDraftIdentity", () => {
		it("reports a healthy store as free of findings", async () => {
			await writeValidDraft("draft-9 - Alpha.md", draft("DRAFT-9", "Alpha"));

			const findings = await filesystem.diagnoseDraftIdentity();

			expect(findings).toEqual({ duplicates: [], unreadable: [], drifted: [] });
		});

		it("reports duplicate identities, drifted frontmatter, and unreadable files", async () => {
			await writeValidDraft("draft-10 - Alpha.md", draft("DRAFT-10", "Alpha"));
			await writeValidDraft("draft-010 - Beta.md", draft("DRAFT-010", "Beta"));
			await writeDraftFile("draft-11 - Drifted.md", serializeTask(draft("DRAFT-99", "Drifted")));
			await writeDraftFile("draft-12 - Damaged.md", "---\nid: [unclosed\n---\n\nbody\n");

			const findings = await filesystem.diagnoseDraftIdentity();

			expect(findings.duplicates).toEqual([{ id: "DRAFT-010", paths: ["draft-010 - Beta.md", "draft-10 - Alpha.md"] }]);
			expect(findings.drifted).toEqual([
				{ path: "draft-11 - Drifted.md", frontmatterId: "DRAFT-99", filenameId: "DRAFT-11" },
			]);
			expect(findings.unreadable).toEqual(["draft-12 - Damaged.md"]);
		});

		it("surfaces an unscannable drafts directory instead of reporting it healthy", async () => {
			await rm(DRAFTS_DIR(), { recursive: true, force: true });

			const unreadable: string[] = [];
			const filenames = await filesystem.listDraftFilenames(unreadable);

			expect(filenames).toEqual([]);
			expect(unreadable).toEqual([DRAFTS_DIR()]);
		});
	});
});
