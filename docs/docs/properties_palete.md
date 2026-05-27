# Implementation Plan: Properties Palette Upgrade & Snap Finalization

This plan corrects the original scope based on the current codebase.

It covers two workstreams:
1. **Finish the snap-mode rollout that is already partially implemented**.
2. **Replace the inline properties overlay with a standalone AutoCAD-style Properties Palette** that edits drawing defaults and selected entities safely.

---

## Current State

Before implementation, account for these existing conditions:

* `SnapModes` already includes `geometricCenter`, `node`, `quadrant`, `perpendicular`, `tangent`, `insertion`, `extension`, and `apparentIntersection`.
* The drawing store already initializes those modes in both the initial state and `resetEditor`.
* `findNearestSnap()` already accepts `startPoint?: Point | null`, and `CanvasEditor` already passes `startPointRef.current` into it.
* `drawSnapIndicator()` and `StatusBar.tsx` already support the new snap-mode labels and indicators.
* `CadSidebar.tsx` still exposes only the older subset of OSNAP toggles.
* The current inline Properties overlay in `CanvasEditor.tsx` is read-only and only appears for single selection.
* The drawing store persists only a subset of editor state during `loadDrawing()` / `saveDrawing()`. That is not enough for a Properties Palette that edits `layers`, `activeLayerId`, `currentStyle`, or `currentArchitecturalPlan`.
* Some visible geometry is rendered from `currentArchitecturalPlan`, not only from `elements`. Calling `updateElement(id, updates)` is therefore not sufficient for all editable objects.

---

## Proposed Changes

### 1. Drawing Document Model & Persistence

#### [MODIFY] [types.ts](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/frontend/src/types.ts)
* Keep the existing `SnapModes` shape as-is.
* Extend `DrawingDocument` so it can persist Properties Palette state, at minimum:
  * `currentStyle`
  * `layers`
  * `activeLayerId`
  * `currentArchitecturalPlan`
  * existing `elements`, `blockDefs`, `measurements`, `constraints`

#### [MODIFY] [drawingStore.ts](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/frontend/src/stores/drawingStore.ts)
* Refactor `loadDrawing()` and `saveDrawing()` to read/write a full `DrawingDocument` payload instead of only `{ elements, blockDefs, measurements, constraints }`.
* Preserve current snap defaults unless there is an explicit product decision to change them. Do **not** silently switch behavior just because the old plan said so.
* Add store actions for property editing that match the real UI needs:
  * `updateElements(ids, updates)` or equivalent batch-update action for multi-select style edits.
  * `updateArchitecturalEntity(id, updates)` or equivalent plan-aware action for walls/openings/rooms/dimensions/grid axes stored in `currentArchitecturalPlan`.
  * Optional helper: `applyPropertiesToSelection(...)` if that reduces component complexity.
* Keep undo/redo coherent:
  * Multi-select edits should create one history entry, not one per selected element.
  * Plan-backed edits must update the same history stream as element edits.

---

### 2. Snapping Engine Finalization

#### [MODIFY] [snap.ts](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/frontend/src/canvas/snap.ts)
Focus on correctness gaps rather than re-adding features that already exist.

* Make `findNearestSnap()` actually respect the master toggles:
  * `snapEnabled` controls grid snap only.
  * `osnapEnabled` controls object snaps only.
  * Today those flags are accepted but ignored.
* Review and tighten the existing helpers:
  * **Geometric Center**: use polygon centroid math for closed polygons/hatches where possible; keep average-vertex fallback for degenerate shapes.
  * **Node**: define the supported sources explicitly. Prefer `type === "point"` first; include block insertion points only if that is a deliberate product choice.
  * **Quadrant**: verify arc-angle normalization and ellipse radius handling.
  * **Perpendicular**: validate only candidates that are geometrically valid for the target entity.
  * **Tangent**: ignore impossible cases (`startPoint` inside or on the circle) and validate arc-range membership for arc targets.
  * **Extension**: cap extension snapping to a fixed visible distance (`100px` converted to world units using zoom), instead of extending infinitely.
  * **Apparent Intersection**: keep infinite-line behavior, but avoid obviously noisy candidates when segments are parallel or nearly parallel.
* Keep `drawSnapIndicator()` aligned with the supported snap types.

#### [MODIFY] [CanvasEditor.tsx](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/frontend/src/pages/CanvasEditor.tsx)
* Keep the current `startPointRef` approach.
* Do **not** add `startPoint` to `getCanvasPoint` dependencies just to pass it into `findNearestSnap`; that is already handled through the ref.
* Update call sites only if `findNearestSnap()` parameter behavior changes.

#### [MODIFY] [CadSidebar.tsx](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/frontend/src/components/CadSidebar.tsx)
* Add the missing OSNAP toggles so the sidebar matches the status bar:
  * `Geometric Center`
  * `Node`
  * `Quadrant`
  * `Perpendicular`
  * `Tangent`
  * `Insertion`
  * `Extension`
  * `Apparent Intersection`

#### [MODIFY] [StatusBar.tsx](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/frontend/src/pages/CanvasEditor/components/StatusBar.tsx)
* No major feature addition is required here because the buttons already exist.
* Only adjust labels/order if product wants parity with AutoCAD naming.

---

### 3. Standalone Properties Palette

#### [NEW] [PropertyPanel.tsx](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/frontend/src/pages/CanvasEditor/components/PropertyPanel.tsx)
Create a standalone, collapsible Properties Palette component.

* **UI Design**:
  * Floating right-side panel.
  * Collapsible header.
  * Reuse the editor’s existing dark glass styling rather than introducing a separate visual system.

* **State access**:
  * Prefer reading directly from Zustand inside the component instead of passing a large prop bundle from `CanvasEditor`.
  * If viewport metrics require DOM measurement, pass only `canvasRef` or a minimal derived viewport object.

* **Selection Modes**:
  1. **No Selection**
     * Show default drawing properties for newly created entities:
       * stroke color
       * fill color
       * line width
       * line type
       * active layer
     * Editing these values updates `currentStyle` and `activeLayerId`.
     * Show view stats:
       * `Center X`
       * `Center Y`
       * `Zoom %`
       * viewport world width / height
     * Show lightweight metadata:
       * active tool
       * visible/total entity count

  2. **Single Selection**
     * Show common editable properties:
       * layer
       * stroke/fill color
       * line width
       * line type
     * Show geometry fields by entity type:
       * Circle: `Center X`, `Center Y`, `Radius`
       * Line / Wall: `Start X`, `Start Y`, `End X`, `End Y`
       * Rectangle: `X`, `Y`, `Width`, `Height`
       * Text / Block / Opening: insertion-position-based fields where applicable
     * Route updates through the correct store API:
       * `updateElement` for element-backed entities
       * plan-aware update action for entities backed by `currentArchitecturalPlan`

  3. **Multi Selection**
     * Show selection count.
     * Limit v1 batch editing to common style fields:
       * layer
       * stroke color
       * fill color where applicable
       * line width
       * line type
     * Use a batch store action so the update is atomic and undo-friendly.

* **Scope guard**
  * Do not promise full geometry editing for every entity type in v1 unless the backing data model is implemented.
  * If a selected entity cannot yet be updated safely, show read-only values instead of mutating the wrong store slice.

---

### 4. Canvas Integration

#### [MODIFY] [CanvasEditor.tsx](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/frontend/src/pages/CanvasEditor.tsx)
* Replace the current inline single-selection overlay with `<PropertyPanel />`.
* Keep the integration thin:
  * render the component near the canvas overlay area
  * pass only minimal refs/derived viewport data if required
* Remove duplicated property UI from `CanvasEditor.tsx` after extraction.

#### [MODIFY] [CadSidebar.tsx](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/frontend/src/components/CadSidebar.tsx)
* Keep the existing lightweight sidebar “Properties” summary only if it still serves a different purpose.
* Otherwise, simplify or remove it to avoid maintaining two conflicting property surfaces.

---

## Verification Plan

### Automated Verification
* Expand [snap.test.ts](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/frontend/src/canvas/snap.test.ts) to cover:
  * grid-only vs osnap-only gating
  * quadrant on circles and arcs
  * polygon centroid / geometric center
  * perpendicular projection validity
  * tangent candidate validity
  * apparent intersection
  * extension-distance limit
* Add store-level tests for property persistence and batch updates:
  * saving/loading `currentStyle`
  * saving/loading `layers` and `activeLayerId`
  * batch selection edits creating one history entry
  * plan-aware updates mutating `currentArchitecturalPlan` correctly
* Run:
  ```bash
  npx tsc --noEmit
  npx tsx --test src/canvas/snap.test.ts
  ```
* If store tests are added:
  ```bash
  npx tsx --test src/stores/drawingStore.test.ts
  ```

### Manual Verification
* Snap behavior:
  * Enable only `SNAP`: verify grid snapping works and object snaps do not appear.
  * Enable only `OSNAP`: verify endpoint/center/quadrant/etc. work and grid snap does not compete.
  * Draw a line from a live `startPoint` and verify perpendicular/tangent only appear when geometrically valid.
  * Verify extension snaps stop at the configured visible limit.
* Properties Palette:
  * With nothing selected, change default stroke/fill/line width/active layer and create a new entity to confirm the defaults apply.
  * Reload the drawing and confirm those defaults persist.
  * Select a circle and edit `Center X`, `Center Y`, and `Radius` in real time.
  * Select multiple entities and verify one batch style change updates all of them and undoes in one step.
  * Select any architecture-backed entity and verify edits either work through the plan-aware path or remain read-only by design.
* Layout / UX:
  * Collapse and reopen the palette.
  * Verify the panel does not block core drawing actions unnecessarily.
  * Verify viewport stats update while panning and zooming.
