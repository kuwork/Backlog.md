---
name: honkit-docs-migration
description: "Build a GitBook-style Markdown documentation set (README.md + SUMMARY.md with chapter folders) into a static HTML site using HonKit, then migrate the output into a target static website's docs directory. Use this skill when asked to generate, publish, or migrate user manuals, wikis, or docs as HTML via HonKit, for example building the Backlog.md user manual from its wiki source and deploying it under a site's /docs/ path."
agent_created: true
---

# HonKit 文档迁移

Generate a static HTML documentation site from a GitBook-style Markdown source
(`README.md` + `SUMMARY.md` + numbered chapter folders) using HonKit, then
migrate the build output into a target static website so it is served as a
subsite (e.g. `/docs/`).

## When to use

- "用 HonKit 把用户手册生成 HTML 并迁移到官网"
- "build the docs with HonKit and publish under /docs/"
- Any task to turn a GitBook-formatted Markdown wiki/manual into a deployable
  static HTML site and place it inside an existing static site.

## Workflow

1. **Identify the source.** Locate the GitBook-style source: a directory
   containing `README.md` and `SUMMARY.md`. Determine the git repo, the
   branch/tree-ish, and the source path. Read `references/workflow.md` for the
   Backlog.md-specific conventions (source branch, wikilink handling, mermaid
   decision, deploy target).

2. **Run the migration script.** The script extracts the source from git,
   normalizes wikilinks, builds with HonKit, and migrates the output:

   ```bash
   python3 scripts/migrate_docs.py \
     --repo /d/git/Backlog.md \
     --branch release \
     --src backlog/wiki/usermanual \
     --site /d/git/backlog-md-site \
     --docs-dir docs \
     --work /d/tmp/um-build \
     --worktree /d/git/backlog-md-pages
   ```

   Parameter reference:
   - `--repo` — git repo holding the docs source.
   - `--branch` — branch/tree-ish to extract from (default `release`).
   - `--src` — docs source path inside the repo.
   - `--site` — target static site root; the manual lands in `--docs-dir`.
   - `--docs-dir` — subdirectory under `--site` for the manual (default `docs`).
   - `--work` — persistent build workspace; preserves `node_modules/honkit` so
     HonKit is not reinstalled each run.
   - `--worktree` — optional gh-pages worktree to sync `index.html` + `docs/`
     into for deployment.

   What the script does internally:
   - Extracts the source via `git archive <branch> <src> | tar -x` into the work
     dir, preserving `node_modules` across runs.
   - Normalizes `[[wikilink]]` / `[[wikilink|alias]]` cross-references to
     readable text (HonKit cannot render them).
   - Writes a minimal `book.json` if absent (title from README frontmatter).
   - Installs HonKit on first build, then runs `npx honkit build` -> `_book/`.
   - Copies `_book/` into `--site/--docs-dir`, excluding `package.json` /
     `package-lock.json`.
   - If `--worktree` is given, syncs `docs/` and `index.html` into it.

3. **Wire up navigation.** If the target site has a docs section, point its
   "user manual" link at the local `docs/` path (not a dead GitHub wiki URL).
   For Backlog.md, edit `backlog-md-site/index.html` `#docs` section's card.

4. **Verify offline.** Use a headless browser (CDP) to screenshot `docs/index.html`
   and a nested page (e.g. `docs/80-图谱与数据查询/06-图表块.html`). Both must
   render the sidebar nav and content with no broken styling. No network is
   required because the build has no external dependencies.

5. **Deploy (user action).** If a `--worktree` was synced, the user commits and
   pushes it. Do not commit or push on the user's behalf unless explicitly asked.

## Key constraints

- **Wikilinks must be normalized** before build; HonKit renders raw `[[...]]`.
- **Do not bundle mermaid/echarts.** Per project decision the manual shows
  diagram fences as source code blocks; the skill intentionally renders no
  diagrams. (Override only with explicit user direction.)
- **Relative links only.** HonKit emits relative links, so the manual mounts
  under any subpath. Never rewrite them to absolute paths.
- **Exclude npm artifacts** (`package.json`, `package-lock.json`) from the
  migrated `docs/` directory.
