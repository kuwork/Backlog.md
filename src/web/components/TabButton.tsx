interface TabButtonProps {
	/** Anchor for the panel's `aria-labelledby`. */
	id: string;
	label: string;
	/**
	 * Optional trailing count. A count is only worth its space when there is something behind it:
	 * an empty list shows the bare caption, so the strip does not fill up with (0)s.
	 */
	count?: number;
	active: boolean;
	onSelect: () => void;
}

/**
 * One entry of a `role="tablist"` strip. Shared by every tab strip in the UI so strips keep the
 * same shape, weight and active state wherever they appear.
 */
export default function TabButton({ id, label, count = 0, active, onSelect }: TabButtonProps) {
	return (
		<button
			type="button"
			role="tab"
			id={id}
			aria-selected={active}
			onClick={onSelect}
			className={`px-3 py-1.5 rounded-md text-sm font-semibold tracking-tight transition-colors duration-200 ${
				active
					? "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
					: "text-gray-500 dark:text-gray-400 hover:bg-gray-50 hover:text-gray-900 dark:hover:bg-gray-700/50 dark:hover:text-gray-100"
			}`}
		>
			{label}
			{count > 0 && <span className="ml-1 font-normal tabular-nums">{`(${count})`}</span>}
		</button>
	);
}
