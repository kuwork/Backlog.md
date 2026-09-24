import { relative } from "node:path";
import { FileSystem } from "../../../src/file-system/operations";
import { CLI_DOCUMENTS_GUIDE, CLI_TASK_CREATION_GUIDE } from "../../../src/guidelines/cli-instructions/index";
import { MCP_DOCUMENTS_GUIDE, MCP_TASK_CREATION_GUIDE } from "../../../src/guidelines/mcp/index";

const ROOT = process.cwd();
const fs = new FileSystem(ROOT);
const BACKLOG = "backlog";

let failures = 0;
const ok = (label: string, detail = "") => console.log(`  PASS  ${label}${detail ? `  ${detail}` : ""}`);
const bad = (label: string, detail: string) => {
	failures += 1;
	console.log(`  FAIL  ${label}  ${detail}`);
};

const agentGuidelines = await Bun.file(`${ROOT}/src/guidelines/agent-guidelines.md`).text();
const guides: Array<[string, string]> = [
	["cli task-creation", CLI_TASK_CREATION_GUIDE],
	["mcp task-creation", MCP_TASK_CREATION_GUIDE],
	["cli documents", CLI_DOCUMENTS_GUIDE],
	["mcp documents", MCP_DOCUMENTS_GUIDE],
	["agent-guidelines", agentGuidelines],
];

const suffixPattern = /^([^:]+?)(?::(\d+)(?:-(\d+))?)?$/;

/** Mirrors Server.handleGetPreview: entity type + id -> project-relative file path. */
async function entityFilePath(type: string, id: string): Promise<string | undefined> {
	switch (type) {
		case "task": {
			const task = await fs.loadTask(id);
			return task?.filePath ? relative(ROOT, task.filePath).replace(/\\/g, "/") : undefined;
		}
		case "draft": {
			const draft = await fs.loadDraft(id);
			return draft?.filePath ? relative(ROOT, draft.filePath).replace(/\\/g, "/") : undefined;
		}
		case "doc": {
			const doc = await fs.loadDocument(id);
			return `${BACKLOG}/docs/${doc.path}`;
		}
		case "decision": {
			const decision = await fs.loadDecision(id);
			return decision?.path ? `${BACKLOG}/decisions/${decision.path}` : undefined;
		}
		case "wiki":
			return `${BACKLOG}/wiki/${id.endsWith(".md") ? id : `${id}.md`}`;
		default:
			return undefined;
	}
}

// --- 1) Markdown link examples in the guides
console.log("\n[1] link examples documented in the guides resolve the way the web preview resolves them");
const linkTargets = new Map<string, string[]>();
for (const [name, text] of guides) {
	for (const match of text.matchAll(/\]\(([^)\s]+)\)/g)) {
		const target = match[1]!;
		if (target.startsWith("#") || /^https?:/.test(target)) continue;
		const seenBy = linkTargets.get(target) ?? [];
		if (!seenBy.includes(name)) seenBy.push(name);
		linkTargets.set(target, seenBy);
	}
}

const entityLink = /^\/(task|draft|documentation|decisions|wiki)\/(.+)$/;
let linkCount = 0;
for (const [target, seenBy] of linkTargets) {
	// Only line-suffixed links are in scope for this task; unsuffixed item links are pre-existing examples.
	const entity = target.match(entityLink);
	let filePath: string | undefined;
	let suffix = "";
	let label = target;

	if (entity) {
		const parsed = entity[2]!.match(suffixPattern);
		if (!parsed?.[2]) continue;
		const type = entity[1] === "documentation" ? "doc" : entity[1] === "decisions" ? "decision" : entity[1]!;
		filePath = await entityFilePath(type, parsed[1]!);
		suffix = `:${parsed[2]}${parsed[3] ? `-${parsed[3]}` : ""}`;
	} else {
		const parsed = target.match(suffixPattern);
		if (!parsed) continue;
		// Only text sources take a line range; images and other assets are out of scope.
		if (!/\.(ts|tsx|js|jsx|md|json|yml|yaml|css)$/.test(parsed[1]!)) continue;
		filePath = parsed[1]!;
		suffix = parsed[2] ? `:${parsed[2]}${parsed[3] ? `-${parsed[3]}` : ""}` : "";
	}

	linkCount += 1;
	if (!filePath) {
		bad(label, "entity did not resolve");
		continue;
	}
	const expected = suffix.match(/^:(\d+)(?:-(\d+))?$/);
	try {
		const result = await fs.readProjectFile(`${filePath}${suffix}`);
		const wantStart = expected ? Number.parseInt(expected[1]!, 10) : undefined;
		const wantEnd = expected ? Number.parseInt(expected[2] ?? expected[1]!, 10) : undefined;
		const rangeOk = result.lineStart === wantStart && result.lineEnd === wantEnd;
		if (rangeOk) {
			ok(`${label} (${seenBy.join(", ")})`, `${filePath}${suffix} -> lines ${result.lineStart ?? "-"}-${result.lineEnd ?? "-"}/${result.totalLines}`);
		} else {
			bad(`${label} (${seenBy.join(", ")})`, `expected ${wantStart}-${wantEnd}, got ${result.lineStart}-${result.lineEnd}`);
		}
	} catch (error) {
		bad(`${label} (${seenBy.join(", ")})`, error instanceof Error ? error.message : String(error));
	}
}
console.log(`  checked ${linkCount} line-suffixed / file link targets`);

// --- 2) --ref values in the task creation guides
console.log("\n[2] --ref values documented in the task creation guides");
const refValues: string[] = [];
for (const [name, text] of guides) {
	for (const line of text.split("\n")) {
		for (const match of line.matchAll(/--(?:add-|remove-)?ref\s+(\S+)/g)) {
			const value = match[1]!.replace(/^["'`]|["'`,.)]+$/g, "");
			if (value === "\\") continue; // line continuation
			// The guides must never show the comma form: a comma splits one entry into two.
			if (value.includes(",")) {
				bad(`${name}: comma inside a ref value`, value);
				continue;
			}
			refValues.push(value);
			if (/^https?:\/\//.test(value)) continue;
			try {
				const result = await fs.readProjectFile(value);
				ok(`${name}: ${value}`, `lines ${result.lineStart ?? 1}-${result.lineEnd ?? result.totalLines} of ${result.totalLines}`);
			} catch (error) {
				bad(`${name}: ${value}`, error instanceof Error ? error.message : String(error));
			}
		}
	}
}
console.log(`  checked ${refValues.length} values`);

// --- 3) No placeholder paths left in reference values
console.log("\n[3] placeholder paths in reference values");
for (const token of ["src/api.ts", "src/foo.ts", "new-ref.md", "old-ref.md", "example.com/spec"]) {
	const offenders = refValues.filter((value) => value.includes(token) && !value.startsWith("https://github.com/"));
	if (offenders.length === 0) ok(`no ${token} in any ref value`);
	else bad(`no ${token} in any ref value`, offenders.join(", "));
}

console.log(failures === 0 ? "\nRESULT: all checks passed" : `\nRESULT: ${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
