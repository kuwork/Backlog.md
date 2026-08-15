import { describe, expect, it } from "bun:test";
import { resolveBrowserLaunchCommand } from "../utils/browser-launch.ts";

const URL = "http://localhost:6420";

describe("resolveBrowserLaunchCommand", () => {
	it("uses BROWSER as a single executable with the URL as a separate argument", () => {
		expect(resolveBrowserLaunchCommand(URL, { BROWSER: "/usr/bin/custom-browser" }, "linux")).toEqual([
			"/usr/bin/custom-browser",
			URL,
		]);
	});

	it("trims whitespace around the BROWSER value", () => {
		expect(resolveBrowserLaunchCommand(URL, { BROWSER: "  /opt/browser  " }, "linux")).toEqual(["/opt/browser", URL]);
	});

	it("strips matching wrapping quotes from the BROWSER value", () => {
		expect(resolveBrowserLaunchCommand(URL, { BROWSER: '"/opt/Browser App/browser"' }, "linux")).toEqual([
			"/opt/Browser App/browser",
			URL,
		]);
		expect(resolveBrowserLaunchCommand(URL, { BROWSER: "'/opt/browser'" }, "linux")).toEqual(["/opt/browser", URL]);
	});

	it("does not split or shell-evaluate BROWSER arguments", () => {
		expect(resolveBrowserLaunchCommand(URL, { BROWSER: "browser --new-window --incognito" }, "linux")).toEqual([
			"browser --new-window --incognito",
			URL,
		]);
	});

	it("falls back to platform openers when BROWSER is unset, empty, or whitespace-only", () => {
		expect(resolveBrowserLaunchCommand(URL, {}, "darwin")).toEqual(["open", URL]);
		expect(resolveBrowserLaunchCommand(URL, {}, "win32")).toEqual(["cmd", "/c", "start", "", URL]);
		expect(resolveBrowserLaunchCommand(URL, {}, "linux")).toEqual(["xdg-open", URL]);
		expect(resolveBrowserLaunchCommand(URL, { BROWSER: "" }, "linux")).toEqual(["xdg-open", URL]);
		expect(resolveBrowserLaunchCommand(URL, { BROWSER: " \t " }, "linux")).toEqual(["xdg-open", URL]);
	});

	it("treats an empty quoted string as unset and falls back", () => {
		expect(resolveBrowserLaunchCommand(URL, { BROWSER: '""' }, "linux")).toEqual(["xdg-open", URL]);
	});
});
