import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	createDatabase,
	DEFAULT_DATABASE,
	dropDatabase,
	listDatabases,
	readRegistry,
	resolveDatabase,
	userDatabasesDir,
	validateDatabaseName,
} from "../graph/databases";

describe("graph database registry", () => {
	let root: string;

	beforeEach(async () => {
		root = await mkdtemp(join(tmpdir(), "backlog-databases-"));
		await mkdir(join(root, "backlog"), { recursive: true });
	});

	afterEach(async () => {
		await rm(root, { recursive: true, force: true });
	});

	test("`default` is reserved and malformed names are rejected", () => {
		expect(validateDatabaseName(DEFAULT_DATABASE)).not.toBeNull();
		expect(validateDatabaseName("1bad")).not.toBeNull();
		expect(validateDatabaseName("bad name")).not.toBeNull();
		expect(validateDatabaseName("")).not.toBeNull();
		expect(validateDatabaseName("good_name-1")).toBeNull();
	});

	test("user databases live under the backlog directory (so they travel with the project)", () => {
		expect(userDatabasesDir(root)).toBe(join(root, "backlog", "databases"));
	});

	test("create registers a database, writes an empty snapshot and appears in list", () => {
		const created = createDatabase(root, "demo", "demo data");
		expect(created.kind).toBe("user");
		expect(created.description).toBe("demo data");
		expect(existsSync(created.source.snapshotPath)).toBe(true);

		const listed = listDatabases(root);
		expect(listed.map((db) => db.name)).toEqual([DEFAULT_DATABASE, "demo"]);
		expect(listed[0]?.kind).toBe("derived");
		expect(listed[1]?.source.snapshotPath).toBe(created.source.snapshotPath);
	});

	test("a duplicate create throws and drop removes the entry and the snapshot", () => {
		createDatabase(root, "demo", "x");
		expect(() => createDatabase(root, "demo", "y")).toThrow();
		const snapshot = resolveDatabase(root, "demo").source.snapshotPath;
		dropDatabase(root, "demo");
		expect(existsSync(snapshot)).toBe(false);
		expect(readRegistry(root).databases).toEqual({});
	});

	test("dropping `default` is refused", () => {
		expect(() => dropDatabase(root, DEFAULT_DATABASE)).toThrow();
	});

	test("resolving an unknown database names the ones that exist", () => {
		createDatabase(root, "demo", "x");
		expect(() => resolveDatabase(root, "nope")).toThrow(/demo/);
	});
});
