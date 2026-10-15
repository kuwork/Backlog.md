interface SwitchProps {
	/** Optional id so an enclosing label can target the input via htmlFor. */
	id?: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
	ariaLabel?: string;
}

/**
 * Presentational on/off switch. The real checkbox is visually hidden but stays
 * focusable; the track and knob are drawn by the sibling spans. The checked track
 * uses the same blue as the Settings page switches.
 */
export default function Switch({ id, checked, onChange, ariaLabel }: SwitchProps) {
	return (
		// The relative wrapper is the input's positioning context: without it the sr-only checkbox
		// resolves `position: absolute` against the initial containing block, stays at its unscrolled
		// document position while an inner scroll container moves, and clicking the label then
		// scroll-into-views the window to that stale spot (blank page jump).
		<span className="relative inline-block">
			<input
				id={id}
				type="checkbox"
				role="switch"
				aria-checked={checked}
				checked={checked}
				onChange={(event) => onChange(event.target.checked)}
				aria-label={ariaLabel}
				className="sr-only peer"
			/>
			<span
				aria-hidden="true"
				className="relative inline-block w-9 h-5 rounded-circle bg-gray-300 dark:bg-gray-600 transition-colors duration-200 peer-checked:bg-blue-500 peer-focus-visible:ring-2 peer-focus-visible:ring-stone-500 dark:peer-focus-visible:ring-stone-400"
			>
				<span
					aria-hidden="true"
					className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-circle bg-white shadow transition-transform duration-200 ease-out ${
						checked ? "translate-x-4" : "translate-x-0"
					}`}
				/>
			</span>
		</span>
	);
}
