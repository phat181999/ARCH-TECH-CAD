# Implementation Plan: 3D View for Multi-Sheet DXF Drawings

**Date:** 2026-06-15  
**Spec:** `docs/superpowers/specs/2026-06-15-3d-dxf-rendering-design.md`

## Problem

The canvas shows multiple drawing types on one sheet — floor plans, elevations, sections, stair details. The current "all lines = walls" heuristic extrudes everything, producing garbage 3D geometry for elevation and section views.

Two improvements are needed:
1. **Layer-name classification** — DXF files carry standard layer names (AIA/NCS: `A-WALL`, `A-DOOR`, `S-COLS`, `A-ANNO-TEXT`). Map these to `archType` instead of extruding everything blindly.
2. **Floor plan region selection** — let the user draw a box around the floor plan view. Only elements inside that box feed the 3D scene.

---

## Phase 1 — Layer-name archType inference

**File:** `frontend/src/canvas/3d/geometry/planClassification.ts`

### Step 1.1 — Add `inferArchTypeFromLayer`

```ts
export function inferArchTypeFromLayer(layerId: string): DrawingElement["archType"] | undefined
```

Match `layerId.toUpperCase()` against AIA/NCS keyword substrings:

| Layer keyword(s) | archType |
|---|---|
| `WALL` | `"wall"` |
| `DOOR` | `"door"` |
| `WIND`, `GLAZ`, `CURT` | `"window"` |
| `ROOM`, `AREA`, `SPCE` | `"room"` |
| `FLOR`, `SLAB` | `"floor"` |
| `GRID`, `COLS`, `BEAM` | `"grid"` |
| `DIM`, `TEXT`, `NOTE`, `ANNO`, `SYMB`, `LABL`, `MARK` | skip — return `undefined`, render flat |
| `STAIR`, `EQPM`, `FURN` | skip — render flat |
| `HATCH`, `PATT` | skip — render flat |

Return `undefined` for anything not matched → falls through to flat render.

### Step 1.2 — Replace `heuristicClassifyWalls` with `layerClassify`

```ts
export function layerClassify(elements: DrawingElement[]): {
  walls: DrawingElement[];
  doors: DrawingElement[];
  windows: DrawingElement[];
  loose: DrawingElement[];
}
```

For each element:
- `inferred = inferArchTypeFromLayer(el.layerId)`
- If `inferred === "wall"` AND `el.type === "line"` → walls
- If `inferred === "door"` → doors  
- If `inferred === "window"` → windows
- If `inferred === undefined` → loose (flat render)
- Fallback when layer gives no signal: same as now (line → wall)

### Step 1.3 — Update `PlanModel` in `ThreeViewer.tsx`

Replace the `heuristicClassifyWalls` call with `layerClassify`. Wire doors and windows into their existing `DoorMesh` / `FlatElementMesh` renderers.

**Verify:** `npx tsc --noEmit` passes.

---

## Phase 2 — Floor plan region selection

### Step 2.1 — Add region state to `ThreeViewer`

```ts
const [floorPlanRegion, setFloorPlanRegion] = useState<{
  minX: number; minZ: number; maxX: number; maxZ: number;
} | null>(null);
```

Filter elements passed to `PlanModel`:
```ts
const sceneElements = floorPlanRegion
  ? elements.filter(el => elementInRegion(el, floorPlanRegion))
  : elements;
```

`elementInRegion` checks the element's bounding coordinates against the region box (reuse logic from `getPlanBounds` per-element).

### Step 2.2 — Add "Pick Floor Plan" tool to `ThreeToolbar`

New tool button: `floor-pick` icon (a crosshair/selection box).

When active:
- Switch back to 2D mode overlay is NOT needed — instead, show a semi-transparent **region selector overlay** rendered on top of the 3D canvas (absolute-positioned div with mouse drag logic).
- On mouse down → record start point in canvas coordinates
- On mouse up → compute bounding box in drawing coordinates (invert the 2D pan/zoom from `drawingStore`) → set `floorPlanRegion`

### Step 2.3 — Region overlay component

**File:** `frontend/src/components/ThreeViewer.tsx` (inline, <50 lines)

```tsx
function RegionSelector({ onSelect }: { onSelect: (r: Region) => void }) {
  // mouse drag → absolute div with dashed border
  // on mouseup → call onSelect with pixel rect
  // parent converts pixel rect → drawing coords via panOffset/zoom
}
```

Coordinate conversion from screen pixels → drawing units:
```ts
drawingX = (screenX - panOffset.x) / zoom
```
Read `panOffset` and `zoom` from `useDrawingStore`.

### Step 2.4 — Reset button

Add a "Reset region" button next to the floor-pick tool. Sets `floorPlanRegion` to `null` → all elements render again.

---

## Phase 3 — Annotation layer visibility toggle (optional, low priority)

Add a toggle in `ThreeToolbar`: "Show annotations". When off, elements whose `inferArchTypeFromLayer` returns `undefined` AND whose layer name contains annotation keywords are hidden entirely (not even rendered flat). Reduces visual noise for drawings with many dimension and text layers.

---

## Verification

| Check | Expected |
|---|---|
| Import DXF with A-WALL/A-DOOR layers → 3D | Walls extruded, doors rendered, text flat |
| Import DXF with no standard layers → 3D | Falls back to current: lines as walls |
| Select floor plan region → 3D | Only elements in box render |
| Reset region | All elements render again |
| `npx tsc --noEmit` | Zero new errors |
| Hand-drawn `archType="wall"` elements | Unchanged — existing branch still fires first |

## File change summary

| File | Change |
|---|---|
| `canvas/3d/geometry/planClassification.ts` | Add `inferArchTypeFromLayer`, replace `heuristicClassifyWalls` with `layerClassify` |
| `components/ThreeViewer.tsx` | Wire `layerClassify`, add `floorPlanRegion` state, `RegionSelector`, region filter |
| `canvas/3d/components/ThreeViewerUI.tsx` | Add `floor-pick` + reset buttons to `ThreeToolbar` |
