#!/usr/bin/env python3
"""Build a GitBook-style docs set with HonKit and migrate it into a static site.

This is the engine behind the `honkit-docs-migration` skill. It:
  1. Extracts a GitBook-style source tree (README.md + SUMMARY.md + chapters)
     from a git repo/branch via `git archive`.
  2. Normalizes `[[wikilink]]` cross-references to readable text (HonKit cannot
     render them).
  3. Builds a static HTML site with HonKit (`npx honkit build` -> `_book/`).
  4. Migrates `_book/` (minus npm artifacts) into a target site's docs dir.
  5. Optionally syncs the result into a gh-pages worktree for deployment.

Usage:
  python3 migrate_docs.py \
    --repo /d/git/Backlog.md \
    --branch release \
    --src backlog/wiki/usermanual \
    --site /d/git/backlog-md-site \
    --docs-dir docs \
    [--work /d/tmp/um-build] \
    [--worktree /d/git/backlog-md-pages]

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
    if os.path.isdir(work_src):
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
        sys.exit(f"[migrate] git archive failed for {branch}:{src}\n{archive.stderr.decode('utf-8', 'replace')}")
    try:
        with tarfile.open(fileobj=io.BytesIO(archive.stdout), mode="r:*") as tf:
            tf.extractall(work_src, filter="data")
    except Exception as e:
        sys.exit(f"[migrate] tar extraction failed: {e}")
    # git archive keeps the full path prefix (e.g. backlog/wiki/usermanual).
    # Descend to the actual source root.
    root = work_src
    rel = src.rstrip("/")
    while rel:
        cand = os.path.join(root, rel)
        if os.path.isfile(os.path.join(cand, "README.md")) or os.path.isfile(
            os.path.join(cand, "SUMMARY.md")
        ):
            return cand
        rel = "/".join(rel.split("/")[1:])
    # fall back: use whatever directory contains README.md
    for dp, _, files in os.walk(work_src):
        if "README.md" in files and "SUMMARY.md" in files:
            return dp
    sys.exit("[migrate] could not locate README.md + SUMMARY.md in extracted source")


def normalize_wikilinks(root):
    count = 0
    for dp, _, files in os.walk(root):
        for f in files:
            if not f.endswith(".md"):
                continue
            p = os.path.join(dp, f)
            txt = open(p, encoding="utf-8").read()
            new = WIKILINK_PAIR.sub(r"\2", txt)
            new = WIKILINK_SIMPLE.sub(lambda m: m.group(1).split("/")[-1], new)
            if new != txt:
                open(p, "w", encoding="utf-8").write(new)
                count += 1
    print(f"[migrate] normalized {count} file(s) with wikilinks", file=sys.stderr)
    return count


def ensure_book_json(src):
    p = os.path.join(src, "book.json")
    if os.path.exists(p):
        return
    title = "User Manual"
    readme = os.path.join(src, "README.md")
    if os.path.exists(readme):
        t = open(readme, encoding="utf-8").read()
        m = re.search(r"^title:\s*(.+)$", t, re.MULTILINE)
        if m:
            title = m.group(1).strip()
    with open(p, "w", encoding="utf-8") as f:
        f.write(
            json.dumps({"title": title, "language": "zh", "plugins": []}, ensure_ascii=False, indent=2)
            + "\n"
        )
    print(f"[migrate] wrote book.json (title={title})", file=sys.stderr)


def build(src):
    if not os.path.isdir(os.path.join(src, "node_modules", "honkit")):
        run([NPM, "init", "-y"], src, "npm init")
        run([NPM, "install", "--save-dev", "honkit"], src, "npm install honkit")
    run([NPX, "honkit", "build"], src, "honkit build")
    book = os.path.join(src, "_book")
    if not os.path.isdir(book):
        sys.exit("[migrate] honkit build produced no _book/")
    n_html = sum(1 for _, _, fs in os.walk(book) if fs for f in fs if f.endswith(".html"))
    print(f"[migrate] built {n_html} HTML page(s) into _book/", file=sys.stderr)
    return book


def migrate(book, site, docs_dir):
    dest = os.path.join(site, docs_dir)
    if os.path.isdir(dest):
        shutil.rmtree(dest)
    os.makedirs(dest, exist_ok=True)
    for name in os.listdir(book):
        if name in EXCLUDE_FROM_BOOK:
            continue
        s = os.path.join(book, name)
        d = os.path.join(dest, name)
        if os.path.isdir(s):
            shutil.copytree(s, d)
        else:
            shutil.copy2(s, d)
    files = sum(1 for _, _, fs in os.walk(dest) for _ in fs)
    print(f"[migrate] migrated {files} file(s) -> {dest}", file=sys.stderr)
    return dest


def sync_worktree(site, docs_dir, worktree):
    dest = os.path.join(worktree, docs_dir)
    if os.path.isdir(dest):
        shutil.rmtree(dest)
    shutil.copytree(os.path.join(site, docs_dir), dest)
    sidx = os.path.join(site, "index.html")
    if os.path.exists(sidx):
        shutil.copy2(sidx, os.path.join(worktree, "index.html"))
    print(f"[migrate] synced docs/ + index.html into worktree {worktree}", file=sys.stderr)


def main():
    ap = argparse.ArgumentParser(description="Build docs with HonKit and migrate into a static site.")
    ap.add_argument("--repo", required=True, help="Path to the git repo holding the docs source")
    ap.add_argument("--branch", default="release", help="Branch/tree-ish to extract from")
    ap.add_argument("--src", required=True, help="Docs source path inside the repo (README.md + SUMMARY.md)")
    ap.add_argument("--site", required=True, help="Target static site root")
    ap.add_argument("--docs-dir", default="docs", help="Subdirectory under --site for the manual")
    ap.add_argument("--work", default=None, help="Persistent build workspace (keeps node_modules)")
    ap.add_argument("--worktree", default=None, help="Optional gh-pages worktree to sync into")
    args = ap.parse_args()

    work = args.work or tempfile.mkdtemp(prefix="honkit-build-")
    work_src = os.path.join(work, "src")

    src = extract_source(args.repo, args.branch, args.src, work_src)
    normalize_wikilinks(src)
    ensure_book_json(src)
    book = build(src)
    dest = migrate(book, args.site, args.docs_dir)
    if args.worktree:
        sync_worktree(args.site, args.docs_dir, args.worktree)

    print(f"[migrate] DONE -> {dest}", file=sys.stderr)


if __name__ == "__main__":
    main()
