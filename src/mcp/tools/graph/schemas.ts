import type { JsonSchema } from "../../validation/validators.ts";

export const graphQuerySchema: JsonSchema = {
	type: "object",
	properties: {
		db: {
			type: "string",
			minLength: 1,
			description:
				"Database name. 'default' is the derived markdown knowledge graph (read-only, rebuilt from the corpus). Any other value is a user database created with graph_create_database.",
		},
		statement: {
			type: "string",
			description:
				"Read-only Cypher statement to run. Omit to get a default overview of node labels. Write keywords (CREATE/MERGE/SET/DELETE/DROP/INSERT/UPDATE) are rejected.",
		},
	},
	required: ["db"],
	additionalProperties: false,
};

export const graphSchemaSchema: JsonSchema = {
	type: "object",
	properties: {
		db: {
			type: "string",
			minLength: 1,
			description:
				"Database name whose schema to introspect. 'default' is the derived markdown knowledge graph; any other value is a user database created with graph_create_database.",
		},
	},
	required: ["db"],
	additionalProperties: false,
};

export const graphListDatabasesSchema: JsonSchema = {
	type: "object",
	properties: {},
	required: [],
	additionalProperties: false,
};
