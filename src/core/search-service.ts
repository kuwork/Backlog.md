import Fuse, { type FuseResult, type FuseResultMatch, type IFuseOptions } from "fuse.js";
import type {
	Decision,
	Document,
	SearchFilters,
	SearchMatch,
	SearchOptions,
	SearchResult,
	SearchResultType,
	Task,
	WikiPage,
} from "../types/index.ts";
import { buildTaskSearchFields, createTaskFilterMatcher, TASK_SEARCH_FUSE_OPTIONS } from "../utils/task-search.ts";
import type { ContentStore, ContentStoreEvent } from "./content-store.ts";

interface BaseSearchEntity {
	readonly id: string;
	readonly type: SearchResultType;
	readonly title: string;
	readonly bodyText: string;
	readonly idVariants: string[];
	readonly dependencyIds: string[];
	readonly modifiedFiles: string[];
	readonly fileName?: string;
}

interface TaskSearchEntity extends BaseSearchEntity {
	readonly type: "task";
	readonly task: Task;
	readonly isCompleted?: boolean;
}

interface DocumentSearchEntity extends BaseSearchEntity {
	readonly type: "document";
	readonly document: Document;
}

interface DecisionSearchEntity extends BaseSearchEntity {
	readonly type: "decision";
	readonly decision: Decision;
}

interface WikiSearchEntity extends BaseSearchEntity {
	readonly type: "wiki";
	readonly wiki: WikiPage;
	readonly fileName: string;
}

type SearchEntity = TaskSearchEntity | DocumentSearchEntity | DecisionSearchEntity | WikiSearchEntity;

export class SearchService {
	private initialized = false;
	private initializing: Promise<void> | null = null;
	private unsubscribe?: () => void;
	private fuse: Fuse<SearchEntity> | null = null;
	private tasks: TaskSearchEntity[] = [];
	private documents: DocumentSearchEntity[] = [];
	private decisions: DecisionSearchEntity[] = [];
	private wikis: WikiSearchEntity[] = [];
	private collection: SearchEntity[] = [];
	private version = 0;

	constructor(private readonly store: ContentStore) {}

	async ensureInitialized(): Promise<void> {
		if (this.initialized) {
			return;
		}

		if (!this.initializing) {
			this.initializing = this.initialize().catch((error) => {
				this.initializing = null;
				throw error;
			});
		}

		await this.initializing;
	}

	dispose(): void {
		if (this.unsubscribe) {
			this.unsubscribe();
			this.unsubscribe = undefined;
		}
		this.fuse = null;
		this.collection = [];
		this.tasks = [];
		this.documents = [];
		this.decisions = [];
		this.wikis = [];
		this.initialized = false;
		this.initializing = null;
	}

	search(options: SearchOptions = {}): SearchResult[] {
		if (!this.initialized) {
			throw new Error("SearchService not initialized. Call ensureInitialized() first.");
		}

		const { query = "", limit, types, filters, includeCompleted = false } = options;

		const trimmedQuery = query.trim();
		const allowedTypes = new Set<SearchResultType>(
			types && types.length > 0 ? types : ["task", "document", "decision", "wiki"],
		);
		const taskMatcher = this.createTaskMatcher(filters);

		if (trimmedQuery === "") {
			return this.collectWithoutQuery(allowedTypes, taskMatcher, limit, includeCompleted);
		}

		const fuse = this.fuse;
		if (!fuse) {
			return [];
		}

		const fuseResults = fuse.search(trimmedQuery);
		const results: SearchResult[] = [];

		for (const result of fuseResults) {
			const entity = result.item;
			if (!allowedTypes.has(entity.type)) {
				continue;
			}

			// Completed-corpus entries share the index so widening the source corpus never
			// perturbs active-result scores; skipping them here keeps the default output
			// byte-identical and keeps them from consuming limit slots.
			if (entity.type === "task" && entity.isCompleted && !includeCompleted) {
				continue;
			}

			if (entity.type === "task" && !taskMatcher(entity.task)) {
				continue;
			}

			results.push(this.mapEntityToResult(entity, result));
			if (limit && results.length >= limit) {
				break;
			}
		}

		return results;
	}

	private toTaskEntity(task: Task, isCompleted: boolean): TaskSearchEntity {
		return {
			type: "task",
			// The completed bucket of the corpus does not uniformly carry the source tag (the
			// disk loader leaves it unset), so widened rows get it here for consumers to route on.
			task: isCompleted && task.source !== "completed" ? { ...task, source: "completed" } : task,
			isCompleted,
			...buildTaskSearchFields(task),
		};
	}

	private async initialize(): Promise<void> {
		const snapshot = await this.store.ensureInitialized();
		this.applySnapshot(
			snapshot.tasks,
			snapshot.documents,
			snapshot.decisions,
			snapshot.wikis,
			snapshot.taskCorpus?.completedTasks ?? [],
		);

		if (!this.unsubscribe) {
			this.unsubscribe = this.store.subscribe((event) => {
				this.handleStoreEvent(event);
			});
		}

		this.initialized = true;
		this.initializing = null;
	}

	private handleStoreEvent(event: ContentStoreEvent): void {
		if (event.version <= this.version) {
			return;
		}
		this.version = event.version;
		this.applySnapshot(
			event.snapshot.tasks,
			event.snapshot.documents,
			event.snapshot.decisions,
			event.snapshot.wikis,
			event.snapshot.taskCorpus?.completedTasks ?? [],
		);
	}

	private applySnapshot(
		tasks: Task[],
		documents: Document[],
		decisions: Decision[],
		wikis: WikiPage[],
		completedTasks: Task[] = [],
	): void {
		// The completed array comes from the corpus' completed bucket, whose entries do not all
		// carry the source tag (the disk loader does not set it), so the flag is set per bucket.
		this.tasks = [
			...tasks.map((task) => this.toTaskEntity(task, task.source === "completed")),
			...completedTasks.map((task) => this.toTaskEntity(task, true)),
		];

		this.documents = documents.map((document) => ({
			id: document.id,
			type: "document",
			title: document.title,
			bodyText: document.rawContent ?? "",
			document,
			idVariants: [],
			dependencyIds: [],
			modifiedFiles: [],
		}));

		this.decisions = decisions.map((decision) => ({
			id: decision.id,
			type: "decision",
			title: decision.title,
			bodyText: decision.rawContent ?? "",
			decision,
			idVariants: [],
			dependencyIds: [],
			modifiedFiles: [],
		}));

		this.wikis = wikis.map((wiki) => {
			const fileName = wiki.path.replace(/\.md$/i, "").split("/").pop() ?? wiki.path;
			const title = typeof wiki.frontmatter.title === "string" ? wiki.frontmatter.title : fileName;
			return {
				id: wiki.path,
				type: "wiki" as const,
				title,
				bodyText: wiki.content,
				wiki,
				fileName,
				idVariants: [],
				dependencyIds: [],
				modifiedFiles: [],
			};
		});

		this.collection = [...this.tasks, ...this.documents, ...this.decisions, ...this.wikis];
		this.rebuildFuse();
	}

	private rebuildFuse(): void {
		if (this.collection.length === 0) {
			this.fuse = null;
			return;
		}

		// Same keys, weights, and threshold as every other task search, plus the fileName key the
		// wiki corpus needs; only the highlight ranges this surface reports back are extra.
		const keys = [...(TASK_SEARCH_FUSE_OPTIONS.keys ?? []), { name: "fileName", weight: 0.25 }];
		const options = {
			...TASK_SEARCH_FUSE_OPTIONS,
			includeMatches: true,
			keys,
		} as IFuseOptions<SearchEntity>;
		this.fuse = new Fuse(this.collection, options);
	}

	/** Task filtering goes through the shared predicate so every surface resolves filters alike. */
	private createTaskMatcher(filters?: SearchFilters): (task: Task) => boolean {
		return createTaskFilterMatcher({
			status: filters?.status,
			statusExcluded: filters?.statusExcluded,
			priority: filters?.priority,
			assignee: filters?.assignee,
			labels: filters?.labels,
			labelMatch: filters?.labelMatch,
			modifiedFiles: filters?.modifiedFiles,
		});
	}

	private collectWithoutQuery(
		allowedTypes: Set<SearchResultType>,
		taskMatcher: (task: Task) => boolean,
		limit?: number,
		includeCompleted = false,
	): SearchResult[] {
		const results: SearchResult[] = [];

		if (allowedTypes.has("task")) {
			const tasks = this.tasks.filter((entity) => taskMatcher(entity.task));
			for (const entity of tasks) {
				if (entity.isCompleted && !includeCompleted) {
					continue;
				}
				results.push(this.mapEntityToResult(entity));
				if (limit && results.length >= limit) {
					return results;
				}
			}
		}

		if (allowedTypes.has("document")) {
			for (const entity of this.documents) {
				results.push(this.mapEntityToResult(entity));
				if (limit && results.length >= limit) {
					return results;
				}
			}
		}

		if (allowedTypes.has("decision")) {
			for (const entity of this.decisions) {
				results.push(this.mapEntityToResult(entity));
				if (limit && results.length >= limit) {
					return results;
				}
			}
		}

		if (allowedTypes.has("wiki")) {
			for (const entity of this.wikis) {
				results.push(this.mapEntityToResult(entity));
				if (limit && results.length >= limit) {
					return results;
				}
			}
		}

		return results;
	}

	private mapEntityToResult(entity: SearchEntity, result?: FuseResult<SearchEntity>): SearchResult {
		const score = result?.score ?? null;
		const matches = this.mapMatches(result?.matches);

		if (entity.type === "task") {
			return {
				type: "task",
				score,
				task: entity.task,
				matches,
			};
		}

		if (entity.type === "document") {
			return {
				type: "document",
				score,
				document: entity.document,
				matches,
			};
		}

		if (entity.type === "wiki") {
			return {
				type: "wiki",
				score,
				wiki: entity.wiki,
				matches,
			};
		}

		return {
			type: "decision",
			score,
			decision: entity.decision,
			matches,
		};
	}

	private mapMatches(matches?: readonly FuseResultMatch[]): SearchMatch[] | undefined {
		if (!matches || matches.length === 0) {
			return undefined;
		}

		return matches.map((match) => ({
			key: match.key,
			indices: match.indices.map(([start, end]) => [start, end] as [number, number]),
			value: match.value,
		}));
	}
}
