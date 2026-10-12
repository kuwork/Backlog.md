/**
 * The one set of rules for walking a project directory.
 *
 * `searchProjectFiles` (src/file-system/operations.ts) grew these rules first and SQLite file
 * discovery needs the exact same ones, so they live here rather than being re-declared per caller:
 * a directory that is invisible to project search must also be invisible to SQLite discovery.
 */

/** Directories never descended into. */
export const PROJECT_SCAN_EXCLUDE_DIRS = new Set(["node_modules", ".git", "dist", "build", ".locks"]);

/**
 * True for a directory a project-wide walk must skip: an excluded directory, or a dot-directory
 * other than `.backlog` (which is ours and must stay visible).
 */
export function isScanSkippedDir(name: string): boolean {
	if (PROJECT_SCAN_EXCLUDE_DIRS.has(name)) return true;
	return name.startsWith(".") && name !== ".backlog";
}
