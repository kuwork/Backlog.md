import { afterEach, describe, expect, it } from "bun:test";
import { homedir } from "node:os";
import { join, sep } from "node:path";
import { graphCacheDir } from "../graph/paths.ts";
import { backlogCacheDir, resolveCacheBaseDir } from "../utils/cache-dir.ts";
import { NO_CACHE_ENV } from "../utils/cache-policy.ts";

const originalPlatform = process.platform;
const originalEnv = {
	LOCALAPPDATA: process.env.LOCALAPPDATA,
	XDG_CACHE_HOME: process.env.XDG_CACHE_HOME,
};

function setPlatform(value: NodeJS.Platform): void {
	Object.defineProperty(process, "platform", { value, configurable: true });
}

function setEnv(name: string, value: string | undefined): void {
	if (value === undefined) delete process.env[name];
	else process.env[name] = value;
}

afterEach(() => {
	setPlatform(originalPlatform);
	setEnv("LOCALAPPDATA", originalEnv.LOCALAPPDATA);
	setEnv("XDG_CACHE_HOME", originalEnv.XDG_CACHE_HOME);
	delete process.env[NO_CACHE_ENV];
});

describe("cache directory resolution", () => {
	it("uses %LOCALAPPDATA% on Windows", () => {
		setPlatform("win32");
		setEnv("LOCALAPPDATA", "C:\\Users\\me\\AppData\\Local");
		setEnv("XDG_CACHE_HOME", undefined);
		expect(resolveCacheBaseDir()).toBe("C:\\Users\\me\\AppData\\Local");
	});

	it("falls back to AppData/Local on Windows without %LOCALAPPDATA%", () => {
		setPlatform("win32");
		setEnv("LOCALAPPDATA", undefined);
		setEnv("XDG_CACHE_HOME", undefined);
		expect(resolveCacheBaseDir()).toBe(join(homedir(), "AppData", "Local"));
	});

	it("uses Library/Caches on macOS, not ~/.cache, when XDG is unset", () => {
		setPlatform("darwin");
		setEnv("LOCALAPPDATA", undefined);
		setEnv("XDG_CACHE_HOME", undefined);
		expect(resolveCacheBaseDir()).toBe(join(homedir(), "Library", "Caches"));
	});

	it("honours an explicit $XDG_CACHE_HOME on every platform", () => {
		for (const platform of ["darwin", "linux", "win32"] as const) {
			setPlatform(platform);
			setEnv("LOCALAPPDATA", undefined);
			setEnv("XDG_CACHE_HOME", "/tmp/xdg-cache");
			expect(resolveCacheBaseDir()).toBe("/tmp/xdg-cache");
		}
	});

	it("uses ~/.cache on Linux when XDG is unset", () => {
		setPlatform("linux");
		setEnv("LOCALAPPDATA", undefined);
		setEnv("XDG_CACHE_HOME", undefined);
		expect(resolveCacheBaseDir()).toBe(join(homedir(), ".cache"));
	});

	it("keeps every cache under the shared backlog.md namespace", () => {
		setPlatform("linux");
		setEnv("LOCALAPPDATA", undefined);
		setEnv("XDG_CACHE_HOME", "/tmp/xdg-cache");
		expect(backlogCacheDir()).toBe(join("/tmp/xdg-cache", "backlog.md"));
		for (const name of ["task-cache", "branch-cache", "content-cache", "web-bundle"]) {
			expect(backlogCacheDir(name).startsWith(join(resolveCacheBaseDir(), "backlog.md") + sep)).toBe(true);
		}
	});

	// The graph cache had its own copy of the platform switch, which ignored $XDG_CACHE_HOME on
	// macOS and Windows. It now has to answer exactly like every other cache.
	it("resolves the graph cache through the same root", () => {
		const savedOverride = process.env.BACKLOG_GRAPH_CACHE_DIR;
		delete process.env.BACKLOG_GRAPH_CACHE_DIR;
		try {
			setPlatform("darwin");
			setEnv("LOCALAPPDATA", undefined);
			setEnv("XDG_CACHE_HOME", undefined);
			expect(graphCacheDir()).toBe(join(homedir(), "Library", "Caches", "backlog.md", "graph"));

			setEnv("XDG_CACHE_HOME", "/tmp/xdg-cache");
			expect(graphCacheDir()).toBe(join("/tmp/xdg-cache", "backlog.md", "graph"));
		} finally {
			if (savedOverride !== undefined) process.env.BACKLOG_GRAPH_CACHE_DIR = savedOverride;
		}
	});
});
