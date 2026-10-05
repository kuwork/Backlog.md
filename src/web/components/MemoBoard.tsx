import { useEffect, useMemo, useRef, useState } from "react";
import type { Memo } from "../../core/memos.ts";
import { useTheme } from "../contexts/ThemeContext";
import { useI18n } from "../hooks/useI18n";
import {
	type BoardNote,
	type BoardNoteVariant,
	hitTest,
	layoutBoard,
	memoInkLines,
	NOTE_INK,
	NOTE_WIDTH,
	wrapEstimate,
} from "../utils/memo-board";
import { ErrorBanner, MemoCard, type MemoCardProps } from "./MemoCard";
import Modal from "./Modal";

/**
 * The memos pinboard (`/memos?view=board`): every memo is a sticky note on a corkboard, rendered
 * with raw WebGL. Each note's whole look - yellow paper, ink text, folded corner, colored pushpin,
 * soft shadow - is baked once into an offscreen 2D canvas and uploaded as a texture; the GL pass
 * then only positions, rotates and lifts textured quads, so a frame is one draw call per note.
 */

/** World-pixel padding around the paper inside the texture: room for the shadow and the pin head. */
const TEX_PAD = 28;
/** Canvas pixels per world pixel when baking a note texture. */
const TEX_SCALE = 2;
/** Texture quad width in world pixels (paper width plus padding on both sides). */
const TEX_WORLD_W = NOTE_WIDTH + TEX_PAD * 2;
/** How much a note grows while hovered. */
const HOVER_GROW = 0.06;
/**
 * Where the hovered note's archive button sits, measured in from the paper's top-right corner.
 * Inside the paper rather than on its edge, so the pointer stays on the note - and therefore on
 * the hover - while travelling to the button.
 */
const ARCHIVE_INSET = 22;

const VERTEX_SHADER = `
attribute vec2 a_corner;
uniform vec2 u_center;
uniform vec2 u_size;
uniform float u_rot;
uniform vec2 u_resolution;
varying vec2 v_uv;
void main() {
	vec2 p = a_corner * u_size;
	float c = cos(u_rot);
	float s = sin(u_rot);
	vec2 world = u_center + vec2(p.x * c - p.y * s, p.x * s + p.y * c);
	vec2 clip = (world / u_resolution) * 2.0 - 1.0;
	gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
	v_uv = a_corner + 0.5;
}
`;

const FRAGMENT_SHADER = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform float u_dim;
void main() {
	vec4 color = texture2D(u_tex, v_uv);
	gl_FragColor = vec4(color.rgb * u_dim, color.a);
}
`;

function hexToRgb(hex: string): [number, number, number] {
	const value = Number.parseInt(hex.slice(1), 16);
	return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

function mixColor(hex: string, other: [number, number, number], amount: number): string {
	const [r, g, b] = hexToRgb(hex);
	const mix = (channel: number, target: number) => Math.round(channel + (target - channel) * amount);
	return `rgb(${mix(r, other[0])}, ${mix(g, other[1])}, ${mix(b, other[2])})`;
}

const lighten = (hex: string, amount: number) => mixColor(hex, [255, 255, 255], amount);
const darken = (hex: string, amount: number) => mixColor(hex, [0, 0, 0], amount);

const INK_COLOR = "#4a4234";
const HAND_FONT = `"Segoe Print", "Bradley Hand", "Comic Sans MS", "Microsoft YaHei", "PingFang SC", cursive`;

/** The paper's outline: a slightly rounded rectangle, optionally with the bottom-right corner cut. */
function paperPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, curl: number) {
	const r = 5;
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.lineTo(x + w - r, y);
	ctx.arcTo(x + w, y, x + w, y + r, r);
	if (curl > 0) {
		ctx.lineTo(x + w, y + h - curl);
		ctx.lineTo(x + w - curl, y + h);
	} else {
		ctx.lineTo(x + w, y + h - r);
		ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
	}
	ctx.lineTo(x + r, y + h);
	ctx.arcTo(x, y + h, x, y + h - r, r);
	ctx.lineTo(x, y + r);
	ctx.arcTo(x, y, x + r, y, r);
	ctx.closePath();
}

function drawPin(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string) {
	// The pin's cast shadow on the paper, offset down-right like the light that casts the note's own.
	ctx.save();
	ctx.fillStyle = "rgba(0, 0, 0, 0.20)";
	ctx.filter = "blur(2.5px)";
	ctx.beginPath();
	ctx.ellipse(cx + 9, cy + 15, 15, 5.5, 0.35, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();

	// The needle, leaning the same way as the shadow.
	const needle = ctx.createLinearGradient(cx, cy, cx + 4, cy + 20);
	needle.addColorStop(0, "#d4d4d8");
	needle.addColorStop(1, "#71717a");
	ctx.strokeStyle = needle;
	ctx.lineWidth = 2.4;
	ctx.lineCap = "round";
	ctx.beginPath();
	ctx.moveTo(cx + 0.5, cy + 6);
	ctx.lineTo(cx + 4.5, cy + 21);
	ctx.stroke();

	// The head: a glossy sphere lit from the top-left.
	const head = ctx.createRadialGradient(cx - 4.5, cy - 5, 1, cx, cy, 14.5);
	head.addColorStop(0, lighten(color, 0.65));
	head.addColorStop(0.35, color);
	head.addColorStop(1, darken(color, 0.35));
	ctx.fillStyle = head;
	ctx.beginPath();
	ctx.arc(cx, cy, 13.5, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = darken(color, 0.3);
	ctx.lineWidth = 0.8;
	ctx.stroke();

	ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
	ctx.beginPath();
	ctx.arc(cx - 4.5, cy - 5.5, 3, 0, Math.PI * 2);
	ctx.fill();
}

/** Bake one note's complete appearance (paper, full text, pin, shadow) into a texture canvas. */
function bakeNoteTexture(memo: Memo, variant: BoardNoteVariant, height: number): HTMLCanvasElement {
	const canvas = document.createElement("canvas");
	canvas.width = TEX_WORLD_W * TEX_SCALE;
	canvas.height = (height + TEX_PAD * 2) * TEX_SCALE;
	const ctx = canvas.getContext("2d");
	if (!ctx) return canvas;
	ctx.scale(TEX_SCALE, TEX_SCALE);

	const x = TEX_PAD;
	const y = TEX_PAD;
	const w = NOTE_WIDTH;
	const h = height;
	const curl = variant.curl ? 30 : 0;

	// Paper with its drop shadow: the single fill carries both.
	ctx.save();
	ctx.shadowColor = "rgba(30, 22, 8, 0.35)";
	ctx.shadowBlur = 13;
	ctx.shadowOffsetY = 6;
	const paperGradient = ctx.createLinearGradient(0, y, 0, y + h);
	paperGradient.addColorStop(0, lighten(variant.paper, 0.25));
	paperGradient.addColorStop(1, variant.paper);
	ctx.fillStyle = paperGradient;
	paperPath(ctx, x, y, w, h, curl);
	ctx.fill();
	ctx.restore();
	ctx.strokeStyle = "rgba(120, 100, 40, 0.18)";
	ctx.lineWidth = 1;
	paperPath(ctx, x, y, w, h, curl);
	ctx.stroke();

	// Folded corner: the flap is the cut triangle mirrored across the cut line, lit from above.
	if (curl > 0) {
		const ax = x + w - curl;
		const ay = y + h;
		const bx = x + w;
		const by = y + h - curl;
		ctx.save();
		ctx.shadowColor = "rgba(30, 22, 8, 0.3)";
		ctx.shadowBlur = 5;
		ctx.shadowOffsetY = -2;
		const flap = ctx.createLinearGradient(ax, ay, bx, by);
		flap.addColorStop(0, lighten(variant.paper, 0.45));
		flap.addColorStop(1, lighten(variant.paper, 0.1));
		ctx.fillStyle = flap;
		ctx.beginPath();
		ctx.moveTo(ax, ay);
		ctx.lineTo(bx, by);
		ctx.lineTo(ax, by);
		ctx.closePath();
		ctx.fill();
		ctx.restore();
	}

	// Ink: the whole memo text, wrapped exactly the way the layout estimated it, so the paper
	// always fits. First line is the heading, the rest the body; date and tags sit at the bottom.
	const { title, body } = memoInkLines(memo);
	const textX = x + NOTE_INK.inset;
	const maxWidth = w - NOTE_INK.inset * 2;
	let textY = y + NOTE_INK.pinClearance;
	ctx.fillStyle = INK_COLOR;
	ctx.font = `600 ${NOTE_INK.titleFontSize}px ${HAND_FONT}`;
	for (const line of wrapEstimate(title, maxWidth, NOTE_INK.titleFontSize)) {
		ctx.fillText(line, textX, textY);
		textY += NOTE_INK.titleLineHeight;
	}
	if (body.length > 0) {
		ctx.font = `${NOTE_INK.bodyFontSize}px ${HAND_FONT}`;
		ctx.fillStyle = "rgba(74, 66, 52, 0.82)";
		textY += 4;
		for (const sourceLine of body) {
			for (const line of wrapEstimate(sourceLine, maxWidth, NOTE_INK.bodyFontSize)) {
				ctx.fillText(line, textX, textY);
				textY += NOTE_INK.bodyLineHeight;
			}
		}
	}
	ctx.font = `10px ${HAND_FONT}`;
	ctx.fillStyle = "rgba(96, 84, 60, 0.65)";
	ctx.fillText(memo.createdDate.slice(0, 10), textX, y + h - 14);
	if (memo.tags.length > 0) {
		const tagLabel = memo.tags
			.slice(0, 2)
			.map((tag) => `#${tag}`)
			.join(" ");
		const tagWidth = ctx.measureText(tagLabel).width;
		ctx.fillText(tagLabel, x + w - NOTE_INK.inset - tagWidth, y + h - 14);
	}

	drawPin(ctx, x + w / 2, y - 2, variant.pin);
	return canvas;
}

interface BoardUniforms {
	u_center: WebGLUniformLocation | null;
	u_size: WebGLUniformLocation | null;
	u_rot: WebGLUniformLocation | null;
	u_resolution: WebGLUniformLocation | null;
	u_dim: WebGLUniformLocation | null;
}

interface GlState {
	gl: WebGLRenderingContext;
	uniforms: BoardUniforms;
	textures: Map<string, { texture: WebGLTexture; stamp: string }>;
}

function initGl(canvas: HTMLCanvasElement): GlState | null {
	const gl = canvas.getContext("webgl", { alpha: true, antialias: true, premultipliedAlpha: false });
	if (!gl) return null;
	const compile = (type: number, source: string): WebGLShader | null => {
		const shader = gl.createShader(type);
		if (!shader) return null;
		gl.shaderSource(shader, source);
		gl.compileShader(shader);
		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			console.warn("MemoBoard shader failed to compile:", gl.getShaderInfoLog(shader));
			return null;
		}
		return shader;
	};
	const vertex = compile(gl.VERTEX_SHADER, VERTEX_SHADER);
	const fragment = compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
	const program = gl.createProgram();
	if (!vertex || !fragment || !program) return null;
	gl.attachShader(program, vertex);
	gl.attachShader(program, fragment);
	gl.linkProgram(program);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		console.warn("MemoBoard program failed to link:", gl.getProgramInfoLog(program));
		return null;
	}
	// biome-ignore lint/correctness/useHookAtTopLevel: WebGL's useProgram is not a React hook.
	gl.useProgram(program);

	const buffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]), gl.STATIC_DRAW);
	const corner = gl.getAttribLocation(program, "a_corner");
	gl.enableVertexAttribArray(corner);
	gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0);

	gl.enable(gl.BLEND);
	gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
	gl.uniform1i(gl.getUniformLocation(program, "u_tex"), 0);

	return {
		gl,
		uniforms: {
			u_center: gl.getUniformLocation(program, "u_center"),
			u_size: gl.getUniformLocation(program, "u_size"),
			u_rot: gl.getUniformLocation(program, "u_rot"),
			u_resolution: gl.getUniformLocation(program, "u_resolution"),
			u_dim: gl.getUniformLocation(program, "u_dim"),
		},
		textures: new Map(),
	};
}

/** A box-with-a-lid glyph for the hovered note's archive button. */
function ArchiveIcon() {
	return (
		<svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
			<path strokeLinecap="round" strokeLinejoin="round" d="M3 7h18v4H3zM5 11h14v9H5zM10 15h4" />
		</svg>
	);
}

interface MemoBoardProps extends Omit<MemoCardProps, "memo"> {
	memos: Memo[];
}

export default function MemoBoard({ memos, onUpdate, onDelete, onArchive, onTagClick }: MemoBoardProps) {
	const { t } = useI18n();
	const { theme } = useTheme();
	const containerRef = useRef<HTMLDivElement | null>(null);
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const [containerWidth, setContainerWidth] = useState(0);
	const [containerHeight, setContainerHeight] = useState(0);
	const [unsupported, setUnsupported] = useState(false);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [isFullscreen, setIsFullscreen] = useState(false);
	const [hoveredId, setHoveredId] = useState<string | null>(null);
	const [archiveError, setArchiveError] = useState<string | null>(null);

	const glRef = useRef<GlState | null>(null);
	const notesRef = useRef<BoardNote[]>([]);
	const liftsRef = useRef(new Map<string, number>());
	const hoveredRef = useRef<string | null>(null);
	// Read through refs from the draw pass, so a theme flip redraws without rebuilding the GL setup.
	const themeRef = useRef(theme);
	themeRef.current = theme;
	const scheduleDrawRef = useRef<() => void>(() => {});

	const boardWidth = containerWidth > 0 ? containerWidth : 800;
	const boardHeight = containerHeight > 0 ? containerHeight : 600;
	const layout = useMemo(() => layoutBoard(memos, boardWidth, boardHeight), [memos, boardWidth, boardHeight]);
	const selectedMemo = selectedId ? (memos.find((memo) => memo.id === selectedId) ?? null) : null;
	const hoveredNote = hoveredId ? (layout.notes.find((note) => note.memo.id === hoveredId) ?? null) : null;

	const archiveNote = async (id: string) => {
		setArchiveError(null);
		try {
			await onArchive(id);
		} catch (_error) {
			setArchiveError(t.memos.archiveFailed);
		}
	};

	const toggleFullscreen = () => {
		const container = containerRef.current;
		if (!container) return;
		if (document.fullscreenElement) void document.exitFullscreen();
		else void container.requestFullscreen();
	};

	// A fullscreened board fills the screen instead of its layout slot; either way the
	// ResizeObserver on the container resizes the canvas.
	useEffect(() => {
		const onChange = () => {
			const container = containerRef.current;
			const active = document.fullscreenElement === container;
			setIsFullscreen(active);
			if (container) container.style.height = active ? "100vh" : "";
		};
		document.addEventListener("fullscreenchange", onChange);
		return () => document.removeEventListener("fullscreenchange", onChange);
	}, []);

	// WebGL setup, input and the draw loop - everything canvas lives here, once per mount.
	useEffect(() => {
		const canvas = canvasRef.current;
		const container = containerRef.current;
		if (!canvas || !container) return;
		const state = initGl(canvas);
		if (!state) {
			setUnsupported(true);
			return;
		}
		glRef.current = state;
		const { gl, uniforms, textures } = state;

		let drawHandle: number | null = null;
		let animHandle: number | null = null;

		const draw = () => {
			drawHandle = null;
			gl.viewport(0, 0, canvas.width, canvas.height);
			gl.clearColor(0, 0, 0, 0);
			gl.clear(gl.COLOR_BUFFER_BIT);
			// The board is a fixed blackboard: world coordinates are CSS pixels, no pan or zoom.
			const dpr = window.devicePixelRatio || 1;
			gl.uniform2f(uniforms.u_resolution, canvas.width / dpr, canvas.height / dpr);
			gl.uniform1f(uniforms.u_dim, themeRef.current === "dark" ? 0.78 : 1);

			// The hovered note lifts and jumps to the top of the pile.
			const ordered = [...notesRef.current].sort((a, b) =>
				a.memo.id === hoveredRef.current ? 1 : b.memo.id === hoveredRef.current ? -1 : 0,
			);
			for (const note of ordered) {
				const entry = textures.get(note.memo.id);
				if (!entry) continue;
				const lift = liftsRef.current.get(note.memo.id) ?? 0;
				const grow = 1 + lift * HOVER_GROW;
				gl.bindTexture(gl.TEXTURE_2D, entry.texture);
				gl.uniform2f(uniforms.u_center, note.x, note.y);
				gl.uniform2f(uniforms.u_size, TEX_WORLD_W * grow, (note.h + TEX_PAD * 2) * grow);
				gl.uniform1f(uniforms.u_rot, note.variant.tilt);
				gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
			}
		};
		const scheduleDraw = () => {
			if (drawHandle === null) drawHandle = requestAnimationFrame(draw);
		};
		scheduleDrawRef.current = scheduleDraw;

		/** Ease every note's lift toward its hover target, redrawing until all have settled. */
		const pumpLifts = () => {
			animHandle = null;
			let settled = true;
			for (const id of [...liftsRef.current.keys()]) {
				const target = id === hoveredRef.current ? 1 : 0;
				const current = liftsRef.current.get(id) ?? 0;
				const next = current + (target - current) * 0.25;
				if (Math.abs(next - target) < 0.01) {
					if (target === 0) liftsRef.current.delete(id);
					else liftsRef.current.set(id, 1);
				} else {
					liftsRef.current.set(id, next);
					settled = false;
				}
			}
			scheduleDraw();
			if (!settled && animHandle === null) animHandle = requestAnimationFrame(pumpLifts);
		};
		const scheduleLift = () => {
			if (animHandle === null) animHandle = requestAnimationFrame(pumpLifts);
		};

		const resize = () => {
			const dpr = window.devicePixelRatio || 1;
			canvas.width = Math.round(container.clientWidth * dpr);
			canvas.height = Math.round(container.clientHeight * dpr);
			setContainerWidth(container.clientWidth);
			setContainerHeight(container.clientHeight);
			scheduleDraw();
		};
		resize();
		const observer = new ResizeObserver(resize);
		observer.observe(container);

		const setHover = (id: string | null) => {
			hoveredRef.current = id;
			setHoveredId(id);
			canvas.style.cursor = id ? "pointer" : "default";
		};
		// Hover is tracked on the container, not the canvas: the archive button floats above the
		// canvas, so a canvas-level leave would hide it the moment the pointer moved onto it.
		const onPointerMove = (event: PointerEvent) => {
			const rect = canvas.getBoundingClientRect();
			const id = hitTest(notesRef.current, event.clientX - rect.left, event.clientY - rect.top)?.memo.id ?? null;
			if (id !== hoveredRef.current) {
				setHover(id);
				scheduleLift();
			}
		};
		const onPointerLeave = () => {
			if (hoveredRef.current === null) return;
			setHover(null);
			scheduleLift();
		};
		let downAt: { x: number; y: number } | null = null;
		const onPointerDown = (event: PointerEvent) => {
			downAt = { x: event.clientX, y: event.clientY };
		};
		const onClick = (event: MouseEvent) => {
			// Ignore drags: only a near-stationary press is a note selection.
			if (downAt && Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y) > 5) return;
			const rect = canvas.getBoundingClientRect();
			const hit = hitTest(notesRef.current, event.clientX - rect.left, event.clientY - rect.top);
			if (hit) setSelectedId(hit.memo.id);
		};

		container.addEventListener("pointermove", onPointerMove);
		container.addEventListener("pointerleave", onPointerLeave);
		canvas.addEventListener("pointerdown", onPointerDown);
		canvas.addEventListener("click", onClick);

		scheduleDraw();
		return () => {
			observer.disconnect();
			container.removeEventListener("pointermove", onPointerMove);
			container.removeEventListener("pointerleave", onPointerLeave);
			canvas.removeEventListener("pointerdown", onPointerDown);
			canvas.removeEventListener("click", onClick);
			if (drawHandle !== null) cancelAnimationFrame(drawHandle);
			if (animHandle !== null) cancelAnimationFrame(animHandle);
			for (const entry of textures.values()) gl.deleteTexture(entry.texture);
			glRef.current = null;
		};
	}, []);

	// Re-bake textures for new or edited memos and drop textures of removed ones.
	useEffect(() => {
		notesRef.current = layout.notes;
		const state = glRef.current;
		if (state) {
			const { gl, textures } = state;
			const live = new Set<string>();
			for (const note of layout.notes) {
				live.add(note.memo.id);
				const stamp = memoStamp(note.memo);
				const cached = textures.get(note.memo.id);
				if (cached && cached.stamp === stamp) continue;
				if (cached) gl.deleteTexture(cached.texture);
				const texture = gl.createTexture();
				if (!texture) continue;
				gl.bindTexture(gl.TEXTURE_2D, texture);
				gl.texImage2D(
					gl.TEXTURE_2D,
					0,
					gl.RGBA,
					gl.RGBA,
					gl.UNSIGNED_BYTE,
					bakeNoteTexture(note.memo, note.variant, note.h),
				);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
				textures.set(note.memo.id, { texture, stamp });
			}
			for (const [id, entry] of textures) {
				if (!live.has(id)) {
					gl.deleteTexture(entry.texture);
					textures.delete(id);
				}
			}
		}
		scheduleDrawRef.current();
	}, [layout]);

	// A theme flip only changes the dim uniform - a plain redraw, no rebake.
	// biome-ignore lint/correctness/useExhaustiveDependencies: theme is the trigger, the draw pass reads it via themeRef
	useEffect(() => {
		scheduleDrawRef.current();
	}, [theme]);

	if (unsupported) {
		return (
			<p role="status" className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
				{t.memos.webglUnavailable}
			</p>
		);
	}

	const corkStyle =
		theme === "dark"
			? {
					backgroundColor: "#4a3a28",
					backgroundImage:
						"radial-gradient(rgba(0,0,0,0.25) 1px, transparent 1.6px), radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1.6px)",
					backgroundSize: "14px 14px, 17px 17px",
					backgroundPosition: "0 0, 6px 8px",
				}
			: {
					backgroundColor: "#c9a06a",
					backgroundImage:
						"radial-gradient(rgba(0,0,0,0.10) 1px, transparent 1.6px), radial-gradient(rgba(255,255,255,0.14) 1px, transparent 1.6px)",
					backgroundSize: "14px 14px, 17px 17px",
					backgroundPosition: "0 0, 6px 8px",
				};

	return (
		<div
			ref={containerRef}
			data-testid="memo-board"
			className="relative h-full w-full overflow-hidden rounded-xl border border-amber-900/20 dark:border-black/40 shadow-inner"
			style={corkStyle}
		>
			<canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
			{hoveredNote && (
				/* A note is a baked texture with no DOM of its own, so its only control is an
				   overlay: it sits inside the board container, which is the fullscreen element.
				   It is a sibling of the canvas, so pressing it never reaches the canvas click
				   that opens the note modal. */
				<button
					type="button"
					data-testid="board-archive-button"
					aria-label={t.memos.archiveNote}
					title={t.memos.archiveNote}
					onClick={() => void archiveNote(hoveredNote.memo.id)}
					style={{
						left: hoveredNote.x + NOTE_WIDTH / 2 - ARCHIVE_INSET,
						top: hoveredNote.y - hoveredNote.h / 2 + ARCHIVE_INSET,
					}}
					className="absolute z-10 -translate-x-1/2 -translate-y-1/2 p-1.5 rounded-md bg-black/30 hover:bg-black/50 text-amber-50 transition-colors"
				>
					<ArchiveIcon />
				</button>
			)}
			{archiveError && (
				<div className="absolute top-3 left-3 z-10">
					<ErrorBanner title={archiveError} onRetry={() => setArchiveError(null)} retryLabel={t.common.close} />
				</div>
			)}
			<button
				type="button"
				onClick={toggleFullscreen}
				aria-label={isFullscreen ? t.memos.exitFullscreen : t.memos.fullscreen}
				title={isFullscreen ? t.memos.exitFullscreen : t.memos.fullscreen}
				className="absolute top-3 right-3 z-10 p-2 rounded-md bg-black/25 hover:bg-black/40 text-amber-50 transition-colors"
			>
				{isFullscreen ? (
					<svg
						aria-hidden="true"
						className="w-4 h-4"
						fill="none"
						stroke="currentColor"
						strokeWidth={2}
						viewBox="0 0 24 24"
					>
						<path strokeLinecap="round" strokeLinejoin="round" d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
					</svg>
				) : (
					<svg
						aria-hidden="true"
						className="w-4 h-4"
						fill="none"
						stroke="currentColor"
						strokeWidth={2}
						viewBox="0 0 24 24"
					>
						<path strokeLinecap="round" strokeLinejoin="round" d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
					</svg>
				)}
			</button>
			{memos.length === 0 && (
				<p className="absolute inset-0 flex items-center justify-center text-sm text-amber-950/70 dark:text-amber-100/70">
					{t.memos.empty}
				</p>
			)}
			{/* The modal lives INSIDE the board container: in fullscreen only the fullscreen
				    element's subtree is visible, so a sibling modal would vanish. */}
			<Modal
				isOpen={selectedMemo !== null}
				onClose={() => setSelectedId(null)}
				title={t.memos.noteModalTitle}
				maxWidthClass="max-w-xl"
			>
				{selectedMemo && (
					<MemoCard
						memo={selectedMemo}
						onUpdate={onUpdate}
						onDelete={async (id) => {
							await onDelete(id);
							setSelectedId(null);
						}}
						onArchive={async (id) => {
							await onArchive(id);
							setSelectedId(null);
						}}
						onTagClick={onTagClick}
					/>
				)}
			</Modal>
		</div>
	);
}

/** The texture changes only when the memo itself does. */
function memoStamp(memo: Memo): string {
	return `${memo.updatedDate ?? memo.createdDate}`;
}
