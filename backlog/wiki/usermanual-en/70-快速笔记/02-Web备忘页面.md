---
title: Web Memo Page
labels: [usermanual]
created_date: 2026-10-03 01:14
updated_date: 2026-11-04 00:00
---

# Web Memo Page

After starting the Web interface, the Memos entry in the sidebar (expandable list + collapsed icon bar) opens the `/memos` page. The page provides both **feed** and **calendar** modes within the same component, sharing the same selected date and deep-linkable via the `?view=` parameter.

## Feed Mode

Feed is the default view of `/memos`: a quick-capture composer at the top, and a reverse-chronological stream of memo cards below.

### Quick Capture

- The top composer reuses the same editor as [Rich-Text Paste](../40-Web界面/06-富文本粘贴与文档上传.md): supports pasting images, dragging in files, and Word document conversion; pasted images are automatically promoted to `assets/paste/` before saving.
- Click the save button or press **Cmd/Ctrl+Enter** to save; the new memo is immediately pinned to the top without refreshing.
- On save failure, the note content is preserved and a localized error banner is shown; it is not silently lost.

### Card Stream

- Cards show creation time, rendered body (Markdown, Mermaid diagrams, `[[wiki]]` links, and auto-linked entity IDs), and read-only tag chips. Entity ID **ranges** (such as `back-101~105`) and **slash lists** (such as `back-101/102/103`) in the body are rendered as a single trigger; clicking opens a portal dropdown listing each clickable ID in the range.
- The tag bar uses a **single-line folded** historical tag strip: recently used tags are compressed into one line, active tags are pinned to the top, and clicking expands filtering options. Cards support inline editing, archiving, and deletion (archiving is detailed in [Pinboard View & Archiving](04-钉板视图与归档.md)). Typing `#topic#` in the composer (such as `#login#`) tags the memo's topic without polluting the body; this closed syntax is recognized as a topic tag.
- Infinite scroll automatically loads subsequent pages based on an IntersectionObserver sentinel; memo changes are broadcast via WebSocket `memos-updated` and synced in real time across all open tabs.

## Pinboard Mode

`/memos` also has a third view—a WebGL sticky-note pinboard: `?view=board` goes directly there. Notes have fixed landing spots, the blackboard stays fixed without scrolling, and it supports full-screen; hovering over a note shows archive options, and clicking opens the edit popup. See [Pinboard View & Archiving](04-钉板视图与归档.md) for details.

## Calendar Mode

Click the view toggle to enter calendar mode: a CSS Grid month view with **intensity-gradient coloring by daily memo count** (data from `GET /api/memos/calendar`), today highlighted, with no third-party calendar library dependency.

- **Month navigation**: prev / next / today buttons flip months across years and refetch counts; the first and last days of adjacent months are dimmed in the grid.
- **Select a day**: clicking a day expands a DayPanel below the grid in place (no page navigation), listing all memos for that day, with inline editing or deletion.
- **Backfill historical dates**: the DayPanel has its own composer; memos written there are pinned to the selected date via `createdDate` (the ID prefix is derived accordingly), suitable for post-meeting notes.
- **View in feed**: a panel action sets `selectedDate` as a date-filter chip and switches back to feed mode—"select a day to filter the feed, clear the chip to return to all".
- **Deep link**: `?view=calendar&date=YYYY-MM-DD` goes directly to that month, preselects that day, and auto-expands the panel.

## Integration with Global Search

The "Memos" tab in the global search dialog searches memos; clicking a result row jumps to the day view at `/memos?date=<day>` (memos do not have an independent detail route). See [Global Search](../40-Web界面/10-全局搜索.md) and [Search & Knowledge Linking](03-搜索与知识互联.md).

## Interface Language

All copy on the Memos page (capture hints, calendar buttons, error banners, etc.) is covered in en / zh-CN / zh-TW / ja and switches instantly with the interface language setting.
