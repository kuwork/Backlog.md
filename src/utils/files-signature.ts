import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Sizes and change times of what a read loads: the given files, and the entries of the given
 * directories one level deep, following symlinks like the loaders. This stat pass is far cheaper
 * than a full read and repairs missed notifications. The ctime also moves when a copy keeps the mtime.
 */
export function filesSignature(inputs: string[]): string {
	const describe = (path: string, name: string) => {
		try {
			const stats = statSync(path);
			return `${name}\0${stats.size}\0${stats.mtimeMs}\0${stats.ctimeMs}`;
		} catch {
			// Missing, dangling or looping entries count by name only.
			return name;
		}
	};
	return inputs
		.flatMap((input) => {
			try {
				return [
					input,
					...readdirSync(input)
						.sort()
						.map((name) => describe(join(input, name), name)),
				];
			} catch {
				// A file, or a directory that does not exist yet.
				return [describe(input, input)];
			}
		})
		.join("\n");
}
