---
title: BACK-618 Add created_date and updated_date fields to milestones
created_date: '2026-09-07 18:54'
updated_date: '2026-09-07 18:54'
labels:
  - source
  - milestones
  - cli
  - mcp
  - web-ui
source_path: backlog/tasks/back-618 - Add-created_date-and-updated_date-fields-to-milestones.md
---

# BACK-618 Add created_date and updated_date fields to milestones

Milestones lacked the created/updated metadata tasks have had since early versions. This task mirrors the task field design: `created_date` stamped automatically at creation, `updated_date` refreshed only on substantive changes via the BACK-534 centralized projection (pure ordering changes preserve it), UTC storage format read through `parseStoredUtcDate`, all riding the `{...milestone}` spread so no function signatures changed — three parallel subagents then landed the CLI, MCP, and Web surfaces.

## Summary

- Core: `Milestone` type gains `createdDate?/updatedDate?`; `parseMilestone`/`serializeMilestone` round-trip them conditionally (legacy files without the fields stay clean, no empty-string pollution); `fs.createMilestone` stamps created_date (UTC `YYYY-MM-DD HH:MM`) and returns `parseMilestone(content)` (fixes its hand-built return object dropping fields); `fs.updateMilestone` centrally stamps updated_date only on substantive changes via a comparable projection excluding the timestamp itself
- CLI: `milestone list` appends '(updated ...)' or '(created ...)' (updatedDate ?? createdDate), omitted when both absent
- MCP: `milestone_list` lines append '(Created: ..., Updated: ...)' with labels only for present fields
- Web: milestone card 'Milestone dates' row shows 'Last Updated' (最近更新) left of planned dates (visible only when updatedDate || createdDate, prefer updatedDate); MilestoneDetailsModal shows 创建于/更新于 in a compact info box at the top of the sidebar, same markup/classes as the task edit page; `taskDetails.section.lastUpdated` i18n key added in en/zh-CN/zh-TW/ja
- Docs: BACK-521 backport pattern — behavior synced into `src/guidelines/cli-instructions/milestones.md`, `src/guidelines/mcp/milestones.md`, and `src/guidelines/agent-guidelines.md`
- Tests: `milestone-timestamps.test.ts` (5), cli-milestone-management (16), mcp-milestones (34), `web-milestone-timestamps.test.tsx` (6) + 14 regressions, guideline tests 28/28

## Acceptance Criteria

- created_date written automatically at milestone creation (UTC storage, consistent with tasks)
- updated_date refreshed on substantive changes only; ordering changes do not refresh it
- All date reads use parseStoredUtcDate and render correctly across timezones
- Legacy milestone files without the fields do not error; display falls back to created_date
- Fields visible/retrievable on CLI, Web UI, and MCP surfaces
- Web milestone page shows 'Last Updated' left of planned start; edit page shows both dates top-right, styled like the task edit page

## Related Concepts

- [[concepts/milestones]] — milestone model, frontmatter fields, and surface parity
- [[concepts/date-fields]] — UTC storage format, parseStoredUtcDate, and the BACK-534 substantive-change projection

## Related Sources

- [[sources/milestone-actual-dates-task]] — BACK-493 actualStart/actualEnd rollout, the precedent this task followed
