import { useI18n } from "../hooks/useI18n";
import Switch from "./Switch";

interface CompletedFilterToggleProps {
	/** Id of the input, so each view can keep its DOM ids unique. */
	id: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
	/**
	 * `filter` draws the bordered pill the board and the task list put in their filter rows.
	 * `plain` drops the chrome so the toggle reads as part of the card it sits in.
	 */
	variant?: "filter" | "plain";
}

const VARIANT_CLASSES: Record<"filter" | "plain", string> = {
	filter:
		"h-10 py-2 px-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700",
	plain: "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100",
};

/**
 * The one completed-corpus toggle. The board and the task list both append it
 * after their own filter controls, followed by the clear-filters button, so the
 * two filter rows end the same way.
 */
export default function CompletedFilterToggle({
	id,
	checked,
	onChange,
	variant = "filter",
}: CompletedFilterToggleProps) {
	const { t } = useI18n();
	return (
		<label
			htmlFor={id}
			className={`inline-flex items-center gap-2.5 py-1 text-sm cursor-pointer select-none whitespace-nowrap transition-colors duration-200 ${VARIANT_CLASSES[variant]}`}
		>
			{t.common.showCompleted}
			<Switch id={id} checked={checked} onChange={onChange} />
		</label>
	);
}
