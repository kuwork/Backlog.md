interface AmbiguousIdNoticeProps {
	message: string;
}

/** Renders a fail-closed identity conflict reported by the API (409 with candidates). */
export function AmbiguousIdNotice({ message }: AmbiguousIdNoticeProps) {
	return (
		<div
			className="mx-8 my-4 rounded border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-800 dark:border-yellow-700 dark:bg-gray-800 dark:text-yellow-200"
			role="alert"
		>
			<p className="font-medium whitespace-pre-wrap">{message}</p>
		</div>
	);
}
