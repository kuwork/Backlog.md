import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, rm, utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { computeWebFingerprint, WebBundleProvider } from "../server/web-bundle.ts";
import { NO_CACHE_ENV } from "../utils/cache-policy.ts";
import { createUniqueTestDir } from "./test-utils.ts";

async function writeBundle(dir: string, marker: string): Promise<void> {
	await mkdir(dir, { recursive: true });
	await writeFile(join(dir, "index.html"), `<!DOCTYPE html><html><body>${marker}</body></html>`);
	await writeFile(join(dir, "chunk-abc.js"), "console.log('ui')");
}

describe("web bundle cache", () => {
	let dir: string;

	beforeEach(async () => {
		dir = createUniqueTestDir("web-bundle");
		await mkdir(dir, { recursive: true });
	});

	afterEach(async () => {
		await rm(dir, { recursive: true, force: true });
	});

	it("serves a cached bundle without building", async () => {
		const provider = WebBundleProvider.create({ buildRoot: dir, fingerprint: "fp-1" });
		expect(provider).not.toBeNull();
		if (!provider) return;
		await writeBundle(join(dir, "fp-1"), "cached");

		let built = false;
		await provider.initialize(async () => {
			built = true;
			return true;
		});

		expect(built).toBe(false);
		expect(provider.state).toBe("ready");
		expect(provider.indexHtml).toContain("cached");
	});

	it("builds into the fingerprint directory when the cache is empty", async () => {
		const provider = WebBundleProvider.create({ buildRoot: dir, fingerprint: "fp-2" });
		if (!provider) return;

		let buildDir = "";
		await provider.initialize(async (outDir) => {
			buildDir = outDir;
			await writeBundle(outDir, "fresh");
			return true;
		});

		expect(buildDir.endsWith("fp-2.building")).toBe(true);
		expect(provider.state).toBe("ready");
		expect(provider.indexHtml).toContain("fresh");
		// The temporary build directory is promoted, so the next start is a cache hit.
		expect(provider.bundleDir.endsWith("fp-2")).toBe(true);
		expect(provider.resolveAsset("/chunk-abc.js")).not.toBeNull();
	});

	it("keeps serving the previous build when a rebuild fails", async () => {
		await writeBundle(join(dir, "fp-old"), "old");
		await writeFile(join(dir, "fp-old", "stamp"), "make it the newest");

		const provider = WebBundleProvider.create({ buildRoot: dir, fingerprint: "fp-3" });
		if (!provider) return;

		await provider.initialize(async () => false);

		expect(provider.state).toBe("ready");
		expect(provider.indexHtml).toContain("old");
	});

	it("refuses to resolve paths outside the bundle", async () => {
		const provider = WebBundleProvider.create({ buildRoot: dir, fingerprint: "fp-4" });
		if (!provider) return;
		await writeBundle(join(dir, "fp-4"), "safe");
		await provider.initialize(async () => true);

		expect(provider.resolveAsset("/chunk-abc.js")).not.toBeNull();
		expect(provider.resolveAsset("/../../etc/passwd")).toBeNull();
		expect(provider.resolveAsset("/%2e%2e/%2e%2e/package.json")).toBeNull();
		expect(provider.contentTypeFor("x.js")).toBe("text/javascript; charset=utf-8");
	});

	it("rebuilds an already-cached bundle when caching is disabled", async () => {
		await writeBundle(join(dir, "fp-5"), "old");
		process.env[NO_CACHE_ENV] = "1";
		try {
			const provider = WebBundleProvider.create({ buildRoot: dir, fingerprint: "fp-5" });
			if (!provider) return;

			let built = false;
			await provider.initialize(async (outDir) => {
				built = true;
				await writeBundle(outDir, "rebuilt");
				return true;
			});

			expect(built).toBe(true);
			expect(provider.indexHtml).toContain("rebuilt");
		} finally {
			delete process.env[NO_CACHE_ENV];
		}
	});

	it("keeps the current build and one fallback, dropping older slots", async () => {
		await writeBundle(join(dir, "fp-a"), "a");
		await writeBundle(join(dir, "fp-b"), "b");
		const old = new Date(Date.now() - 60_000);
		await utimes(join(dir, "fp-a", "index.html"), old, old);

		const provider = WebBundleProvider.create({ buildRoot: dir, fingerprint: "fp-new" });
		if (!provider) return;
		await provider.initialize(async (outDir) => {
			await writeBundle(outDir, "new");
			return true;
		});

		expect(existsSync(join(dir, "fp-new", "index.html"))).toBe(true);
		expect(existsSync(join(dir, "fp-b", "index.html"))).toBe(true);
		expect(existsSync(join(dir, "fp-a"))).toBe(false);
	});

	it("changes the fingerprint when a source file changes", async () => {
		const webDir = join(dir, "web");
		await mkdir(join(webDir, "components"), { recursive: true });
		await writeFile(join(webDir, "index.html"), "<html></html>");
		await writeFile(join(webDir, "components", "app.tsx"), "export const a = 1;");
		await writeFile(join(dir, "package.json"), "{}");

		const first = computeWebFingerprint(webDir, dir);
		expect(computeWebFingerprint(webDir, dir)).toBe(first);

		await writeFile(join(webDir, "components", "app.tsx"), "export const a = 22222222;");
		expect(computeWebFingerprint(webDir, dir)).not.toBe(first);
	});
});
