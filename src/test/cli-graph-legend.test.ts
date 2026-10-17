import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { loadLegendConfig, saveLegendConfig } from "../graph/legend-store.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
const CLI_PATH = join(process.cwd(), "src", "cli.ts");
const normalize = (output: string) => output.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

/** Make TEST_DIR a minimal Backlog.md project so `requireProjectRoot` resolves to it (not the repo root). */
async function initProject(dir: string): Promise<void> {
	const backlogDir = join(dir, "backlog");
	await mkdir(backlogDir, { recursive: true });
	// A config file (not just the directory) is what marks a directory as a project root.
	await writeFile(join(backlogDir, "config.yml"), "project_name: test-legend\n", "utf8");
}

describe("CLI graph legend (BACK-808)", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-cli-legend");
		await mkdir(TEST_DIR, { recursive: true });
		await initProject(TEST_DIR);
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {
			// best effort
		}
	});

	const SAMPLE = { types: { FileNode: { color: "#ff0000", caption: "Task" } } };

	it("get on an unknown database prints a clear no-config message and exits 0", async () => {
		const result = await $`bun ${CLI_PATH} graph legend get demo`.cwd(TEST_DIR).nothrow().quiet();
		const output = normalize(result.stdout.toString() + result.stderr.toString());
		expect(result.exitCode).toBe(0);
		expect(output).toContain("尚无图例配置");
	});

	it("get --json on an unknown database prints null and exits 0", async () => {
		const result = await $`bun ${CLI_PATH} graph legend get demo --json`.cwd(TEST_DIR).nothrow().quiet();
		expect(result.exitCode).toBe(0);
		expect(result.stdout.toString().trim()).toBe("null");
	});

	it("get without --json prints a human-readable summary, not the raw JSON", async () => {
		saveLegendConfig(TEST_DIR, "demo", SAMPLE);
		const result = await $`bun ${CLI_PATH} graph legend get demo`.cwd(TEST_DIR).nothrow().quiet();
		expect(result.exitCode).toBe(0);
		const out = result.stdout.toString();
		expect(out).toContain("图例配置（数据库 demo）");
		expect(out).toContain("FileNode");
		expect(out).toContain("#ff0000");
		expect(out).toContain("Task");
		// The default output is a summary, not the raw JSON body.
		expect(out).not.toContain('"types"');
		expect(out.trimStart().startsWith("{")).toBe(false);
	});

	it("get without --json renders rules, relations and hidden buckets readably", async () => {
		const rich = {
			captionsVisible: false,
			types: {
				Person: {
					caption: "{{name}}",
					color: "#204af3",
					rules: [{ id: "r1", name: "Young", expression: "age < 30", color: "#111111" }],
				},
				Project: { caption: "", rules: [] },
			},
			relations: { DEPENDS_ON: { dash: "dashed", arrow: "both", name: "依赖", color: "#999999" } },
			hidden: ["t:Person|s:rule:other"],
		};
		saveLegendConfig(TEST_DIR, "demo", rich);
		const result = await $`bun ${CLI_PATH} graph legend get demo`.cwd(TEST_DIR).nothrow().quiet();
		expect(result.exitCode).toBe(0);
		const out = result.stdout.toString();
		expect(out).toContain("节点标题：隐藏");
		expect(out).toContain("{{name}}");
		expect(out).toContain("Young");
		expect(out).toContain("age < 30");
		expect(out).toContain("依赖");
		expect(out).toContain("虚线");
		expect(out).toContain("两端");
		expect(out).toContain("t:Person|s:rule:other");
	});

	it("set from a YAML file stores the config and get --json reads it back", async () => {
		const file = join(TEST_DIR, "legend.yaml");
		await writeFile(
			file,
			["types:", "  FileNode:", '    color: "#ff0000"', "    caption: Task", ""].join("\n"),
			"utf8",
		);

		const setResult = await $`bun ${CLI_PATH} graph legend set demo ${file}`.cwd(TEST_DIR).nothrow().quiet();
		expect(setResult.exitCode).toBe(0);
		expect(setResult.stdout.toString()).toContain("已保存");

		const getResult = await $`bun ${CLI_PATH} graph legend get demo --json`.cwd(TEST_DIR).nothrow().quiet();
		expect(getResult.exitCode).toBe(0);
		expect(JSON.parse(getResult.stdout.toString())).toEqual(SAMPLE);

		// Same file the server reads through: proves CLI and web share the store.
		expect(loadLegendConfig(TEST_DIR, "demo")).toEqual(SAMPLE);
		// The store file is block-style YAML, not JSON.
		const stored = await Bun.file(join(TEST_DIR, "backlog", "databases", "graph-legends.yaml")).text();
		expect(stored).toContain("demo:");
		expect(stored.trimStart().startsWith("{")).toBe(false);
	});

	it("set --stdin reads the YAML from standard input and stores it", async () => {
		const setResult =
			await $`echo ${'types:\n  FileNode:\n    color: "#ff0000"\n    caption: Task'} | bun ${CLI_PATH} graph legend set demo --stdin`
				.cwd(TEST_DIR)
				.nothrow()
				.quiet();
		expect(setResult.exitCode).toBe(0);

		const getResult = await $`bun ${CLI_PATH} graph legend get demo --json`.cwd(TEST_DIR).nothrow().quiet();
		expect(JSON.parse(getResult.stdout.toString())).toEqual(SAMPLE);
	});

	it("set also accepts a JSON payload (YAML is a superset of JSON)", async () => {
		const setResult = await $`echo ${JSON.stringify(SAMPLE)} | bun ${CLI_PATH} graph legend set demo --stdin`
			.cwd(TEST_DIR)
			.nothrow()
			.quiet();
		expect(setResult.exitCode).toBe(0);
		expect(loadLegendConfig(TEST_DIR, "demo")).toEqual(SAMPLE);
	});

	it("set with invalid YAML exits non-zero and leaves the store untouched", async () => {
		const setResult = await $`echo ${"types: [FileNode"} | bun ${CLI_PATH} graph legend set demo --stdin`
			.cwd(TEST_DIR)
			.nothrow()
			.quiet();
		expect(setResult.exitCode).not.toBe(0);
		expect(setResult.stderr.toString()).toContain("合法的 YAML");

		// Store file must not have been created by a failed write.
		expect(loadLegendConfig(TEST_DIR, "demo")).toBeNull();
	});

	it("set with a non-mapping YAML payload exits non-zero and leaves the store untouched", async () => {
		const setResult = await $`echo ${"[1, 2, 3]"} | bun ${CLI_PATH} graph legend set demo --stdin`
			.cwd(TEST_DIR)
			.nothrow()
			.quiet();
		expect(setResult.exitCode).not.toBe(0);
		expect(setResult.stderr.toString()).toContain("YAML 映射");
		expect(loadLegendConfig(TEST_DIR, "demo")).toBeNull();
	});

	it("remove deletes an existing entry and is idempotent on an absent one", async () => {
		saveLegendConfig(TEST_DIR, "demo", SAMPLE);
		const removeResult = await $`bun ${CLI_PATH} graph legend remove demo`.cwd(TEST_DIR).nothrow().quiet();
		expect(removeResult.exitCode).toBe(0);
		expect(removeResult.stdout.toString()).toContain("已移除");
		expect(loadLegendConfig(TEST_DIR, "demo")).toBeNull();

		const removeAgain = await $`bun ${CLI_PATH} graph legend remove demo`.cwd(TEST_DIR).nothrow().quiet();
		expect(removeAgain.exitCode).toBe(0);
		expect(removeAgain.stdout.toString()).toContain("无需移除");
	});

	it("round-trips with the server-side reader: a direct write is visible to get", async () => {
		// The web panel/server write through saveLegendConfig; the CLI must observe the same file.
		saveLegendConfig(TEST_DIR, "demo", SAMPLE);
		const getResult = await $`bun ${CLI_PATH} graph legend get demo --json`.cwd(TEST_DIR).nothrow().quiet();
		expect(JSON.parse(getResult.stdout.toString())).toEqual(SAMPLE);
	});
});
