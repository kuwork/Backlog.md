import React, { useEffect, useState } from "react";
import { apiClient } from "../lib/api";
import { useI18n } from "../hooks/useI18n";
import Modal from "./Modal";
import type { Task } from "../../types";

interface DuplicateGroup {
	id: string;
	tasks: Task[];
}

interface DuplicateRepairChange {
	sourcePath: string;
	targetPath: string;
	oldId: string;
	newId: string;
	title: string;
}

interface DuplicateReferenceReview {
	path: string;
	line: number;
	text: string;
	ids: string[];
}

interface DuplicateRepairPlan {
	groups: DuplicateGroup[];
	changes: DuplicateRepairChange[];
	references: DuplicateReferenceReview[];
	referenceScanComplete: boolean;
	blockedReasons: string[];
	repairable: boolean;
}

interface DuplicateRepairResult {
	repairedFiles: number;
	changes: DuplicateRepairChange[];
	references: DuplicateReferenceReview[];
}

interface DuplicateTaskRepairModalProps {
	isOpen: boolean;
	onClose: () => void;
	onRepaired: () => void;
}

const DuplicateTaskRepairModal: React.FC<DuplicateTaskRepairModalProps> = ({ isOpen, onClose, onRepaired }) => {
	const { t } = useI18n();
	const [plan, setPlan] = useState<DuplicateRepairPlan | null>(null);
	const [result, setResult] = useState<DuplicateRepairResult | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [isRepairing, setIsRepairing] = useState(false);
	const [isCommitting, setIsCommitting] = useState(false);
	const [isRollingBack, setIsRollingBack] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);

	const loadPreview = async () => {
		setIsLoading(true);
		setError(null);
		setSuccess(null);
		setResult(null);
		try {
			const preview = await apiClient.getDuplicateTaskIdsPreview();
			setPlan(preview);
		} catch (err) {
			setError(err instanceof Error ? err.message : t.duplicateRepair.failedToLoadPreview);
			setPlan(null);
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		if (isOpen) {
			void loadPreview();
		}
	}, [isOpen]);

	const handleRepair = async () => {
		setIsRepairing(true);
		setError(null);
		setSuccess(null);
		try {
			const repairResult = await apiClient.repairDuplicateTaskIds();
			setResult(repairResult);
			setSuccess(t.duplicateRepair.repairSuccess(repairResult.repairedFiles));
			onRepaired();
		} catch (err) {
			setError(err instanceof Error ? err.message : t.duplicateRepair.failedToRepair);
		} finally {
			setIsRepairing(false);
		}
	};

	const handleCommit = async () => {
		setIsCommitting(true);
		setError(null);
		setSuccess(null);
		try {
			const { removedBackups } = await apiClient.commitDuplicateTaskIdsRepair();
			setSuccess(t.duplicateRepair.commitSuccess(removedBackups.length));
			setResult(null);
			await loadPreview();
		} catch (err) {
			setError(err instanceof Error ? err.message : t.duplicateRepair.failedToCommit);
		} finally {
			setIsCommitting(false);
		}
	};

	const handleRollback = async () => {
		setIsRollingBack(true);
		setError(null);
		setSuccess(null);
		try {
			const { restored, removed } = await apiClient.rollbackDuplicateTaskIdsRepair();
			setSuccess(t.duplicateRepair.rollbackSuccess(restored.length, removed.length));
			setResult(null);
			onRepaired();
			await loadPreview();
		} catch (err) {
			setError(err instanceof Error ? err.message : t.duplicateRepair.failedToRollback);
		} finally {
			setIsRollingBack(false);
		}
	};

	const handleClose = () => {
		setPlan(null);
		setResult(null);
		setError(null);
		setSuccess(null);
		onClose();
	};

	const renderGroups = () => {
		if (!plan || plan.groups.length === 0) return null;
		return (
			<div className="space-y-4">
				<h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
					{t.duplicateRepair.warning(plan.groups.length)}
				</h3>
				{plan.groups.map((group, index) => (
					<div key={group.id} className="rounded-md bg-gray-50 dark:bg-gray-800 p-3">
						<p className="text-sm font-medium text-gray-900 dark:text-gray-100">
							{t.duplicateRepair.group(index + 1, group.id)}
						</p>
						<ul className="mt-2 space-y-1">
							{group.tasks.map((task) => (
								<li key={task.id} className="text-xs text-gray-600 dark:text-gray-400">
									{task.filePath ?? task.title}
								</li>
							))}
						</ul>
					</div>
				))}
			</div>
		);
	};

	const renderChanges = () => {
		if (!plan || plan.changes.length === 0) return null;
		return (
			<div className="space-y-2">
				<h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t.duplicateRepair.plannedRepairs}</h3>
				<ul className="space-y-1">
					{plan.changes.map((change) => (
						<li key={change.sourcePath} className="text-xs text-gray-600 dark:text-gray-400">
							<code className="break-all">{change.sourcePath}</code>
							<span className="mx-2">→</span>
							<code className="break-all">{change.targetPath}</code>
						</li>
					))}
				</ul>
			</div>
		);
	};

	const renderReferences = (items: DuplicateReferenceReview[]) => {
		if (items.length === 0) return null;
		return (
			<div className="space-y-2">
				<h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
					{t.duplicateRepair.referencesToReview}
				</h3>
				<ul className="space-y-1 max-h-48 overflow-auto">
					{items.map((reference, index) => (
						<li key={index} className="text-xs text-gray-600 dark:text-gray-400">
							<code className="break-all">
								{reference.path}:{reference.line}
							</code>
							<p className="mt-0.5 italic">{reference.text}</p>
						</li>
					))}
				</ul>
			</div>
		);
	};

	const renderBlockedReasons = () => {
		if (!plan || plan.blockedReasons.length === 0) return null;
		return (
			<div className="space-y-2">
				<h3 className="text-sm font-semibold text-red-700 dark:text-red-300">{t.duplicateRepair.blockedReasons}</h3>
				<ul className="space-y-1">
					{plan.blockedReasons.map((reason, index) => (
						<li key={index} className="text-xs text-red-600 dark:text-red-300">
							{reason}
						</li>
					))}
				</ul>
				<p className="text-xs text-red-600 dark:text-red-300">{t.duplicateRepair.cannotRepair}</p>
			</div>
		);
	};

	const noDuplicates = plan && plan.groups.length === 0;

	return (
		<Modal isOpen={isOpen} onClose={handleClose} title={t.duplicateRepair.title} maxWidthClass="max-w-3xl">
			<div className="space-y-6">
				{isLoading && (
					<div className="text-center py-4">
						<div className="text-gray-600 dark:text-gray-400">{t.duplicateRepair.loadingPreview}</div>
					</div>
				)}

				{error && (
					<div className="rounded-md bg-red-100 dark:bg-red-900/40 p-3">
						<p className="text-sm text-red-700 dark:text-red-200">{error}</p>
					</div>
				)}

				{success && (
					<div className="rounded-md bg-green-100 dark:bg-green-900/40 p-3">
						<p className="text-sm text-green-700 dark:text-green-200">{success}</p>
					</div>
				)}

				{!isLoading && noDuplicates && (
					<div className="text-center py-8 text-gray-500 dark:text-gray-400">{t.duplicateRepair.noDuplicates}</div>
				)}

				{!isLoading && plan && plan.groups.length > 0 && (
					<>
						{renderGroups()}
						{renderChanges()}
						{renderReferences(result?.references ?? plan.references)}
						{renderBlockedReasons()}
						{result && result.references.length > 0 && (
							<div className="rounded-md bg-yellow-50 dark:bg-yellow-900/30 p-3">
								<p className="text-sm text-yellow-800 dark:text-yellow-200">{t.duplicateRepair.manualReferenceHint}</p>
							</div>
						)}
					</>
				)}

				<div className="flex flex-wrap items-center justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
					<button
						type="button"
						onClick={handleClose}
						className="px-4 py-2 rounded-md text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
					>
						{t.common.close}
					</button>
					{plan?.repairable && !result && (
						<button
							type="button"
							onClick={handleRepair}
							disabled={isRepairing}
							className="px-4 py-2 rounded-md text-sm font-medium bg-blue-500 dark:bg-blue-600 text-white hover:bg-blue-600 dark:hover:bg-blue-700 disabled:opacity-50"
						>
							{isRepairing ? t.duplicateRepair.repairing : t.duplicateRepair.repair}
						</button>
					)}
					{result && (
						<>
							<button
								type="button"
								onClick={handleRollback}
								disabled={isRollingBack}
								className="px-4 py-2 rounded-md text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
							>
								{isRollingBack ? t.duplicateRepair.rollingBack : t.duplicateRepair.rollback}
							</button>
							<button
								type="button"
								onClick={handleCommit}
								disabled={isCommitting}
								className="px-4 py-2 rounded-md text-sm font-medium bg-blue-500 dark:bg-blue-600 text-white hover:bg-blue-600 dark:hover:bg-blue-700 disabled:opacity-50"
							>
								{isCommitting ? t.duplicateRepair.committing : t.duplicateRepair.commit}
							</button>
						</>
					)}
					{!result && plan && plan.groups.length > 0 && !plan.repairable && (
						<button
							type="button"
							onClick={handleRollback}
							disabled={isRollingBack}
							className="px-4 py-2 rounded-md text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
						>
							{isRollingBack ? t.duplicateRepair.rollingBack : t.duplicateRepair.rollback}
						</button>
					)}
				</div>
			</div>
		</Modal>
	);
};

export default DuplicateTaskRepairModal;
