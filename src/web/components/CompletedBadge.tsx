import { useI18n } from "../hooks/useI18n";

interface CompletedBadgeProps {
	/** Shape and size classes, so each host keeps the chip style of the list it lives in. */
	className?: string;
}

/**
 * The one completed-corpus marker. Its background is the emerald of the task modal's
 * "mark completed" button, the action that moves a task into that corpus, and its tooltip
 * carries the read-only hint from BACK-663.
 */
export default function CompletedBadge({ className = "" }: CompletedBadgeProps) {
	const { t } = useI18n();
	return (
		<span
			className={`inline-flex shrink-0 items-center bg-emerald-600 text-white dark:bg-emerald-700 ${className}`}
			title={t.taskDetails.completedCorpusHint}
		>
			{t.common.completedBadge}
		</span>
	);
}
