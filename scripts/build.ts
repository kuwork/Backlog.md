import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { BunPlugin } from "bun";
import tailwind from "bun-plugin-tailwind";

type PackageJson = {
	version: string;
};

const packageJson = (await Bun.file("package.json").json()) as PackageJson;
const outfile = process.env.BACKLOG_BUILD_OUTFILE ?? "dist/backlog";
const version = process.env.BACKLOG_BUILD_VERSION ?? packageJson.version;
const target = process.env.BACKLOG_BUILD_TARGET;
const executablePath = process.env.BACKLOG_BUILD_EXECUTABLE_PATH;
const outputDirectory = dirname(outfile);

// `@duckdb/node-bindings` picks its native binding through a runtime platform switch, but the
// bundler resolves every branch statically. Only the build target's binding is embedded into the
// binary; the other branches are left as external requires that never execute at runtime.
const ALL_DUCKDB_BINDINGS = [
	"@duckdb/node-bindings-darwin-arm64",
	"@duckdb/node-bindings-darwin-x64",
	"@duckdb/node-bindings-linux-arm64",
	"@duckdb/node-bindings-linux-arm64-musl",
	"@duckdb/node-bindings-linux-x64",
	"@duckdb/node-bindings-linux-x64-musl",
	"@duckdb/node-bindings-win32-arm64",
	"@duckdb/node-bindings-win32-x64",
];

function resolveDuckdbTarget(): { platform: string; arch: string; musl: boolean } {
	const match = target ? /^bun-(windows|linux|darwin)-(x64|arm64)/.exec(target) : null;
	const [, rawPlatform, rawArch] = match ?? [];
	const platform = rawPlatform ? (rawPlatform === "windows" ? "win32" : rawPlatform) : process.platform;
	const arch = rawArch ?? process.arch;
	const musl = platform === "linux" && (target?.includes("musl") ?? false);
	return { platform, arch, musl };
}

const duckdbTarget = resolveDuckdbTarget();
const duckdbBinding = `@duckdb/node-bindings-${duckdbTarget.platform}-${duckdbTarget.arch}${duckdbTarget.musl ? "-musl" : ""}`;
try {
	require.resolve(`${duckdbBinding}/duckdb.node`);
} catch {
	console.error(
		`error: DuckDB native binding "${duckdbBinding}" is not installed.\n` +
			"Bun only installs platform-specific optionalDependencies matching the host. " +
			"Install the build target's binding with:\n" +
			`  bun install --os ${duckdbTarget.platform} --cpu ${duckdbTarget.arch}`,
	);
	process.exit(1);
}
const external = ALL_DUCKDB_BINDINGS.filter((name) => name !== duckdbBinding);

// duckdb.node links against a sibling shared library next to it, but a compiled binary extracts
// only the .node (oven-sh/bun#44063). This plugin resolves the virtual module that
// src/duckdb/query.ts requires to the target's library; the file loader embeds it into the
// binary and its default export is the embedded path, which is written out at runtime.
const DUCKDB_SIBLING_NAMES: Record<string, string> = {
	win32: "duckdb.dll",
	linux: "libduckdb.so",
	darwin: "libduckdb.dylib",
};

const duckdbSiblingPlugin: BunPlugin = {
	name: "duckdb-sibling-lib",
	setup(build) {
		build.onResolve({ filter: /^virtual:duckdb-sibling-lib$/ }, () => ({
			path: require.resolve(`${duckdbBinding}/${DUCKDB_SIBLING_NAMES[duckdbTarget.platform]}`),
		}));
	},
};

if (outputDirectory !== ".") {
	await mkdir(outputDirectory, { recursive: true });
}

const result = await Bun.build({
	entrypoints: ["src/cli.ts"],
	target: "bun",
	minify: true,
	define: {
		__EMBEDDED_VERSION__: JSON.stringify(version),
		"process.env.NODE_ENV": JSON.stringify("production"),
	},
	external,
	plugins: [tailwind, duckdbSiblingPlugin],
	compile: {
		outfile,
		...(target ? { target: target as Bun.Build.CompileTarget } : {}),
		...(executablePath ? { executablePath } : {}),
	},
	throw: false,
});

if (!result.success) {
	for (const log of result.logs) {
		console.error(log);
	}
	process.exit(1);
}
