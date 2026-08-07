import { useEffect, useRef, useState } from "react";
import { useI18n } from "../hooks/useI18n";

interface StatusFilterDropdownProps {
	availableStatuses: string[];
	selectedStatuses: string[];
	onChange: (statuses: string[]) => void;
	menuId: string;
	className?: string;
}

/**
 * Multi-select status include filter, modeled after LabelFilterDropdown.
 * Shows tasks whose status is one of the selected statuses.
 */
export default function StatusFilterDropdown({
	availableStatuses,
	selectedStatuses,
	onChange,
	menuId,
	className = "min-w-[200px]",
}: StatusFilterDropdownProps) {
	const [isOpen, setIsOpen] = useState(false);
	const buttonRef = useRef<HTMLButtonElement | null>(null);
	const menuRef = useRef<HTMLDivElement | null>(null);
	const { t } = useI18n();

	useEffect(() => {
		if (!isOpen) return;
		const handleClickOutside = (event: MouseEvent) => {
			const target = event.target as Node;
			if (
				buttonRef.current &&
				menuRef.current &&
				!buttonRef.current.contains(target) &&
				!menuRef.current.contains(target)
			) {
				setIsOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [isOpen]);

	const toggleStatus = (status: string) => {
		const next = selectedStatuses.includes(status)
			? selectedStatuses.filter((item) => item !== status)
			: [...selectedStatuses, status];
		onChange(next);
	};

	return (
		<div className="relative">
			<button
				type="button"
				ref={buttonRef}
				onClick={() => setIsOpen((open) => !open)}
				aria-expanded={isOpen}
				aria-controls={menuId}
				className={`${className} py-2 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-stone-500 dark:focus:ring-stone-400 transition-colors duration-200 text-left`}
			>
				<div className="flex items-center justify-between gap-2">
					<span>{t.statusFilter.statuses}</span>
					<span className="text-xs text-gray-500 dark:text-gray-400">
						{selectedStatuses.length === 0
							? t.common.all
							: selectedStatuses.length === 1
								? selectedStatuses[0]
								: `${selectedStatuses.length} selected`}
					</span>
				</div>
			</button>
			{isOpen && (
				<div
					id={menuId}
					ref={menuRef}
					className="absolute z-50 mt-2 w-[240px] rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg max-h-80 overflow-y-auto"
				>
					{availableStatuses.length === 0 ? (
						<div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">{t.statusFilter.noStatuses}</div>
					) : (
						availableStatuses.map((status) => {
							const isSelected = selectedStatuses.includes(status);
							return (
								<button
									key={status}
									type="button"
									onClick={() => toggleStatus(status)}
									className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
										isSelected ? "text-gray-900 dark:text-gray-100" : "text-gray-700 dark:text-gray-300"
									}`}
								>
									<span>{status}</span>
									{isSelected && (
										<svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
										</svg>
									)}
								</button>
							);
						})
					)}
					{selectedStatuses.length > 0 && (
						<button
							type="button"
							onClick={() => onChange([])}
							className="w-full px-3 py-2 text-sm text-left border-t border-gray-200 dark:border-gray-700 text-stone-500 dark:text-stone-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
						>
							{t.statusFilter.clearFilter}
						</button>
					)}
				</div>
			)}
		</div>
	);
}
