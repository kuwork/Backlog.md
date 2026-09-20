import { formatStoredUtcDateForCompactDisplay, formatStoredUtcDateForDisplay } from "../utils/date-display";

interface StoredDateProps {
	/** The value as stored in the Markdown (UTC). */
	value: string;
	/** Dense lists render recent values relatively ("today", "3d ago"). */
	compact?: boolean;
	/** Reference time for the compact label; defaults to now. */
	now?: Date;
	/** Classes the host already applied to the date node, so layout is unchanged. */
	className?: string;
}

/**
 * Renders a stored date through the shared web date helpers, so the canonical UTC value is on
 * hover wherever a date is shown and no component converts or formats on its own. Date-only
 * values get no title: there is no time to name.
 */
export default function StoredDate({ value, compact = false, now, className }: StoredDateProps) {
	const { text, title } = compact
		? formatStoredUtcDateForCompactDisplay(value, now)
		: formatStoredUtcDateForDisplay(value);

	return (
		<span className={className} title={title}>
			{text}
		</span>
	);
}
