# 3D View Fix — DXF Scale & Auto-Extrusion

**Date:** 2026-06-15  
**Status:** Approved

## Problem

Switching from 2D → 3D shows an empty grey canvas for DXF-imported drawings, even when thousands of elements exist.

Two distinct root causes:

1. **Fog/far clipping** — DXF coordinates are stored raw (no normalization). A floor plan drawn in mm sits at coordinates like X=−428,803. The Three.js scene has `fog far=900` and `camera far=4000`. The camera (positioned correctly by AutoFrame) is ~1M units from the geometry — everything clips to solid grey.

2. **No wall classification** — `classifyPlan()` only recognises elements tagged `archType="wall"`. DXF imports produce raw lines with no `archType`, so `PlanModel` finds no walls and falls through to the flat-render path, which is still invisible due to problem #1.

## Confirmed Non-Issues

- `getPlanBounds` — already handles all element types (lines, polylines, arcs, circles, text, blocks). No change needed.
- `AutoFrame` — already repositions the camera relative to bounds on mount. No change needed.
- `FlatElementMesh` — renders lines, polylines, arcs, circles, rectangles. No change needed.
- `CanvasEditor` — no 3D logic should move here. No change needed.

## Design

### Approach: Scale-aware rendering + all-lines-as-walls fallback

Contained to two files. No changes to import pipeline, 2D canvas, or existing archType-tagged flow.

---

### 1. `planClassification.ts` — new export

```ts
export function heuristicClassifyWalls(elements: DrawingElement[]): {
  walls: DrawingElement[];
  loose: DrawingElement[];
}
```

- `walls`: all elements where `type === "line"` (DXF lines/polylines are imported as lines)
- `loose`: everything else (circles, arcs, text, blocks)
- No threshold math — all lines become walls per user decision

---

### 2. `ThreeViewer.tsx` — three targeted edits

**Edit A — Dynamic `far` on Canvas**

In `ThreeViewer` component body, compute span from `getPlanBounds(elements)`:

```ts
const canvasBounds = useMemo(() => getPlanBounds(elements), [elements]);
const canvasFar = canvasBounds
  ? Math.max(4000, (Math.max(
      canvasBounds.maxX - canvasBounds.minX,
      canvasBounds.maxZ - canvasBounds.minZ
    )) * 4)
  : 4000;
```

Pass to Canvas: `camera={{ position: [760, 420, 760], fov: 42, near: 0.1, far: canvasFar }}`

**Edit B — Scale-aware fog in `Scene`**

Replace hardcoded `<fog args={["#e5e7eb", 250, 900]} />` with bounds-relative values:

```ts
const span = bounds
  ? Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ, 200)
  : 800;
const fogNear = span * 0.5;
const fogFar = span * 3;
// <fog args={["#e5e7eb", fogNear, fogFar]} />
```

**Edit C — Heuristic wall fallback in `PlanModel`**

After the existing "no shell, no tagged walls" branch that renders everything flat, add:

```
if (no elements have any archType) {
  const { walls, loose } = heuristicClassifyWalls(elements)
  // extrude walls via buildWallSegmentsFromSemanticWalls
  // render loose as FlatElementMesh
}
```

Trigger condition: `elements.every(el => !el.archType)` — only fires for pure DXF imports.

---

## Verification

1. Import a DXF file → switch to 3D → building visible (extruded walls), not grey
2. Hand-drawn walls with `archType="wall"` still work as before (existing branch fires first)
3. Empty canvas → 3D shows empty scene (bounds=null, fog falls back to 250/900)
4. `cd frontend && npx tsc --noEmit` passes
