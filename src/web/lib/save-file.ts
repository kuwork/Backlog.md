/**
 * Saves a string where the user chooses (BACK-776 follow-up).
 *
 * The server returns the CSV text with a suggested filename; the *destination* is the user's, not
 * the server's. On Chromium the File System Access API opens a save dialog straight to that path;
 * everywhere else (and on a non-secure origin) we fall back to a blob download, which the browser
 * parks in the Downloads folder and lets the user relocate.
 */

interface SaveWritable {
	write(data: string): Promise<void>;
	close(): Promise<void>;
}

interface SaveFileHandle {
	createWritable(): Promise<SaveWritable>;
}

type SaveFilePicker = (options?: {
	suggestedName?: string;
	types?: { description?: string; accept: Record<string, string[]> }[];
}) => Promise<SaveFileHandle>;

export async function saveTextFile(filename: string, contents: string, mime = "text/csv;charset=utf-8"): Promise<void> {
	const picker = (globalThis as { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker;
	if (picker) {
		const handle = await picker({
			suggestedName: filename,
			types: [{ description: "CSV", accept: { "text/csv": [".csv"] } }],
		});
		const writable = await handle.createWritable();
		await writable.write(contents);
		await writable.close();
		return;
	}

	// Deprecated-but-universal fallback: a blob the browser downloads rather than writes in place.
	const blob = new Blob([contents], { type: mime });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = filename;
	document.body.appendChild(anchor);
	anchor.click();
	document.body.removeChild(anchor);
	URL.revokeObjectURL(url);
}
