import { useEffect, useRef, useState } from "react";
import { translateLoadingMessage } from "../../utils/loading-messages";
import { useI18n } from "../hooks/useI18n";

interface BranchIndexingIndicatorProps {
	message?: string | null;
	/** How long the loading message must persist before the indicator appears. */
	appearDelayMs?: number;
	/** Fade-out duration before the indicator unmounts. */
	exitDurationMs?: number;
}

/**
 * Shell-level indicator for cross-branch indexing: a status chip in the header plus a hairline
 * sweep bar along the header's bottom border. It appears only after the indexing state has
 * persisted (fast completions never flash) and fades out cleanly when indexing finishes.
 *
 * The chip's label is the real progress line, translated through the same loading-message table
 * the sidebar and board sentence placeholders used, so the phase detail - branch counts included -
 * stays visible while the content underneath stays interactive. Long phases truncate, and the
 * full line stays available as the tooltip.
 *
 * The ring and the sweep are the indicator's whole signal, so they animate even on hosts that ask
 * for reduced motion (BACK-670): those are the hosts with system animations switched off, and a
 * still chip there is indistinguishable from a stuck one.
 */
export function BranchIndexingIndicator({
	message,
	appearDelayMs = 250,
	exitDurationMs = 200,
}: BranchIndexingIndicatorProps) {
	const { locale } = useI18n();
	const [mounted, setMounted] = useState(false);
	const [active, setActive] = useState(false);
	const lastMessageRef = useRef<string | null>(null);
	if (message) lastMessageRef.current = message;

	useEffect(() => {
		if (message) {
			if (mounted) {
				// Runs post-paint, so the first activation still transitions from the
				// hidden state the chip mounted with.
				setActive(true);
				return;
			}
			const timer = window.setTimeout(() => setMounted(true), appearDelayMs);
			return () => window.clearTimeout(timer);
		}
		if (!mounted) return;
		setActive(false);
		const timer = window.setTimeout(() => setMounted(false), exitDurationMs);
		return () => window.clearTimeout(timer);
	}, [message, mounted, appearDelayMs, exitDurationMs]);

	if (!mounted) return null;

	const detail = lastMessageRef.current ? translateLoadingMessage(lastMessageRef.current, locale) : undefined;
	return (
		<>
			<div
				role="status"
				title={detail}
				className={`flex items-center gap-2 rounded-circle bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600 transition-all duration-200 dark:bg-blue-600/20 dark:text-blue-400 ${
					active ? "translate-y-0 opacity-100" : "-translate-y-0.5 opacity-0"
				}`}
			>
				<span
					className="h-3 w-3 shrink-0 animate-spin rounded-circle border-2 border-blue-200 border-t-blue-600 dark:border-blue-400/30 dark:border-t-blue-400"
					aria-hidden="true"
				/>
				<span className="hidden max-w-[16rem] truncate sm:inline-block">{detail}</span>
			</div>
			<div
				aria-hidden="true"
				className={`pointer-events-none absolute inset-x-0 bottom-0 h-0.5 overflow-hidden transition-opacity duration-200 ${
					active ? "opacity-100" : "opacity-0"
				}`}
			>
				<div className="animate-indexing-sweep h-full w-2/5 bg-gradient-to-r from-transparent via-blue-500 to-transparent dark:via-blue-400" />
			</div>
		</>
	);
}
