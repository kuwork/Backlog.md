import { describe, expect, it } from "bun:test";
import { buildTopicCandidates, filterTopicSuggestions, findOpenTopicAtCaret } from "../web/hooks/useTopicAutocomplete";

describe("findOpenTopicAtCaret", () => {
	it("opens a run on the hash, with nothing typed yet", () => {
		expect(findOpenTopicAtCaret("hello #", 7)).toEqual({ hashIndex: 6, token: "" });
	});

	it("reports what has been typed inside the run", () => {
		expect(findOpenTopicAtCaret("hello #me", 9)).toEqual({ hashIndex: 6, token: "me" });
	});

	it("closes the run on the second hash, so a finished #topic# is not open", () => {
		expect(findOpenTopicAtCaret("#meeting#", 9)).toBeNull();
		expect(findOpenTopicAtCaret("notes #meeting# done", 15)).toBeNull();
	});

	it("ends the run at whitespace, which is why a heading is not a topic", () => {
		expect(findOpenTopicAtCaret("# Heading", 9)).toBeNull();
		expect(findOpenTopicAtCaret("## Heading", 10)).toBeNull();
	});

	it("lets a topic sit inside a sentence, Weibo style", () => {
		expect(findOpenTopicAtCaret("今天#天气", 5)).toEqual({ hashIndex: 2, token: "天气" });
	});

	it("finds nothing when there is no hash at all", () => {
		expect(findOpenTopicAtCaret("no hash here", 12)).toBeNull();
		expect(findOpenTopicAtCaret("", 0)).toBeNull();
	});
});

describe("filterTopicSuggestions", () => {
	it("offers everything when nothing has been typed yet", () => {
		expect(filterTopicSuggestions(["meeting", "idea"], "")).toEqual(["meeting", "idea"]);
	});

	it("matches case-insensitively, prefix hits first", () => {
		expect(filterTopicSuggestions(["meeting", "idea", "release-meeting"], "mee")).toEqual([
			"meeting",
			"release-meeting",
		]);
	});

	it("returns nothing when no topic matches", () => {
		expect(filterTopicSuggestions(["meeting", "idea"], "zzz")).toEqual([]);
	});
});

describe("buildTopicCandidates", () => {
	it("offers the typed text as a new topic when it is used for the first time", () => {
		expect(buildTopicCandidates([], "天气")).toEqual([{ topic: "天气", isNew: true }]);
		expect(buildTopicCandidates(["meeting", "idea"], "weather")).toEqual([{ topic: "weather", isNew: true }]);
	});

	it("marks matching known topics as not new, and still lets a variant be created", () => {
		expect(buildTopicCandidates(["meeting", "idea"], "mee")).toEqual([
			{ topic: "meeting", isNew: false },
			// "mee" is not itself a known topic, so it stays creatable alongside the match.
			{ topic: "mee", isNew: true },
		]);
	});

	it("does not add a create row when the typed text is already known", () => {
		expect(buildTopicCandidates(["meeting", "idea"], "idea")).toEqual([{ topic: "idea", isNew: false }]);
		// Case-insensitive: `#IDEA#` would not create a second topic.
		expect(buildTopicCandidates(["meeting", "idea"], "IDEA")).toEqual([{ topic: "idea", isNew: false }]);
	});

	it("offers nothing for a bare hash with an empty vocabulary", () => {
		expect(buildTopicCandidates([], "")).toEqual([]);
	});

	it("keeps the create row last, after the known matches", () => {
		expect(buildTopicCandidates(["meeting", "release-meeting"], "mee")).toEqual([
			{ topic: "meeting", isNew: false },
			{ topic: "release-meeting", isNew: false },
			{ topic: "mee", isNew: true },
		]);
	});
});

describe("topic autocomplete and ordinary references", () => {
	it("never rewrites a PR reference on its own", () => {
		// `PR #268` does read as an open run, and the menu will offer `#268#` as a new topic - but
		// only an explicit Enter/Tab/click turns it into one. Typing on leaves it plain text,
		// because nothing auto-closes on space or blur.
		const open = findOpenTopicAtCaret("审查 PR #268", 10);
		expect(open).toEqual({ hashIndex: 6, token: "268" });
		expect(filterTopicSuggestions(["meeting", "idea"], open?.token ?? "")).toEqual([]);
	});
});
