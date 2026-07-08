# 3D-First Core Mechanism — Auto-Generated 2D Views Design Spec

## Context

`docs/docs/3d_first_architecture_plan.md` lays out a 6-phase vision: 3D as the sole source of truth, 2D views auto-generated from it, an AI TCVN (Vietnamese building code) reviewer, an AI design generator from a text brief, and permit-ready PDF export (~18 days of work across independent subsystems). This spec covers only the first, foundational piece — **Sub-project A: 3D-first core mechanism** — decomposed out of that vision per `superpowers:brainstorming`. The other three sub-projects (Layout/title-block auto-compose, AI TCVN reviewer, AI design generator) are out of scope here and get their own specs later.

**Why this one first:** every other sub-project either renders through this pipeline (Layout auto-compose, PDF export) or reads the same underlying 3D model independently (AI reviewer, AI generator) — but the auto-generated-views mechanism is the one piece the user asked for directly, and the one everything downstream assumes exists.

## Goal

Add a **Views** tab that renders plan / elevation / section drawings live from the 3D model (`elements[]` in the Zustand `drawingStore`, unchanged — no new authoring surface, no new data to keep in sync). Export works from either 3D (already built: GLTF/IFC) or a 2D view (PNG, extending the export pipeline already built in the previous plan).

**Explicitly not changing:** the existing `Mô hình 2D` tab keeps its full hand-drawing toolset (Line/Rect/Move/Trim/furniture library/etc.) exactly as it is today. This was an open question resolved during brainstorming — the original doc proposed stripping 2D down to annotation-only; that's rejected as unnecessarily disruptive. Views is a new, additive tab, not a replacement.

## Prior art already in the codebase

The previous plan (`docs/superpowers/plans/2026-07-07-house-planner-parity.md`, Task 7) already built a first cut of this exact idea:

- `canvas/3d/geometry/sheetCamera.ts` — pure function `sheetFrustum(bounds, view, wallHeight, roofAllowance?, margin?)` computing an orthographic camera frustum for `"plan" | "front" | "side"`. Already vitest-tested (3 tests).
- `canvas/3d/components/DrawingSheetExporter.tsx` — one-shot trigger: renders the scene through that frustum on a white background (hiding grid/sky/roof as appropriate via `userData.exportHide`/`exportRoof`), downloads a PNG, restores the live view.

This spec **generalizes and extends** that pipeline rather than replacing it — `DrawingSheetExporter`'s existing 3-button quick-export (used from the 3D view's Export tab) is left as-is; the new `ViewRenderer` is a separate, reusable component built for the Views tab's persistent thumbnails.

## Architecture

```
elements[] (Zustand store, unchanged — single source of truth)
        │
        ▼
sheetFrustum() [extended]  ── camera frustum for any ViewType, including user-defined sections
        │
        ▼
ViewRenderer               ── persistent offscreen <Canvas>, line-art materials, renders to a thumbnail
        │
        ▼
Views tab (ViewsPanel)     ── grid of live thumbnails: plan, 4 elevations, user section cuts
        │
        ├─→ click thumbnail → full-size view + auto-dimension overlay
        └─→ Export → same PNG download pipeline, per-view
```

The Views tab sits alongside the existing 4 tabs (`Mô hình 2D`, `Mô hình 3D`, `Layout`, `Dự toán`), using the same boolean-flag pattern already in `CanvasEditor.tsx` (`show3D` / `showPaperSpace` / `showEstimation`) — add `showViews`, same wiring, same `EditorHeader` button pattern.

## Components

| File | Change | Notes |
|---|---|---|
| `canvas/3d/geometry/sheetCamera.ts` | **Extend** | `SheetView` grows from `"plan" \| "front" \| "side"` to `"plan" \| "elevation-N" \| "elevation-S" \| "elevation-E" \| "elevation-W" \| "section"`. Elevations are the existing front/side math generalized to 4 compass directions. `"section"` takes a user-drawn cut line (`{x1,y1,x2,y2}`, drawing coords) instead of a fixed direction, and the resulting frustum/camera setup also implies a clipping plane along that line so geometry beyond the cut doesn't render. Existing 3 tests keep passing unchanged; add cases per new view type. |
| `canvas/3d/components/ViewRenderer.tsx` | **New** | Persistent offscreen `<Canvas>` — not a one-shot trigger like `DrawingSheetExporter`. Renders elements with `EdgesGeometry` + `MeshBasicMaterial` (line art, no shading, matching the original doc's Phase 1B). Produces a live-updating thumbnail `<canvas>`/data URL per view, re-rendered when `elements[]` changes. |
| `canvas/3d/geometry/autoDimension.ts` | **New** | Pure function `generateDimensions(walls: DrawingElement[]): DimensionLine[]` — per-room chain + overall-horizontal + overall-vertical chains, positioned outside the bounding box. Vitest-tested like `sheetCamera.ts`; no rendering logic in this file. |
| `canvas/3d/components/DimensionOverlay.tsx` | **New** | Renders `DimensionLine[]` as SVG/canvas overlay on top of a `ViewRenderer` thumbnail when expanded to full size. |
| `pages/CanvasEditor/components/ViewsPanel.tsx` | **New** | Tab content: thumbnail grid (plan / 4 elevations / section cuts), "+ Add section cut" button, click-to-expand a thumbnail, per-view Export button (reuses the PNG-download logic pattern from `DrawingSheetExporter`). Empty state when `elements.length === 0`. |
| `canvas/3d/controllers/SectionCutTool.tsx` | **New** | User drags a line across the plan thumbnail to define a section cut. Same 2-click-line UX as `RidgeLineController` (already built). Rejects zero-length lines (same validation pattern as `isValidWall`). |
| `stores/slices/sceneSlice.ts` | Modify | Add `sectionCuts: { id: string; label: string; line: RidgeLine }[]` + `addSectionCut`/`removeSectionCut`. Same storage pattern as the existing `roofRidge` field — persists per-drawing, not derived. Labels auto-assigned A-A, B-B, C-C... |
| `pages/CanvasEditor/components/EditorHeader.tsx` | Modify | Add a 5th tab button ("Views" / "Bản vẽ") using the existing `viewBtnCls`/`setShowX` pattern. |
| `pages/CanvasEditor.tsx` | Modify | Add `showViews` state, mount `ViewsPanel` when active — same pattern as `showPaperSpace` → `PaperSpace`. |

**Not touched:** `Mô hình 2D` tab and its toolbar, `ThreeViewer.tsx`'s drawing tools/controllers, `DrawingSheetExporter.tsx` (kept for the existing 3D-tab quick-export).

## Data flow & state

Views are **always derived, never stored** — no new fields on `DrawingElement`, no duplicated geometry. The only new persisted state is the list of user-defined section cuts (`sceneSlice.sectionCuts`), because those are user *decisions* (where to cut), not derivable from the model — same reasoning as why `roofRidge` is stored rather than inferred.

Plan and the 4 elevations require no stored state at all — they're computed on demand from `elements[]` bounds, same as `sheetFrustum` already does today.

## Error handling / edge cases

- **Empty drawing** (0 elements): Views tab shows an empty state ("Vẽ gì đó ở chế độ 3D trước" / draw something in 3D first), not a blank or broken thumbnail.
- **No walls, but other elements exist**: plan/elevation views still render whatever exists; `autoDimension` simply produces no dimension lines (walls are the only element type it reads).
- **Section cut with zero/near-zero length**: rejected at draw-time by `SectionCutTool`, same guard as `isValidWall`'s `minLen`.
- **Very large models** (performance): out of scope for this spec — `ViewRenderer` re-renders on `elements[]` change same as the existing 3D viewer does; if this proves slow in practice, debouncing/memoization is a follow-up, not a blocker for v1.

## Testing

- `sheetCamera.ts` extension: vitest, same style as the existing 3 tests — assert frustum bounds/position/up-vector per new `SheetView` variant, including that `"section"` produces a frustum oriented along the cut line's normal.
- `autoDimension.ts`: vitest — given a small set of wall elements, assert the expected dimension chains (values, not pixel positions).
- `ViewRenderer` / `ViewsPanel` / `SectionCutTool`: manual browser verification (same Playwright-driven pass used to verify the last two plans), since these are React-Three-Fiber rendering components, not pure logic.

## Non-goals (this spec)

- **Multi-floor/level support.** The store has no floor/level concept today. All views render the whole model as a single level. The original doc's `floorIndex` parameter assumes floors exist as a concept — they don't yet, and introducing that concept is a separate, larger change not bundled here.
- Layout tab auto-compose + TCVN title block (sub-project B, future spec).
- AI TCVN reviewer (sub-project C, future spec).
- AI design generator from a text brief (sub-project D, future spec).
- PDF permit export, DXF Paper Space layouts (rest of the original doc's Phase 6 — depends on sub-project B's layout composer to be meaningful; a bare per-view PNG export is in scope here, a composed multi-sheet PDF is not).
