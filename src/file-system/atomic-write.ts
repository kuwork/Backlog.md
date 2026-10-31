import { rename as renameFile } from "node:fs/promises";

const LOCK_ERROR_CODES = new Set(["EPERM", "EACCES", "EBUSY"]);

/**
 * Replace `target` with `source` in one step, retrying briefly on Windows.
 *
 * A freshly written temp file can still be held for a few hundred milliseconds
 * by the virus scanner or the search indexer, which makes the rename fail with
 * EPERM even though nothing else has the workbook open. Retrying rides that out;
 * a real lock (Excel / WPS holding the file) still surfaces as an error.
 */
export async function replaceFile(source: string, target: string): Promise<void> {
	let lastError: unknown;
	for (let attempt = 0; attempt < 5; attempt++) {
		try {
			await renameFile(source, target);
			return;
		} catch (error) {
			const code = (error as NodeJS.ErrnoException).code ?? "";
			if (!LOCK_ERROR_CODES.has(code)) throw error;
			lastError = error;
			await new Promise((resolve) => setTimeout(resolve, 80 * (attempt + 1)));
		}
	}
	throw lastError;
}
