#!/usr/bin/env node

const { spawn } = require("node:child_process");
const { PLATFORM_ARCHES, getPackageName } = require("./resolveBinary.cjs");

// Platform-specific packages to uninstall, named like the resolver expects them
const platformPackages = PLATFORM_ARCHES.map(([platform, arch]) => getPackageName(platform, arch));

// Detect package manager
const packageManager = process.env.npm_config_user_agent?.split("/")[0] || "npm";

console.log("Cleaning up platform-specific packages...");

// Try to uninstall all platform packages
for (const pkg of platformPackages) {
	const args = packageManager === "bun" ? ["remove", "-g", pkg] : ["uninstall", "-g", pkg];

	const child = spawn(packageManager, args, {
		stdio: "pipe", // Don't show output to avoid spam
		windowsHide: true,
	});

	child.on("exit", (code) => {
		if (code === 0) {
			console.log(`✓ Cleaned up ${pkg}`);
		}
		// Silently ignore failures - package might not be installed
	});
}

console.log("Platform package cleanup completed.");
