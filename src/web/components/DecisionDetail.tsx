import { useState, useEffect, memo, useRef } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { apiClient, isAmbiguousIdConflict } from '../lib/api';
import { AmbiguousIdNotice } from './AmbiguousIdNotice';
import { PasteAwareMDEditor } from './PasteAwareMDEditor';
import MermaidMarkdown from './MermaidMarkdown';
import { type Decision } from '../../types';
import ErrorBoundary from '../components/ErrorBoundary';
import { SuccessToast } from './SuccessToast';
import { useTheme } from '../contexts/ThemeContext';
import { sanitizeUrlTitle, encodeWikiPath } from '../utils/urlHelpers';
import { useI18n } from '../hooks/useI18n';
import { normalizeMarkdownHashLinks } from '../../markdown/hash-links';
import { extractTempImageUrls, replaceTempImageUrls } from '../utils/temp-assets';

// Utility function for ID transformations
const stripIdPrefix = (id: string): string => {
	if (id.startsWith('decision-')) return id.replace('decision-', '');
	return id;
};

/** Canonical decision statuses offered by the editor; a non-canonical stored value is kept as an extra option. */
const DECISION_STATUS_OPTIONS = ['proposed', 'accepted', 'rejected', 'superseded'] as const;

/**
 * Presentation for a decision status: the same muted, theme-aware pill as task
 * statuses, plus a per-status leading icon so the state never relies on colour
 * alone. Unknown (free-form) statuses fall back to a neutral info style.
 */
const DECISION_STATUS_STYLES: Record<string, { chip: string; icon: string; path: string }> = {
	proposed: {
		chip: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
		icon: 'text-gray-500 dark:text-gray-400',
		path: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
	},
	accepted: {
		chip: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200',
		icon: 'text-green-600 dark:text-green-400',
		path: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
	},
	rejected: {
		chip: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200',
		icon: 'text-red-600 dark:text-red-400',
		path: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
	},
	deprecated: {
		chip: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200',
		icon: 'text-amber-600 dark:text-amber-400',
		path: 'M21 12a9 9 0 11-18 0 9 9 0 0118 0zM5.636 5.636l12.728 12.728',
	},
	superseded: {
		chip: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200',
		icon: 'text-blue-600 dark:text-blue-400',
		path: 'M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5',
	},
};

const DECISION_STATUS_UNKNOWN_STYLE = {
	chip: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
	icon: 'text-gray-500 dark:text-gray-400',
	path: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
};

// Custom MDEditor wrapper for proper height handling
const MarkdownEditor = memo(function MarkdownEditor({
	value,
	onChange,
	isEditing,
	onTaskClick,
	onDraftClick,
	onDocClick,
	onDecisionClick,
	onWikiClick,
}: {
	value: string;
	onChange?: (val: string | undefined) => void;
	isEditing: boolean;
	isReadonly?: boolean;
	onTaskClick?: (taskId: string) => void;
	onDraftClick?: (draftId: string) => void;
	onDocClick?: (docId: string) => void;
	onDecisionClick?: (decisionId: string) => void;
	onWikiClick?: (wikiPath: string) => void;
}) {
	const { t } = useI18n();
	const { theme } = useTheme();
	if (!isEditing) {
		// Preview mode - just show the rendered markdown without editor UI
			return (
				<div className="prose prose-sm !max-w-none w-full p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden" data-color-mode={theme}>
					<MermaidMarkdown source={value} onTaskClick={onTaskClick} onDraftClick={onDraftClick} onDocClick={onDocClick} onDecisionClick={onDecisionClick} onWikiClick={onWikiClick} wikilinkBasePath="index.md" />
				</div>
			);
	}

	// Edit mode - show full editor that fills the available space
	return (
		<div className="h-full w-full flex flex-col">
			<div className="flex-1 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
				<PasteAwareMDEditor
					value={value}
					onChange={onChange}
					preview="edit"
					height="100%"
					hideToolbar={false}
					data-color-mode={theme}
					textareaProps={{
						placeholder: t.decisions.placeholderBody,
						style: { 
							fontSize: '14px',
							resize: 'none'
						}
					}}
				/>
			</div>
		</div>
	);
});

// Utility function to add decision prefix for API calls
const addDecisionPrefix = (id: string): string => {
	return id.startsWith('decision-') ? id : `decision-${id}`;
};

interface DecisionDetailProps {
	decisions: Decision[];
	onRefreshData: () => Promise<void>;
}

export default function DecisionDetail({ decisions, onRefreshData }: DecisionDetailProps) {
	const { t } = useI18n();
	const { id, title } = useParams<{ id: string; title: string }>();
	const navigate = useNavigate();
	const location = useLocation();
	const [searchParams, setSearchParams] = useSearchParams();
	const [decision, setDecision] = useState<Decision | null>(null);
	const [content, setContent] = useState<string>('');
	const [originalContent, setOriginalContent] = useState<string>('');
	const [decisionTitle, setDecisionTitle] = useState<string>('');
	const [originalDecisionTitle, setOriginalDecisionTitle] = useState<string>('');
	const [decisionStatus, setDecisionStatus] = useState<string>('proposed');
	const [originalDecisionStatus, setOriginalDecisionStatus] = useState<string>('proposed');
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [isEditing, setIsEditing] = useState(false);
	const [error, setError] = useState<Error | null>(null);
	
	
	const [isNewDecision, setIsNewDecision] = useState(false);
	const [showSaveSuccess, setShowSaveSuccess] = useState(false);
	const handledRouteIdRef = useRef<string | undefined>(undefined);

	useEffect(() => {
		// Only react to an actual route change. The parent refreshes its decisions
		// array regularly, and re-running this on every refresh used to reset edit
		// mode (closing the editor about a second after it opened) and to reload
		// content over in-progress edits.
		if (handledRouteIdRef.current === id) return;
		handledRouteIdRef.current = id;
		if (id === 'new') {
			// Handle new decision creation
			setIsNewDecision(true);
			setIsEditing(true);
			setIsLoading(false);
			setError(null);
			setDecision(null);
			setDecisionTitle('');
			setOriginalDecisionTitle('');
			setDecisionStatus('proposed');
			setOriginalDecisionStatus('proposed');
		} else if (id) {
			setIsNewDecision(false);
			setIsEditing(false); // Ensure we start in preview mode for existing decisions
			loadDecisionContent();
		}
	}, [id, decisions]);

	// Check for edit query parameter to start in edit mode
	useEffect(() => {
		if (searchParams.get('edit') === 'true') {
			setIsEditing(true);
			// Remove the edit parameter from URL
			setSearchParams(params => {
				params.delete('edit');
				return params;
			});
		}
	}, [searchParams, setSearchParams]);

	// Normalize bare /decisions/:id to slugged /decisions/:id/:title
	useEffect(() => {
		if (!id || id === 'new' || isLoading || !decision) return;
		const expectedSlug = sanitizeUrlTitle(decisionTitle);
		if (title !== expectedSlug) {
			navigate(`/decisions/${id}/${expectedSlug}`, { replace: true });
		}
	}, [id, decisionTitle, decision, isLoading, title, navigate]);

	const loadDecisionContent = async () => {
		if (!id) return;
		
		try {
			setIsLoading(true);
			setError(null);
			const prefixedId = addDecisionPrefix(id);
			const decision = decisions.find(d => d.id === prefixedId);
			
			// Always try to fetch the decision from API, whether we found it in decisions or not
			// This ensures deep linking works even before the parent component loads the decisions array
			try {
				const fullDecision = await apiClient.fetchDecision(prefixedId);
				setContent(fullDecision.rawContent || '');
				setOriginalContent(fullDecision.rawContent || '');
				setDecisionTitle(fullDecision.title || '');
				setOriginalDecisionTitle(fullDecision.title || '');
				setDecisionStatus(fullDecision.status || 'proposed');
				setOriginalDecisionStatus(fullDecision.status || 'proposed');
				// Update decision state with full data
				setDecision(fullDecision);
			} catch (fetchError) {
				if (isAmbiguousIdConflict(fetchError)) {
					// Fail closed: never fall back to the cached entry when identity is ambiguous.
					setDecision(null);
					setError(fetchError instanceof Error ? fetchError : new Error(String(fetchError)));
					return;
				}
				// If fetch fails and we don't have the decision in props, show error
				if (!decision) {
					console.error('Failed to load decision:', fetchError);
				} else {
					// We have basic info from props even if fetch failed
					setDecision(decision);
					setDecisionTitle(decision.title || '');
					setOriginalDecisionTitle(decision.title || '');
					setDecisionStatus(decision.status || 'proposed');
					setOriginalDecisionStatus(decision.status || 'proposed');
				}
			}
		} catch (error) {
			console.error('Failed to load decision:', error);
		} finally {
			setIsLoading(false);
		}
	};

	const handleSave = async () => {
		if (!decisionTitle.trim()) {
			console.error('Decision title is required');
			return;
		}

		try {
			setIsSaving(true);
			
			if (isNewDecision) {
				// Create new decision
				const created = await apiClient.createDecision(decisionTitle);
				// The create form also offers the body editor, so persist what was
				// typed there (promoting temporary pasted images) instead of silently
				// dropping it when navigating to the new decision.
				let newContent = normalizeMarkdownHashLinks(content);
				const tempUrls = extractTempImageUrls(newContent);
				if (tempUrls.length > 0) {
					const mapping = await apiClient.promoteAssets(tempUrls);
					newContent = replaceTempImageUrls(newContent, mapping);
				}
				const hasBody = newContent.trim().length > 0;
				// Only write when there is something to write: a body or a status the
				// create call's default (proposed) did not already set.
				if (hasBody || decisionStatus !== 'proposed') {
					await apiClient.updateDecision(addDecisionPrefix(created.id), {
						...(hasBody && { content: newContent }),
						status: decisionStatus,
					});
				}
				// Refresh data and navigate to the new decision
				await onRefreshData();
				// Show success toast
				setShowSaveSuccess(true);
				setTimeout(() => setShowSaveSuccess(false), 4000);
				// Exit edit mode and navigate to the new decision
				setIsEditing(false);
				setIsNewDecision(false);
				const newId = stripIdPrefix(created.id);
				navigate(`/decisions/${newId}/${sanitizeUrlTitle(decisionTitle)}`);
			} else {
				// Update existing decision
				if (!id) return;
				// The body is only sent when it actually changed, so a status-only edit
				// does not round-trip the sections through the parser.
				const bodyChanged = content !== originalContent;
				let contentToSave = content;
				if (bodyChanged) {
					contentToSave = normalizeMarkdownHashLinks(content);
					// Promote temporary pasted images before saving, exactly like the
					// task description fields, and keep the rewritten body in the editor
					// state so a failed save can be retried against the permanent URLs.
					const tempUrls = extractTempImageUrls(contentToSave);
					if (tempUrls.length > 0) {
						const mapping = await apiClient.promoteAssets(tempUrls);
						contentToSave = replaceTempImageUrls(contentToSave, mapping);
						setContent(contentToSave);
					}
				}
				await apiClient.updateDecision(addDecisionPrefix(id), {
					...(bodyChanged && { content: contentToSave }),
					status: decisionStatus,
				});
				// Re-read from disk: the route does not change, so nothing else refreshes
				// the title, body and status shown in preview.
				await loadDecisionContent();
				// Refresh data from parent
				await onRefreshData();
				// Show success toast
				setShowSaveSuccess(true);
				setTimeout(() => setShowSaveSuccess(false), 4000);
				// Exit edit mode and navigate to decision detail page (this will load in preview mode)
				setIsEditing(false);
				navigate(`/decisions/${id}/${sanitizeUrlTitle(decisionTitle)}`);
			}
		} catch (error) {
			if (isAmbiguousIdConflict(error)) {
				setError(error instanceof Error ? error : new Error(String(error)));
				return;
			}
			console.error('Failed to save decision:', error);
		} finally {
			setIsSaving(false);
		}
	};

	const handleEdit = () => {
		setIsEditing(true);
	};

	const handleCancelEdit = () => {
		if (isNewDecision) {
			// Navigate back for new decisions
			navigate('/decisions');
		} else {
			// Revert changes for existing decisions
			setContent(originalContent);
			setDecisionTitle(originalDecisionTitle);
			setDecisionStatus(originalDecisionStatus);
			setIsEditing(false);
		}
	};

	const hasChanges =
		content !== originalContent ||
		decisionTitle !== originalDecisionTitle ||
		decisionStatus !== originalDecisionStatus;

	// A stored status outside the labelled set stays selectable instead of being
	// silently replaced by the first option.
	const statusOptions: string[] = (DECISION_STATUS_OPTIONS as readonly string[]).includes(decisionStatus)
		? [...DECISION_STATUS_OPTIONS]
		: [...DECISION_STATUS_OPTIONS, decisionStatus];

	// Labels come from the active locale; an unlabelled free-form status (or one
	// stored in a language the interface is not showing) falls back to its
	// capitalized raw form.
	const decisionStatusLabel = (status: string): string => {
		const labels = t.decisions.statusLabels as Record<string, string>;
		return labels[status.toLowerCase()] ?? status.charAt(0).toUpperCase() + status.slice(1);
	};

	const editedStatusStyle = DECISION_STATUS_STYLES[decisionStatus.toLowerCase()] ?? DECISION_STATUS_UNKNOWN_STYLE;
	const savedStatusStyle =
		DECISION_STATUS_STYLES[(decision?.status ?? '').toLowerCase()] ?? DECISION_STATUS_UNKNOWN_STYLE;

	if (!id) {
		return (
			<div className="flex-1 flex items-center justify-center p-8">
				<div className="text-center">
					<svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
					</svg>
					<h3 className="mt-2 text-sm font-medium text-gray-900">{t.decisions.noDecisionSelected}</h3>
					<p className="mt-1 text-sm text-gray-500">{t.decisions.selectDecision}</p>
				</div>
			</div>
		);
	}

	if (isLoading) {
		return (
			<div className="flex-1 flex items-center justify-center">
				<div className="text-gray-500">{t.common.loading}</div>
			</div>
		);
	}


	if (error && !isEditing) {
		return (
			<ErrorBoundary>
				<div className="flex-1 bg-white dark:bg-gray-900">
					<AmbiguousIdNotice message={error.message} />
				</div>
			</ErrorBoundary>
		);
	}
	return (
		<ErrorBoundary>
			<div className="h-full bg-white dark:bg-gray-900 flex flex-col transition-colors duration-200">
			{/* Header Section - Confluence/Linear Style */}
			<div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 transition-colors duration-200">
				<div className="max-w-4xl mx-auto px-8 py-6">
					<div className="flex items-start justify-between mb-6">
						<div className="flex-1">
							{isEditing ? (
								<input
									type="text"
									value={decisionTitle}
									onChange={(e) => setDecisionTitle(e.target.value)}
									className="text-3xl font-bold text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 mb-2 w-full bg-transparent border border-gray-300 dark:border-gray-600 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-colors duration-200"
									placeholder={t.decisions.placeholderTitle}
								/>
							) : (
								<h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2 transition-colors duration-200">
									{decisionTitle || decision?.title || (title ? decodeURIComponent(title) : `Decision ${id}`)}
								</h1>
							)}
							<div className="flex items-center space-x-6 text-sm text-gray-500 dark:text-gray-400 transition-colors duration-200">
								<div className="flex items-center space-x-2">
									<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a.997.997 0 01-1.414 0l-7-7A1.997 1.997 0 013 12V7a4 4 0 014-4z" />
									</svg>
									<span>ID: {decision?.id}</span>
								</div>
								<div className="flex items-center space-x-2">
									<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
									</svg>
									<span>{t.common.decision}</span>
								</div>
								{decision?.date && (
									<div className="flex items-center space-x-2">
										<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
										</svg>
										<span>{t.decisions.date}: {decision.date}</span>
									</div>
								)}
								{isEditing ? (
									<div className="flex items-center space-x-2">
										<svg className={`w-4 h-4 flex-shrink-0 ${editedStatusStyle.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={editedStatusStyle.path} />
										</svg>
										<select
											value={decisionStatus}
											onChange={(event) => setDecisionStatus(event.target.value)}
											aria-label={t.common.status}
											className="h-8 rounded-md border border-gray-300 dark:border-gray-600 px-2 text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-colors duration-200"
										>
											{statusOptions.map((option) => (
												<option key={option} value={option}>
													{decisionStatusLabel(option)}
												</option>
											))}
										</select>
									</div>
								) : decision?.status ? (
									<div className="flex items-center space-x-2">
										<svg className={`w-4 h-4 flex-shrink-0 ${savedStatusStyle.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={savedStatusStyle.path} />
										</svg>
										<span className={`inline-flex rounded-circle px-2 py-0.5 text-[11px] font-medium ${savedStatusStyle.chip}`}>
											{decisionStatusLabel(decision.status)}
										</span>
									</div>
								) : null}
							</div>
						</div>
						<div className="flex items-center space-x-3 ml-6">
							{!isEditing && (
								<button
									onClick={handleEdit}
									className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors duration-200"
								>
									<svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
									</svg>
									{t.common.edit}
								</button>
							)}
							{isEditing && (
								<div className="flex items-center space-x-2">
										<button
											onClick={handleCancelEdit}
											className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-400 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors duration-200"
										>
											{t.common.cancel}
										</button>
									<button
										onClick={handleSave}
										disabled={!hasChanges || isSaving}
											className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors duration-200 ${
												hasChanges && !isSaving
													? 'bg-blue-600 dark:bg-blue-600 text-white hover:bg-blue-700 dark:hover:bg-blue-700 focus:ring-blue-500 dark:focus:ring-blue-400'
													: 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
											}`}
										>
											<svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
											</svg>
										{isSaving ? t.common.saving : t.common.save}
									</button>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>

			{/* Content Section */}
			<div className="flex-1 bg-gray-50 dark:bg-gray-800 transition-colors duration-200 flex flex-col">
				<div className="flex-1 p-8 flex flex-col min-h-0">
					<MarkdownEditor
						value={content}
						onChange={(val) => setContent(val || '')}
						isEditing={isEditing}
						onTaskClick={(taskId) => navigate(`/task/${taskId}`, { state: { backgroundLocation: location } })}
						onDraftClick={(draftId) => navigate(`/draft/${draftId}`, { state: { backgroundLocation: location } })}
						onDocClick={(docId) => navigate(`/documentation/${docId}`)}
						onDecisionClick={(decisionId) => navigate(`/decisions/${decisionId}`)}
						onWikiClick={(wikiPath) => navigate(`/wiki/${encodeWikiPath(wikiPath)}`)}
					/>
				</div>
			</div>
			</div>
			
		{/* Save Success Toast */}
		{showSaveSuccess && (
			<SuccessToast
				message={`${t.decisions.saveSuccessPrefix} "${decisionTitle}" ${t.decisions.saveSuccessSuffix}`}
				onDismiss={() => setShowSaveSuccess(false)}
				icon={
					<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
				}
			/>
		)}
		</ErrorBoundary>
	);
}
