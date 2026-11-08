import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ContentCache, contentCacheFilePath, contentSignature } from "../file-system/content-cache.ts";
import { NO_CACHE_ENV } from "../utils/cache-policy.ts";
import { createUniqueTestDir } from "./test-utils.ts";

type Entry = { title: string };

describe("content cache", () => {
	let dir: string;

	beforeEach(async () => {
		dir = createUniqueTestDir("content-cache");
		await mkdir(dir, { recursive: true });
	});

	afterEach(async () => {
		delete process.env[NO_CACHE_ENV];
		await rm(dir, { recursive: true, force: true });
	});

	it("reuses a parsed value while the file signature is unchanged", async () => {
		const file = join(dir, "page.md");
		await writeFile(file, "# Page\n");
		const signature = contentSignature(file);
		expect(signature).not.toBeNull();

		const cacheFile = join(dir, "cache.json");
		const cache = new ContentCache<Entry>("pages", cacheFile);
		await cache.load();
		expect(cache.reuse("page.md", signature)).toBeNull();

		cache.remember("page.md", signature, { title: "Page" });
		await cache.flush();
		expect(existsSync(cacheFile)).toBe(true);

		const reloaded = new ContentCache<Entry>("pages", cacheFile);
		await reloaded.load();
		expect(reloaded.reuse("page.md", signature)).toEqual({ title: "Page" });
	});

	it("re-reads a file whose signature moved", async () => {
		const file = join(dir, "page.md");
		await writeFile(file, "# Page\n");
		const before = contentSignature(file);

		const cache = new ContentCache<Entry>("pages", join(dir, "cache.json"));
		await cache.load();
		cache.remember("page.md", before, { title: "Page" });
		await cache.flush();

		await writeFile(file, "# Page edited\n");
		const after = contentSignature(file);
		expect(after).not.toEqual(before);

		const reloaded = new ContentCache<Entry>("pages", join(dir, "cache.json"));
		await reloaded.load();
		expect(reloaded.reuse("page.md", after)).toBeNull();
	});

	it("drops entries the last scan did not see", async () => {
		const file = join(dir, "page.md");
		await writeFile(file, "# Page\n");
		const signature = contentSignature(file);

		const cache = new ContentCache<Entry>("pages", join(dir, "cache.json"));
		await cache.load();
		cache.remember("page.md", signature, { title: "Page" });
		cache.remember("gone.md", signature, { title: "Gone" });
		cache.retainOnly(new Set(["page.md"]));
		await cache.flush();

		const reloaded = new ContentCache<Entry>("pages", join(dir, "cache.json"));
		await reloaded.load();
		expect(reloaded.reuse("page.md", signature)).toEqual({ title: "Page" });
		expect(reloaded.reuse("gone.md", signature)).toBeNull();
	});

	it("ignores the persisted snapshot when caching is disabled but still rewrites it", async () => {
		const file = join(dir, "page.md");
		await writeFile(file, "# Page\n");
		const signature = contentSignature(file);
		const cacheFile = join(dir, "cache.json");

		const warm = new ContentCache<Entry>("pages", cacheFile);
		await warm.load();
		warm.remember("page.md", signature, { title: "Page" });
		await warm.flush();

		process.env[NO_CACHE_ENV] = "1";
		const cold = new ContentCache<Entry>("pages", cacheFile);
		await cold.load();
		expect(cold.reuse("page.md", signature)).toBeNull();
		cold.remember("page.md", signature, { title: "Rebuilt" });
		await cold.flush();

		delete process.env[NO_CACHE_ENV];
		const rewarmed = new ContentCache<Entry>("pages", cacheFile);
		await rewarmed.load();
		expect(rewarmed.reuse("page.md", signature)).toEqual({ title: "Rebuilt" });
	});

	it("survives a corrupt cache file", async () => {
		const file = join(dir, "page.md");
		await writeFile(file, "# Page\n");
		await writeFile(join(dir, "cache.json"), "{not json");

		const cache = new ContentCache<Entry>("pages", join(dir, "cache.json"));
		await cache.load();
		expect(cache.reuse("page.md", contentSignature(file))).toBeNull();
	});

	it("keys cache files by project root", async () => {
		await mkdir(join(dir, "project"), { recursive: true });
		const first = contentCacheFilePath(join(dir, "project"), "wikis");
		const second = contentCacheFilePath(join(dir, "project", "nested"), "wikis");
		expect(first).not.toBe(second);
		expect(first.endsWith("-wikis.json")).toBe(true);
	});
});
