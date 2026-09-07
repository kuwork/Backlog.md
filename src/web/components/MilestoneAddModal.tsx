import React, { useState } from "react";
import Modal from "./Modal";
import { PasteAwareMDEditor } from "./PasteAwareMDEditor";
import { PathAutocomplete } from "./PathAutocomplete";
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
	"w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 dark:[color-scheme:dark]";

const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
	<h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 tracking-tight transition-colors duration-200">
		{title}
	</h3>
);

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
	const [documentation, setDocumentation] = useState<string[]>([]);
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
				documentation,
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
					<div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
						<SectionHeader title={t.taskDetails.section.documentation} />
						<div className="space-y-3">
							{documentation.length > 0 ? (
								<ul className="space-y-2">
									{documentation.map((doc, idx) => (
										<li key={idx} className="flex items-center gap-3 group">
											<span className="flex-1 min-w-0">
												{doc.startsWith("http://") || doc.startsWith("https://") ? (
													<a
														href={doc}
														target="_blank"
														rel="noopener noreferrer"
														className="text-sm text-blue-600 dark:text-blue-400 hover:underline break-all"
													>
														{doc}
													</a>
												) : (
													<span className="text-sm font-mono text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded break-all">
														{doc}
													</span>
												)}
											</span>
											<button
												type="button"
												onClick={() => setDocumentation(documentation.filter((_, i) => i !== idx))}
												className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all flex-shrink-0"
												title={t.taskDetails.removeDocumentation}
											>
												<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
												</svg>
											</button>
										</li>
									))}
								</ul>
							) : (
								<p className="text-sm text-gray-500 dark:text-gray-400">{t.taskDetails.noDocumentation}</p>
							)}
							<div className="flex gap-2">
								<PathAutocomplete
									name="newDoc"
									placeholder={t.taskDetails.placeholderRefDoc}
									className="flex-1 text-sm px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
								/>
								<button
									type="button"
									onClick={(e) => {
										const input = (e.currentTarget.parentElement?.querySelector("input[name='newDoc']") as HTMLInputElement | null);
										const value = input?.value.trim() ?? "";
										if (value && !documentation.includes(value)) {
											setDocumentation([...documentation, value]);
											if (input) input.value = "";
										}
									}}
									className="px-4 py-2 text-sm font-medium bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
								>
									{t.common.add}
								</button>
							</div>
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
