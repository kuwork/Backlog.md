/** Heading selector used for table-of-contents entries. */
export const TOC_HEADING_SELECTOR = "h1, h2, h3, h4, h5, h6";

/** Deepest indentation a table of contents shows, even for deep heading trees. */
const MAX_TOC_DEPTH = 6;

export interface TocItem {
	/** Rendered heading id, i.e. the in-document anchor target. */
	id: string;
	/** Human-readable heading text. */
	text: string;
	/** Indentation depth, where 1 is the shallowest heading on the page. */
	level: number;
}

function headingText(heading: HTMLElement): string {
	const explicit = heading.getAttribute("data-heading-text");
	return (explicit ?? heading.textContent ?? "").trim();
}

/**
 * Shift levels so the shallowest heading becomes depth 1 and cap the depth.
 * Rendered documents rarely start at h1 (the page title is outside the markdown
 * body), and deeply nested subtrees should not push entries off the rail.
 */
export function normalizeTocLevels(items: TocItem[]): TocItem[] {
	if (items.length === 0) return items;
	const shallowest = Math.min(...items.map((item) => item.level));
	return items.map((item) => ({
		...item,
		level: Math.min(item.level - shallowest + 1, MAX_TOC_DEPTH),
	}));
}

/**
 * Collect table-of-contents entries from headings that are already rendered.
 *
 * Reading the DOM (instead of re-parsing the markdown) keeps entries aligned
 * with the anchors the renderer actually produced, including github-slugger
 * slugs, duplicate-heading suffixes, and CJK titles.
 */
export function collectTocItems(root: ParentNode | null | undefined): TocItem[] {
	if (!root) return [];
	const items: TocItem[] = [];
	for (const heading of root.querySelectorAll<HTMLElement>(TOC_HEADING_SELECTOR)) {
		const id = heading.id;
		const text = headingText(heading);
		if (!id || !text) continue;
		items.push({ id, text, level: Number.parseInt(heading.tagName.slice(1), 10) });
	}
	return normalizeTocLevels(items);
}

/** Compare two entry lists so repeated DOM mutations do not re-render needlessly. */
export function tocItemsEqual(a: TocItem[], b: TocItem[]): boolean {
	if (a.length !== b.length) return false;
	return a.every((item, index) => {
		const other = b[index];
		return other !== undefined && item.id === other.id && item.text === other.text && item.level === other.level;
	});
}

/** An outline entry with the entries nested underneath it. */
export interface TocNode extends TocItem {
	children: TocNode[];
}

/** One visible outline row, flattened back out of the tree for rendering. */
export interface TocRow {
	item: TocItem;
	/** Whether the entry owns a subtree, i.e. whether it can be collapsed. */
	hasChildren: boolean;
}

/**
 * Nest entries into a tree. Each entry hangs off the closest preceding entry
 * that is shallower than it, because heading levels may skip (h2 straight to h4)
 * and so depth cannot be used as a stack index.
 */
export function buildTocTree(items: TocItem[]): TocNode[] {
	const roots: TocNode[] = [];
	const open: TocNode[] = [];
	for (const item of items) {
		const node: TocNode = { ...item, children: [] };
		while (open.length > 0 && (open[open.length - 1] as TocNode).level >= node.level) open.pop();
		const parent = open[open.length - 1];
		if (parent) parent.children.push(node);
		else roots.push(node);
		open.push(node);
	}
	return roots;
}

/**
 * Depth-first walk of the tree in document order, dropping the whole subtree of
 * every collapsed entry.
 */
export function flattenTocTree(nodes: TocNode[], isCollapsed: (id: string) => boolean): TocRow[] {
	const rows: TocRow[] = [];
	const walk = (list: TocNode[]) => {
		for (const node of list) {
			const hasChildren = node.children.length > 0;
			rows.push({ item: { id: node.id, text: node.text, level: node.level }, hasChildren });
			if (hasChildren && !isCollapsed(node.id)) walk(node.children);
		}
	};
	walk(nodes);
	return rows;
}

/** Ids of the entries containing `id`, outermost first, so a subtree can be opened up to it. */
export function tocAncestorIds(nodes: TocNode[], id: string): string[] {
	const walk = (list: TocNode[], trail: string[]): string[] | null => {
		for (const node of list) {
			if (node.id === id) return trail;
			const found = walk(node.children, [...trail, node.id]);
			if (found) return found;
		}
		return null;
	};
	return walk(nodes, []) ?? [];
}
