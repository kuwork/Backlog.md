import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Every top-level page the web app can route to must also be declared in the server's SPA route
 * table, or a direct visit / refresh on that URL answers 404 instead of the app shell.
 *
 * This is a **source-level guard**, deliberately: the server builds its `routes` object inline
 * inside `start()`, so there is no runtime value to import, and the drift is between two literal
 * lists - exactly the kind of thing that silently breaks a deep link (BACK-771 shipped
 * `/databases` in the router while the server was never told about it).
 */

const repoRoot = join(import.meta.dir, "..", "..");

function read(relativePath: string): string {
	return readFileSync(join(repoRoot, relativePath), "utf8");
}

describe("server SPA routes", () => {
	const appSource = read("src/web/App.tsx");
	const serverSource = read("src/server/index.ts");

	/**
	 * Static top-level segments from App.tsx: `path="graph"` -> `graph`. Parameterized and nested
	 * routes (`task/:id`, `wiki/*`) are covered by the server's own wildcard entries and are not
	 * part of this check.
	 */
	const staticSegments = [
		...new Set(
			[...appSource.matchAll(/path="([^"]+)"/g)]
				.map((match) => match[1] ?? "")
				.filter((route) => route !== "/" && !route.includes("/") && !route.includes(":")),
		),
	].sort();

	test("the router declares a non-trivial set of top-level pages", () => {
		// Guards the extraction itself: a regex that stopped matching would make every assertion below
		// vacuously true.
		expect(staticSegments.length).toBeGreaterThanOrEqual(10);
		expect(staticSegments).toContain("databases");
	});

	test("every top-level page is served as the SPA shell (no 404 on refresh)", () => {
		const missing = staticSegments.filter((segment) => !serverSource.includes(`"/${segment}": spaIndexHtml`));
		expect(missing).toEqual([]);
	});

	test("deep-link prefixes keep their wildcard entries", () => {
		for (const prefix of ["/documentation/*", "/decisions/*", "/wiki/*", "/search/*"]) {
			expect(serverSource).toContain(`"${prefix}": spaIndexHtml`);
		}
	});
});
