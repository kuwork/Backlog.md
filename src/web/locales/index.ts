import type { StatusDefinition } from "../../types/index.ts";
import { en, defaultStateMachine as enStateMachine } from "./en";
import { ja, defaultStateMachine as jaStateMachine } from "./ja";
import type { TranslationDict } from "./types";
import { zhCN, defaultStateMachine as zhCNStateMachine } from "./zh-CN";
import { zhTW, defaultStateMachine as zhTWStateMachine } from "./zh-TW";

export type Locale = "en" | "ja" | "zh-CN" | "zh-TW";

export type { TranslationDict };

const dictionaries: Record<Locale, TranslationDict> = {
	en,
	ja,
	"zh-CN": zhCN,
	"zh-TW": zhTW,
};

/**
 * The seven-column default task state machine (doc-19 §4.1), one variant per locale. Status
 * names, categories, exit channels and display flags are identical in every variant - only the
 * `when` / `if` / `requires` / `evidence` prose is localized.
 *
 * Writing conventions for the edge text, so an AI reader can act on it directly: `when` is the
 * trigger that makes the move relevant, `if` is an observable condition the AI can check from the
 * conversation (never a config-internal reference), `requires` is machine-checkable.
 */
export const DEFAULT_STATE_MACHINES: Record<Locale, StatusDefinition[]> = {
	en: enStateMachine,
	ja: jaStateMachine,
	"zh-CN": zhCNStateMachine,
	"zh-TW": zhTWStateMachine,
};

export function getDictionary(locale: Locale): TranslationDict {
	return dictionaries[locale] ?? dictionaries.en;
}

export function isValidLocale(value: string): value is Locale {
	return value === "en" || value === "ja" || value === "zh-CN" || value === "zh-TW";
}
