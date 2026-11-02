---
name: honkit-docs-migration
description: "Build a GitBook-style Markdown documentation set into a static HTML site with HonKit, then migrate the output into a target static website's docs directory. Handles bilingual/multilingual books driven by LANGS.md as well as single books. Use this skill when asked to generate, publish, or migrate user manuals, wikis, or docs as HTML via HonKit, for example building the Backlog.md user manual (Chinese and English) from its wiki source and deploying it under a site's /docs/ and /en/docs/ paths."
agent_created: true
---

# HonKit 文档迁移

Generate static HTML documentation from GitBook-style Markdown sources
(`README.md` + `SUMMARY.md` + numbered chapter folders) using HonKit, then
migrate the build output into a target static website so it is served as a
subsite (e.g. `/docs/`, `/en/docs/`).

## When to use

- "用 HonKit 把用户手册生成 HTML 并迁移到官网"
- "build the docs with HonKit and publish under /docs/"
- Any task to turn a GitBook-formatted Markdown wiki/manual into a deployable
  static HTML site and place it inside an existing static site.

## Workflow

1. **Identify the book root.** Ask for the directory HonKit is launched from,
   not just the folder holding `SUMMARY.md`:

   - **Multilingual root** — contains `LANGS.md` plus one sub-directory per
     language (e.g. `usermanual/`, `usermanual-en/`). Each sub-directory holds
     its own `README.md` + `SUMMARY.md` (+ optional `book.json`).
   - **Single book** — the directory itself holds `README.md` + `SUMMARY.md`.

   Read `references/workflow.md` for the Backlog.md-specific conventions
   (source branch, wikilink handling, mermaid decision, deploy target).

2. **Run the migration script.** It extracts the source from git, normalizes
   wikilinks, builds every language book from the book root, and migrates each
   output:

   ```bash
   python3 scripts/migrate_docs.py \
     --repo /d/git/Backlog.md \
     --branch wiki-tmp \
     --src backlog/wiki \
     --site /d/git/backlog-md-site \
     --docs-dir docs \
     --work /d/tmp/um-build \
     --worktree /d/git/backlog-md-pages
   ```

   Parameter reference:
   - `--repo` — git repo holding the docs source.
   - `--branch` — branch/tree-ish to extract from (default `release`).
   - `--src` — book root inside the repo (`LANGS.md`, or `README.md`+`SUMMARY.md`).
   - `--site` — target static site root.
   - `--docs-dir` — target subdirectory for the primary language (default `docs`).
   - `--lang-dirs` — explicit map, e.g. `usermanual=docs,usermanual-en=en/docs`.
     Default rule: `<name>-en` → `en/<docs-dir>`, everything else → `<docs-dir>`.
   - `--langs` — build only these language dirs (comma separated).
   - `--work` — persistent build workspace; preserves `node_modules/honkit` and
     keeps build output outside the site repo.
   - `--worktree` — optional gh-pages worktree to sync the docs dirs plus
     `index.html` / `en/index.html` into.

   What the script does internally:
   - Extracts the source via `git archive <branch> <src> | tar -x` into the work
     dir (Python `tarfile`, so Chinese paths decode correctly on Windows),
     preserving `node_modules` across runs.
   - Normalizes `[[wikilink]]` / `[[wikilink|alias]]` cross-references to
     readable text (HonKit cannot render them).
   - Builds **each language separately from the book root**:
     `npx honkit build usermanual <out>/usermanual`,
     `npx honkit build usermanual-en <out>/usermanual-en`.
   - Verifies each output is self-contained (`index.html` + its own `gitbook/`)
     and copies it into the site target, dropping npm artifacts.
   - If `--worktree` is given, syncs every docs dir plus both index pages.

3. **Wire up navigation.** Point each site language's "user manual" card at its
   own local docs path — `index.html` → `docs/`, `en/index.html` → `docs/`
   (which resolves to `en/docs/`). Never link a GitHub wiki URL that 404s.

4. **Inject SEO metadata (mandatory after every build).** HonKit emits an empty
   `<meta name="description">` and no canonical/OG/hreflang, and a rebuild wipes
   anything added by hand. Run the site's injector:

   ```bash
   python scripts/seo.py --check      # preview
   python scripts/seo.py              # write metadata + sitemap.xml
   ```

   - Script: `<site>/scripts/seo.py`, config: `<site>/seo.json` (`base_url`
     plus one entry per language book).
   - Per page it writes: description from the first substantive paragraph,
     canonical, OG/Twitter tags, `hreflang` pairs (zh ↔ en by identical path),
     `robots`, and JSON-LD `TechArticle` + `BreadcrumbList`.
   - It also regenerates `sitemap.xml` (static pages + every manual page with
     `xhtml:link` alternates). `robots.txt` must point at that sitemap.
   - Idempotent: the injected block is wrapped in `<!-- seo:start -->` /
     `<!-- seo:end -->` and replaced in place on re-runs.
   - Switching the host is a one-line change: edit `base_url` in `seo.json` and
     re-run. The hand-written landing pages carry absolute URLs in their heads,
     so the script also rewrites every known legacy base (see `LEGACY_BASES`)
     to the current one — append the outgoing base there when it changes again.
   - `404.html` is served at any depth, so its links stay root-absolute and get
     the deployment sub-path (`/Backlog.md/assets/…`); the script handles that
     too, and skips it automatically when deployed at a domain root.

5. **Verify offline.** Headless-render `docs/index.html` and `en/docs/index.html`
   plus one nested page each. Sidebar, search box and body text must be styled;
   an unstyled page means `gitbook/` did not land next to `index.html`.

6. **Deploy (user action).** If a `--worktree` was synced, the user commits and
   pushes it. Do not commit or push on the user's behalf unless explicitly asked.

## Key constraints

- **Build per language, not from the multilingual `_book/`.** A `LANGS.md` build
  shares one `gitbook/` at `_book/gitbook` and one combined search index, so
  pages reference `../gitbook/...` and search returns hits from both languages
  (and the English book would index Chinese pages). Building each book on its
  own yields self-contained output with a correct per-language index — no
  post-build link rewriting.
- **Launch HonKit from the book root** even when building a sub-book
  (`npx honkit build <lang-dir> <out-dir>`), so the install cache stays in one
  place and the source layout on disk is what the site repo documents.
- **Wikilinks must be normalized** before build; HonKit renders raw `[[...]]`.
- **Do not bundle mermaid/echarts.** Per project decision the manual shows
  diagram fences as source code blocks; the skill intentionally renders no
  diagrams. (Override only with explicit user direction.)
- **Relative links only.** HonKit emits relative links, so a book mounts under
  any subpath. Never rewrite them to absolute paths.
- **Exclude npm artifacts** (`package.json`, `package-lock.json`) from the
  migrated docs directories.
