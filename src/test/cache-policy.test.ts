import { afterEach, describe, expect, it } from "bun:test";
import { isCacheDisabled, NO_CACHE_ENV, setCacheDisabled } from "../utils/cache-policy.ts";

describe("no-cache policy", () => {
	afterEach(() => {
		delete process.env[NO_CACHE_ENV];
	});

	it("reads the truthy spellings the flag and a manual export can produce", () => {
		expect(isCacheDisabled()).toBe(false);
		for (const value of ["1", "true", "TRUE", " yes "]) {
			process.env[NO_CACHE_ENV] = value;
			expect(isCacheDisabled()).toBe(true);
		}
		for (const value of ["0", "false", "no", ""]) {
			process.env[NO_CACHE_ENV] = value;
			expect(isCacheDisabled()).toBe(false);
		}
	});

	it("toggles the switch for the process", () => {
		setCacheDisabled(true);
		expect(isCacheDisabled()).toBe(true);
		setCacheDisabled(false);
		expect(isCacheDisabled()).toBe(false);
	});
});
