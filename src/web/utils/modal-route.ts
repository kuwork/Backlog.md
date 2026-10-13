/**
 * True when `pathname` is one of the full-screen detail modals: a task (`/task/:id`), a draft
 * (`/draft/:id`) or a milestone (`/milestone/:id`).
 *
 * The task and milestone detail modals are route-driven and always mounted - switching between
 * them hides the lower one without unmounting it. So a modal whose close landed the app on one of
 * these paths was only *occluded* (the user can navigate back into it), whereas landing anywhere
 * else means it was really left. Callers use this to tell "went one level deeper" from "closed".
 *
 * The plural list paths (`/tasks`, `/milestones`) must not match, hence the required `/` or end.
 */
export function isModalRoutePath(pathname: string): boolean {
	return /^\/(?:task|draft|milestone)(?:\/|$)/.test(pathname);
}
