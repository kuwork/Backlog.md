---
id: BACK-519
title: Add image lightbox for all images
status: Done
assignee:
  - '@kimi'
created_date: '2026-06-13 01:30'
updated_date: '2026-06-13 07:48'
labels:
  - web-ui
dependencies: []
ordinal: 174400
actual_start: '2026-06-13 01:31'
actual_end: '2026-06-13 07:48'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Provide a fullscreen Lightbox image viewer for every image rendered in the project. The viewer must be reachable from any clickable image (including Markdown-rendered images in articles, documents, and task details) by clicking, pressing Enter, or pressing Space.

When opened, the Lightbox should display the selected image on a dark overlay, initially sized up to 90% of the viewport width and height, leaving a visible margin so users can discover that zooming is available. Users must be able to:

- Zoom in and out with the mouse wheel or dedicated on-screen plus/minus buttons, up to a reasonable maximum zoom level.
- Zoom around the current cursor position; the image must stay stable under the cursor and must not drift or jump after panning.
- Pan a zoomed image by dragging with the mouse or swiping on touch devices, with panning constrained so the image cannot be dragged completely out of view.
- Rotate the image 90 degrees clockwise or counter-clockwise via on-screen buttons.
- Switch between all images present on the current page using on-screen arrow buttons, the Left/Right Arrow keys, or a dot indicator above the bottom controls.
- Close the Lightbox with the top-right × button or the ESC key.

The dot indicator must appear above the bottom control bar when more than one image is available. It must show one dot per image, with the active dot enlarged and adjacent dots gradually shrinking toward the sides for a smooth visual effect. Clicking any dot must jump directly to the corresponding image and reset the zoom, rotation, and pan state.

Zoom level, rotation, and pan position must reset whenever the user switches to a different image. Background page scrolling must be blocked while the Lightbox is open. The on-screen controls must float above the image with a subtle dark rounded background so they remain visible over light or white images. The implementation must use only the existing project stack and must not introduce any extra third-party libraries.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 All clickable images on the page (including images in articles, documents, task details, etc.) can be expanded into the large-image view.
- [x] #2 The large-image view displays the current image on a dark overlay background.
- [x] #3 A × button is shown in the top-right corner; clicking it closes the large-image view.
- [x] #4 Pressing the ESC key closes the large-image view without propagating the event to parent modals or panels.
- [x] #5 Pressing the Left Arrow key switches to the previous image on the current page.
- [x] #6 Pressing the Right Arrow key switches to the next image on the current page.
- [x] #7 Mouse wheel zoom in/out is supported.
- [x] #8 When the mouse is inside the image area, the zoom center is the mouse position.
- [x] #9 When the mouse is outside the image area, the zoom center is the image-area center.
- [x] #10 Zoom, rotation, and pan position are reset when switching images.
- [x] #11 When the image is zoomed larger than the viewport, dragging (mouse) or swiping (touch) pans the image.
- [x] #12 Panning is constrained so the image cannot be dragged completely out of view.
- [x] #13 Wheel zoom after panning keeps the image stable by adjusting the pan offset, preventing sudden jumps.
- [x] #14 A dot indicator appears above the bottom controls when multiple images are present.
- [x] #15 The active dot is larger than the surrounding dots, and dot sizes decrease smoothly toward both sides.
- [x] #16 Clicking a dot switches directly to the corresponding image and resets zoom/rotation/pan.
- [x] #17 Keyboard events (Escape, ArrowLeft, ArrowRight) are captured and stopped from reaching parent modals or panels while the Lightbox is open.
- [x] #18 No extra third-party libraries are introduced; only the existing project stack (native JS/TS and the existing CSS/component library) is used.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:IMPLEMENTATION_PLAN:BEGIN -->
1. **Global state and provider**
   - Create `ImageLightboxContext` with a Provider that manages the open/closed state, the list of image sources on the current page, the current index, and the current view transform.
   - Expose `openLightbox(src)` so any image can request the viewer.
   - Wrap the application in `ImageLightboxProvider` so every routed page shares a single viewer instance.

2. **Image collection**
   - Mark all Markdown-rendered images as lightbox-enabled by overriding the `img` component in `MermaidMarkdown`.
   - Add `data-lightbox-img`, keyboard activation (Enter/Space), and an accessible label.
   - The Provider collects sources by scanning `[data-lightbox-img]` images in the DOM when opened.

3. **Lightbox overlay UI**
   - Render a fixed fullscreen dark overlay with z-50 when open.
   - Add a top-right close button.
   - Add left/right arrow buttons when multiple images are available.
   - Render the current image with `max-w-[90vw] max-h-[90vh]` and `object-contain`.
   - Add a bottom control bar with rotate-left, zoom-out, reset, zoom-in, and rotate-right buttons.

4. **Keyboard support**
   - Attach a capture-phase `keydown` listener while open to handle ESC (close), ArrowLeft (previous), and ArrowRight (next).

5. **Zoom interactions**
   - Implement wheel zoom on the image element.
   - Implement plus/minus button zoom.
   - Keep zoom level within a defined min/max range.

6. **Cursor-centered zoom**
   - Compute the zoom center as the viewport center plus the current pan offset.
   - When zooming, update both `scale` and `translate` atomically so the image point under the cursor stays fixed on screen.
   - Clamp the resulting pan offset to keep the image reachable.

7. **Panning**
   - Enable drag-to-pan when the image is zoomed in.
   - Track mouse and touch events on `window` during a drag.
   - Disable CSS transitions and change the cursor to `grabbing` while dragging.
   - Clamp pan offsets to prevent the image from leaving the viewport.

8. **Rotation**
   - Implement 90-degree clockwise/counter-clockwise rotation via the bottom buttons.
   - Store rotation in the same view state so it resets on image switch.

9. **Event isolation**
   - Block background page scrolling by capturing `wheel` events on `document` while the Lightbox is open.
   - Handle Escape, ArrowLeft, and ArrowRight in the capture phase and call `stopPropagation()` so parent modals or panels do not also react.

10. **Dot indicator**
    - Render a row of dots above the bottom control bar when multiple images are present.
    - Scale each dot based on its distance from the active image; apply smooth transitions for size changes.
    - Make each dot clickable to jump to the corresponding image and reset the view state.

11. **Testing**
    - Add JSDOM-based tests covering render markers, click-to-open, ESC close, arrow-key switching, wheel zoom, rotation, panning while zoomed, reset on switch, cursor-centered zoom without drift, and dot-indicator navigation.
<!-- SECTION:IMPLEMENTATION_PLAN:END -->

## Implementation Notes

<!-- SECTION:IMPLEMENTATION_NOTES:BEGIN -->
- **No third-party dependencies**: The entire feature is built with React, Tailwind CSS, and native DOM APIs. No image-viewer libraries were added.

- **Single view state**: `scale`, `translate`, and `rotation` are stored together in a `ViewState` object so that zoom and pan updates can be applied atomically in one `setView` call. This prevents inconsistencies when the user scrolls rapidly or when multiple state changes happen in quick succession.

- **Transform composition**: The image uses `transform: translate(x, y) scale(s) rotate(r)` with `transform-origin: center`. The order is important: translate is applied in the scaled coordinate space, which matches the intuitive drag-to-pan behavior.

- **Cursor-centered zoom formula**: When zooming from scale `s` to `s'` with the cursor at screen position `p` and the current transform center at `c` (viewport center plus current translate), the new translate is `translate - (p - c) * (s'/s - 1)`. This keeps the image point under the cursor at the same screen location before and after the zoom. The formula works regardless of rotation because rotation is applied before scaling.

- **Why not `getBoundingClientRect()`**: Early versions computed the zoom center from the image bounding box. After rotation the bounding-box center no longer coincides with the transform center, causing the image to drift during wheel zoom. The final implementation uses the viewport center plus the current translate, which is always the true transform center because the image is flex-centered in the overlay.

- **Pan constraints**: Panning is limited based on the image's unscaled dimensions, the current scale, and a small viewport padding. When scale is 1 or less, panning is disabled and the cursor returns to default.

- **Drag responsiveness**: CSS transitions are disabled while dragging (`transition: none`) so the image follows the pointer without lag. The cursor switches between `grab` and `grabbing` to give clear visual feedback.

- **Touch support**: Touch events are wired alongside mouse events on `window`, with `preventDefault()` on `touchmove` during a drag to avoid scrolling the page.

- **Event isolation**: A capture-phase `wheel` listener on `document` calls `preventDefault()` while the Lightbox is open, and `overflow: hidden` is applied to `body` and `html` as a fallback. Keyboard events for Escape, ArrowLeft, and ArrowRight are handled in capture phase and call `stopPropagation()` so that parent modals, panels, or other key handlers (such as a task-detail or wiki-detail view) do not also react while the Lightbox is visible.

- **Accessibility**: Lightbox-enabled images have `role="button"`, `tabIndex={0}`, an `aria-label`, and keyboard activation. The overlay and controls use semantic buttons with `aria-label` attributes.

- **Control styling**: All controls share `rounded-lg bg-black/20 hover:bg-black/40` so they remain visible over white or light images. The reset icon was changed from `⟲` to `⎌` after feedback that it looked too similar to the rotation icons.

- **Dot indicator**: A row of dots is rendered above the bottom control bar when more than one image exists. The indicator container uses the same translucent black background as the other controls (`bg-black/20`) with a large rounded rectangle shape (`rounded-2xl`). The active dot is scaled to 1.25 and neighboring dots scale down by 0.2 per step, clamped at 0.5, with `transition-all duration-200 ease-out` for smooth size changes. Each dot is a button with an `aria-label` built from `t.imageLightbox.goToImage`, and clicking it updates the current index and resets the view.

- **Testing environment**: Tests run in JSDOM with `createRoot` and `act()`, polyfilling `matchMedia`, `requestAnimationFrame`, and `fetch` as needed.
<!-- SECTION:IMPLEMENTATION_NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implementation complete. Added `ImageLightboxContext` (Provider + hook + fullscreen overlay) and overrode the `img` component in `MermaidMarkdown` so all Markdown-rendered images open the large view on click, Enter, or Space. The Lightbox initially displays the image at up to 90% of the viewport (`max-w-[90vw] max-h-[90vh]`) so users can see the surrounding margin and discover zooming, while allowing further zoom up to 8x via mouse wheel or on-screen buttons. Added rotation controls (clockwise and counter-clockwise 90 degrees) in the bottom control bar; zoom, rotation, and pan position reset on image switch. It supports closing via top-right × or ESC, switching images with on-screen arrow buttons, keyboard arrow keys, or dot-indicator clicks, and mouse-wheel zoom. Wheel zoom uses the cursor as the zoom center and adjusts the pan offset in the same render so the image stays under the cursor and does not jump after dragging or drift during repeated zooms. When zoomed in, users can drag the image with the mouse (or swipe on touch) to pan; panning is clamped to keep the image within reach, the cursor changes to `grab`/`grabbing`, and the transform transition is disabled during dragging for immediate response. Background page scrolling is blocked by capturing wheel events on `document`. Keyboard events (Escape, ArrowLeft, ArrowRight) are handled in capture phase with `stopPropagation()` so that opening the Lightbox from a task detail or wiki detail does not also close the parent panel when ESC is pressed. UI refinements: a bottom control bar with rotate, zoom, and reset buttons for touch-friendly interaction; a dot indicator above the bottom bar when multiple images are present, sharing the same translucent black rounded-2xl background as the other controls, with the active dot enlarged (scale 1.25) and neighboring dots shrinking by 0.2 per step (minimum 0.5) with smooth transitions; all control buttons unified with `rounded-lg bg-black/20 hover:bg-black/40` styling and float above the image, remaining visible over light/white images; arrow buttons given fixed dimensions and flex centering for proper vertical alignment; reset icon changed from `⟲` to `⎌` to avoid confusion with rotation icons. Refactored `scale`/`translate`/`rotation` into a single `ViewState` to keep zoom and pan updates atomic. Added `src/test/image-lightbox.test.tsx` covering render markers, click-to-open, ESC close, arrow-key switching, wheel zoom, rotation, panning while zoomed, zoom/rotation/pan reset, cursor-centered zoom without drift, dot-indicator navigation, and ESC event isolation. No extra third-party libraries were introduced.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
