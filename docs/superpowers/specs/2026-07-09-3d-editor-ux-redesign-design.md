# 3D Editor UX Redesign — First-Load Welcome Card + Wall-Draw Chrome Design Spec

## Context

Two static HTML/CSS mockups (`3d-editor-init-redesign-demo.html`, `3d-editor-draw-wall-demo.html`) show a proposed UX pass on the 3D tab: a first-load welcome card for an empty scene, and interaction chrome around wall drawing (active-tool badge, live progress panel, first-time hint toast, pulsing snap marker).

Investigating the current codebase before scoping found the mockups significantly overstate how much is new. `WallDrawController.tsx` already implements essentially all of the wall-drawing *interaction logic* the second demo shows: endpoint/midpoint/axis snapping with colored markers, numeric exact-length entry (type a number, Enter to commit), Shift-to-axis-lock, Escape/double-click to end a chain, and a live length HUD with a typed-number buffer (`"🧱 {length} ⌨ {buffer} m"` — nearly identical text to the mockup). `ThreeViewerUI.tsx`'s `ViewerTopBar` already renders a wall-height chip and full live perf stats (FPS, frame time, draw calls, triangles, color-coded) via an existing `PerfStatsProbe`. What's actually new is UI chrome layered on top of that already-working functionality — not new interaction mechanics.

## Goal

Add a first-load welcome card for the empty 3D scene, and finish the wall-drawing UX with an active-tool badge, a live progress panel, a one-time hint toast, and a pulsing snap-point marker — all additive UI, no changes to how wall drawing actually works.

## Explicitly out of scope (resolved during brainstorming)

- **House templates** ("Chọn mẫu nhà"): the welcome card ships with 2 actions, not 3 — "Vẽ tường đầu tiên" (draw first wall) and "Nhập bản vẽ DXF" (import DXF), both backed by real existing features. A template library is a separate, much larger feature not bundled here.
- **Orthographic camera toggle**: the top bar's "Perspective" chip is a static descriptive label, not a new camera-mode switch.
- **Generalizing the badge/panel/toast to other 3D tools**: scoped to the wall tool (`wall3d`) only, matching the mockups exactly. Not built as a reusable framework other tools plug into — no second consumer exists today, so that would be speculative.
- **Left icon rail redesign**: the mockups' rail (Select/Wall/Floor/Rectangle/Circle/Door/Window/Measure) doesn't match the real, already-built `ToolRail.tsx` (grouped flyouts, 12 buttons) — treated as a rough illustration in the mockup, not a redesign request. `ToolRail.tsx` is untouched.

## Components

| File | Change |
|---|---|
| `canvas/3d/components/ThreeViewerUI.tsx` | Add three new exported components: `WelcomeCard`, `ActiveToolBadge`, `WallDrawHintToast`. Add one static "Perspective" chip to the existing `ViewerTopBar`. Add a small wall-draw progress block to the existing `RightSidebar`'s Render tab. |
| `canvas/3d/controllers/WallDrawController.tsx` | Add an optional `onProgress?: (p: { segmentCount: number; currentLength: number; totalLength: number } \| null) => void` prop, called whenever chain state changes (point placed, wall committed, chain cancelled/ended) — purely additive, no change to existing drawing/snapping/numeric-entry logic. The snap-point marker mesh gains a subtle scale-oscillation animation (via `useFrame`), matching the mockup's CSS pulse. |
| `components/ThreeViewer.tsx` | New local `useState` (`wallProgress`), following the exact same pattern as the existing `perfStats` state (a callback from inside `<Canvas>` populates state read by the HTML overlay outside it). Renders the four new overlay components. Empty-state check (`elements.length === 0`) gates the welcome card. |

## Data flow

No new Zustand store fields. Both features are ephemeral, session-local UI state living in `ThreeViewer`'s own component state — mirroring how `perfStats`/`quality` already work, not the persisted-drawing-data pattern. `WelcomeCard`'s two actions call existing store actions/callbacks already wired elsewhere (`setActiveTool("wall3d")` for the wall tool; the same DXF-import trigger `EditorHeader`'s import button already calls) — no new backend or store surface.

## Card dismissal behavior

The welcome card is **derived state**, not a persisted "seen it" flag: it shows whenever `elements.length === 0` in the 3D tab, and disappears the moment any element exists. "Skip → blank canvas" just lets the user see the empty grid without drawing yet — if they reload or revisit that same still-empty drawing later, the card reappears, since nothing about the scene has changed. This needs no persistence layer at all.

The hint toast is the opposite: a genuine one-time onboarding dismiss, tracked via a `localStorage` flag (e.g. `autocard.walldraw-hint-dismissed`), set when the toast's "Đã hiểu" button is clicked. Once dismissed, it never reappears on that browser, regardless of drawing.

## Testing

No new pure geometry/math functions are introduced (the progress-tracking callback is a thin reporting layer over `WallDrawController`'s existing, already-tested state, not new logic), so no new vitest coverage is needed. Verification is a manual browser pass: confirm the welcome card appears on an empty drawing, both actions work correctly, skip works and the card correctly reappears on reload if still empty; draw a wall and confirm the badge, progress panel, hint toast, and snap-marker pulse all appear and update correctly, and confirm the hint toast does not reappear after dismiss + reload.

## Non-goals

- Any change to `WallDrawController`'s actual drawing/snapping/numeric-entry/axis-lock behavior — chrome only.
- A house-template system.
- An orthographic camera mode.
- Generalizing tool-progress UI to floor/roof-ridge/MEP/other 3D drawing tools.
- Any left icon rail changes.
