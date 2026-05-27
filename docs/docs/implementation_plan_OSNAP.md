# Implementation Plan: Dynamic Input HUD and Object Snap Settings (OSNAP)

This plan defines a first implementation of AutoCAD-style real-time HUD overlays and a focused OSNAP settings menu for the current 2D editor. The scope is intentionally limited to snap modes that the existing canvas editor can calculate reliably without misleading the user.

---

## User Review Required

> [!IMPORTANT]
> - **Supported OSNAP Scope in V1**: The dropdown will expose only snap modes that are actually implemented and calculated: `endpoint`, `midpoint`, `center`, `intersection`, `grid`, and `nearest`. Advanced AutoCAD targets such as `node`, `quadrant`, `extension`, `insertion`, `perpendicular`, `tangent`, `apparentIntersection`, and `parallel` are explicitly out of scope for this version and will not be shown as active toggles.
> - **Nearest Geometry Scope**: `nearest` will snap against line-like geometry that exists in the current editor model: `line`, rectangle edges, `polyline`, `leader`, `hatch` boundary segments, and synthetic wall segments derived from `currentArchitecturalPlan.walls`. `hatch` closes its polygon (last point → first point). `polyline` and `leader` use their `points: Point[]` array.
> - **Command Line Consistency**: The `SNAP` command `desc` string and the error/help text must both match the exact modes exposed in the header dropdown. As of this plan, the `desc` at `commandStore.ts:193` is **also** missing `intersection` (a pre-existing gap) — fix both gaps in the same commit: update to `endpoint/midpoint/center/grid/intersection/nearest`.
> - **Keyboard Input**: The HUD remains a read-only visual aid. Numeric input continues to go through the command line.
> - **Coordinate spaces in the HUD**: Length and angle are computed in canvas model coordinates (`startPoint`/`dragPoint`). The HUD `<div>` is positioned using client/screen coordinates (`mouseClientPos`). These two coordinate systems must not be mixed.

---

## Proposed Changes

### 1. Types
#### [MODIFY] [types.ts](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/frontend/src/types.ts)
- Extend `SnapModes` with only the new mode needed for this plan:
  ```typescript
  export interface SnapModes {
    endpoint: boolean;
    midpoint: boolean;
    center: boolean;
    grid: boolean;
    intersection: boolean;
    nearest: boolean;
  }
  ```
- Do not add placeholder booleans for unsupported modes in this version.

---

### 2. Store and Command Surface
#### [MODIFY] [drawingStore.ts](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/frontend/src/stores/drawingStore.ts)
- Add `nearest` to the initialized `snapModes` object in both the store initializer and `resetEditor`.
- Keep `toggleSnapMode(mode: keyof SnapModes)` unchanged, but ensure the default state is explicit and stable:
  - `endpoint`, `midpoint`, `center`, `intersection`, `grid`: preserve current defaults.
  - `nearest`: add with default `false` in both locations.

#### [MODIFY] [commandStore.ts](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/frontend/src/stores/commandStore.ts)
- Fix the `SNAP` command `desc` at line 193 — it currently lists only `endpoint/midpoint/center/grid` and is **missing both `intersection` (pre-existing gap) and `nearest`**. Update to:
  ```
  "Toggle snap mode (endpoint/midpoint/center/grid/intersection/nearest) or show status"
  ```
- Update the error/help output at line 682 to append `nearest`:
  ```
  "Unknown snap mode: ${mode}. Options: endpoint, midpoint, center, grid, intersection, nearest"
  ```
- The SNAP toggle logic at line 677 (`mode in store.snapModes`) is already dynamic — no changes needed there.

---

### 3. Snapping Engine
#### [MODIFY] [snap.ts](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/frontend/src/canvas/snap.ts)

**New shared `Segment` type and `collectSegments` helper:**

Add a `Segment` type and a module-level `collectSegments(elements)` function that normalizes drawable entities into line segments. Both `snapNearest` and the refactored `snapIntersection` will call this helper — removing the duplicate normalization logic that currently only handles `line` and `rectangle`.

```typescript
type Segment = { x1: number; y1: number; x2: number; y2: number };

function collectSegments(elements: DrawingElement[]): Segment[] {
  const segs: Segment[] = [];
  for (const el of elements) {
    if (el.type === "line") {
      segs.push({ x1: el.x1!, y1: el.y1!, x2: el.x2!, y2: el.y2! });
    } else if (el.type === "rectangle") {
      const { x, y, width: w, height: h } = el as any;
      segs.push(
        { x1: x, y1: y, x2: x + w, y2: y },
        { x1: x + w, y1: y, x2: x + w, y2: y + h },
        { x1: x + w, y1: y + h, x2: x, y2: y + h },
        { x1: x, y1: y + h, x2: x, y2: y }
      );
    } else if (
      (el.type === "polyline" || el.type === "leader" || el.type === "hatch") &&
      el.points?.length
    ) {
      const pts = el.points;
      for (let i = 0; i < pts.length - 1; i++) {
        segs.push({ x1: pts[i].x, y1: pts[i].y, x2: pts[i + 1].x, y2: pts[i + 1].y });
      }
      if (el.type === "hatch" && pts.length >= 3) {
        segs.push({ x1: pts[pts.length - 1].x, y1: pts[pts.length - 1].y, x2: pts[0].x, y2: pts[0].y });
      }
    }
  }
  return segs;
}
```

**New `snapNearest`:**

- Takes `elements`, `pt`, `threshold`, and an optional `wallSegments?: Segment[]` for synthetic ArchitecturalPlan wall centerlines.
- Merges `collectSegments(elements)` with `wallSegments`.
- Projects cursor onto each segment using `closestPointOnSegment` (already in file).
- Returns the projected point within threshold as `{ point, type: "nearest" }`.

**Refactor `snapIntersection`:**

Replace the inline segment-building loop with a call to `collectSegments(elements)`. This gives `snapIntersection` visibility into polyline, leader, and hatch edges at no extra cost.

**Update `findNearestSnap` signature:**

Add an optional `wallSegments?: Segment[]` parameter (last position, after `gridSize`). Pass it through to `snapNearest`. The caller (`CanvasEditor`) is responsible for building this array — the snap engine stays store-free.

**Export `Segment` type** so `CanvasEditor` can reference it when building wall segments.

**Update `drawSnapIndicator`:**

Add a `nearest` case — an orange X mark (two crossing diagonals), visually distinct from all existing markers:
```typescript
case "nearest":
  ctx.strokeStyle = "#f97316"; // orange
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(point.x - size / 2, point.y - size / 2);
  ctx.lineTo(point.x + size / 2, point.y + size / 2);
  ctx.moveTo(point.x + size / 2, point.y - size / 2);
  ctx.lineTo(point.x - size / 2, point.y + size / 2);
  ctx.stroke();
  break;
```

---

### 4. Snap Source Collection
#### [MODIFY] [CanvasEditor.tsx](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/frontend/src/pages/CanvasEditor.tsx)

Inside `getCanvasPoint`, read `currentArchitecturalPlan` from `useDrawingStore.getState()` (already called for `snapEnabled`/`snapModes`/`elements`). Build wall segments inline and pass to `findNearestSnap`:

```typescript
const { snapEnabled, snapModes, elements, currentArchitecturalPlan } = useDrawingStore.getState();
if (snapEnabled) {
  const wallSegs = currentArchitecturalPlan?.walls.map(w => ({
    x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2,
  }));
  const snapped = findNearestSnap(elements, pt, snapModes, 40, 12 / zoom, wallSegs);
  ...
}
```

No changes to the `findNearestSnap` call site signature from `CanvasEditor`'s perspective — wall segments are optional and default to undefined when the plan is null.

---

### 5. Interactive HUD and Header Menu
#### [MODIFY] [CanvasEditor.tsx](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/frontend/src/pages/CanvasEditor.tsx)

**HUD:**

- Add `mouseClientPos` state: `const [mouseClientPos, setMouseClientPos] = useState<{ x: number; y: number } | null>(null)`.
- In `handleMouseMove`, set `mouseClientPos({ x: e.clientX, y: e.clientY })` before any early returns that skip canvas drawing (panning, dragging).
- Render a floating `<div>` only when `isDrawing && startPoint && dragPoint && mouseClientPos`. Position it with `style={{ left: mouseClientPos.x + 16, top: mouseClientPos.y + 16 }}`.
- Display: length (model coords), angle (0–360, Y-down convention), and snap label from `snapPoint?.type`.
- The HUD `<div>` must have `pointer-events: none` so it never intercepts canvas events.
- **Note on coordinate spaces**: length/angle come from model-space (`startPoint`/`dragPoint`); the `<div>` is placed in screen-space (`mouseClientPos`). Do not mix them.

**OSNAP dropdown:**

- Destructure `snapModes` and `toggleSnapMode` from `useDrawingStore`.
- Add `showSnapSettings` boolean state and `snapSettingsRef` ref.
- Add `snapSettingsRef` to the existing `handleClickOutside` effect so the dropdown closes on outside click (reuse the existing pattern — no second `useEffect` needed).
- Add a compact `OSNAP` button next to the existing `SNAP` button in the header snap-controls group. Clicking it toggles `showSnapSettings`.
- The dropdown lists the 6 supported modes: Endpoint, Midpoint, Center, Intersection, Grid, Nearest. Each row is a checkbox calling `toggleSnapMode`.

---

## Verification Plan

### Automated Tests
#### [NEW] [snap.test.ts](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/frontend/src/canvas/snap.test.ts)
- `snapNearest` projecting cursor onto a horizontal line segment → projects to y=0.
- `snapNearest` choosing the closest segment when two candidates exist.
- `snapNearest` using wall segments passed as the optional parameter.
- `findNearestSnap` respects `snapModes.nearest = false` (returns null).
- `findNearestSnap` respects `snapModes.nearest = true` (returns nearest result).
- Toggling `nearest` mode in the store via `toggleSnapMode` updates `snapModes` correctly.
- Keep OSNAP tests in this file, separate from `dxf.test.ts`.

### Manual Verification
1. Select the Line tool and start drawing. Verify the HUD follows the cursor and updates length and angle continuously.
2. Hover near an endpoint, midpoint, center, and intersection candidate. Verify both the canvas indicator and the HUD label show the same snap type.
3. Toggle `Nearest` on in the OSNAP dropdown and hover near:
   - a plain line
   - a polyline edge
   - a wall centerline (if an architectural plan is loaded)
   Verify the orange X marker appears and snaps to the projected point on the segment.
4. Toggle `Nearest` off and verify the marker disappears.
5. Run the `SNAP` command with no arguments and verify the active-mode output matches the header dropdown state exactly.
6. Run `SNAP nearest` and verify the mode toggles successfully and the help text includes `nearest`.
7. Run `SNAP bogus` and verify the error message lists all six supported modes including `intersection` and `nearest`.
