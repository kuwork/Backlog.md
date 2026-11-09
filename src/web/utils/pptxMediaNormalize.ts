import JSZip from "jszip";

/**
 * pptx-renderer (1.4.0) only indexes and resolves embedded media from the
 * canonical `ppt/media/` directory. Some decks — notably ones emitted by
 * certain export tools / AI generators — store pictures under a slide-local
 * `ppt/slides/media/` folder instead. PowerPoint resolves those targets
 * relative to the slide, so the file opens fine there, but the renderer never
 * registers them (`rv()` skips them during collection and `gs()` only probes
 * `ppt/media/`), so every such picture renders as the "No image data"
 * placeholder.
 *
 * This normalizes the package **in memory** so all media lands under
 * `ppt/media/` with corrected relationship Targets. The on-disk file is never
 * touched. Decks that already use the canonical layout pass through untouched
 * (we return the original buffer, skipping the re-zip entirely).
 */
export async function normalizePptxMedia(input: ArrayBuffer): Promise<ArrayBuffer> {
	try {
		const zip = await JSZip.loadAsync(input);

		// Locate media entries that are NOT already under `ppt/media/`.
		const relocations: { from: string; to: string }[] = [];
		const standardPrefix = "ppt/media/";
		zip.forEach((rawPath) => {
			const path = rawPath.replace(/\\/g, "/");
			const mediaIdx = path.lastIndexOf("/media/");
			if (mediaIdx < 0) return;
			if (path.startsWith(standardPrefix)) return; // already canonical
			// Deterministic, collision-free destination name.
			const to = `${standardPrefix}${path.split("/").join("_")}`;
			relocations.push({ from: path, to });
		});

		if (relocations.length === 0) return input;

		// Read bytes once, then move each entry out of its slide-local folder
		// and into `ppt/media/`.
		const bytes = new Map<string, Uint8Array>();
		for (const r of relocations) {
			const file = zip.file(r.from);
			if (file) bytes.set(r.from, await file.async("uint8array"));
		}
		for (const r of relocations) {
			const data = bytes.get(r.from);
			if (!data) continue;
			zip.remove(r.from);
			zip.file(r.to, data);
		}

		// Rewrite every .rels Target that pointed at a relocated media file.
		const fromSet = new Set(relocations.map((r) => r.from));
		const toByFrom = new Map(relocations.map((r) => [r.from, r.to]));
		const relsPaths: string[] = [];
		zip.forEach((rawPath) => {
			const path = rawPath.replace(/\\/g, "/");
			if (path.toLowerCase().endsWith(".rels")) relsPaths.push(path);
		});
		for (const relsPath of relsPaths) {
			const file = zip.file(relsPath);
			if (!file) continue;
			const xml = await file.async("string");
			// A `.rels` at `<dir>/_rels/<part>.rels` describes `<dir>/<part>`,
			// so its Targets are relative to `<dir>` (the parent of `_rels`).
			const baseDir = dirname(dirname(relsPath));
			const next = rewriteRelsTargets(xml, baseDir, fromSet, toByFrom);
			if (next !== xml) zip.file(relsPath, next);
		}

		return await zip.generateAsync({
			type: "arraybuffer",
			mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
		});
	} catch {
		// If normalization fails for any reason, fall back to the original bytes
		// so the renderer still gets a chance (it will just miss those images).
		return input;
	}
}

function rewriteRelsTargets(xml: string, baseDir: string, fromSet: Set<string>, toByFrom: Map<string, string>): string {
	return xml.replace(/<Relationship\b[^>]*>/g, (tag) => {
		const mode = tag.match(/\bTargetMode\s*=\s*"([^"]*)"/i);
		if (mode && mode[1]?.toLowerCase() === "external") return tag;
		const target = tag.match(/\bTarget\s*=\s*"([^"]*)"/i);
		if (!target) return tag;
		const resolved = resolveRelative(baseDir, target[1] ?? "");
		if (!fromSet.has(resolved)) return tag;
		const to = toByFrom.get(resolved);
		if (!to) return tag;
		const newTarget = relativePath(baseDir, to);
		return tag.replace(target[0], `Target="${newTarget}"`);
	});
}

/** Resolve a (possibly relative, possibly `/`-rooted, possibly percent-encoded) OOXML Target to a package-absolute path. */
function resolveRelative(baseDir: string, target: string): string {
	const baseParts = target.startsWith("/") ? [] : baseDir.split("/").filter(Boolean);
	for (const rawPart of target.split("/")) {
		if (rawPart === "" || rawPart === ".") continue;
		let part = rawPart;
		try {
			part = decodeURIComponent(rawPart);
		} catch {
			/* keep literal */
		}
		if (part === "..") baseParts.pop();
		else baseParts.push(part);
	}
	return baseParts.join("/");
}

/** Relative path from `fromDir` to `toPath`, both package-absolute. */
function relativePath(fromDir: string, toPath: string): string {
	const from = fromDir.split("/").filter(Boolean);
	const to = toPath.split("/").filter(Boolean);
	let i = 0;
	while (i < from.length && i < to.length && from[i] === to[i]) i += 1;
	const up = from.length - i;
	const down = to.slice(i);
	return `${up === 0 ? "" : "../".repeat(up)}${down.join("/")}`;
}

function dirname(path: string): string {
	const parts = path.split("/");
	parts.pop();
	return parts.join("/");
}
