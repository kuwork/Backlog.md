import { useI18n } from "../hooks/useI18n";
import Switch from "./Switch";

interface CompletedFilterToggleProps {
	/** Id of the input, so each view can keep its DOM ids unique. */
	id: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
}

/**
 * The one completed-corpus toggle. The board and the task list both append it
 * after their own filter controls, followed by the clear-filters button, so the
 * two filter rows end the same way.
 */
export default function CompletedFilterToggle({ id, checked, onChange }: CompletedFilterToggleProps) {
	const { t } = useI18n();
	return (
		<label
			htmlFor={id}
			className="inline-flex items-center gap-2.5 h-10 py-2 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 cursor-pointer select-none whitespace-nowrap hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
		>
			{t.common.showCompleted}
			<Switch id={id} checked={checked} onChange={onChange} />
		</label>
	);
}
