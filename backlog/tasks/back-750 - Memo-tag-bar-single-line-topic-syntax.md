---
id: BACK-750
title: 'Memo tag bar: single-line history strip and topic syntax'
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-06 02:57'
updated_date: '2026-10-06 14:35'
labels:
  - enhancement
  - web-ui
  - memos
dependencies:
  - BACK-731
modified_files:
  - src/web/components/MemosPage.tsx
  - src/web/components/MemoCard.tsx
  - src/web/components/MemoBoard.tsx
  - src/web/components/PasteAwareMDEditor.tsx
  - src/web/components/EntityLinkAutocomplete.tsx
  - src/web/components/MermaidMarkdown.tsx
  - src/web/utils/memos.ts
  - src/web/utils/memo-board.ts
  - src/web/utils/topic-highlight.ts
  - src/web/hooks/useTopicAutocomplete.ts
  - src/web/components/TopicAutocompleteMenu.tsx
  - src/web/hooks/useCaretPopupPosition.ts
  - src/web/styles/source.css
  - src/test/web-memos-page.test.tsx
  - src/test/web-topic-editor.test.tsx
  - src/test/web-topic-autocomplete.test.ts
  - src/web/locales/en.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
  - src/web/locales/ja.ts
  - src/web/utils/memo-board.test.ts
priority: medium
ordinal: 314501
actual_start: '2026-10-06 02:20'
actual_end: '2026-10-06 13:42'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Reworked the memos tag UI into a collapsible multi-line "tag history" strip (`flex-wrap` flow that clips to one row when collapsed, active tags floated to the front, chevron + max-height animation) plus a clickable tag row at the bottom of each memo card that mirrors the filter highlight. The strip's header was dropped so it is a single row, and pills show the bare tag with no `#`.

With BACK-751 merged in, the body syntax is now the closed `#topic#` form (no migration; frontmatter `tags` untouched), backed by a composer autocomplete panel and an overlay `topic` token so a closed topic renders as one run instead of a lone colored hash. A final pass carries the active filter into the pinboard note modal, the inline `#topic#` chips in a memo body (blue when active, colour only), and the note ink (a topic chip: pale normally, light-blue when selected; the footer shows the active tag in blue text only).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 The tag strip renders as a multi-line `flex-wrap` flow, not a dropdown
- [x] #2 A toggle collapses the strip to one line; when collapsed, active tags lead the row (active-first), and expanding restores the original order
- [x] #3 Collapse/expand animates (max-height transition + chevron rotate)
- [x] #4 Each memo card shows its tags at the bottom as clickable chips that filter the feed and mirror the active highlight
- [x] #5 `tagExpand` / `tagCollapse` are present in all four locales (en / zh-CN / zh-TW / ja); the now-dead `tagFilter` and `tagsLabel` keys are removed
- [x] #6 The strip is a single row: no title line, and the collapse toggle sits at the end of the chip flow instead of on its own line
- [x] #7 Tag pills are bordered and show the bare tag, with no `#`, in both the strip and the card's bottom row
- [x] #8 A topic is recognised only in the closed `#topic#` form; a lone `#tag` is plain text
- [x] #9 Topic text holds no spaces, so `# heading` is never a topic and references such as `PR #268` are no longer lifted into tags
- [x] #10 Rendered inline chips show the closed form and stay clickable to filter the feed
- [x] #11 Typing `#` in the composer opens a candidate panel sourced from tags already in use; typing filters it live
- [x] #12 Enter/Tab selects a candidate and inserts `#topic#`, auto-closing it
- [x] #13 The composer's highlight overlay paints a topic as one run - not a heading with a lone colored hash - and matches the saved chip
- [x] #14 Existing memo tests are updated to the closed syntax and the suites pass
- [x] #15 The note modal opened from the pinboard marks the active tags too - the board view has no strip of its own, so the modal is the only place a narrowed board shows what it is narrowed by
- [x] #16 A `#topic#` chip in a memo body is highlighted (blue) when its tag is the one the view is narrowed by, without changing its box - it sits inline in a paragraph
- [x] #17 On the pinboard, a `#topic#` in a note's body gets a chip of its own - a light wash, light blue with blue text when its tag is the active filter - and the note's footer tag list shows the active tag in blue text with no background, the rest in the muted meta colour, so a filtered board never looks like every tag is selected
<!-- AC:END -->

## Definition of Done

<!-- DOD:BEGIN -->
- [x] bunx tsc --noEmit passes when TypeScript touched
- [x] bun run check . passes when formatting/linting touched
- [x] bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Remove the prior dropdown `TagFilter` (and its `TagIcon`/`CheckIcon` helpers) and replace with `TagHistory`: a `flex flex-col` wrapper (`data-testid="memos-tag-history"`) holding a header row (`标签` label + a collapse/expand toggle with `aria-expanded`) and a `flex flex-wrap ... overflow-hidden transition-[max-height]` chip row that toggles `max-h-9` (collapsed) vs `max-h-64` (expanded). *(Revised by step 10: the header row was later dropped and the clip tightened to `max-h-8`.)*
2. In `TagHistory`, compute `orderedTags` with `useMemo`: when collapsed, `[...active, ...rest]` (active tags first, preserving relative order within each group); when expanded, the original `availableTags`. Add a shared `tagChipClass(isActive)` helper and a "Clear tag filter" button when any tag is active.
3. Add `activeTags?: string[]` to `MemoCardProps` and render a bordered bottom tag row (`mt-3 ... border-t ... pt-2.5`) of tag buttons *(bare, no `#` - see step 10)*; each toggles `onTagClick(tag)` and mirrors the active highlight via `aria-pressed`.
4. Update the four locale files: drop `tagFilter`, add `tagExpand` / `tagCollapse`.
5. Repoint the existing "narrows the feed by tag chip" test to find chips inside `memos-tag-history`; add a test asserting the active tag leads the row after collapsing.
6. (Merged from BACK-751) Change `extractInlineTags` to the closed pattern `/#([^\s#`]+)#/g` and mirror it in `INLINE_TAG_PATTERN` (`MermaidMarkdown.tsx`), rendering the chip as `match[0]` so the closing hash is part of it.
7. (Merged from BACK-751) Add `src/web/hooks/useTopicAutocomplete.ts` (`findOpenTopicAtCaret`, `buildTopicCandidates`) plus `TopicAutocompleteMenu`, sharing caret positioning through `src/web/hooks/useCaretPopupPosition.ts`; wire both into `PasteAwareMDEditor` behind an optional `topicSuggestions` prop that `MemosPage` (composer) and `MemoCard` (inline editor) pass from `availableTags`.
8. (Merged from BACK-751) Update `src/web/utils/memos.test.ts` to the closed syntax, add `PR #268` / `# heading` cases, and add `src/test/web-topic-autocomplete.test.ts`.
9. (Follow-up, reported in the browser) Add `src/web/utils/topic-highlight.ts` and register a `topic` token before `title` in the refractor markdown grammar the composer's overlay tokenizes with; gate the chip palette behind a `topic-aware` class so editors without a topic vocabulary stay untouched.
10. (Follow-up) Drop the strip's header line so collapsed state is one row, and drop the `#` from both tag pill rows.
11. (Follow-up, reported in the browser) Carry the active filter into the two places that were left out: `MemosPage` now passes `activeTags` to `MemoBoard`, which forwards it to the `MemoCard` inside its note modal (the prop was already in `MemoBoardProps` via `Omit<MemoCardProps, "memo">` - it was simply dropped); and `MermaidMarkdown` takes `activeTags` so its inline `#topic#` pass can mark the chips standing for the active filter, styled by a colour-only `.inline-tag-active` rule.
12. (Follow-up) Dress the pinboard's own ink: `memo-board.ts` splits a laid-out line into runs (`splitInkRuns`) and places them (`inkRunBoxes`), `wrapEstimate` keeps a closed topic as a single unbreakable token so a chip can never be split across lines, and `bakeNoteTexture` paints a chip behind every topic run - pale wash normally, light blue on blue when selected - plus a footer tag list that shows the active tag in blue text only (no background), the rest in the muted meta colour. Rebake on selection change by folding the active-tag key into `memoStamp`.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
`TagHistory` keeps `collapsed` in `useState`. `activeSet` (lowercased) drives both the `orderedTags` reorder and per-chip `aria-pressed`. Layout is one flex row (`flex items-start gap-2`): the chip container is `flex-1 flex-wrap overflow-hidden` and the toggle is a `shrink-0` sibling at the end, so collapse costs no vertical space beyond the chips themselves - `max-h-8` clips the flow to its first line, `max-h-64` expands it, and `transition-[max-height] duration-200 ease-in-out` animates while the chevron `<svg>` rotates (`transition-transform duration-200` + `rotate-180` when expanded). The toggle's `aria-expanded` is `!collapsed` (a collapsed strip reads as "expanded=false"). An earlier revision put a `标签` label + toggle on a header line above the chips; that line is gone - the chips are bordered pills that identify themselves, so the label was redundant and it forced a second row. The MemoCard bottom row mirrors the strip's filter semantics exactly (case-insensitive active match) so a tag chosen from a card or the strip highlights in both places. i18n: `tagFilter` was removed in the earlier pass and `tagsLabel` is removed now (dead once the header line went away, verified unused across `src/`); `tagExpand`/`tagCollapse` stay, with locale-appropriate labels (Expand/Collapse; 展开/收起; 展開/收起; 展開/折りたたむ) that are deliberately short because the toggle now sits inline. The earlier dropdown design was discarded per user clarification that the strip should be a flowing multi-line layout, not a floating dropdown.

Topic syntax (merged from BACK-751): `extractInlineTags` is `/#([^\s#`]+)#/g`, mirrored by `INLINE_TAG_PATTERN`, and the chip renders `match[0]` so the closing hash is part of it. Only the closed form counts - there is no migration for legacy `#tag` bodies, and frontmatter `tags` is never rewritten.

Composer overlay (follow-up): `@uiw/react-md-editor` tokenizes with `refractor`, whose markdown grammar declares `title` as `/(^\s*)#.+/m` - no space required after the hashes, unlike CommonMark - so `#人类#` came back as `<span class="token title">…<span class="token punctuation">#</span>人类# </span>` and only the punctuation hash took a colour. `registerTopicHighlight()` inserts a `topic` token (`/#([^\s#`]+)#|#([^\s#`]+)$/m`) *before* `title`, and it must run against **both** refractor instances rehype-prism-plus ships (`refractor/lib/common.js` named export and `refractor/lib/all.js` default export, the one the overlay uses); the guard `if (!languages.markdown || languages.markdown.topic) continue;` makes it idempotent. The open-run branch (`#foo$`) is what keeps a half-typed topic from flashing as a heading while the caret is still inside it. The overlay is a `<pre>` glyph-aligned behind a transparent `<textarea>`, so `source.css` only sets `background-color`/`color`/`border-radius` on `.token.topic` - padding or font changes would skew the caret. The palette is scoped to `.topic-aware`, a class `PasteAwareMDEditor` adds to its wrapper only when `topicSuggestions` is supplied, so editors without a topic vocabulary are untouched.
Active-state plumbing (follow-up). Two surfaces were drawing tags without knowing what the view was narrowed by. The pinboard's note modal: `MemoBoardProps` is `Omit<MemoCardProps, "memo">`, so `activeTags` was already accepted - it just was not destructured or forwarded, and the board view hides the strip, so a board narrowed by a tag opened a card with nothing marked. The memo body: `MermaidMarkdown` now takes `activeTags` and the inline-tag pass emits `inline-tag-active` (plus `aria-pressed`) on the chips that stand for them, case-insensitively like the filter. Two constraints shaped it: a unified plugin passed to `.use()` is *called* by unified, so a parameterised one has to be an attacher factory (`rehypeInlineTags(set)` returning `() => (tree) => …`) - returning the transformer directly makes `tree` undefined and crashes every render; and the active chip may only change colour, because it sits inline in a paragraph, so padding or weight would reflow the line the moment a filter is applied. Both light and dark palettes gained `--memo-chip-on-bg` / `--memo-chip-on-fg` so the rule is never a one-theme patch.
Pinboard ink (follow-up). A note is a baked texture drawn with `fillText`, so a topic had no surface to dress - it was just ink. `layoutInkLines` now hands each segment a `runs` split (`splitInkRuns`) and `inkRunBoxes` places those runs left to right with measured widths, so `bakeNoteTexture` can paint a chip behind a run without knowing anything about the font; the boxes are painted before the ink because a chip is padded and would otherwise wash over its neighbour's last glyph. `wrapEstimate` gained one alternative to its tokenizer - a closed `#topic#` is a single token - because the baker draws exactly the lines the estimator produced, and a topic broken across two lines is not a chip. The selection has to reach the baker too: `memoStamp` folds in an order-independent active-tag key so a texture is re-baked when the filter changes, not only when the memo does. Colours are deliberately light: the paper under a chip is always yellow, so a saturated fill shouts - the chip is a pale wash normally and light blue on blue when selected. The footer's tag list carries **no** chip - the tag the board is narrowed by is simply blue text, and every other tag stays in the muted meta colour (the same as the date), so a filtered board highlights exactly one tag without painting a background (per the last review, the footer must not change its background).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Rebuilt the memos tag UI as a collapsible multi-line "tag history" strip plus per-card bottom tag rows, and - with BACK-751 merged in - reworked the tag syntax itself into the closed `#topic#` form with composer autocomplete.

Tag UI. `src/web/components/MemosPage.tsx`: removed the `TagFilter` dropdown (and `TagIcon`/`CheckIcon`); added `TagHistoryProps`, a shared `tagChipClass` helper, and the `TagHistory` component - a `flex flex-wrap` flow clipped to one line when collapsed (`max-h-8` + `overflow-hidden`), with active tags floated to the front via `orderedTags = [...active, ...rest]`; expanding restores the original order; `max-height` transition + chevron rotate animate the toggle. The follow-up pass removed the strip's `标签` header line, so the strip is one row: chips in a `flex-1` container, toggle as a `shrink-0` sibling at the end. `src/web/components/MemoCard.tsx`: added optional `activeTags?: string[]` and a bordered bottom tag row of clickable chips that call `onTagClick` and mirror the active highlight (case-insensitive). Both pill rows now render the bare tag - the `#` belongs to the body syntax, and the pills are bordered so they read as tags on their own. `src/web/locales/{en,zh-CN,zh-TW,ja}.ts`: removed `tagFilter` (earlier pass) and the newly dead `tagsLabel`; `tagExpand` / `tagCollapse` remain.

Topic syntax (BACK-751). `extractInlineTags` and `INLINE_TAG_PATTERN` now match `/#([^\s#`]+)#/g` and render `match[0]`, so `# heading` is never a topic and `PR #268` is never lifted into tags; legacy `#tag` bodies degrade to plain text, no migration, frontmatter untouched. `src/web/hooks/useTopicAutocomplete.ts` (`findOpenTopicAtCaret`, `buildTopicCandidates`) + `src/web/components/TopicAutocompleteMenu.tsx` add the composer panel, sharing caret positioning via `src/web/hooks/useCaretPopupPosition.ts`, wired into `PasteAwareMDEditor` behind an optional `topicSuggestions` prop.

Composer overlay fix. `src/web/utils/topic-highlight.ts` registers a `topic` token ahead of prism's `title` in both refractor instances the overlay can use, and `source.css` paints it with the chip palette behind a `topic-aware` scope - before this, a just-closed `#人类#` came back as a heading and only the leading hash took a colour.

Active-state follow-up. The board view hides the strip, so its note modal was the one place a narrowed board could still show what it is narrowed by - and `MemoBoard` was dropping `activeTags` on the floor instead of handing it to the modal's `MemoCard`. `MemosPage -> MemoBoard -> modal MemoCard` now carries it. In the feed, `MermaidMarkdown` takes `activeTags` so the inline `#topic#` chips standing for the active filter get `inline-tag-active` + `aria-pressed`, painted blue by a colour-only rule - colour only because the chip sits inline in a paragraph and anything touching its box would reflow the line.

Verification: `bun test` on the touched suites = 99 pass / 0 fail; `src/web/utils/memo-board.test.ts` = 30 pass (the run split, run placement, active marking, and a topic staying whole across a wrap); and 260 pass / 0 fail across every suite that renders `MermaidMarkdown` / `MemoCard`. `bunx tsc --noEmit` clean under `src/`, `bunx biome check` clean on every changed file, and confirmed in real headless Chrome over CDP (typing `#人类` opens the menu, Enter inserts `#人类# `, overlay emits `<span class="token topic">#人类#</span>` with computed chip colours). The pinboard modal and baked ink need WebGL, which jsdom cannot provide, so that leg is covered by the pure functions (`splitInkRuns`, `inkRunBoxes`, `footerTagBoxes`) plus the prop chain. Left uncommitted per convention.
<!-- SECTION:FINAL_SUMMARY:END -->

## Files Changed

- `src/web/components/MemosPage.tsx` — removed `TagFilter` dropdown; added `TagHistoryProps`, `tagChipClass`, and `TagHistory` (multi-line flow, collapse-to-one-line, active-first reorder, max-height + chevron animation); follow-up pass dropped the header line so the strip is a single row with the toggle inline, and chips lost their `#`. Wired into the feed and passed `activeTags` to `MemoCard`.
- `src/web/components/MemoCard.tsx` — added `activeTags?: string[]` prop; renders a bottom clickable tag row mirroring the filter highlight, now with `data-testid="memo-tag-chip"` and a bare tag label; passes `activeTags` down to `MermaidMarkdown`.
- `src/web/components/MemoBoard.tsx` — forwards `activeTags` to the `MemoCard` inside the note modal (the prop already existed on `MemoBoardProps`; it was simply not passed on); bakes a chip behind every topic run in the note's ink (pale wash, light blue on blue when selected), paints the footer tag list with no background - the active tag is blue text, the rest stay in the muted meta colour - and re-bakes when the selection changes.
- `src/web/utils/memo-board.ts` — `splitInkRuns` / `inkRunBoxes` / `InkRun` / `InkBox`; `InkSegment.runs`; `wrapEstimate` treats a closed `#topic#` as one unbreakable token so a chip never straddles a line break.
- `src/web/utils/memo-board.test.ts` — tests for the new run split, run placement and active marking, and for a topic staying whole when the line wraps.
- `src/web/components/PasteAwareMDEditor.tsx` — accepts optional `topicSuggestions`, renders `TopicAutocompleteMenu`, registers the topic grammar token, and tags its wrapper `topic-aware`.
- `src/web/components/MermaidMarkdown.tsx` — `INLINE_TAG_PATTERN` switched to the closed `#topic#` form; the chip renders `match[0]`; takes `activeTags` so the inline-tag pass can mark (`inline-tag-active` + `aria-pressed`) the chips standing for the active filter.
- `src/web/styles/source.css` — `.topic-aware` chip palette (light + dark) applied to `.token.topic` in the editor overlay; `--memo-chip-on-bg` / `--memo-chip-on-fg` (light + dark) behind the colour-only `.inline-tag-active` rule.
- `src/web/utils/memos.ts` — `extractInlineTags` switched to `/#([^\s#`]+)#/g`.
- `src/web/utils/topic-highlight.ts` (new) — registers the `topic` token ahead of `title` in both refractor instances the composer overlay uses; idempotent.
- `src/web/hooks/useTopicAutocomplete.ts` (new) — `findOpenTopicAtCaret` / `buildTopicCandidates`, reusing the entity-autocomplete caret/debounce/IME machinery.
- `src/web/components/TopicAutocompleteMenu.tsx` (new) — the candidate panel; Enter/Tab closes the topic.
- `src/web/hooks/useCaretPopupPosition.ts` (new) — shared caret-to-viewport positioning for the panel, lifted out of `EntityLinkAutocomplete` so both panels use one implementation.
- `src/web/components/EntityLinkAutocomplete.tsx` — switched to the shared caret-positioning hook (no behaviour change).
- `src/test/web-memos-page.test.tsx` — repointed tag-narrowing test to `memos-tag-history`; added active-first-when-collapsed test; chip expectations now match bare tags via the new test ids; `renderBody` takes `activeTags` and a new test asserts a body chip is marked active (case-insensitively) only when its tag is the active filter.
- `src/test/web-topic-editor.test.tsx` (new) — grammar-token tests (closed run, open run at EOL, real headings stay `title`, idempotency) plus overlay tests on `PasteAwareMDEditor`.
- `src/test/web-topic-autocomplete.test.ts` (new) — `findOpenTopicAtCaret` / `buildTopicCandidates` unit tests.
- `src/web/utils/memos.test.ts` — updated to the closed syntax with `PR #268` and `# heading` cases.
- `src/web/locales/{en,zh-CN,zh-TW,ja}.ts` — removed `tagFilter` and the now-dead `tagsLabel`; added `tagExpand` / `tagCollapse`.
- `backlog/archive/tasks/back-751 - Memo-topics-Weibo-style-topic-syntax-with-autocomplete.md` — BACK-751's ticket file, moved here after its scope was merged into this one.
