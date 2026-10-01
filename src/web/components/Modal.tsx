import type React from "react";
import { useEffect, useRef } from "react";
import { useI18n } from "../hooks/useI18n";
import TocDrawer from "./TocDrawer";

interface ModalProps {
	isOpen: boolean;
	onClose: () => void;
	title: string;
	children: React.ReactNode;
	maxWidthClass?: string; // e.g., "max-w-4xl"
	disableEscapeClose?: boolean; // when true, Escape and backdrop click won't close (child can handle it)
	actions?: React.ReactNode; // optional actions rendered in header before close
	leftActions?: React.ReactNode; // optional actions rendered in header before title
	toc?: boolean; // when true, a bookmark tab on the left edge opens a floating outline of the content headings
}

const Modal: React.FC<ModalProps> = ({
	isOpen,
	onClose,
	title,
	children,
	maxWidthClass = "max-w-2xl",
	disableEscapeClose,
	actions,
	leftActions,
	toc,
}) => {
	const { t } = useI18n();
	const overlayRef = useRef<HTMLDivElement | null>(null);
	const contentRef = useRef<HTMLDivElement | null>(null);
	const onCloseRef = useRef(onClose);
	onCloseRef.current = onClose;
	useEffect(() => {
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape" && !disableEscapeClose) {
				onCloseRef.current();
			}
		};

		if (isOpen) {
			if (!disableEscapeClose) {
				document.addEventListener("keydown", handleEscape);
			}
			document.body.style.overflow = "hidden";
		}

		return () => {
			if (!disableEscapeClose) {
				document.removeEventListener("keydown", handleEscape);
			}
			document.body.style.overflow = "unset";
		};
	}, [isOpen, disableEscapeClose]);

	// Backdrop close is wired at the document level instead of with an onClick on the
	// overlay: a click handler on a plain <div> is invisible to keyboard users, and
	// Escape already covers them. Only a click landing on the overlay itself closes
	// the modal — the panel is ignored, and so is the click that opened the modal,
	// which can still be bubbling to document when this listener is registered.
	useEffect(() => {
		if (!isOpen || disableEscapeClose) return undefined;
		const handleBackdropClick = (event: MouseEvent) => {
			if (event.target !== overlayRef.current) return;
			onCloseRef.current();
		};
		document.addEventListener("click", handleBackdropClick);
		return () => document.removeEventListener("click", handleBackdropClick);
	}, [isOpen, disableEscapeClose]);

	if (!isOpen) return null;

	return (
		<div
			ref={overlayRef}
			className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-center justify-center z-50 p-4"
			role="presentation"
		>
			<div
				className={`relative flex max-h-[94vh] w-full flex-col rounded-lg border border-gray-200 bg-white shadow-2xl transition-colors duration-200 dark:border-gray-600 dark:bg-gray-800 ${maxWidthClass}`}
				role="dialog"
				aria-modal="true"
				aria-labelledby="modal-title"
			>
				{toc && <TocDrawer containerRef={contentRef} />}
				<div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-6 pt-4 pb-3 dark:border-gray-700">
					<div className="flex items-center gap-2 flex-1 min-w-0 mr-4">
						{leftActions}
						<h2
							id="modal-title"
							className="text-base font-semibold text-gray-900 dark:text-gray-100 flex-1 min-w-0 line-clamp-2"
						>
							{title}
						</h2>
					</div>
					<div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
						{actions}
						<button
							type="button"
							onClick={onClose}
							className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded p-1 transition-colors duration-200 text-2xl leading-none w-8 h-8 flex items-center justify-center"
							aria-label={t.modal.closeAria}
						>
							×
						</button>
					</div>
				</div>
				<div ref={contentRef} className="min-h-0 overflow-y-auto px-6 pt-4 pb-6">
					{children}
				</div>
			</div>
		</div>
	);
};

export default Modal;
