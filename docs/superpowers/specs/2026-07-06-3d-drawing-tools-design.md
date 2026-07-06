# 3D Drawing Tools Enhancement — Design Spec

**Date:** 2026-07-06
**Scope:** `autocard/frontend` — 3D viewer (`src/components/ThreeViewer.tsx`, `src/canvas/3d/`)
**Goal:** Close the gap between the current 3D toolset and a SketchUp/AutoCAD-hybrid workflow: transform gizmo, snapping + numeric input, new shape-creation tools, per-face materials, and draggable section planes.

## Background

The 3D viewer currently offers: select, eraser, wall draw (`wall3d`), floor draw (`floor3d`), draw-on-face, push/pull, orbit/pan/zoom, tape measure, door/window placement, perpendicular wall move, wall height, walkthrough, room detection, and quick furniture insert.

Key gaps identified:

1. No Move/Rotate/Scale/Copy gizmo for arbitrary objects (only perpendicular wall move).
2. No 3D snapping/inference (endpoint, midpoint, axis lock) — wall/floor drawing is imprecise.
3. No exact numeric input while drawing (type a length, press Enter).
4. Missing creation tools: rectangle/circle/arc on a plane, offset, primitives (box/cylinder).
5. No per-face material assignment (paint bucket); section cut is a fixed X-axis boolean.
6. Undo/redo not wired in the 3D view (store support already exists).

## Approach decision

**Chosen: extend the existing controller pattern.** Each new tool is a controller component in `src/canvas/3d/controllers/` (following `WallDrawController`), committing elements through `drawingStore` — which already provides history/undo and `rotation`/`scale`/`pushPullDepth` fields on `DrawingElement`.

Rejected alternatives:
- Unified editor state-machine rewrite — too risky against the existing 1,600-line `ThreeViewer.tsx`; blocks incremental shipping.
- Migrating the 3D viewer onto the new `src/cad/` system — violates the repo boundary rule (old drawing system and new CAD system are parallel and must not mix).

Included cleanup (serves the goal): raycast logic currently copy-pasted per controller moves into a shared hook.

## Design

### Phase 1 — Shared interaction infrastructure

**`src/canvas/3d/interaction/snap3d.ts` — SnapEngine3D**
- Input: pointer world point, drawing elements, current tool context (e.g. chain start point).
- Candidates: element endpoints, midpoints, wall-axis intersections with the ground grid, grid points.
- Axis lock: holding Shift (or arrow keys) constrains the preview to the X or Z axis from the anchor point.
- Output: `{ point, snapType }` where `snapType ∈ endpoint | midpoint | grid | axis-x | axis-z | none`; consumers render a colored glyph per type.
- Pure functions; unit-tested with vitest.

**`useNumericInput` hook + HUD overlay**
- While a tool has an active segment/drag, typing a digit opens a small input near the cursor (HTML overlay, outside the WebGL tree).
- Enter commits the exact value (length in current units via `formatLength` conventions, or angle for rotate); Escape cancels back to pointer control.
- Exposed as: `const { pending, valueFor } = useNumericInput(active)` — tools consume the committed value to override the pointer-derived distance.

**`useToolRaycast` hook**
- Shared pointer→NDC→ray→(ground plane | scene meshes) utilities, replacing the duplicated `toGround` blocks in `WallDrawController`, `FloorDrawController`, `DoorPlacerController`, `WallMoveController`.

**Retrofit:** `WallDrawController` and `FloorDrawController` consume all three (snap, numeric input, shared raycast).

### Phase 2 — Transform tools

**`TransformGizmoController`**
- Active when tool = `select` and an element is selected (existing `onElementClick` path sets selection).
- drei `TransformControls` bound to a proxy object at the element's world position; modes: translate (XZ always; Y only for elements with `elevation` support, e.g. pipes), rotate around Y, scale (uniform).
- On drag end, commits via `updateElement(id, { x, y, rotation, scale })` — one history entry per gesture (commit only on release, not per-frame).
- OrbitControls disabled while a gizmo drag is active.
- Numeric input integration: typing during a translate drag moves the element exactly N units along the drag axis; during rotate, sets the angle in degrees.

**Multi-select & group transform**
- Shift-click adds/removes from a selection set (new `selectedIds: string[]` in the viewer or element slice).
- Group translate applies the same delta to all via `updateElements`.
- Rotate/scale for multi-select is out of scope this round (single-element only).

**Copy**
- Ctrl held at translate-drag start duplicates the element(s) (new ids), then moves the copies.

### Phase 3 — Creation tools

**`ShapeDrawController` (rectangle / circle / arc)**
- Draw on the ground plane or on a face (reusing `DrawOnFaceController`'s basis-matrix math for face-local 2D coordinates).
- Rectangle: 2 clicks (corners). Circle: center + radius click. Arc: 3 points (start, end, bulge).
- Commits `DrawingElement` (`type: rectangle | circle | arc`) so shapes render in 2D and 3D and are push/pull-able via the existing pipeline.
- Snap + numeric input supported (typed side length / radius).

**Primitive tools (box / cylinder)**
- Click-drag footprint on ground, release, then move up/down to set height, click to commit.
- Box → rectangle element with `pushPullDepth`; cylinder → circle element with `pushPullDepth`.

**`OffsetWallController`**
- Click a wall → preview a parallel wall at the pointer's perpendicular distance (or typed distance) → click/Enter commits a new wall element.

### Phase 4 — Materials & sections

**Paint bucket (`paint3d` tool)**
- Material palette panel (reusing `MaterialService` texture names) appears when the tool is active.
- Click a mesh → `updateElement(id, { material: <name> })`.
- `WallMesh` and `FloorMesh` read `el.material ?? current default` (wall facade material prop remains the fallback). `RoomMesh` (translucent overlay) and `RoofMesh` (generated, not element-backed) are not paintable.

**Draggable section planes**
- Replace boolean `sectionCut` in `sceneSlice` with `{ enabled: boolean; axis: "x" | "y" | "z"; offset: number }`.
- Arrow gizmo on the plane; dragging updates `offset` live (clipping plane constant), axis switchable from the section UI.
- Existing `gl.localClippingEnabled` wiring in `Scene` adapts to the new state shape.

### Phase 5 — UX polish

- Ctrl+Z / Ctrl+Shift+Z (and Cmd on mac) wired in the 3D view → store `undo()/redo()`; toolbar buttons with disabled states from `historyIndex`.
- Left toolbar regrouped into flyout groups: Select/Erase · Draw (wall, floor, shapes, primitives) · Transform (gizmo, offset, wall tools) · Camera (orbit, pan, zoom, walk) · Measure & Section · Materials.
- Consistent Escape behavior: first Esc cancels the in-progress gesture, second Esc returns to `select`.
- Per-tool cursor styles on the canvas container.

## Data model changes

- `DrawingElement`: add optional `material?: string` (per-element material override). All other fields required (`rotation`, `scale`, `pushPullDepth`, `elevation`) already exist.
- `sceneSlice`: `sectionCut: boolean` → `section: { enabled: boolean; axis: "x" | "y" | "z"; offset: number }`.
- New `selectedIds: string[]` selection state (multi-select).

## Error handling

- Raycast misses (no ground/face hit): tools ignore the event; no crash, no partial commit.
- Degenerate geometry (zero-length wall, zero-radius circle): rejected before commit (extend the `isValidWall` pattern per shape).
- Numeric input: non-numeric/negative-invalid values are rejected inline (input turns red, no commit).
- TransformControls drag: commit only on drag end; Escape mid-drag reverts to the pre-drag transform.

## Testing

- Vitest unit tests: `snap3d` (candidate collection, axis lock, priority ordering), shape-element factories (rectangle/circle/arc/primitives validity), offset-wall geometry.
- `npx tsc --noEmit` clean after every phase (the known pre-existing `StoreOrderPage.tsx:493` error excepted).
- Manual smoke per phase: draw → snap → type exact length → transform → undo → material paint → section drag.

### Phase 6 — Avatar walkthrough (added after UX review)

The existing `WalkthroughController` is a first-person fly camera only — there is no visible body, so there is no way to *watch* a traversal from room to room (e.g. for a client demo). Add a visible humanoid that walks to a clicked point and reports which room it is standing in.

**`AvatarMesh`** — a small humanoid (same proportions as the existing static scale `Mannequin` in `ThreeViewer.tsx`) with a simple leg-swing cycle driven by `useFrame` while moving.

**`AvatarWalkController`** (tool `walk-avatar`) — click the ground to set a target; the avatar moves toward it at human walking speed (~1.4 m/s), facing its direction of travel. Position/rotation are driven imperatively via a group ref (not React state) to avoid a re-render every frame. Each frame, the avatar's position is converted to drawing coordinates and checked against `detectRooms(elements)` polygons; on entering a different room, the app shows a transient "Entered `<room>`" notice and marks that room visited in a small on-screen checklist.

Camera stays on the existing `OrbitControls` (user can orbit/zoom freely while watching the avatar) — a third-person follow camera is an explicit stretch goal, not required for v1.

### Phase 7 — Multi-layer wall assemblies (added after UX review)

Walls currently render as one homogeneous slab (`WallMesh`, `wallGeometry.ts`). Real construction is layered — brick + insulation + drywall, or a steel-stud drywall partition — and the user wants to pick a construction assembly before drawing, not just a facade material.

**Data model:** `DrawingElement` gains `wallLayers?: { material: string; thicknessMm: number }[]`. When absent, a wall renders exactly as today (backward compatible with every existing plan/DXF-imported wall). When present, `wallThickness` is derived as the sum of `thicknessMm` and the wall renders as N parallel slabs, each `thicknessMm` wide and using `MaterialService.getMaterial(material)`, stacked along the wall's perpendicular normal.

**Presets:** the wall tool gets an assembly picker (same interaction pattern as the Task 12 paint palette) with starting presets — "Gạch 100mm" and "Gạch 200mm" (single layer), "3 lớp cách nhiệt" (100mm brick + 50mm XPS insulation + 12mm drywall), "Vách thạch cao" (12mm drywall + 75mm steel stud + 12mm drywall). The selected preset is attached to every wall segment committed by `WallDrawController` until changed.

### Phase 8 — MEP (điện / cấp nước / thoát nước) 3D drawing tools (added after UX review)

`DrawingElement` already has `archType: "pipe"`, `pipeSystem: "water" | "hvac" | "drain" | "electric" | "gas"`, `pipeDiameter`, and `elevation`, and `PipeMesh` already renders these as colored cylinders — but the *only* way to create one today is the 2D `CanvasEditor`'s Pipe/Wire tool. The 3D viewer has no way to draw MEP runs directly, which is the gap the user flagged ("chưa có... vẽ đường điện đường thoát nước").

Add five dedicated 3D tools — one button per system (`mep-water`, `mep-drain`, `mep-electric`, `mep-hvac`, `mep-gas`), not a single tool with a system picker, so every system is one click away. Each draws a free-space click-click chain (same snapping/axis-lock/numeric-length infrastructure as the wall tool, Tasks 1–2) at a per-system default elevation above the floor slab (water +30cm, drain −20cm/embedded-below-slab, electric +280cm/near-ceiling, hvac +300cm, gas +30cm). The scroll wheel adjusts elevation live while a run is in progress (10cm per notch, clamped to roughly [-100, 400]cm) — there is no other natural input for a third dimension while drawing on the ground plane. Runs are tagged `archType: "pipe"`, `pipeSystem: <system>`, so they render, clash-detect, and quantity-take exactly like MEP drawn in 2D today.

## Out of scope

- Extrude-along-path (follow-me), fillet/chamfer in 3D, rotate/scale for multi-selection, terrain tools, 2D canvas tool changes, backend changes.
- Avatar wall-collision / pathfinding around obstacles (v1 walks in a straight line to the clicked point) and third-person follow camera.
- Wall-assembly editor UI (custom layer stacks beyond the four presets), MEP run bending/elbow fittings, MEP-to-wall auto-routing (v1 is free-space only, not "follow this wall").
