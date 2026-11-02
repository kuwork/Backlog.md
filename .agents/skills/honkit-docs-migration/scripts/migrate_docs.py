#!/usr/bin/env python3
"""Build a GitBook-style docs set with HonKit and migrate it into a static site.

This is the engine behind the `honkit-docs-migration` skill. It:
  1. Extracts a GitBook-style source tree from a git repo/branch via `git archive`.
     The source may be a single book (README.md + SUMMARY.md) or a multilingual
     root (LANGS.md + one sub-directory per language).
  2. Normalizes `[[wikilink]]` cross-references to readable text (HonKit cannot
     render them).
  3. Builds each language book separately with HonKit, from the book root:
         npx honkit build usermanual    <out>/zh
         npx honkit build usermanual-en <out>/en
     Building per language (instead of relying on the multilingual `_book/`) keeps
     every output self-contained: its own `gitbook/` assets and its own search
     index, so no link rewriting is needed after the copy.
  4. Migrates each output into the target site's docs directory.
  5. Optionally syncs the results into a gh-pages worktree for deployment.

Usage (multilingual, the Backlog.md case):
  python3 migrate_docs.py \
    --repo /d/git/Backlog.md \
    --branch wiki-tmp \
    --src backlog/wiki \
    --site /d/git/backlog-md-site \
    --docs-dir docs \
    --work /d/tmp/um-build \
    --worktree /d/git/backlog-md-pages

Usage (single book):
  python3 migrate_docs.py --repo ... --branch ... --src backlog/wiki/usermanual \
    --site ... --docs-dir docs

Notes:
  - `node_modules` is preserved across runs in the work dir so HonKit is not
    reinstalled every time (only the markdown source is re-extracted).
  - mermaid/echarts fenced blocks are intentionally left as source code blocks;
    this skill does not bundle diagram renderers (per project decision).
"""
import argparse
import io
import json
import os
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile

WIKILINK_PAIR = re.compile(r"\[\[([^\]|]+)\|([^\]]+)\]\]")
WIKILINK_SIMPLE = re.compile(r"\[\[([^\]]+)\]\]")
LANG_ENTRY = re.compile(r"^\s*[-*]\s*\[([^\]]+)\]\(([^)]+)\)\s*$", re.MULTILINE)

EXCLUDE_FROM_BOOK = {"package.json", "package-lock.json"}


def _exe(name):
    """Resolve a command name to an executable. On Windows npm/npx are .cmd wrappers."""
    if os.name == "nt":
        for cand in (name + ".cmd", name + ".exe", name):
            if shutil.which(cand):
                return cand
    return name


NPM = _exe("npm")
NPX = _exe("npx")


def run(cmd, cwd, step):
    print(f"[migrate] {step}: {' '.join(cmd)}", file=sys.stderr)
    r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stdout, file=sys.stderr)
        print(r.stderr, file=sys.stderr)
        sys.exit(f"[migrate] failed during: {step}")
    return r


def extract_source(repo, branch, src, work_src):
    """Extract `src` from `branch` of `repo` into `work_src`, preserving node_modules."""
    os.makedirs(work_src, exist_ok=True)
    # Wipe previous markdown extraction but keep node_modules (HonKit cache).
    for item in os.listdir(work_src):
        if item == "node_modules":
            continue
        p = os.path.join(work_src, item)
        shutil.rmtree(p) if os.path.isdir(p) else os.remove(p)
    # git archive <branch> <src> | tar -x -C work_src
    # Use Python's tarfile (not shell `tar`) so non-ASCII (Chinese) entry names
    # are decoded as UTF-8 correctly on Windows. Shell tar writes them as mojibake,
    # which then breaks HonKit's SUMMARY path resolution.
    archive = subprocess.run(
        ["git", "-C", repo, "archive", branch, src], capture_output=True
    )
    if archive.returncode != 0:
        msg = archive.stderr.decode("utf-8", "replace")
        sys.exit(f"[migrate] git archive failed for {branch}:{src}\n{msg}")
    try:
        with tarfile.open(fileobj=io.BytesIO(archive.stdout), mode="r:*") as tf:
            tf.extractall(work_src, filter="data")
    except Exception as e:
        sys.exit(f"[migrate] tar extraction failed: {e}")
    # git archive keeps the full path prefix (e.g. backlog/wiki). Descend to the
    # book root: a directory holding LANGS.md, or README.md + SUMMARY.md.
    rel = src.rstrip("/")
    while rel:
        cand = os.path.join(work_src, rel)
        if os.path.isfile(os.path.join(cand, "LANGS.md")) or (
            os.path.isfile(os.path.join(cand, "README.md"))
            and os.path.isfile(os.path.join(cand, "SUMMARY.md"))
        ):
            return cand
        rel = "/".join(rel.split("/")[1:])
    sys.exit("[migrate] could not locate a book root (LANGS.md or README.md+SUMMARY.md)")


def detect_languages(book_root):
    """Return [(dir_name, label)] — one entry per book to build under `book_root`."""
    langs_md = os.path.join(book_root, "LANGS.md")
    if os.path.isfile(langs_md):
        text = open(langs_md, encoding="utf-8").read()
        langs = []
        for label, path in LANG_ENTRY.findall(text):
            name = path.strip().strip("/")
            if name and os.path.isdir(os.path.join(book_root, name)):
                langs.append((name, label))
        if langs:
            return langs
        sys.exit("[migrate] LANGS.md listed no usable language directory")
    # Single book
    return [("", "default")]


def normalize_wikilinks(root):
    count = 0
    for dp, _, files in os.walk(root):
        if "node_modules" in dp.split(os.sep):
            continue
        for f in files:
            if not f.endswith(".md"):
                continue
            p = os.path.join(dp, f)
            txt = open(p, encoding="utf-8").read()
            new = WIKILINK_PAIR.sub(r"\2", txt)
            new = WIKILINK_SIMPLE.sub(lambda m: m.group(1).split("/")[-1], new)
            if new != txt:
                open(p, "w", encoding="utf-8", newline="").write(new)
                count += 1
    print(f"[migrate] normalized {count} file(s) with wikilinks", file=sys.stderr)
    return count


def ensure_book_json(book_dir, lang_dir):
    p = os.path.join(book_dir, "book.json")
    if os.path.exists(p):
        return
    title = "User Manual"
    readme = os.path.join(book_dir, "README.md")
    if os.path.exists(readme):
        t = open(readme, encoding="utf-8").read()
        m = re.search(r"^title:\s*(.+)$", t, re.MULTILINE)
        if m:
            title = m.group(1).strip()
    lang = "en" if lang_dir.endswith("-en") else "zh"
    with open(p, "w", encoding="utf-8") as f:
        f.write(
            json.dumps(
                {"title": title, "language": lang, "structure": {"readme": "README.md", "summary": "SUMMARY.md"}},
                ensure_ascii=False,
                indent=2,
            )
            + "\n"
        )
    print(f"[migrate] wrote {p} (title={title}, lang={lang})", file=sys.stderr)


def install_honkit(book_root):
    """Install HonKit once at the book root; reuse the cached node_modules afterwards."""
    if os.path.isdir(os.path.join(book_root, "node_modules", "honkit")):
        return
    if not os.path.isfile(os.path.join(book_root, "package.json")):
        run([NPM, "init", "-y"], book_root, "npm init")
    run([NPM, "install", "--save-dev", "honkit"], book_root, "npm install honkit")


def build_book(book_root, lang_dir, out_dir):
    """Build one language book from the book root into a self-contained out_dir."""
    if os.path.isdir(out_dir):
        shutil.rmtree(out_dir)
    target = lang_dir or "."
    run([NPX, "honkit", "build", target, out_dir], book_root, f"honkit build {lang_dir or '<root>'}")
    if not os.path.isfile(os.path.join(out_dir, "index.html")):
        sys.exit(f"[migrate] honkit build produced no index.html in {out_dir}")
    if not os.path.isdir(os.path.join(out_dir, "gitbook")):
        sys.exit(f"[migrate] build output is not self-contained (no gitbook/ in {out_dir})")
    n_html = sum(1 for _, _, fs in os.walk(out_dir) for f in fs if f.endswith(".html"))
    print(f"[migrate] built {n_html} HTML page(s) for {lang_dir or '<root>'}", file=sys.stderr)


def migrate(built_dir, site, target):
    dest = os.path.join(site, target)
    if os.path.isdir(dest):
        shutil.rmtree(dest)
    os.makedirs(dest, exist_ok=True)
    for name in os.listdir(built_dir):
        if name in EXCLUDE_FROM_BOOK:
            continue
        s = os.path.join(built_dir, name)
        d = os.path.join(dest, name)
        if os.path.isdir(s):
            shutil.copytree(s, d)
        else:
            shutil.copy2(s, d)
    files = sum(1 for _, _, fs in os.walk(dest) for _ in fs)
    print(f"[migrate] migrated {files} file(s) -> {dest}", file=sys.stderr)
    return dest


def resolve_targets(langs, docs_dir, override):
    """Map each language dir to a site subdirectory.

    Default: `docs` for the primary language, `en/docs` for `*-en` books.
    `override` is the `--lang-dirs` map (e.g. "usermanual=docs,usermanual-en=en/docs").
    """
    mapping = {}
    if override:
        for part in override.split(","):
            if not part.strip():
                continue
            k, _, v = part.partition("=")
            mapping[k.strip()] = v.strip()
    targets = []
    for name, _label in langs:
        if name in mapping:
            target = mapping[name]
        elif name.endswith("-en"):
            target = os.path.join("en", docs_dir)
        else:
            target = docs_dir
        targets.append((name, target))
    return targets


def sync_worktree(site, targets, worktree):
    """Copy the built docs dirs plus both index pages into the deploy worktree."""
    for _name, target in targets:
        src = os.path.join(site, target)
        dst = os.path.join(worktree, target)
        if os.path.isdir(dst):
            shutil.rmtree(dst)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copytree(src, dst)
        print(f"[migrate] synced {target} -> worktree", file=sys.stderr)
    for page in ("index.html", os.path.join("en", "index.html")):
        src = os.path.join(site, page)
        if os.path.exists(src):
            dst = os.path.join(worktree, page)
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.copy2(src, dst)
            print(f"[migrate] synced {page} -> worktree", file=sys.stderr)


def main():
    ap = argparse.ArgumentParser(description="Build docs with HonKit and migrate into a static site.")
    ap.add_argument("--repo", required=True, help="Path to the git repo holding the docs source")
    ap.add_argument("--branch", default="release", help="Branch/tree-ish to extract from")
    ap.add_argument("--src", required=True, help="Book root inside the repo (LANGS.md, or README.md+SUMMARY.md)")
    ap.add_argument("--site", required=True, help="Target static site root")
    ap.add_argument("--docs-dir", default="docs", help="Subdirectory under --site for the primary language")
    ap.add_argument("--lang-dirs", default=None, help='Explicit language -> target map, e.g. "usermanual=docs,usermanual-en=en/docs"')
    ap.add_argument("--langs", default=None, help="Only build these language dirs (comma separated)")
    ap.add_argument("--work", default=None, help="Persistent build workspace (keeps node_modules)")
    ap.add_argument("--worktree", default=None, help="Optional gh-pages worktree to sync into")
    args = ap.parse_args()

    work = args.work or tempfile.mkdtemp(prefix="honkit-build-")
    work_src = os.path.join(work, "src")

    book_root = extract_source(args.repo, args.branch, args.src, work_src)
    normalize_wikilinks(book_root)
    langs = detect_languages(book_root)
    if args.langs:
        keep = {s.strip() for s in args.langs.split(",") if s.strip()}
        langs = [l for l in langs if l[0] in keep] or langs
    targets = resolve_targets(langs, args.docs_dir, args.lang_dirs)
    print(f"[migrate] book root: {book_root}", file=sys.stderr)
    print(f"[migrate] languages: {', '.join(n or '<root>' for n, _ in langs)}", file=sys.stderr)

    install_honkit(book_root)

    results = []
    for name, target in targets:
        ensure_book_json(book_root if not name else os.path.join(book_root, name), name)
        out_dir = os.path.join(work, "out", name or "book")
        build_book(book_root, name, out_dir)
        results.append((target, migrate(out_dir, args.site, target)))

    if args.worktree:
        sync_worktree(args.site, targets, args.worktree)

    for target, dest in results:
        print(f"[migrate] DONE {target} -> {dest}", file=sys.stderr)


if __name__ == "__main__":
    main()
