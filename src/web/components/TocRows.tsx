import { useI18n } from "../hooks/useI18n";
import type { TocRow } from "../utils/toc";

const CHEVRON_ICON_PATH = "M9 5l7 7-7 7";

/**
 * Indented outline rows shared by the header TocButton panel and the modal
 * TocDrawer: entries nest by heading level and every entry that owns a subtree
 * can be folded away.
 */
export default function TocRows({
	rows,
	activeId,
	activeAncestors,
	isCollapsed,
	onSelect,
	onToggle,
}: {
	rows: TocRow[];
	activeId: string | null;
	activeAncestors: Set<string>;
	isCollapsed: (id: string) => boolean;
	onSelect: (id: string) => void;
	onToggle: (id: string) => void;
}) {
	const { t } = useI18n();

	return (
		<ul className="space-y-0.5">
			{rows.map(({ item, hasChildren }) => {
				const isActive = item.id === activeId;
				const isFolded = hasChildren && isCollapsed(item.id);
				// A folded branch holding the current section still gets the accent,
				// so the reader can tell where they are without opening everything.
				const holdsActive = !isActive && activeAncestors.has(item.id);
				return (
					<li key={item.id} data-toc-level={item.level} style={{ paddingLeft: 12 + (item.level - 1) * 12 }}>
						<div className="flex items-stretch">
							{hasChildren ? (
								<button
									type="button"
									aria-expanded={!isFolded}
									aria-label={`${isFolded ? t.toc.expand : t.toc.collapse} — ${item.text}`}
									onClick={() => onToggle(item.id)}
									className="flex w-5 shrink-0 items-center justify-center rounded text-gray-400 transition-colors duration-200 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-stone-400 dark:text-gray-500 dark:hover:text-gray-200"
								>
									<svg
										className={`h-3.5 w-3.5 transition-transform duration-200 ${isFolded ? "" : "rotate-90"}`}
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
										aria-hidden="true"
									>
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={CHEVRON_ICON_PATH} />
									</svg>
								</button>
							) : (
								<span className="w-5 shrink-0" aria-hidden="true" />
							)}
							<a
								href={`#${item.id}`}
								aria-current={isActive ? "true" : undefined}
								title={item.text}
								onClick={(event) => {
									event.preventDefault();
									onSelect(item.id);
								}}
								className={`block min-w-0 flex-1 truncate border-l-2 py-1 pr-2 text-sm transition-colors duration-200 ${
									isActive
										? "border-blue-500 font-medium text-blue-600 dark:border-blue-400 dark:text-blue-400"
										: holdsActive
											? "border-transparent text-blue-600 dark:text-blue-400"
											: "border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
								}`}
							>
								{item.text}
							</a>
						</div>
					</li>
				);
			})}
		</ul>
	);
}
