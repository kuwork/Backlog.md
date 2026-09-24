import { useEffect, useState } from "react";
import { useI18n } from "../hooks/useI18n";

interface GraphStatusIndicatorProps {
	status: "building" | "ready" | null;
	/** How long the status must persist before the chip appears (fast warm starts never flash). */
	appearDelayMs?: number;
	/** Fade-out duration before the chip unmounts. */
	exitDurationMs?: number;
	/** How long the ready chip stays before it dismisses itself. */
	readyDisplayMs?: number;
}

/**
 * Shell-level indicator for the task graph cold start (doc-014): a status chip in the header,
 * left of the theme toggle. It shows one message when the cold start begins and one when the
 * graph is ready, running entirely in parallel with the normal loading flow - it neither blocks
 * content nor reacts to the regular loading messages. The ready chip dismisses itself after a
 * few seconds; a fast warm start (fingerprint match) never flashes thanks to the appear delay.
 */
export function GraphStatusIndicator({
	status,
	appearDelayMs = 250,
	exitDurationMs = 200,
	readyDisplayMs = 3000,
}: GraphStatusIndicatorProps) {
	const { t } = useI18n();
	const [mounted, setMounted] = useState(false);
	const [active, setActive] = useState(false);
	const [dismissed, setDismissed] = useState(false);

	useEffect(() => {
		if (status === "ready") {
			setDismissed(false);
			const timer = window.setTimeout(() => setDismissed(true), readyDisplayMs);
			return () => window.clearTimeout(timer);
		}
		setDismissed(false);
	}, [status, readyDisplayMs]);

	const visible = status !== null && !dismissed;

	useEffect(() => {
		if (visible) {
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
	}, [visible, mounted, appearDelayMs, exitDurationMs]);

	if (!mounted || !status) return null;

	const building = status === "building";
	const label = building ? t.loadingPhases.buildingTaskGraph : t.loadingPhases.taskGraphReady;
	return (
		<div
			role="status"
			title={label}
			className={`flex items-center gap-2 rounded-circle px-2.5 py-1 text-xs font-medium transition-all duration-200 ${
				building
					? "bg-blue-50 text-blue-600 dark:bg-blue-600/20 dark:text-blue-400"
					: "bg-emerald-50 text-emerald-600 dark:bg-emerald-600/20 dark:text-emerald-400"
			} ${active ? "translate-y-0 opacity-100" : "-translate-y-0.5 opacity-0"}`}
		>
			{building ? (
				<span
					className="h-3 w-3 shrink-0 animate-spin rounded-circle border-2 border-blue-200 border-t-blue-600 dark:border-blue-400/30 dark:border-t-blue-400"
					aria-hidden="true"
				/>
			) : (
				<svg className="h-3 w-3 shrink-0" viewBox="0 0 12 12" fill="none" aria-hidden="true">
					<path
						d="M2.5 6.5L5 9l4.5-6"
						stroke="currentColor"
						strokeWidth="1.8"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</svg>
			)}
			<span className="hidden max-w-[16rem] truncate sm:inline-block">{label}</span>
		</div>
	);
}
