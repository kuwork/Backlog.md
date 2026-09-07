import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
	getCandidatePackageNames,
	getOwnPackageName,
	getPackageName,
	isRosettaTranslated,
	resolveBinaryPath,
	scopePrefixOf,
} = require("../../scripts/resolveBinary.cjs");

// The launcher derives platform package names from the main package's own name,
// so expectations are computed from the repo's package.json rather than literals.
const repoPackage = JSON.parse(readFileSync(join(import.meta.dir, "..", "..", "package.json"), "utf8")) as {
	name?: string;
};
const repoName = repoPackage.name ?? "";
const scope = repoName.startsWith("@") && repoName.includes("/") ? repoName.slice(0, repoName.indexOf("/") + 1) : "";

function resolverFor(available: string[]) {
	return (specifier: string) => {
		if (!available.includes(specifier)) {
			throw new Error(`Cannot find module '${specifier}'`);
		}
		return `/node_modules/${specifier}`;
	};
}

describe("scopePrefixOf", () => {
	it("returns the scope prefix for scoped package names", () => {
		expect(scopePrefixOf("@some-scope/pkg")).toBe("@some-scope/");
		expect(scopePrefixOf("@scope/with/slashes")).toBe("@scope/");
	});

	it("returns an empty prefix for unscoped package names", () => {
		expect(scopePrefixOf("backlog.md")).toBe("");
		expect(scopePrefixOf("@noslash")).toBe("");
		expect(scopePrefixOf("")).toBe("");
	});
});

describe("getOwnPackageName", () => {
	it("reads the name of the package the launcher ships in", () => {
		expect(getOwnPackageName()).toBe(repoName);
	});
});

describe("getPackageName", () => {
	it("maps win32 platform to windows package", () => {
		expect(getPackageName("win32", "x64")).toBe(`${scope}backlog.md-windows-x64`);
	});

	it("maps win32 arm64 to windows-arm64 package", () => {
		expect(getPackageName("win32", "arm64")).toBe(`${scope}backlog.md-windows-arm64`);
	});

	it("returns linux name unchanged", () => {
		expect(getPackageName("linux", "arm64")).toBe(`${scope}backlog.md-linux-arm64`);
	});

	it("maps darwin arches to darwin packages", () => {
		expect(getPackageName("darwin", "arm64")).toBe(`${scope}backlog.md-darwin-arm64`);
		expect(getPackageName("darwin", "x64")).toBe(`${scope}backlog.md-darwin-x64`);
	});
});

describe("getCandidatePackageNames", () => {
	it("tries the sibling darwin arch after the native one on macOS", () => {
		expect(getCandidatePackageNames("darwin", "arm64", false)).toEqual([
			`${scope}backlog.md-darwin-arm64`,
			`${scope}backlog.md-darwin-x64`,
		]);
		expect(getCandidatePackageNames("darwin", "x64", false)).toEqual([
			`${scope}backlog.md-darwin-x64`,
			`${scope}backlog.md-darwin-arm64`,
		]);
	});

	it("prefers the arm64 hardware arch when the process runs under Rosetta", () => {
		expect(getCandidatePackageNames("darwin", "x64", true)).toEqual([
			`${scope}backlog.md-darwin-arm64`,
			`${scope}backlog.md-darwin-x64`,
		]);
	});

	it("does not add fallbacks on other platforms", () => {
		expect(getCandidatePackageNames("linux", "x64")).toEqual([`${scope}backlog.md-linux-x64`]);
		expect(getCandidatePackageNames("linux", "arm64")).toEqual([`${scope}backlog.md-linux-arm64`]);
		expect(getCandidatePackageNames("win32", "x64")).toEqual([`${scope}backlog.md-windows-x64`]);
	});

	it("does not add fallbacks for unknown darwin arches", () => {
		expect(getCandidatePackageNames("darwin", "ppc64")).toEqual([`${scope}backlog.md-darwin-ppc64`]);
	});
});

describe("resolveBinaryPath", () => {
	it("resolves the native package when it is installed", () => {
		const resolver = resolverFor([`${scope}backlog.md-darwin-arm64/backlog`, `${scope}backlog.md-darwin-x64/backlog`]);
		expect(resolveBinaryPath("darwin", "arm64", resolver)).toBe(
			`/node_modules/${scope}backlog.md-darwin-arm64/backlog`,
		);
	});

	it("falls back to darwin-x64 when arm64 Node only has the x64 package", () => {
		const resolver = resolverFor([`${scope}backlog.md-darwin-x64/backlog`]);
		expect(resolveBinaryPath("darwin", "arm64", resolver)).toBe(`/node_modules/${scope}backlog.md-darwin-x64/backlog`);
	});

	it("falls back to darwin-arm64 when Rosetta x64 Node only has the arm64 package", () => {
		const resolver = resolverFor([`${scope}backlog.md-darwin-arm64/backlog`]);
		expect(resolveBinaryPath("darwin", "x64", resolver)).toBe(`/node_modules/${scope}backlog.md-darwin-arm64/backlog`);
	});

	it("throws the original error when no darwin package is installed", () => {
		expect(() => resolveBinaryPath("darwin", "arm64", resolverFor([]))).toThrow(
			`Cannot find module '${scope}backlog.md-darwin-arm64/backlog'`,
		);
	});

	it("does not fall back across arches on linux", () => {
		const resolver = resolverFor([`${scope}backlog.md-linux-arm64/backlog`]);
		expect(() => resolveBinaryPath("linux", "x64", resolver)).toThrow(
			`Cannot find module '${scope}backlog.md-linux-x64/backlog'`,
		);
	});

	it("resolves the .exe binary on windows", () => {
		const resolver = resolverFor([`${scope}backlog.md-windows-x64/backlog.exe`]);
		expect(resolveBinaryPath("win32", "x64", resolver)).toBe(
			`/node_modules/${scope}backlog.md-windows-x64/backlog.exe`,
		);
	});
});

describe("isRosettaTranslated", () => {
	it("is false off macOS without shelling out", () => {
		expect(isRosettaTranslated("linux")).toBe(false);
		expect(isRosettaTranslated("win32")).toBe(false);
	});

	it("returns a boolean on the current platform", () => {
		expect(typeof isRosettaTranslated()).toBe("boolean");
	});
});
