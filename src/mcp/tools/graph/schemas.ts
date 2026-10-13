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

export const graphDescribeDatabaseSchema: JsonSchema = {
	type: "object",
	properties: {
		db: {
			type: "string",
			minLength: 1,
			description:
				"Database name to describe. 'default' is the derived markdown knowledge graph; any other value is a user database created with graph_create_database.",
		},
	},
	required: ["db"],
	additionalProperties: false,
};

export const graphCreateDatabaseSchema: JsonSchema = {
	type: "object",
	properties: {
		name: {
			type: "string",
			minLength: 1,
			description:
				"Name of the new user database (letters/digits/_/-, must start with a letter; 'default' is reserved).",
		},
		description: {
			type: "string",
			minLength: 1,
			description: "Human-readable description of the new user database.",
		},
		acknowledged: {
			type: "boolean",
			description:
				"Confirmation flag. Must be true; graph_create_database is a write operation that creates a durable database.",
		},
	},
	required: ["name", "description", "acknowledged"],
	additionalProperties: false,
};

export const graphImportCsvSchema: JsonSchema = {
	type: "object",
	properties: {
		db: {
			type: "string",
			minLength: 1,
			description:
				"User database to import into. 'default' is the read-only derived markdown graph; create a user database with graph_create_database first.",
		},
		csv: {
			type: "string",
			minLength: 1,
			description:
				"Path to the CSV file. Absolute, or relative to the project root. The whole file is parsed and validated before the database is opened, so a malformed file leaves the database unchanged.",
		},
		node: {
			type: "string",
			description:
				"Node table to import rows into. Defaults to a name derived from the CSV file name. Also the default endpoint table for a relationship import.",
		},
		map: {
			description:
				'Rename CSV columns to graph property names, e.g. {"First Name": "firstName"}. Keys are the CSV headers, values are the property names.',
		},
		header: {
			type: "boolean",
			description:
				"Whether the first line is a header row. Default true; set false to generate column names column1, column2, …",
		},
		rel: {
			type: "string",
			description: "Import as edges into this relationship table instead of as nodes. Requires from and to.",
		},
		from: {
			type: "string",
			description: "Relationship import: CSV column holding the source node's key.",
		},
		to: {
			type: "string",
			description: "Relationship import: CSV column holding the destination node's key.",
		},
		fromNode: {
			type: "string",
			description:
				"Relationship import: source node table (used only when the relationship table must be created). Defaults to node.",
		},
		toNode: {
			type: "string",
			description:
				"Relationship import: destination node table (used only when the relationship table must be created). Defaults to node.",
		},
	},
	required: ["db", "csv"],
	additionalProperties: false,
};
