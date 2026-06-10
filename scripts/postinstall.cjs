#!/usr/bin/env node

const { spawnSync } = require("node:child_process");
const { existsSync } = require("node:fs");

// Only run in development (git repo), skip when installed from npm registry
if (!existsSync(".git")) {
	process.exit(0);
}

function commandExists(cmd) {
	const isWin = process.platform === "win32";
	const result = isWin
		? spawnSync("where", [cmd], { stdio: "ignore", windowsHide: true })
		: spawnSync("sh", ["-c", `command -v ${cmd} >/dev/null 2>&1`], {
				stdio: "ignore",
				windowsHide: true,
			});
	return result.status === 0;
}

if (commandExists("bun2nix")) {
	const result = spawnSync("bun2nix", ["-o", "bun.nix"], {
		stdio: "inherit",
		windowsHide: true,
	});
	if (result.status === 0) process.exit(0);
} else if (commandExists("nix")) {
	spawnSync(
		"nix",
		[
			"--extra-experimental-features",
			"nix-command flakes",
			"run",
			"github:baileyluTCD/bun2nix/85d692d68a5345d868d3bb1158b953d2996d70f7",
			"--",
			"-o",
			"bun.nix",
		],
		{ stdio: "inherit", windowsHide: true },
	);
	// Intentionally ignore failures - this is an optional step
}
