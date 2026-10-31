import { useI18nContext } from "../contexts/I18nContext";

// Corner-arrow glyphs shared by every fullscreen toggle in the app: pointing outwards to
// expand, inwards to collapse. Kept in one place so the graph panel, the memo board and the
// document previews cannot drift apart.
const EXPAND_ICON_PATH = "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5";
const COLLAPSE_ICON_PATH = "M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5";

interface FullscreenIconProps {
	active: boolean;
	className?: string;
}

export function FullscreenIcon({ active, className = "h-4 w-4" }: FullscreenIconProps) {
	return (
		<svg aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
			<path strokeLinecap="round" strokeLinejoin="round" d={active ? COLLAPSE_ICON_PATH : EXPAND_ICON_PATH} />
		</svg>
	);
}

interface FullscreenToggleButtonProps {
	active: boolean;
	onClick: () => void;
	className?: string;
}

const defaultButtonClass =
	"flex h-8 w-8 items-center justify-center rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300";

/**
 * Icon-only fullscreen toggle for modal headers. The label (fullscreen / exit fullscreen)
 * lives in the tooltip and the accessible name, matching the graph panel's toggle instead of
 * spending header width on a text button.
 */
export default function FullscreenToggleButton({
	active,
	onClick,
	className = defaultButtonClass,
}: FullscreenToggleButtonProps) {
	const { t } = useI18nContext();
	const label = active ? t.common.exitFullscreen : t.common.fullscreen;

	return (
		<button
			type="button"
			onClick={onClick}
			aria-label={label}
			aria-pressed={active}
			title={label}
			className={className}
		>
			<FullscreenIcon active={active} />
		</button>
	);
}
