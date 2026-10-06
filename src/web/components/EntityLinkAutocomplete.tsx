import { useCaretPopupPosition } from "../hooks/useCaretPopupPosition";
import type { AutocompleteCandidate, EntityAutocompleteMenuState } from "../hooks/useEntityAutocomplete";

/** BACK-511 style short-name badges shown next to each candidate. */
export const AUTOCOMPLETE_KIND_LABELS: Record<AutocompleteCandidate["kind"], string> = {
	task: "TASK",
	doc: "DOC",
	decision: "DECISION",
	draft: "DRAFT",
	wiki: "WIKI",
};

export interface EntityLinkAutocompleteMenuProps {
	menu: EntityAutocompleteMenuState;
	textarea: HTMLTextAreaElement | null;
	/** Called on Enter or click; the host inserts the candidate's link at the caret. */
	onSelect: (candidate: AutocompleteCandidate) => void;
}

/**
 * "Insert link" autocomplete popup rendered below the caret. Absolutely
 * positioned inside the nearest positioned ancestor (the host wraps its
 * editor in a relative container); coordinates are derived from the
 * textarea/caret rects so the same menu works for plain textareas and
 * @uiw/react-md-editor's inner textarea.
 */
export function EntityLinkAutocompleteMenu({ menu, textarea, onSelect }: EntityLinkAutocompleteMenuProps) {
	const { listRef, position } = useCaretPopupPosition(menu.caret, textarea);

	return (
		<div
			ref={listRef}
			role="listbox"
			aria-label="Insert entity link"
			className="absolute z-50 min-w-56 max-h-56 overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
			style={position ? { top: position.top, left: position.left } : { visibility: "hidden" }}
		>
			{menu.candidates.map((candidate, index) => {
				const selected = index === menu.selectedIndex;
				return (
					<div key={`${candidate.kind}:${candidate.id}`} role="option" aria-selected={selected} tabIndex={-1}>
						<button
							type="button"
							className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${
								selected
									? "bg-blue-100 text-blue-900 dark:bg-blue-900/50 dark:text-blue-100"
									: "text-gray-900 dark:text-gray-100"
							}`}
							onMouseDown={(event) => event.preventDefault()}
							onClick={() => onSelect(candidate)}
						>
							<span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600 dark:bg-gray-700 dark:text-gray-300">
								{AUTOCOMPLETE_KIND_LABELS[candidate.kind]}
							</span>
							<span className="truncate font-mono">{candidate.id}</span>
						</button>
					</div>
				);
			})}
		</div>
	);
}
