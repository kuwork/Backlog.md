interface SwitchProps {
	/** Optional id so an enclosing label can target the input via htmlFor. */
	id?: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
	ariaLabel?: string;
}

/**
 * Presentational on/off switch. The real checkbox is visually hidden but stays
 * focusable; the track and knob are drawn by the sibling spans. Checked track
 * uses the completed-corpus emerald so the "on" state reads as "已完成".
 */
export default function Switch({ id, checked, onChange, ariaLabel }: SwitchProps) {
	return (
		<>
			<input
				id={id}
				type="checkbox"
				role="switch"
				checked={checked}
				onChange={(event) => onChange(event.target.checked)}
				aria-label={ariaLabel}
				className="sr-only peer"
			/>
			<span
				aria-hidden="true"
				className="relative inline-block w-9 h-5 rounded-circle bg-gray-300 dark:bg-gray-600 transition-colors duration-200 peer-checked:bg-emerald-600 dark:peer-checked:bg-emerald-700 peer-focus-visible:ring-2 peer-focus-visible:ring-stone-500 dark:peer-focus-visible:ring-stone-400"
			>
				<span
					aria-hidden="true"
					className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-circle bg-white shadow transition-transform duration-200 ease-out ${
						checked ? "translate-x-4" : "translate-x-0"
					}`}
				/>
			</span>
		</>
	);
}
