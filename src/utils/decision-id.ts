import { findUniqueEntityById } from "./entity-id.ts";

const DECISION_PREFIX = "decision";

type DecisionIdentity = { id: string; title: string; path?: string };

const RESOLVE_GUIDANCE = "Rename or delete the conflicting files so exactly one of them carries this ID.";

/** Resolves one decision by ID, throwing on ambiguous matches instead of picking a winner. */
export function findDecisionById<T extends DecisionIdentity>(decisions: readonly T[], id: string): T | null {
	return findUniqueEntityById(
		"Decision",
		DECISION_PREFIX,
		id,
		decisions,
		(decision) => decision.path ?? decision.title,
		RESOLVE_GUIDANCE,
	);
}
