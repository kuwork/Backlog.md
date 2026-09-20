import { useI18n } from '../hooks/useI18n';

interface BoardLoadingSkeletonProps {
	/** Ghost columns to render; pass the configured status count so the real board mounts without a width jump. */
	columnCount?: number;
}

/**
 * First-load placeholder for the kanban board. Renders ghost columns with the
 * same chrome and geometry as the real board so content replaces it in place,
 * plus a compact centered spinner matching the branch-indexing chip ring.
 *
 * Shown only before the first successful data load (see BACK-668): the header
 * chip already carries the progress sentence, so the skeleton stays copy-free
 * and only announces itself to assistive tech.
 *
 * Everything here animates even on hosts that ask for reduced motion (BACK-670): those hosts are
 * the ones with system animations switched off (MinAnimate=0 over RDP, VMs), and a still ring over
 * still ghosts reads as a hung board rather than a loading one.
 */
export function BoardLoadingSkeleton({ columnCount }: BoardLoadingSkeletonProps) {
	const { t } = useI18n();
	const columns = columnCount && columnCount > 0 ? columnCount : 3;
	return (
		<div className="relative" role="status" aria-label={t.board.loading}>
			<div className="overflow-x-auto pb-2" aria-hidden="true">
				<div className="flex flex-row flex-nowrap gap-4 w-full">
					{Array.from({ length: columns }, (_, column) => (
						<div key={column} className="flex-1 min-w-[16rem]">
							{/* min-h-24 is the floor every real column has (TaskColumn), so the board only
							    ever grows from here - it never contracts, even on an empty project. */}
							<div className="rounded-lg p-4 min-h-24 bg-white border border-gray-200 shadow-sm dark:bg-gray-800 dark:border-gray-700 transition-colors duration-200">
								<div className="mb-3 h-4 w-24 animate-pulse rounded-md bg-gray-100 dark:bg-gray-700/50" />
								<div className="h-8 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-700/50" />
							</div>
						</div>
					))}
				</div>
			</div>
			<div className="pointer-events-none absolute inset-0 flex items-center justify-center">
				<span
					className="h-5 w-5 animate-spin rounded-circle border-2 border-blue-200 border-t-blue-600 dark:border-blue-400/30 dark:border-t-blue-400"
					aria-hidden="true"
				/>
				<span className="sr-only">{t.board.loading}</span>
			</div>
		</div>
	);
}
