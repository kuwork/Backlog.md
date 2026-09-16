import { describe, expect, it } from "bun:test";
import {
	CommentsManager,
	extractStructuredSection,
	updateStructuredSections,
} from "../markdown/structured-sections.ts";

function roundTripNotes(notes: string): string | undefined {
	const content = updateStructuredSections("# Task\n", { implementationNotes: notes });
	return extractStructuredSection(content, "implementationNotes");
}

describe("fenced code blocks preserve consecutive blank lines in notes", () => {
	it("keeps blank lines inside a backtick fence", () => {
		const notes = ["Steps:", "", "```sh", "echo one", "", "", "echo two", "```", "", "Done."].join("\n");
		expect(roundTripNotes(notes)).toBe(notes);
	});

	it("keeps blank lines inside a tilde fence", () => {
		const notes = ["~~~text", "first", "", "", "", "second", "~~~"].join("\n");
		expect(roundTripNotes(notes)).toBe(notes);
	});

	it("treats an unterminated fence as protecting the rest of the notes", () => {
		const notes = ["Intro paragraph.", "", "```", "line", "", "", "still fenced"].join("\n");
		expect(roundTripNotes(notes)).toBe(notes);
	});

	it("keeps blank lines around section-shaped lines that sit inside a fence", () => {
		const notes = ["```md", "<!-- SECTION:NOTES:BEGIN -->", "", "", "body", "```"].join("\n");
		expect(roundTripNotes(notes)).toBe(notes);
	});

	it("still collapses runs of blank lines in prose", () => {
		const notes = ["First.", "", "", "", "Second."].join("\n");
		expect(roundTripNotes(notes)).toBe("First.\n\nSecond.");
	});

	it("keeps fenced blank lines when an existing notes section is replaced", () => {
		const existing = [
			"# Task",
			"",
			"## Implementation Notes",
			"",
			"<!-- SECTION:NOTES:BEGIN -->",
			"old body",
			"",
			"",
			"old tail",
			"<!-- SECTION:NOTES:END -->",
		].join("\n");
		const notes = ["```sh", "one", "", "", "two", "```"].join("\n");

		const updated = updateStructuredSections(existing, { implementationNotes: notes });

		expect(extractStructuredSection(updated, "implementationNotes")).toBe(notes);
	});

	it("keeps fenced blank lines through a comments parse and rewrite cycle", () => {
		const body = "```sh\none\n\n\ntwo\n```";
		const first = CommentsManager.updateContent("# Task\n", [{ body, index: 1, createdDate: "" }]);
		const parsed = CommentsManager.parseAllComments(first);
		const second = CommentsManager.updateContent(first, parsed);

		expect(second).toContain("one\n\n\ntwo");
	});

	it("still collapses blank line runs in comment prose", () => {
		const body = "First.\n\n\nSecond.";
		const updated = CommentsManager.updateContent("# Task\n", [{ body, index: 1, createdDate: "" }]);

		expect(updated).toContain("First.\n\nSecond.");
	});
});
