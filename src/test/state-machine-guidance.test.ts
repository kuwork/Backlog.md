import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { DEFAULT_STATE_MACHINE } from "../core/state-machine.ts";
import {
	composeGuideText,
	composeGuideTextWithProject,
	renderProjectStateMachine,
	renderStateMachineSection,
	STATE_MACHINE_PLACEHOLDER,
} from "../core/state-machine-guidance.ts";
import { FileSystem } from "../file-system/operations.ts";
import { CLI_TASK_EXECUTION_GUIDE, CLI_WORKFLOW_OVERVIEW } from "../guidelines/cli-instructions/index.ts";
import {
	MCP_TASK_EXECUTION_GUIDE,
	MCP_TASK_FINALIZATION_GUIDE,
	MCP_WORKFLOW_OVERVIEW,
	MCP_WORKFLOW_OVERVIEW_TOOLS,
} from "../guidelines/mcp/index.ts";
import { createUniqueTestDir } from "./test-utils.ts";

const HEALTHY_INSPECTION = {
	statuses: DEFAULT_STATE_MACHINE,
	diagnostics: { declared: 7, accepted: 7, rejected: [] },
};

/** Deliberately lint-clean, so a problem block in a test means the test put it there. */
const HEALTHY_CONFIG = `project_name: "Guidance"
statuses:
  - name: To Do
    category: active
    next:
      - to: Done
        when: "人类验收通过"
        ai: forbidden
  - name: Done
    category: done
    exit: complete
    next: []
labels: []
`;

describe("the shipped execution guides carry the machine", () => {
	const texts: Array<[string, string]> = [
		["CLI task execution", CLI_TASK_EXECUTION_GUIDE],
		["MCP task execution", MCP_TASK_EXECUTION_GUIDE],
	];
	const HEADING = "## The Project State Machine (`backlog/config.yml` -> `statuses`)";

	for (const [name, text] of texts) {
		it(`${name} carries the static section and the placeholder for the machine`, () => {
			expect(text).toContain(HEADING);
			expect(text).toContain(STATE_MACHINE_PLACEHOLDER);
			expect(text).toContain("category: active");
			expect(text).toContain('statuses: ["To Do", "In Progress", "Done"]');
			expect(text).toContain("There is no");
		});

		it(`${name} points the reader at the rendered machine and says how to use it`, () => {
			// The format reference alone is not enough: the agent has to be told that the block below is
			// this project's machine, and how a current status decides the next one.
			const instructionAt = text.indexOf("**Using the machine.**");
			expect(instructionAt).toBeGreaterThan(-1);
			expect(instructionAt).toBeLessThan(text.indexOf(STATE_MACHINE_PLACEHOLDER));
			expect(text).toContain("Read its current `status`");
			expect(text).toContain("those edges are the only transitions declared out of it");
			expect(text).toContain("never move along one without an explicit user answer");
			// The no-transitions project is not left to guess either.
			expect(text).toContain("may move between any pair of non-terminal statuses");
		});

		it(`${name} puts the machine before the planning workflow that uses it`, () => {
			const sectionAt = text.indexOf(HEADING);
			const planningAt = text.indexOf("### Planning Workflow");

			expect(sectionAt).toBeGreaterThan(-1);
			expect(sectionAt).toBeLessThan(planningAt);
			expect(text.slice(sectionAt, planningAt)).toContain(STATE_MACHINE_PLACEHOLDER);
		});
	}
});

describe("the shipped overview texts point at the machine", () => {
	const texts: Array<[string, string, string]> = [
		["CLI instructions", CLI_WORKFLOW_OVERVIEW, "backlog instructions task-execution"],
		["MCP overview resource", MCP_WORKFLOW_OVERVIEW, "backlog://workflow/task-execution"],
		["MCP overview tool", MCP_WORKFLOW_OVERVIEW_TOOLS, "backlog://workflow/task-execution"],
	];

	for (const [name, text, pointer] of texts) {
		it(`${name} keeps only a pointer, not the machine itself`, () => {
			expect(text).toContain("## The Project State Machine");
			expect(text).toContain(pointer);
			expect(text).toContain("**`defaultStatus`** must be one of the configured `statuses`");
			expect(text).not.toContain(STATE_MACHINE_PLACEHOLDER);
			expect(text).not.toContain("**Using the machine.**");
			expect(text).not.toContain("category: active");
		});
	}
});

describe("composeGuideText", () => {
	it("swaps the placeholder for the rendered machine", () => {
		const composed = composeGuideText(`intro\n\n${STATE_MACHINE_PLACEHOLDER}\n\noutro\n`, HEALTHY_INSPECTION);

		expect(composed).toContain("intro");
		expect(composed).toContain("outro");
		expect(composed).toContain("## This project's state machine");
		expect(composed).not.toContain(STATE_MACHINE_PLACEHOLDER);
	});

	it("passes a text without the placeholder through untouched", () => {
		const text = "# Nothing to substitute here\n";
		expect(composeGuideText(text, HEALTHY_INSPECTION)).toBe(text);
	});

	it("says the machine is unavailable rather than omitting it", () => {
		expect(composeGuideText(STATE_MACHINE_PLACEHOLDER, null)).toContain("No readable `backlog/config.yml`");
		expect(renderStateMachineSection(null)).toContain("No readable `backlog/config.yml`");
	});

	it("still reports a broken machine instead of throwing", () => {
		const composed = composeGuideText(STATE_MACHINE_PLACEHOLDER, {
			statuses: ["To Do", "In Progress", "Done"],
			diagnostics: {
				declared: 0,
				accepted: 0,
				rejected: [],
				fallback: "the built-in defaults (To Do / In Progress / Done)",
				unreadable: true,
			},
		});

		expect(composed).toContain("### State machine config problem");
		expect(composed).toContain("the fallback every reader uses");
	});
});

describe("the shipped execution guides", () => {
	const guides: Array<[string, string, string]> = [
		["CLI task execution", CLI_TASK_EXECUTION_GUIDE, "backlog instructions task-execution"],
		["MCP task execution", MCP_TASK_EXECUTION_GUIDE, "backlog://workflow/task-execution"],
	];

	for (const [name, text, machinePointer] of guides) {
		it(`${name} follows the machine and points the reader at this guide's rendered machine`, () => {
			expect(text).toContain("state machine");
			expect(text).toContain(machinePointer);
			expect(text).toContain("never set a status the machine does not list");
			expect(text).toContain("`forbidden`");
			// The old universal sequence is gone: no guide tells the reader to just set In Progress.
			expect(text).not.toContain("Mark it in progress and assign yourself");
			expect(text).not.toContain("Mark task as In Progress");
		});
	}

	it("asks for the configured terminal status rather than naming Done", () => {
		expect(MCP_TASK_FINALIZATION_GUIDE).toContain("machine declares terminal");
		expect(MCP_TASK_FINALIZATION_GUIDE).not.toContain('Set status to "Done"');
		expect(MCP_TASK_FINALIZATION_GUIDE).not.toContain('Status transitions to "Done"');
	});
});

describe("the project's own machine", () => {
	let testDir: string;
	let filesystem: FileSystem;

	beforeEach(async () => {
		testDir = createUniqueTestDir("state-machine-guidance");
		await mkdir(join(testDir, "backlog"), { recursive: true });
		filesystem = new FileSystem(testDir);
	});

	afterEach(async () => {
		await rm(testDir, { recursive: true, force: true });
	});

	const write = async (content: string) => {
		await Bun.write(join(testDir, "backlog", "config.yml"), content);
	};

	it("serves the project's statuses inside the execution guide", async () => {
		await write(HEALTHY_CONFIG);
		const composed = await composeGuideTextWithProject(MCP_TASK_EXECUTION_GUIDE, filesystem);

		expect(composed).toContain("| To Do | active | - | shown |");
		expect(composed).toContain("`To Do` -> `Done`");
		expect(composed).not.toContain(STATE_MACHINE_PLACEHOLDER);
		expect(composed).not.toContain("### State machine config problem");
	});

	it("keeps the execution guide coming, and says why, when the statuses block is broken", async () => {
		await write('project_name: "Broken"\nstatuses:\n  - name: "To Do"\n  - category: active\n');
		const composed = await composeGuideTextWithProject(MCP_TASK_EXECUTION_GUIDE, filesystem);

		expect(composed).toContain("### State machine config problem");
		expect(composed).toContain("entry 2: missing or empty `name`");
		// The static half is still there: the AI keeps the format docs even with a broken machine.
		expect(composed).toContain("## The Project State Machine");
	});

	it("renders the machine for injection into the agent instruction files", async () => {
		await write('statuses: ["To Do", "In Progress", "Done"]\n');
		const section = await renderProjectStateMachine(filesystem);

		expect(section).toContain("declares no transitions");
		expect(section).toContain("| Done | done | complete | shown |");
	});

	it("treats a missing project as a broken block, never as a crash", async () => {
		const section = await renderProjectStateMachine(new FileSystem(testDir));

		expect(section).toContain("declares no `statuses` block");
		expect(section).toContain("the fallback every reader uses");
	});

	it("handles having no project source at all", async () => {
		expect(await renderProjectStateMachine(undefined)).toContain("No readable `backlog/config.yml`");
	});
});
