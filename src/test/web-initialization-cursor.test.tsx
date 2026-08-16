import { describe, expect, it } from "bun:test";
import { renderToString } from "react-dom/server";
import { getDictionary } from "../web/locales";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";
import InitializationScreen from "../web/components/InitializationScreen";

describe("Web init Cursor copy", () => {
	it("describes the AGENTS.md option as shared with Cursor in every locale", () => {
		for (const locale of ["en", "ja", "zh-CN", "zh-TW"] as const) {
			const desc = getDictionary(locale).init.agentFilesLabels.agentsMdDesc;
			expect(desc).toContain("Cursor");
		}
	});

	it("renders the initialization screen without crashing", () => {
		const html = renderToString(
			<I18nProvider initialLocale="en">
				<InitializationScreen onInitialized={() => {}} />
			</I18nProvider>,
		);
		expect(html).toContain("Initialize Backlog.md");
	});
});
