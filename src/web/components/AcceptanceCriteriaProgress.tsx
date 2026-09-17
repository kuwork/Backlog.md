import type { Task } from "../../types";

interface AcceptanceCriteriaProgressProps {
	task: Pick<Task, "status" | "acceptanceCriteriaItems">;
	/** "cells" renders the monospace [██░░] indicator; "bar" renders the rounded track used by the task modal. The bar track is w-full, so the width is controlled by the component className (e.g. "flex-1" to fill or "w-20" for a fixed width). */
	variant?: "cells" | "bar";
	/** Cell count for the "cells" variant. */
	cells?: 5 | 10;
	className?: string;
}

const VARIANT_CLASSES: Record<"cells" | "bar", string> = {
	cells: "gap-1 whitespace-nowrap font-mono text-[10px] font-medium text-blue-600 dark:text-blue-300",
	bar: "gap-1.5 text-xs text-gray-500 dark:text-gray-400",
};

const normalizeStatus = (status: string) => status.trim().toLowerCase().replace(/\s+/g, "");

export default function AcceptanceCriteriaProgress({
	task,
	variant = "cells",
	cells = 10,
	className = "",
}: AcceptanceCriteriaProgressProps) {
	const criteria = task.acceptanceCriteriaItems ?? [];
	if (normalizeStatus(task.status) !== "inprogress" || criteria.length === 0) return null;

	const checked = criteria.reduce((total, criterion) => total + Number(criterion.checked), 0);
	const fraction = `${checked}/${criteria.length}`;
	const percent = (checked / criteria.length) * 100;
	const filled = Math.round((percent / 100) * cells);

	return (
		<span
			className={`inline-flex items-center ${VARIANT_CLASSES[variant]} ${className}`}
			data-acceptance-criteria-progress
			{...(variant === "cells" ? { "data-cell-count": cells } : {})}
			role="progressbar"
			aria-label="Acceptance criteria progress"
			aria-valuemin={0}
			aria-valuemax={criteria.length}
			aria-valuenow={checked}
			title={`${checked} of ${criteria.length} acceptance criteria checked`}
		>
			{variant === "cells" ? (
				<>
					<span aria-hidden="true">{`[${"█".repeat(filled)}${"░".repeat(cells - filled)}]`}</span>
					<span>{fraction}</span>
				</>
			) : (
				<>
					<span className="w-full h-2 rounded-full bg-gray-200 dark:bg-gray-500 overflow-hidden">
						<span className="block h-full bg-emerald-500 transition-all duration-300" style={{ width: `${percent}%` }} />
					</span>
					<span className="flex-shrink-0">{fraction}</span>
				</>
			)}
		</span>
	);
}
