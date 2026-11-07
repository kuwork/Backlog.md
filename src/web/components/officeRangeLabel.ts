import type { useI18nContext } from "../contexts/I18nContext";
import type { OfficeRange } from "./binaryOfficeFile";

type Translations = ReturnType<typeof useI18nContext>["t"];

/**
 * Human label for a `:range` suffix, shared by the four Office viewers and the inline embed so the
 * same range reads the same everywhere (BACK-838). Returns null when the link carries no range.
 */
export function officeRangeLabel(t: Translations, range?: OfficeRange | null): string | null {
	if (!range) return null;

	if (range.type === "pages") {
		return range.end && range.end !== range.start
			? t.preview.shared.pageRange.replace("{start}", String(range.start)).replace("{end}", String(range.end))
			: t.preview.shared.pageSingle.replace("{start}", String(range.start));
	}

	const items = range.items.filter(Boolean);
	const first = items[0];
	if (!first) return null;
	// A workbook range is either sheet indices (`p1`, `p1-p3`) or one sheet name.
	if (items.every((item) => /^p\d+$/i.test(item))) {
		const start = first.replace(/^p/i, "");
		const last = (items[items.length - 1] ?? first).replace(/^p/i, "");
		return start === last
			? t.preview.xlsx.sheetIndex.replace("{index}", start)
			: t.preview.xlsx.sheetRange.replace("{start}", start).replace("{end}", last);
	}
	return t.preview.xlsx.sheetName.replace("{name}", first);
}
