import MDEditor from "@uiw/react-md-editor";
import React, { useEffect, useRef } from "react";
import { useImageLightbox } from "../contexts/ImageLightboxContext";
import { useI18n } from "../hooks/useI18n";
import { apiClient } from "../lib/api";
import { renderMermaidIn } from "../utils/mermaid";
import { parseStyleString, prepareWikiMarkdown } from "../utils/wikiLinks";

interface Props {
	source: string;
	onFileClick?: (path: string) => void;
	onTaskClick?: (taskId: string) => void;
	onDraftClick?: (draftId: string) => void;
	onDocClick?: (docId: string) => void;
	onDecisionClick?: (decisionId: string) => void;
	onWikiClick?: (wikiPath: string) => void;
	wikilinkBasePath?: string;
}

const URI_AUTOLINK_PREFIX_REGEX = /^<[A-Za-z][A-Za-z0-9+.-]{1,31}:[^<>\u0000-\u0020]*>/;
const EMAIL_AUTOLINK_PREFIX_REGEX = /^<[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z0-9-]+>/;

function sanitizeMarkdownSource(source: string): string {
	const protectedRanges: { start: number; end: number }[] = [];

	// Protect code blocks (```...```)
	for (const match of source.matchAll(/```[\s\S]*?```/g)) {
		protectedRanges.push({ start: match.index!, end: match.index! + match[0].length });
	}

	// Protect inline code (`...`)
	for (const match of source.matchAll(/`[^`\n]+`/g)) {
		protectedRanges.push({ start: match.index!, end: match.index! + match[0].length });
	}

	return source.replace(/<(?=[A-Za-z])/g, (match, offset, fullText) => {
		// Skip replacement inside code blocks and inline code
		for (const range of protectedRanges) {
			if (offset >= range.start && offset < range.end) {
				return match;
			}
		}
		const remaining = fullText.slice(offset);
		if (URI_AUTOLINK_PREFIX_REGEX.test(remaining) || EMAIL_AUTOLINK_PREFIX_REGEX.test(remaining)) {
			return match;
		}
		return "&lt;";
	});
}

function isExternalLink(href?: string): boolean {
	if (!href) return true;
	if (href.startsWith("#")) return false;
	if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return true;
	return false;
}

interface LocalLinkInfo {
	type: "task" | "draft" | "doc" | "decision" | "wiki";
	id: string;
	alias: string;
}

function parseLocalUrl(href: string): LocalLinkInfo | null {
	if (href.startsWith("#")) return null;
	try {
		const url = new URL(href, window.location.href);
		if (url.origin !== window.location.origin) return null;

		const taskMatch = url.pathname.match(/^\/task\/([^/]+)/);
		if (taskMatch) return { type: "task", id: taskMatch[1]!, alias: `TASK#${taskMatch[1]!}` };

		const draftMatch = url.pathname.match(/^\/draft\/([^/]+)/);
		if (draftMatch) return { type: "draft", id: draftMatch[1]!, alias: `DRAFT#${draftMatch[1]!}` };

		const docMatch = url.pathname.match(/^\/documentation\/([^/]+)/);
		if (docMatch) return { type: "doc", id: docMatch[1]!, alias: `DOC#${docMatch[1]!}` };

		const decisionMatch = url.pathname.match(/^\/decisions\/([^/]+)/);
		if (decisionMatch) return { type: "decision", id: decisionMatch[1]!, alias: `Decisions#${decisionMatch[1]!}` };

		const wikiMatch = url.pathname.match(/^\/wiki\/(.+)/);
		if (wikiMatch)
			return {
				type: "wiki",
				id: decodeURIComponent(wikiMatch[1]!),
				alias: `WIKI#${decodeURIComponent(wikiMatch[1]!)}`,
			};

		return null;
	} catch {
		return null;
	}
}

function parseTaskUrl(href: string): string | null {
	if (href.startsWith("#")) return null;
	try {
		const url = new URL(href, window.location.href);
		if (url.origin !== window.location.origin) return null;
		const match = url.pathname.match(/^\/task\/([^/]+)/);
		return match?.[1] ?? null;
	} catch {
		return null;
	}
}

function LightboxImage(props: React.ImgHTMLAttributes<HTMLImageElement>) {
	const { openLightbox } = useImageLightbox();
	const { t } = useI18n();
	const { className, onClick, onKeyDown, alt, ...rest } = props;

	const handleActivate = (target: HTMLImageElement) => {
		const rawSrc = target.getAttribute("src");
		if (rawSrc) openLightbox(rawSrc);
	};

	return (
		<img
			{...rest}
			data-lightbox-img
			alt={alt ?? ""}
			className={`${className ?? ""} cursor-zoom-in max-w-full`.trim()}
			role="button"
			tabIndex={0}
			aria-label={alt || t.imageLightbox.viewImage}
			onClick={(e) => {
				handleActivate(e.currentTarget);
				onClick?.(e);
			}}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					handleActivate(e.currentTarget);
				}
				onKeyDown?.(e);
			}}
		/>
	);
}

function VideoPlayer(props: React.VideoHTMLAttributes<HTMLVideoElement>) {
	const { className, ...rest } = props;
	return <video {...rest} className={`${className ?? ""} max-w-full`.trim()} controls preload="metadata" />;
}

function AudioPlayer(props: React.AudioHTMLAttributes<HTMLAudioElement>) {
	const { className, ...rest } = props;
	return <audio {...rest} className={`${className ?? ""} w-full`.trim()} controls preload="metadata" />;
}

export default function MermaidMarkdown({
	source,
	onFileClick,
	onTaskClick,
	onDraftClick,
	onDocClick,
	onDecisionClick,
	onWikiClick,
	wikilinkBasePath,
}: Props) {
	const ref = useRef<HTMLDivElement | null>(null);
	const safeSource = wikilinkBasePath
		? prepareWikiMarkdown(source, wikilinkBasePath)
		: sanitizeMarkdownSource(source);
	const { t } = useI18n();

	useEffect(() => {
		if (!ref.current) return;

		// Render mermaid diagrams after the markdown has been rendered
		// Use requestAnimationFrame to ensure MDEditor has finished rendering
		const frameId = requestAnimationFrame(() => {
			if (ref.current) {
				void renderMermaidIn(ref.current);
			}
		});

		return () => cancelAnimationFrame(frameId);
	}, [safeSource]);

	const LinkComponent = React.useCallback(
		({
			href,
			children,
			className,
			style,
			id,
			"data-wikilink": dataWikilink,
		}: {
			href?: string;
			children?: React.ReactNode;
			className?: string;
			style?: React.CSSProperties | string;
			id?: string;
			"data-wikilink"?: string;
		}) => {
			const parsedStyle = typeof style === "string" ? parseStyleString(style) : style;
			const combinedClassName = [className, "text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"]
				.filter(Boolean)
				.join(" ");

			const localLink = href ? parseLocalUrl(href) : null;

			if (localLink) {
				const isWikilink = dataWikilink === "true";
				const content = localLink.type === "wiki" && isWikilink ? children : localLink.alias;

				if (localLink.type === "task" && onTaskClick) {
					return (
						<a
							href={href}
							onClick={(e) => {
								e.preventDefault();
								onTaskClick(localLink.id);
							}}
							className={combinedClassName}
							style={parsedStyle}
							id={id}
						>
							{content}
						</a>
					);
				}
				if (localLink.type === "draft" && onDraftClick) {
					return (
						<a
							href={href}
							onClick={(e) => {
								e.preventDefault();
								onDraftClick(localLink.id);
							}}
							className={combinedClassName}
							style={parsedStyle}
							id={id}
						>
							{content}
						</a>
					);
				}
				if (localLink.type === "doc" && onDocClick) {
					return (
						<a
							href={href}
							onClick={(e) => {
								e.preventDefault();
								onDocClick(localLink.id);
							}}
							className={combinedClassName}
							style={parsedStyle}
							id={id}
						>
							{content}
						</a>
					);
				}
				if (localLink.type === "decision" && onDecisionClick) {
					return (
						<a
							href={href}
							onClick={(e) => {
								e.preventDefault();
								onDecisionClick(localLink.id);
							}}
							className={combinedClassName}
							style={parsedStyle}
							id={id}
						>
							{content}
						</a>
					);
				}
				if (localLink.type === "wiki" && onWikiClick) {
					return (
						<a
							href={href}
							onClick={(e) => {
								e.preventDefault();
								onWikiClick(localLink.id);
							}}
							className={combinedClassName}
							style={parsedStyle}
							id={id}
						>
							{content}
						</a>
					);
				}
				// Local link matched but no handler provided: render alias as plain link
				return (
					<a href={href} className={combinedClassName} style={parsedStyle} id={id}>
						{content}
					</a>
				);
			}

			// Legacy task URL parsing for consumers that only pass onTaskClick
			const taskId = href ? parseTaskUrl(href) : null;
			if (taskId && onTaskClick) {
				return (
					<a
						href={href}
						onClick={(e) => {
							e.preventDefault();
							onTaskClick(taskId);
						}}
						className={combinedClassName}
						style={parsedStyle}
						id={id}
					>
						{children}
					</a>
				);
			}

			if (isExternalLink(href)) {
				return (
					<a href={href} target="_blank" rel="noopener noreferrer" className={className} style={parsedStyle} id={id}>
						{children}
					</a>
				);
			}

			if (!onFileClick) {
				return (
					<a href={href} className={className} style={parsedStyle} id={id}>
						{children}
					</a>
				);
			}

			const handleClick = async (e: React.MouseEvent) => {
				e.preventDefault();
				if (!href) return;
				try {
					// Verify file exists before opening preview
					await apiClient.fetchFileContent(href);
					onFileClick(href);
				} catch {
					// File not found or inaccessible: fall back to normal link behavior
					window.open(href, "_blank");
				}
			};

			return (
				<a
					href={href}
					onClick={handleClick}
					className={combinedClassName}
					style={parsedStyle}
					id={id}
					title={t.mermaidMarkdown.clickToPreview}
				>
					{children}
				</a>
			);
		},
		[onFileClick, onTaskClick, onDraftClick, onDocClick, onDecisionClick, onWikiClick, t],
	);

	return (
		<div ref={ref} className="wmde-markdown">
			<MDEditor.Markdown source={safeSource} components={{ a: LinkComponent, img: LightboxImage, video: VideoPlayer, audio: AudioPlayer }} />
		</div>
	);
}
