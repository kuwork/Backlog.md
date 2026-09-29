import { composeGuideTextWithProject } from "../../../core/state-machine-guidance.ts";
import type { McpServer } from "../../server.ts";
import type { McpResourceHandler } from "../../types.ts";
import { WORKFLOW_GUIDES } from "../../workflow-guides.ts";

export function registerWorkflowResources(server: McpServer): void {
	for (const guide of WORKFLOW_GUIDES) {
		const resource: McpResourceHandler = {
			uri: guide.uri,
			name: guide.name,
			description: guide.description,
			mimeType: guide.mimeType,
			// The overview carries the project's own state machine, so it is assembled per read from
			// the current config rather than served as the shipped static text.
			handler: async () => ({
				contents: [
					{
						uri: guide.uri,
						mimeType: guide.mimeType,
						text: await composeGuideTextWithProject(guide.resourceText, server.filesystem),
					},
				],
			}),
		};

		server.addResource(resource);
	}
}
