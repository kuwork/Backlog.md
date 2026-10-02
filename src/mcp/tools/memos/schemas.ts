import type { JsonSchema } from "../../validation/validators.ts";

export const memoListSchema: JsonSchema = {
	type: "object",
	properties: {
		limit: {
			type: "number",
			minimum: 1,
			maximum: 100,
		},
		cursor: {
			type: "string",
			maxLength: 100,
		},
		date: {
			type: "string",
			maxLength: 10,
		},
		tags: {
			type: "array",
			items: { type: "string", maxLength: 100 },
			maxItems: 50,
		},
	},
	required: [],
	additionalProperties: false,
};

export const memoViewSchema: JsonSchema = {
	type: "object",
	properties: {
		id: {
			type: "string",
			minLength: 1,
			maxLength: 100,
		},
	},
	required: ["id"],
	additionalProperties: false,
};

export const memoCreateSchema: JsonSchema = {
	type: "object",
	properties: {
		content: {
			type: "string",
			minLength: 1,
		},
		tags: {
			type: "array",
			items: { type: "string", maxLength: 100 },
			maxItems: 50,
		},
	},
	required: ["content"],
	additionalProperties: false,
};

export const memoUpdateSchema: JsonSchema = {
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
		append: {
			type: "string",
		},
		tags: {
			type: "array",
			items: { type: "string", maxLength: 100 },
			maxItems: 50,
		},
	},
	required: ["id"],
	additionalProperties: false,
};

export const memoDeleteSchema: JsonSchema = {
	type: "object",
	properties: {
		id: {
			type: "string",
			minLength: 1,
			maxLength: 100,
		},
	},
	required: ["id"],
	additionalProperties: false,
};
