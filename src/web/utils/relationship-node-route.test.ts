import { describe, expect, test } from "bun:test";
import { relationshipNodeRoute } from "../components/TaskDependencyGraph";

describe("relationshipNodeRoute", () => {
	test("routes a milestone node to the milestone details modal", () => {
		expect(relationshipNodeRoute("m-3", "milestone")).toBe("/milestone/m-3");
	});

	test("encodes the milestone id for safe URLs", () => {
		expect(relationshipNodeRoute("m/3 a", "milestone")).toBe("/milestone/m%2F3%20a");
	});

	test("returns null for task and draft nodes so the caller drills into its corpus", () => {
		expect(relationshipNodeRoute("BACK-1", "task")).toBeNull();
		expect(relationshipNodeRoute("DRAFT-2", "draft")).toBeNull();
	});

	test("returns null when the kind is unknown", () => {
		expect(relationshipNodeRoute("BACK-1", undefined)).toBeNull();
	});
});
