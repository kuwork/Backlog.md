import { describe, expect, it } from "bun:test";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import SideNavigation from "../web/components/SideNavigation";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";
import type { Locale } from "../web/locales";

const storage = new Map<string, string>();
globalThis.localStorage = {
	getItem: (key) => storage.get(key) ?? null,
	setItem: (key, value) => storage.set(key, value),
	removeItem: (key) => storage.delete(key),
	clear: () => storage.clear(),
	key: (index) => [...storage.keys()][index] ?? null,
	get length() {
		return storage.size;
	},
} as Storage;

const render = (locale: Locale, graphsCollapsed?: boolean): string => {
	storage.delete("graphsCollapsed");
	if (graphsCollapsed) storage.set("graphsCollapsed", "true");
	return renderToString(
		<I18nProvider initialLocale={locale}>
			<MemoryRouter>
				<SideNavigation
					tasks={[]}
					docs={[]}
					docsTree={[]}
					decisions={[]}
					wikiTree={[]}
					isLoading={false}
					onRetry={async () => {}}
					onRefreshData={async () => {}}
				/>
			</MemoryRouter>
		</I18nProvider>,
	).replaceAll("<!-- -->", "");
};

const at = (html: string, needle: string): number => {
	const index = html.indexOf(needle);
	expect(index, `missing ${needle}`).toBeGreaterThan(-1);
	return index;
};

describe("graphs nav group", () => {
	it("groups the three graph entries under a 图谱 header placed before Documents", () => {
		const html = render("zh-CN");
		const header = at(html, "图谱");
		const query = at(html, "数据查询");
		const taskGraph = at(html, "任务图谱");
		const knowledge = at(html, "知识图谱");
		const memos = at(html, "随手记");
		const documents = at(html, "文档");

		expect(memos).toBeLessThan(header);
		expect(header).toBeLessThan(query);
		expect(query).toBeLessThan(taskGraph);
		expect(taskGraph).toBeLessThan(knowledge);
		expect(knowledge).toBeLessThan(documents);
	});

	it("hides the three entries when the group is collapsed, keeping the header", () => {
		const collapsed = render("zh-CN", true);
		expect(collapsed).toContain("图谱");
		expect(collapsed).not.toContain("数据查询");
		expect(collapsed).not.toContain("任务图谱");
		expect(collapsed).not.toContain("知识图谱");
		expect(collapsed).toContain("展开图谱");
	});

	it("translates the header and the renamed entry in every locale", () => {
		expect(render("en")).toContain("Data Query");
		expect(render("ja")).toContain("データ照会");
		expect(render("zh-TW")).toContain("資料查詢");
		expect(render("en")).toContain("Graphs");
		expect(render("ja")).toContain("グラフ");
		expect(render("zh-TW")).toContain("圖譜");
	});
});
