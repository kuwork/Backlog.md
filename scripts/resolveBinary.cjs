const { execFileSync } = require("node:child_process");

let ownPackageName;
/**
 * The name of the main package this launcher was published in, read from its own
 * package.json. The launcher ships at the main package root (published layout) or
 * one directory below it (repo layout). Falls back to "" when neither exists.
 */
function getOwnPackageName() {
	if (ownPackageName === undefined) {
		ownPackageName = "";
		for (const candidate of ["./package.json", "../package.json"]) {
			try {
				const pkg = require(candidate);
				if (typeof pkg.name === "string") {
					ownPackageName = pkg.name;
					break;
				}
			} catch {
				// Try the next candidate location.
			}
		}
	}
	return ownPackageName;
}

/** "@scope/" when the package is published under a scope, "" otherwise. */
function scopePrefixOf(packageName) {
	const slash = packageName.indexOf("/");
	return packageName.startsWith("@") && slash > 1 ? packageName.slice(0, slash + 1) : "";
}

/** [platform, arch] pairs that have published platform packages. */
const PLATFORM_ARCHES = [
	["linux", "x64"],
	["linux", "arm64"],
	["darwin", "x64"],
	["darwin", "arm64"],
	["win32", "x64"],
	["win32", "arm64"],
];

function mapPlatform(platform = process.platform) {
	switch (platform) {
		case "win32":
			return "windows";
		case "darwin":
		case "linux":
			return platform;
		default:
			return platform;
	}
}

function mapArch(arch = process.arch) {
	switch (arch) {
		case "x64":
		case "arm64":
			return arch;
		default:
			return arch;
	}
}

function getPackageName(platform = process.platform, arch = process.arch) {
	return `${scopePrefixOf(getOwnPackageName())}backlog.md-${mapPlatform(platform)}-${mapArch(arch)}`;
}

/**
 * Package names to try, in order. On macOS both darwin variants are candidates
 * because the OS can run whichever one is actually installed (natively or via
 * Rosetta 2). A Rosetta-translated process reports x64 while the hardware is
 * arm64, so under Rosetta the arm64 (hardware) package comes first.
 */
function getCandidatePackageNames(
	platform = process.platform,
	arch = process.arch,
	rosetta = isRosettaTranslated(platform),
) {
	if (platform !== "darwin" || (arch !== "arm64" && arch !== "x64")) {
		return [getPackageName(platform, arch)];
	}
	const primary = rosetta ? "arm64" : arch;
	return [getPackageName(platform, primary), getPackageName(platform, primary === "arm64" ? "x64" : "arm64")];
}

/** True when the current process runs under Rosetta 2 translation on macOS. */
function isRosettaTranslated(platform = process.platform) {
	if (platform !== "darwin") return false;
	try {
		return execFileSync("/usr/sbin/sysctl", ["-in", "sysctl.proc_translated"], { encoding: "utf8" }).trim() === "1";
	} catch {
		return false;
	}
}

function resolveBinaryPath(platform = process.platform, arch = process.arch, resolver = require.resolve) {
	const binary = `backlog${platform === "win32" ? ".exe" : ""}`;
	let firstError;
	for (const packageName of getCandidatePackageNames(platform, arch)) {
		try {
			return resolver(`${packageName}/${binary}`);
		} catch (error) {
			firstError ??= error;
		}
	}
	throw firstError;
}

module.exports = {
	PLATFORM_ARCHES,
	getCandidatePackageNames,
	getOwnPackageName,
	getPackageName,
	isRosettaTranslated,
	resolveBinaryPath,
	scopePrefixOf,
};
