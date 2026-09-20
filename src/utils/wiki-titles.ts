import type { WikiPage, WikiTreeNode } from "../types/index.ts";

/**
 * The label a wiki page is known by: its frontmatter title when it has one, otherwise the file name
 * without the markdown extension. Same fallback the search corpus and the page header use, so the
 * sidebar, search results and the page itself never disagree about a page's name.
 */
export const wikiPageTitle = (page: WikiPage): string => {
	const fileName = page.path.replace(/\.md$/i, "").split("/").pop() ?? page.path;
	const title = page.frontmatter?.title;
	return typeof title === "string" && title.trim() !== "" ? title : fileName;
};

/**
 * Attach page titles to a wiki tree so the web sidebar can sort and label pages by title. Nodes whose
 * page is not in the corpus (unreadable files, a store that is not ready yet) keep the file-name
 * fallback the client applies, and the input tree is left untouched.
 */
export const withWikiPageTitles = (nodes: WikiTreeNode[], pages: WikiPage[]): WikiTreeNode[] => {
	if (pages.length === 0) {
		return nodes;
	}

	const titles = new Map(pages.map((page) => [page.path, wikiPageTitle(page)]));

	const attach = (items: WikiTreeNode[]): WikiTreeNode[] =>
		items.map((node) => {
			const title = node.type === "file" ? titles.get(node.path) : undefined;
			const children = node.children ? attach(node.children) : undefined;
			if (!title && !children) {
				return node;
			}
			return { ...node, ...(title ? { title } : {}), ...(children ? { children } : {}) };
		});

	return attach(nodes);
};
