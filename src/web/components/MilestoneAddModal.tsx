import React, { useState } from "react";
import Modal from "./Modal";
import { PasteAwareMDEditor } from "./PasteAwareMDEditor";
import { apiClient } from "../lib/api";
import { useTheme } from "../contexts/ThemeContext";
import { useI18n } from "../hooks/useI18n";
import { extractTempImageUrls, replaceTempImageUrls } from "../utils/temp-assets";
import { dateTimeLocalToStoredUtc, storedUtcToDateTimeLocal } from "../utils/date-display";

interface Props {
	isOpen: boolean;
	onClose: () => void;
	onCreated: (title: string) => Promise<void> | void;
}

const inputClass =
	"w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 dark:[color-scheme:dark]";

const MilestoneAddModal: React.FC<Props> = ({ isOpen, onClose, onCreated }) => {
	const { t } = useI18n();
	const { theme } = useTheme();
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [dueDate, setDueDate] = useState("");
	const [plannedStart, setPlannedStart] = useState("");
	const [plannedEnd, setPlannedEnd] = useState("");
	const [actualStart, setActualStart] = useState("");
	const [actualEnd, setActualEnd] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isSaving, setIsSaving] = useState(false);

	const handleSubmit = async (event?: React.FormEvent<HTMLFormElement>) => {
		event?.preventDefault();
		const value = name.trim();
		if (!value) {
			setError(t.milestones.nameRequired);
			return;
		}
		setIsSaving(true);
		setError(null);
		try {
			let saveDescription = description;
			const tempUrls = extractTempImageUrls(description);
			if (tempUrls.length > 0) {
				const mapping = await apiClient.promoteAssets(tempUrls);
				saveDescription = replaceTempImageUrls(description, mapping);
			}
			await apiClient.createMilestone(
				value,
				saveDescription,
				dueDate,
				plannedStart,
				plannedEnd,
				actualStart,
				actualEnd,
			);
			await onCreated(value);
			onClose();
		} catch (err) {
			console.error("Failed to add milestone:", err);
			setError(err instanceof Error ? err.message : t.milestones.addError);
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title={t.milestones.addTitle}
			maxWidthClass="max-w-5xl"
			actions={
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={onClose}
						className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors duration-200"
						title={t.common.cancel}
					>
						<svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
						</svg>
						{t.common.cancel}
					</button>
					<button
						type="button"
						onClick={() => void handleSubmit()}
						disabled={isSaving || !name.trim()}
						className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors duration-200 disabled:opacity-50"
						title={t.common.create}
					>
						<svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
						</svg>
						{isSaving ? t.common.saving : t.common.create}
					</button>
				</div>
			}
		>
			<form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
				<div className="space-y-4 md:col-span-2">
					<div className="space-y-2">
						<label className="text-sm font-medium text-gray-900 dark:text-gray-100">{t.milestones.nameLabel}</label>
						<input
							type="text"
							value={name}
							onChange={(e) => {
								setName(e.target.value);
								if (error) setError(null);
							}}
							placeholder={t.milestones.namePlaceholder}
							autoFocus
							className={inputClass}
						/>
						{error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
					</div>
					<div className="space-y-2">
						<label className="text-sm font-medium text-gray-900 dark:text-gray-100">{t.milestones.descriptionLabel}</label>
						<div className="border border-gray-200 dark:border-gray-700 rounded-md">
							<PasteAwareMDEditor
								value={description}
								onChange={(value) => setDescription(value || "")}
								preview="edit"
								height={260}
								data-color-mode={theme}
							/>
						</div>
					</div>
				</div>
				<div className="space-y-4">
					<div className="space-y-2">
						<label className="text-sm font-medium text-gray-900 dark:text-gray-100">{t.taskDetails.section.dueDate}</label>
						<input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
					</div>
					<div className="space-y-2">
						<label className="text-sm font-medium text-gray-900 dark:text-gray-100">
							{t.taskDetails.section.plannedStart}
						</label>
						<input
							type="date"
							value={plannedStart}
							onChange={(e) => setPlannedStart(e.target.value)}
							className={inputClass}
						/>
					</div>
					<div className="space-y-2">
						<label className="text-sm font-medium text-gray-900 dark:text-gray-100">
							{t.taskDetails.section.plannedEnd}
						</label>
						<input type="date" value={plannedEnd} onChange={(e) => setPlannedEnd(e.target.value)} className={inputClass} />
					</div>
					<div className="space-y-2">
						<label className="text-sm font-medium text-gray-900 dark:text-gray-100">
							{t.taskDetails.section.actualStart}
						</label>
						<input
							type="datetime-local"
							value={storedUtcToDateTimeLocal(actualStart)}
							onChange={(e) => setActualStart(dateTimeLocalToStoredUtc(e.target.value))}
							className={inputClass}
						/>
					</div>
					<div className="space-y-2">
						<label className="text-sm font-medium text-gray-900 dark:text-gray-100">
							{t.taskDetails.section.actualEnd}
						</label>
						<input
							type="datetime-local"
							value={storedUtcToDateTimeLocal(actualEnd)}
							onChange={(e) => setActualEnd(dateTimeLocalToStoredUtc(e.target.value))}
							className={inputClass}
						/>
					</div>
				</div>
			</form>
		</Modal>
	);
};

export default MilestoneAddModal;
