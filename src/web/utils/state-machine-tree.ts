import type { StatusDefinition } from "../../types/index.ts";

function quoteLabel(value: string): string {
	return `"${value.replace(/"/g, "#quot;").replace(/[\r\n]+/g, " ")}"`;
}

/**
 * Render a status machine as a mermaid tree rooted at the first status (the initial one).
 *
 * The tree is what the settings page shows next to the editor: it answers "where can I get to
 * from the start", so a status is expanded once. An edge that points back at something already
 * in the tree — a rejection loop like `Plan Review → Planning`, or any cycle — is drawn as a
 * dotted back-reference instead of opening a second subtree, which keeps cycles finite.
 * Statuses nothing reaches are still listed, as isolated nodes, so they never silently vanish.
 */
export function buildStateMachineTreeSource(statuses: StatusDefinition[], root?: string): string {
	if (statuses.length === 0) return "flowchart TD";

	const byName = new Map<string, StatusDefinition>();
	for (const status of statuses) {
		const name = status.name?.trim();
		if (name && !byName.has(name)) byName.set(name, status);
	}

	const ids = new Map<string, string>();
	const lines = ["flowchart TD"];
	// Not named `declare`: in a .ts module a statement that starts with that keyword is parsed as an
	// ambient declaration and never emitted, so `declare(name);` would silently vanish.
	const nodeId = (name: string): string => {
		const existing = ids.get(name);
		if (existing) return existing;
		const id = `S${ids.size}`;
		ids.set(name, id);
		lines.push(`  ${id}[${quoteLabel(name)}]`);
		return id;
	};

	const rootName = root?.trim() || statuses[0]?.name?.trim();
	const queue: string[] = [];
	if (rootName && byName.has(rootName)) {
		nodeId(rootName);
		queue.push(rootName);
	}

	while (queue.length > 0) {
		const current = queue.shift() as string;
		const from = ids.get(current) as string;
		for (const transition of byName.get(current)?.next ?? []) {
			const target = transition.to?.trim();
			if (!target || !byName.has(target)) continue; // dangling target: lint reports it
			const isBackReference = ids.has(target);
			if (!isBackReference) queue.push(target);
			const to = nodeId(target);
			const arrow = isBackReference ? "-.->" : "-->";
			const label = transition.when?.trim();
			lines.push(label ? `  ${from} ${arrow}|${quoteLabel(label)}| ${to}` : `  ${from} ${arrow} ${to}`);
		}
	}

	for (const status of statuses) {
		const name = status.name?.trim();
		if (name && !ids.has(name)) nodeId(name);
	}

	return lines.join("\n");
}
