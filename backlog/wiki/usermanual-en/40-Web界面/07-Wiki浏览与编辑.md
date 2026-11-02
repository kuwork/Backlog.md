---
title: Wiki Browsing & Editing
labels: [usermanual]
created_date: 2026-05-14 00:00
updated_date: 2026-11-04 00:00
---

# Wiki Browsing & Editing

The Backlog.md Web interface provides a complete Wiki module for browsing and editing knowledge-base content under `backlog/wiki/`. The Wiki is an **LLM-maintained incremental knowledge base**—AI agents read source files such as tasks/docs/decisions and automatically compile them into structured wiki content; it is human-readable and editable, and pages can be created and modified directly.

## Entering the Wiki

After starting the Web interface, click the "Wiki" tab in the top navigation bar to enter the Wiki page. The page is divided into left and right parts:

- **Left sidebar**: collapsible file tree reflecting the directory structure of `backlog/wiki/`.
- **Right content area**: rendered Markdown content.

## Browsing the File Tree

The sidebar shows all content under `backlog/wiki/` in a tree structure:

- Click the chevron icon to the left of a folder to expand or collapse it.
- The number of Markdown files in a folder is shown next to the folder name (such as `concepts (3)`).
- Click a `.md` file to view its content on the right.
- Empty folders are also shown in the tree and can be expanded to view their children.

### Sort Toggles

The Wiki area header provides **Title / Filename sort toggles**. Click to switch the sort column and direction:

- **Title**: sort by the page frontmatter `title` (falls back to filename when there is no title); the tree display labels also change to titles.
- **Filename**: sort by filename (without `.md`); labels display filenames accordingly—the tree always shows the field currently used for sorting.
- Folders are always listed before pages; each level is sorted independently and numeric-aware (`page-4` comes before `page-10`).

### Paths and URLs

Wiki page URLs preserve directory-level readability; the `/` separator is not encoded as `%2F`. For example, a page at `concepts/web-ui-features.md` shows in the address bar as:

```
http://localhost:6420/wiki/concepts/web-ui-features
```

Spaces, CJK characters, and other special characters in the path are safely encoded, but the directory hierarchy remains intuitive. You can copy or edit the path in the address bar to quickly jump to a target page.

## Viewing Page Content

Wiki pages are shown as rendered Markdown:

- The page title is extracted from frontmatter and displayed.
- Supports code-block syntax highlighting, Mermaid diagrams, tables, and lists.
- **Labels**: the page's labels are shown below the title (such as `concept`, `source`).
- Click `[[wikilink]]` references in the body to jump to the corresponding page.

## Online Editing

Click the "Edit" button in the upper-right corner of the page to enter edit mode:

- **Title**: modify the page title in the large input box at the top; after saving, it is automatically written to frontmatter.
- **Labels**: the ChipInput below the title supports adding/removing labels; press Enter or comma to add, Backspace to remove the last one.
- **Body**: use the full Markdown editor (supports paste-as-Markdown, image upload, and Word document conversion).
- **Save**: the Save button turns blue and enabled only when content, title, or labels have changed.
- **Cancel**: click Cancel to discard all changes and restore the original content.

After saving, the page frontmatter automatically updates the `updated_date` field.

### Switching Pages Auto-Exits Edit Mode

In edit mode, if you click another Wiki page in the sidebar, the system **automatically exits edit mode** and shows the new page in read-only view:

- Unsaved edits are silently discarded.
- The edit/view toggle button state updates to "View" mode.
- This prevents the new page content from being accidentally shown in the editor and reduces confusion.

> If you want to save the current changes, click Save before switching pages.

## Creating Files and Folders

Create new content anywhere in the sidebar:

1. Hover over a folder name or the Wiki root title.
2. A `+` button appears on the right; click it to expand a dropdown menu:
   - **Create file** — create a new page; enter the filename (`.md` is auto-completed).
   - **Create folder** — create an empty folder.
3. After creation succeeds, you are automatically navigated to the new page.

The `+` button on the root "Wiki" title creates content under the `backlog/wiki/` root directory.

## Renaming

Select **Rename** from the dropdown menu of a file or folder:

- Enter a new name; cross-directory moves are supported (such as `concepts/new-name`).
- If you are currently viewing the page, you are automatically navigated to the new path after renaming.

## Popup Preview and Outline Drawer

Wiki previews and file previews opened from the file tree or search are presented as **popups** without leaving the current page. A bookmark-style "Contents" tab protrudes from the middle of the left edge of the popup: clicking it opens a floating outline panel on the left side of the popup that is the same height as the popup; clicking an entry smoothly scrolls to the corresponding section. The popup width remains unchanged; on narrow screens the drawer automatically switches to floating mode over the content. The file preview popup width has been increased, making long documents more comfortable.

## Real-Time Sync

Wiki content is synced in real time across all open tabs:

- Wiki files modified through the CLI or an external editor → WebSocket broadcast → all browser tabs refresh automatically.
- Edits saved in the browser → other tabs show the update instantly.
- The file tree also responds automatically to create, modify, delete, and rename operations.

## Differences from Documents

| | Documents (docs/) | Wiki (wiki/) |
|---|---|---|
| **Maintainer** | Human-written | Mainly maintained by AI Skill; human-readable and editable |
| **Purpose** | Project guides, API docs, reference manuals | Knowledge base: concept extraction, source summaries, cross-references |
| **Editing** | Modified through the editor after creation | Edited directly in the browser; frontmatter auto-managed |
| **Structure** | Human-organized | AI maintains standard directories (`sources/`, `concepts/`, `entities/`) |
