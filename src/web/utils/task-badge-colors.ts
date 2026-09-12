export function getStatusBadgeColor(status: string): string {
	switch (status.toLowerCase()) {
		case "to do":
			return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
		case "in progress":
			return "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200";
		case "done":
			return "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200";
		default:
			return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
	}
}

export function getPriorityBadgeColor(priority?: string): string {
	switch (priority?.toLowerCase()) {
		case "high":
			return "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200";
		case "medium":
			return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200";
		case "low":
			return "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200";
		default:
			return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
	}
}
