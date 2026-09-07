import type React from "react";
import { createContext, useContext, useMemo } from "react";
import type { Decision, Document, Task } from "../../types";
import { buildEntityIndex, EMPTY_ENTITY_INDEX, type EntityIndex } from "../utils/task-id-links";

const TaskIdIndexContext = createContext<EntityIndex>(EMPTY_ENTITY_INDEX);

/**
 * Canonical entity index shared by the render-side auto-linker and the input-side
 * insert-link hint. Falls back to an empty index outside the provider, so markdown
 * renders unlinked rather than throwing.
 */
export const useTaskIdIndex = () => useContext(TaskIdIndexContext);

interface TaskIdIndexProviderProps {
	tasks: Task[];
	docs?: Document[];
	decisions?: Decision[];
	drafts?: Task[];
	/** Wiki page paths (extensionless, e.g. "patterns/cross-surface"). */
	wikiPaths?: string[];
	children: React.ReactNode;
}

export function TaskIdIndexProvider({ tasks, docs, decisions, drafts, wikiPaths, children }: TaskIdIndexProviderProps) {
	const index = useMemo(
		() => buildEntityIndex({ tasks, docs, decisions, drafts, wikiPaths }),
		[tasks, docs, decisions, drafts, wikiPaths],
	);

	return <TaskIdIndexContext.Provider value={index}>{children}</TaskIdIndexContext.Provider>;
}
