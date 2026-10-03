import type { JsonSchema } from "../../validation/validators.ts";

export const decisionUpdateSchema: JsonSchema = {
	type: "object",
	properties: {
		id: {
			type: "string",
			minLength: 1,
			maxLength: 100,
		},
		content: {
			type: "string",
		},
		appendContent: {
			type: "array",
			items: { type: "string" },
			maxItems: 50,
		},
		status: {
			type: "string",
			minLength: 1,
			maxLength: 50,
		},
	},
	required: ["id"],
	additionalProperties: false,
};

export const decisionListSchema: JsonSchema = {
	type: "object",
	properties: {
		limit: {
			type: "number",
			minimum: 1,
			maximum: 100,
		},
		offset: {
			type: "number",
			minimum: 0,
			description: "Skip this many decisions before returning the window (0-based).",
		},
		status: {
			type: "string",
			maxLength: 50,
			description: "Filter by decision status (proposed, accepted, rejected, superseded).",
		},
		search: {
			type: "string",
			maxLength: 200,
			description: "Case-insensitive substring match against decision id or title.",
		},
	},
	required: [],
	additionalProperties: false,
};
