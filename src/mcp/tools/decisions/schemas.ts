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
