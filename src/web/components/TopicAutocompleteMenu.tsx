import { useCaretPopupPosition } from "../hooks/useCaretPopupPosition";
import type { TopicAutocompleteMenuState } from "../hooks/useTopicAutocomplete";

export interface TopicAutocompleteMenuProps {
	menu: TopicAutocompleteMenuState;
	textarea: HTMLTextAreaElement | null;
	/** Called on Enter/Tab or click; the host inserts the topic, closed. */
	onSelect: (topic: string) => void;
}

/**
 * The topic popup rendered below the caret. It offers topics already in use and - once the typed
 * text matches none of them - a `NEW` row carrying that text, so a topic typed for the first time
 * is completable too. Every row is shown in the closed `#topic#` form it will be inserted as;
 * picking one is what closes the topic, so the user never has to type the trailing hash.
 */
export function TopicAutocompleteMenu({ menu, textarea, onSelect }: TopicAutocompleteMenuProps) {
	const { listRef, position } = useCaretPopupPosition(menu.caret, textarea);

	return (
		<div
			ref={listRef}
			role="listbox"
			aria-label="Insert topic"
			data-testid="topic-autocomplete-menu"
			className="absolute z-50 min-w-44 max-h-56 overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
			style={position ? { top: position.top, left: position.left } : { visibility: "hidden" }}
		>
			{menu.candidates.map((candidate, index) => {
				const selected = index === menu.selectedIndex;
				return (
					<div key={candidate.topic} role="option" aria-selected={selected} tabIndex={-1}>
						<button
							type="button"
							data-testid="topic-autocomplete-option"
							data-new-topic={candidate.isNew ? "true" : undefined}
							className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${
								selected
									? "bg-blue-100 text-blue-900 dark:bg-blue-900/50 dark:text-blue-100"
									: "text-gray-900 dark:text-gray-100"
							}`}
							onMouseDown={(event) => event.preventDefault()}
							onClick={() => onSelect(candidate.topic)}
						>
							{candidate.isNew && (
								<span className="shrink-0 rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600 dark:bg-gray-700 dark:text-gray-300">
									NEW
								</span>
							)}
							<span className="truncate font-mono">#{candidate.topic}#</span>
						</button>
					</div>
				);
			})}
		</div>
	);
}
