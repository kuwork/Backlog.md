import MDEditor from "@uiw/react-md-editor";
import Slugger from "github-slugger";
import type { Element, ElementContent, Parent, Root, RootContent } from "hast";
import React, { useEffect, useMemo, useRef } from "react";
import { visit } from "unist-util-visit";
import { useImageLightbox } from "../contexts/ImageLightboxContext";
import { useTaskIdIndex } from "../contexts/TaskIdIndexContext";
import { useOptionalTheme } from "../contexts/ThemeContext";
import { useI18n } from "../hooks/useI18n";
import { apiClient } from "../lib/api";
import { activateHashTarget, HEADING_PREFIX_ID_REGEX } from "../utils/hash-target";
import { renderMermaidIn } from "../utils/mermaid";
import { createEntityLinkPlugin } from "../utils/task-id-links";
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
	/**
	 * When set, GFM task-list checkboxes become clickable and report their document-order index, so
	 * the caller can flip the matching `- [ ]` marker in its own source. Left unset the checkboxes
	 * stay disabled, exactly like GitHub's rendering.
	 */
	onToggleTask?: (index: number) => void;
	/**
	 * When set, `#tag` tokens in the body render as chips instead of plain text. Opt-in because
	 * only the note surfaces dress them; a task or doc body keeps its literal `#word`.
	 */
	inlineTagChips?: boolean;
	/**
	 * The tags the surrounding view is narrowed by. A chip standing for one of them is marked
	 * active, so the body reads as "this note is here because of this tag". Case-insensitive,
	 * matching how the filter itself compares tags.
	 */
	activeTags?: string[];
}

const URI_AUTOLINK_PREFIX_REGEX = /^<[A-Za-z][A-Za-z0-9+.-]{1,31}:[^<>\s]*>/;
const EMAIL_AUTOLINK_PREFIX_REGEX = /^<[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z0-9-]+>/;

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

/**
 * GFM task-list checkboxes arrive from mdast-util-to-hast hard-coded `disabled`, so nothing can
 * toggle them. Tag each one, in document order, with the index of the marker it stands for; the
 * click handler reads it back off the DOM and the caller flips that marker in its source.
 */
function rehypeTaskListIndex() {
	return (tree: Root) => {
		let index = 0;
		visit(tree, "element", (node: Element) => {
			if (node.tagName !== "input" || node.properties?.type !== "checkbox") return;
			node.properties = { ...node.properties, "data-task-index": String(index) };
			index += 1;
		});
	};
}

/**
 * Weibo-style `#topic#` tokens - the same shape `extractInlineTags` lifts into a memo's `tags`, so
 * a chip always has a filter it can stand for. Closing the topic with a second hash is what makes
 * it one, which keeps ordinary references (`PR #268`) out of the chip pass.
 */
const INLINE_TAG_PATTERN = /#([^\s#`]+)#/g;
/** Elements whose text must never be split: code is code, a label inside a link is a label. */
const INLINE_TAG_SKIP_TAGS = new Set(["a", "code", "pre", "script", "style"]);

/** Split one text node into plain runs and chip elements, or null when it holds no tag. */
function splitInlineTags(value: string, activeTags: ReadonlySet<string>): ElementContent[] | null {
	let parts: ElementContent[] | null = null;
	let cursor = 0;

	INLINE_TAG_PATTERN.lastIndex = 0;
	for (let match = INLINE_TAG_PATTERN.exec(value); match; match = INLINE_TAG_PATTERN.exec(value)) {
		const tag = match[1];
		if (!tag) continue;
		const start = match.index;
		parts ??= [];
		if (start > cursor) parts.push({ type: "text", value: value.slice(cursor, start) });
		const isActive = activeTags.has(tag.toLowerCase());
		parts.push({
			type: "element",
			tagName: "span",
			properties: {
				// `inline-tag-active` only ever changes colour: the chip sits inline in a
				// paragraph, so padding or weight would reflow the line it is on.
				className: isActive ? ["inline-tag", "inline-tag-active"] : ["inline-tag"],
				"data-memo-tag": tag,
				"data-memo-tag-active": isActive ? "true" : undefined,
				// A chip stands for a filter, so it has to be reachable and activatable without a mouse.
				role: "button",
				tabIndex: 0,
				"aria-pressed": isActive ? "true" : "false",
			},
			// The chip shows the topic exactly as it was typed, closing hash included.
			children: [{ type: "text", value: match[0] }],
		});
		cursor = start + match[0].length;
	}
	if (!parts) return null;
	if (cursor < value.length) parts.push({ type: "text", value: value.slice(cursor) });
	return parts;
}

/**
 * Rebuild the children array while descending, the same way `linkEntityIds` does for entity IDs:
 * visits in place, so the markdown source never has to be rewritten.
 */
function decorateInlineTags(node: Parent, activeTags: ReadonlySet<string>): void {
	const rewritten: RootContent[] = [];
	let changed = false;
	for (const child of node.children) {
		if (child.type === "text" && typeof child.value === "string") {
			const parts = splitInlineTags(child.value, activeTags);
			if (parts) {
				rewritten.push(...parts);
				changed = true;
				continue;
			}
		} else if (child.type === "element" && !INLINE_TAG_SKIP_TAGS.has(child.tagName)) {
			decorateInlineTags(child, activeTags);
		}
		rewritten.push(child);
	}
	if (changed) node.children = rewritten;
}

/** Opt-in pass: turns `#tag` text into a chip element the memo styles can dress. */
function rehypeInlineTags(activeTags: ReadonlySet<string>) {
	return () => (tree: Root) => {
		decorateInlineTags(tree, activeTags);
	};
}

function sanitizeMarkdownSource(source: string): string {
	const protectedRanges: { start: number; end: number }[] = [];

	// Protect code blocks (```...```)
	for (const match of source.matchAll(/```[\s\S]*?```/g)) {
		protectedRanges.push({ start: match.index ?? 0, end: match.index ?? 0 + match[0].length });
	}

	// Protect inline code (`...`)
	for (const match of source.matchAll(/`[^`\n]+`/g)) {
		protectedRanges.push({ start: match.index ?? 0, end: match.index ?? 0 + match[0].length });
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
		protectedRanges.push({ start: match.index ?? 0, end: match.index ?? 0 + match[0].length });
	}

	// Protect inline code (`...`)
	for (const match of source.matchAll(/`[^`\n]+`/g)) {
		protectedRanges.push({ start: match.index ?? 0, end: match.index ?? 0 + match[0].length });
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
	const id = match[1] ?? "";
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
			const parsed = parseLineRange(taskMatch[1] ?? "");
			if (!parsed) return null;
			return {
				type: "task",
				id: parsed.id,
				alias: formatAliasWithRange(`TASK#${parsed.id}`, parsed.range),
				range: parsed.range,
			};
		}

		const draftMatch = url.pathname.match(/^\/draft\/([^/]+)/);
		if (draftMatch) {
			const parsed = parseLineRange(draftMatch[1] ?? "");
			if (!parsed) return null;
			return {
				type: "draft",
				id: parsed.id,
				alias: formatAliasWithRange(`DRAFT#${parsed.id}`, parsed.range),
				range: parsed.range,
			};
		}

		const docMatch = url.pathname.match(/^\/documentation\/([^/]+)/);
		if (docMatch) {
			const parsed = parseLineRange(docMatch[1] ?? "");
			if (!parsed) return null;
			return {
				type: "doc",
				id: parsed.id,
				alias: formatAliasWithRange(`DOC#${parsed.id}`, parsed.range),
				range: parsed.range,
			};
		}

		const decisionMatch = url.pathname.match(/^\/decisions\/([^/]+)/);
		if (decisionMatch) {
			const parsed = parseLineRange(decisionMatch[1] ?? "");
			if (!parsed) return null;
			return {
				type: "decision",
				id: parsed.id,
				alias: formatAliasWithRange(`Decisions#${parsed.id}`, parsed.range),
				range: parsed.range,
			};
		}

		const wikiMatch = url.pathname.match(/^\/wiki\/(.+)/);
		if (wikiMatch) {
			const parsed = parseLineRange(decodeURIComponent(wikiMatch[1] ?? ""));
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
	const imageRef = useRef<HTMLImageElement | null>(null);

	const handleActivate = () => {
		const rawSrc = imageRef.current?.getAttribute("src");
		if (rawSrc) openLightbox(rawSrc);
	};

	return (
		<button
			type="button"
			className="max-w-full cursor-zoom-in border-0 bg-transparent p-0"
			aria-label={alt || t.imageLightbox.viewImage}
			onClick={handleActivate}
		>
			<img
				{...rest}
				ref={imageRef}
				data-lightbox-img
				alt={alt ?? ""}
				className={`${className ?? ""} max-w-full`.trim()}
				onClick={onClick}
				onKeyDown={onKeyDown}
			/>
		</button>
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
	onToggleTask,
	inlineTagChips,
	activeTags,
}: Props) {
	const ref = useRef<HTMLDivElement | null>(null);
	const safeSource = wikilinkBasePath
		? encodeLocalFileLinkDestinations(prepareWikiMarkdown(source, wikilinkBasePath))
		: sanitizeMarkdownSource(encodeLocalFileLinkDestinations(source));
	const { t } = useI18n();
	const theme = useOptionalTheme();
	const entityIndex = useTaskIdIndex();
	const remarkPlugins = useMemo(() => [createEntityLinkPlugin(entityIndex)], [entityIndex]);
	const activeTagSet = useMemo(() => new Set((activeTags ?? []).map((tag) => tag.toLowerCase())), [activeTags]);
	const rehypePlugins = useMemo(
		() =>
			inlineTagChips
				? [rehypeHeadingMetadata, rehypeTaskListIndex, rehypeInlineTags(activeTagSet)]
				: [rehypeHeadingMetadata, rehypeTaskListIndex],
		[inlineTagChips, activeTagSet],
	);

	// react-markdown hands a component only the element's own hast props, so the page's toggle
	// handler has to be bound in from here. Going through a ref keeps the component's identity
	// stable: a fresh type on every render would unmount and remount each checkbox.
	const toggleTaskRef = useRef(onToggleTask);
	useEffect(() => {
		toggleTaskRef.current = onToggleTask;
	}, [onToggleTask]);
	const TaskCheckbox = useMemo(
		() =>
			function TaskCheckboxInput({
				node: _node,
				checked,
				...props
			}: React.InputHTMLAttributes<HTMLInputElement> & { node?: unknown }) {
				// Without a handler the checkbox keeps the renderer's own disabled state, like GitHub.
				if (!toggleTaskRef.current) return <input {...props} checked={checked} />;
				return (
					<input
						{...props}
						// Always a real boolean, never omitted. The renderer only emits `checked` for a
						// ticked item, and React re-applies that prop only while it exists - so without
						// this, unticking would save but the box would keep the tick React restored.
						checked={checked === true}
						disabled={false}
						className={`${props.className ?? ""} cursor-pointer`.trim()}
						onChange={(event) => {
							// The index travels on the DOM node, not in props, so it arrives the same way
							// whichever name the markdown pipeline gives the property.
							const raw = event.currentTarget.getAttribute("data-task-index");
							const index = raw === null ? Number.NaN : Number.parseInt(raw, 10);
							// Read the handler at click time. Taking it from the ref while rendering would
							// freeze whatever the previous commit stored, and every second click on a memo
							// would then toggle a stale copy of it - the box would appear stuck.
							if (Number.isFinite(index)) toggleTaskRef.current?.(index);
						}}
					/>
				);
			},
		[],
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: intentionally scoped
	useEffect(() => {
		if (!ref.current) return;

		// Render mermaid diagrams after the markdown has been rendered
		// Use requestAnimationFrame to ensure MDEditor has finished rendering
		const frameId = requestAnimationFrame(() => {
			if (ref.current) {
				void renderMermaidIn(ref.current, { mode: theme });
			}
		});

		return () => cancelAnimationFrame(frameId);
	}, [safeSource, theme]);

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

			if (href?.startsWith("#")) {
				const resolvedHref =
					typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}${href}` : href;

				const handleHashClick = (e: React.MouseEvent) => {
					e.preventDefault();
					if (!activateHashTarget(href.slice(1))) {
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
					localLink.type === "wiki" && isWikilink ? children : hasCustomLabel ? children : localLink.alias;

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
				// Re-mounting on theme change restores the original code blocks, which
				// `renderMermaidIn` replaces with its own SVG containers.
				key={theme}
				source={safeSource}
				components={{
					a: LinkComponent,
					img: LightboxImage,
					video: VideoPlayer,
					audio: AudioPlayer,
					input: TaskCheckbox,
				}}
				rehypePlugins={rehypePlugins}
				remarkPlugins={remarkPlugins}
			/>
		</div>
	);
}
