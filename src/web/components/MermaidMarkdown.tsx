import Slugger from "github-slugger";
import MDEditor from "@uiw/react-md-editor";
import React, { useEffect, useRef } from "react";
import type { Element, Root } from "hast";
import { visit } from "unist-util-visit";
import { useImageLightbox } from "../contexts/ImageLightboxContext";
import { useI18n } from "../hooks/useI18n";
import { apiClient } from "../lib/api";
import { renderMermaidIn } from "../utils/mermaid";
import { parseStyleString, prepareWikiMarkdown } from "../utils/wikiLinks";

interface Props {
	source: string;
	onFileClick?: (path: string) => void;
	onTaskClick?: (taskId: string, range?: { lineStart?: number; lineEnd?: number }) => void;
	onDraftClick?: (draftId: string, range?: { lineStart?: number; lineEnd?: number }) => void;
	onDocClick?: (docId: string, range?: { lineStart?: number; lineEnd?: number }) => void;
	onDecisionClick?: (decisionId: string, range?: { lineStart?: number; lineEnd?: number }) => void;
	onWikiClick?: (wikiPath: string, range?: { lineStart?: number; lineEnd?: number }) => void;
	wikilinkBasePath?: string;
}

const URI_AUTOLINK_PREFIX_REGEX = /^<[A-Za-z][A-Za-z0-9+.-]{1,31}:[^<>\u0000-\u0020]*>/;
const EMAIL_AUTOLINK_PREFIX_REGEX = /^<[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z0-9-]+>/;
const HEADING_PREFIX_ID_REGEX = /^([A-Za-z]*\d+(?:\.[A-Za-z]*\d+)*)(?=\s*[:：.、]|\s+|$)/;

function getTextContent(node: Element): string {
	let text = "";
	for (const child of node.children) {
		if (child.type === "text") {
			text += child.value;
		} else if (child.type === "element") {
			text += getTextContent(child);
		}
	}
	return text;
}

function findHeadingByHashTarget(target: string): HTMLElement | null {
	// Decode percent-encoded anchors, e.g. <#A1: Section Title> renders as #A1:%20Section%20Title.
	let decodedTarget: string;
	try {
		decodedTarget = decodeURIComponent(target);
	} catch {
		decodedTarget = target;
	}

	// Exact ID match covers github-slugger slugs and prefix ids.
	const byId = document.getElementById(decodedTarget);
	if (byId && /^h[1-6]$/i.test(byId.tagName)) return byId;

	// Fallback: human-friendly anchors using the original heading prefix or title.
	const headings = document.querySelectorAll("h1, h2, h3, h4, h5, h6");
	for (const heading of headings) {
		const element = heading as HTMLElement;
		if (element.getAttribute("data-heading-prefix") === decodedTarget) return element;
		if (element.getAttribute("data-heading-text") === decodedTarget) return element;
	}

	// If the anchor starts with a section prefix (e.g. "A1:"), treat it as a heading-text
	// prefix so that full-heading-title anchors written with angle brackets still resolve.
	if (HEADING_PREFIX_ID_REGEX.test(decodedTarget)) {
		let bestMatch: HTMLElement | null = null;
		let bestMatchLength = 0;
		for (const heading of headings) {
			const element = heading as HTMLElement;
			const text = element.getAttribute("data-heading-text");
			if (text && text.startsWith(decodedTarget) && text.length > bestMatchLength) {
				bestMatch = element;
				bestMatchLength = text.length;
			}
		}
		if (bestMatch) return bestMatch;
	}

	return null;
}

function rehypeHeadingMetadata() {
	const slugger = new Slugger();
	return (tree: Root) => {
		visit(tree, "element", (node: Element) => {
			if (!/^h[1-6]$/.test(node.tagName)) return;
			const text = getTextContent(node);
			const prefixMatch = HEADING_PREFIX_ID_REGEX.exec(text);
			const prefix = prefixMatch?.[1] ?? null;
			const slug = slugger.slug(text);
			node.properties = { ...node.properties, id: slug, "data-heading-prefix": prefix, "data-heading-text": text };
			const anchor = node.children[0];
			if (anchor && anchor.type === "element" && anchor.tagName === "a" && anchor.properties?.ariaHidden === "true") {
				anchor.properties = { ...anchor.properties, href: `#${slug}` };
			}
		});
	};
}

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

function encodeLocalFileLinkDestinations(source: string): string {
	const protectedRanges: { start: number; end: number }[] = [];

	// Protect code blocks (```...```)
	for (const match of source.matchAll(/```[\s\S]*?```/g)) {
		protectedRanges.push({ start: match.index!, end: match.index! + match[0].length });
	}

	// Protect inline code (`...`)
	for (const match of source.matchAll(/`[^`\n]+`/g)) {
		protectedRanges.push({ start: match.index!, end: match.index! + match[0].length });
	}

	return source.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, ...args) => {
		const offset = args[args.length - 2] as number;
		for (const range of protectedRanges) {
			if (offset >= range.start && offset < range.end) return match;
		}
		const text = args[0] as string;
		const url = args[1] as string;
		if (!url) return match;
		if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith("#")) return match;
		const encodedUrl = url.replace(/ /g, "%20");
		if (encodedUrl === url) return match;
		return `[${text}](${encodedUrl})`;
	});
}

function isExternalLink(href?: string): boolean {
	if (!href) return true;
	if (href.startsWith("#")) return false;
	if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return true;
	return false;
}

interface LineRange {
	lineStart?: number;
	lineEnd?: number;
}

interface LocalLinkInfo {
	type: "task" | "draft" | "doc" | "decision" | "wiki";
	id: string;
	alias: string;
	range?: LineRange;
}

function parseLineRange(segment: string): { id: string; range?: LineRange } | null {
	const match = segment.match(/^([^:]+)(?::(\d+)(?:-(\d+))?)?$/);
	if (!match) return null;
	const id = match[1]!;
	if (!id) return null;
	if (!match[2]) return { id };
	const lineStart = Number.parseInt(match[2], 10);
	const lineEndRaw = match[3];
	const lineEnd = lineEndRaw ? Number.parseInt(lineEndRaw, 10) : lineStart;
	return { id, range: { lineStart, lineEnd } };
}

function formatAliasWithRange(baseAlias: string, range?: LineRange): string {
	if (!range) return baseAlias;
	if (range.lineEnd === range.lineStart) return `${baseAlias}:${range.lineStart}`;
	return `${baseAlias}:${range.lineStart}-${range.lineEnd}`;
}

export function parseLocalUrl(href: string): LocalLinkInfo | null {
	if (href.startsWith("#")) return null;
	// Absolute paths and full URLs can be short local links. Relative paths
	// (e.g. backlog/docs/file.md) must be handled by the file/navigation
	// handlers, not misinterpreted as /task/* /doc/* relative to the current
	// page URL.
	if (!href.startsWith("/") && !/^[a-z][a-z0-9+.-]*:/i.test(href)) return null;
	try {
		const url = new URL(href, window.location.href);
		if (url.origin !== window.location.origin) return null;

		const taskMatch = url.pathname.match(/^\/task\/([^/]+)/);
		if (taskMatch) {
			const parsed = parseLineRange(taskMatch[1]!);
			if (!parsed) return null;
			return { type: "task", id: parsed.id, alias: formatAliasWithRange(`TASK#${parsed.id}`, parsed.range), range: parsed.range };
		}

		const draftMatch = url.pathname.match(/^\/draft\/([^/]+)/);
		if (draftMatch) {
			const parsed = parseLineRange(draftMatch[1]!);
			if (!parsed) return null;
			return { type: "draft", id: parsed.id, alias: formatAliasWithRange(`DRAFT#${parsed.id}`, parsed.range), range: parsed.range };
		}

		const docMatch = url.pathname.match(/^\/documentation\/([^/]+)/);
		if (docMatch) {
			const parsed = parseLineRange(docMatch[1]!);
			if (!parsed) return null;
			return { type: "doc", id: parsed.id, alias: formatAliasWithRange(`DOC#${parsed.id}`, parsed.range), range: parsed.range };
		}

		const decisionMatch = url.pathname.match(/^\/decisions\/([^/]+)/);
		if (decisionMatch) {
			const parsed = parseLineRange(decisionMatch[1]!);
			if (!parsed) return null;
			return { type: "decision", id: parsed.id, alias: formatAliasWithRange(`Decisions#${parsed.id}`, parsed.range), range: parsed.range };
		}

		const wikiMatch = url.pathname.match(/^\/wiki\/(.+)/);
		if (wikiMatch) {
			const parsed = parseLineRange(decodeURIComponent(wikiMatch[1]!));
			if (!parsed) return null;
			return {
				type: "wiki",
				id: parsed.id,
				alias: formatAliasWithRange(`WIKI#${parsed.id}`, parsed.range),
				range: parsed.range,
			};
		}

		return null;
	} catch {
		return null;
	}
}

function parseTaskUrl(href: string): string | null {
	if (href.startsWith("#")) return null;
	// Absolute paths and full URLs can be legacy task links; relative paths are not.
	if (!href.startsWith("/") && !/^[a-z][a-z0-9+.-]*:/i.test(href)) return null;
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
		? encodeLocalFileLinkDestinations(prepareWikiMarkdown(source, wikilinkBasePath))
		: sanitizeMarkdownSource(encodeLocalFileLinkDestinations(source));
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

			if (href && href.startsWith("#")) {
				const resolvedHref =
					typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}${href}` : href;

				const handleHashClick = (e: React.MouseEvent) => {
					e.preventDefault();
					const targetId = href.slice(1);
					const target = findHeadingByHashTarget(targetId);
					if (target) {
						if (typeof target.scrollIntoView === "function") {
							target.scrollIntoView({ behavior: "smooth" });
						}
						window.history.pushState(null, "", resolvedHref);
					} else {
						window.location.href = resolvedHref;
					}
				};

				return (
					<a href={resolvedHref} onClick={handleHashClick} className={combinedClassName} style={parsedStyle} id={id}>
						{children}
					</a>
				);
			}

			if (localLink) {
				const isWikilink = dataWikilink === "true";
				// For wikilinks, always use the explicit alias text. For short local
				// markdown links, prefer a non-URL custom label if one was provided;
				// otherwise fall back to the system alias (with line range when present).
				const hasCustomLabel =
					typeof children === "string" &&
					children.trim().length > 0 &&
					!children.startsWith("/") &&
					!/^[a-z][a-z0-9+.-]*:/i.test(children) &&
					children !== href;
				const content =
					localLink.type === "wiki" && isWikilink
						? children
						: hasCustomLabel
							? children
							: localLink.alias;

				if (localLink.type === "task" && onTaskClick) {
					return (
						<a
							href={href}
							onClick={(e) => {
								e.preventDefault();
								onTaskClick(localLink.id, localLink.range);
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
								onDraftClick(localLink.id, localLink.range);
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
								onDocClick(localLink.id, localLink.range);
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
								onDecisionClick(localLink.id, localLink.range);
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
								onWikiClick(localLink.id, localLink.range);
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
				// Markdown-it requires percent-encoded spaces in link destinations;
				// decode back to the real project path before checking/previewing the file.
				const decodedHref = decodeURIComponent(href);
				try {
					// Verify file exists before opening preview
					await apiClient.fetchFileContent(decodedHref);
					onFileClick(decodedHref);
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
			<MDEditor.Markdown
				source={safeSource}
				components={{ a: LinkComponent, img: LightboxImage, video: VideoPlayer, audio: AudioPlayer }}
				rehypePlugins={[rehypeHeadingMetadata]}
			/>
		</div>
	);
}
