# 3D-First Views (Auto-Generated 2D from 3D) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Views" tab that renders plan / 4 elevations / user-defined section cuts live from the 3D model (`elements[]`), with auto-dimensioning and per-view PNG export — 3D stays the primary drawing surface, the existing 2D hand-drawing tab is untouched.

**Architecture:** A new standalone, lightweight R3F `<Canvas>` component (`ViewRenderer`) builds line-art wall/roof geometry directly from `elements[]` through a fixed orthographic camera (extended `sheetFrustum`), independent of the interactive `ThreeViewer.tsx` scene (matches the original 3D-first doc's explicit rationale: a separate embedded Canvas avoids destabilizing the interactive viewer). A new `ViewsPanel` tab hosts a thumbnail grid of `ViewRenderer` instances, an expand-to-fullsize view with dimension-line overlay, section-cut drawing (2-click raycasting against the plan `ViewRenderer`'s own ground plane, same technique as the existing `RidgeLineController`), and per-view PNG export.

**Tech Stack:** React 19 + TypeScript, @react-three/fiber, @react-three/drei, three.js, Zustand, vitest.

**Spec:** `docs/superpowers/specs/2026-07-08-3d-first-views-design.md`

## Global Constraints

- All frontend paths below are relative to `autocard/frontend/` unless prefixed otherwise.
- Type-check after every task: `cd autocard/frontend && npx tsc --noEmit` — must stay clean (the pre-existing error in `src/pages/StoreOrderPage.tsx:493` is ignorable).
- Unit tests: `cd autocard/frontend && npx vitest run <file>`.
- Coordinate conventions (from `src/canvas/3d/geometry/coordBridge.ts`): 2D drawing coords are pixels (X right, Y down); 3D world maps X→X, Y→Z; 100 scene units = 1 m. `Center = { cx, cz }` converts between them via `worldToDrawing`/`drawingToWorld`.
- `sheetFrustum`'s `bounds` parameter is always **already local** (origin-centered — the plan center subtracted out), matching how `ThreeViewer.tsx`'s `sheetBounds` is computed today. New code must follow the same convention: compute raw bounds, subtract center, pass local bounds to `sheetFrustum`.
- Frontend tools only call store methods — never direct API calls.
- Do NOT touch `src/cad/` (the new, parallel CAD system) or `ThreeViewer.tsx`'s drawing tools/controllers, or `DrawingSheetExporter.tsx` (kept as-is for the existing 3D-tab quick-export). Do NOT change the existing `Mô hình 2D` tab's toolset.
- Match existing code style; commit after every task.

---

### Task 1: Extend `sheetFrustum` with elevation-N/S/E/W and section views

**Files:**
- Modify: `src/canvas/3d/geometry/sheetCamera.ts`
- Test: `src/canvas/3d/geometry/sheetCamera.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces (used by Tasks 4, 6, 7): `SheetView` gains `"elevation-N" | "elevation-S" | "elevation-E" | "elevation-W" | "section"` (in addition to the existing `"plan" | "front" | "side"`, which are untouched — `DrawingSheetExporter.tsx` keeps using them unchanged). `sheetFrustum` gains an optional 6th parameter `sectionLine?: { x1: number; z1: number; x2: number; z2: number }` (already-local scene coords, same convention as `bounds`) — required only when `view === "section"`, and the function throws a descriptive `Error` if `view === "section"` and `sectionLine` is omitted.

- [x] **Step 1: Write the failing tests**

```ts
// src/canvas/3d/geometry/sheetCamera.test.ts (add to the existing file — do not remove the 3 existing tests)
import { describe, it, expect } from "vitest";
import { sheetFrustum } from "./sheetCamera";

const bounds = { minX: -500, maxX: 500, minZ: -300, maxZ: 300 };

// ... existing 3 "plan"/"front"/"side" tests stay unchanged above this line ...

describe("sheetFrustum — elevation-N/S/E/W", () => {
  it("elevation-N looks south from beyond +Z (matches the existing 'front' math)", () => {
    const f = sheetFrustum(bounds, "elevation-N", 260, 400, 100);
    expect(f.position[2]).toBeGreaterThan(bounds.maxZ);
    expect(f.top - f.bottom).toBeCloseTo(260 + 400 + 200);
    expect(f.right - f.left).toBeCloseTo(1000 + 200);
  });

  it("elevation-S looks north from beyond -Z (mirror of elevation-N)", () => {
    const f = sheetFrustum(bounds, "elevation-S", 260, 400, 100);
    expect(f.position[2]).toBeLessThan(bounds.minZ);
    expect(f.top - f.bottom).toBeCloseTo(260 + 400 + 200);
    expect(f.right - f.left).toBeCloseTo(1000 + 200);
  });

  it("elevation-E looks west from beyond +X (matches the existing 'side' math)", () => {
    const f = sheetFrustum(bounds, "elevation-E", 260, 400, 100);
    expect(f.position[0]).toBeGreaterThan(bounds.maxX);
    expect(f.right - f.left).toBeCloseTo(600 + 200);
  });

  it("elevation-W looks east from beyond -X (mirror of elevation-E)", () => {
    const f = sheetFrustum(bounds, "elevation-W", 260, 400, 100);
    expect(f.position[0]).toBeLessThan(bounds.minX);
    expect(f.right - f.left).toBeCloseTo(600 + 200);
  });
});

describe("sheetFrustum — section", () => {
  it("positions the camera along the cut line's normal, looking at its midpoint", () => {
    const line = { x1: 0, z1: 0, x2: 100, z2: 0 }; // horizontal line along X
    const f = sheetFrustum(bounds, "section", 260, 400, 100, line);
    expect(f.target).toEqual([50, expect.any(Number), 0]);
    expect(f.position[0]).toBeCloseTo(50);
    expect(f.position[2]).toBeGreaterThan(0); // normal of a horizontal line points along +Z
    expect(f.right - f.left).toBeCloseTo(100 + 200); // line length + margin
  });

  it("throws when view is 'section' without a sectionLine", () => {
    expect(() => sheetFrustum(bounds, "section", 260)).toThrow(/sectionLine/);
  });
});
```

- [x] **Step 2: Run the tests to verify the new ones fail**

Run: `cd autocard/frontend && npx vitest run src/canvas/3d/geometry/sheetCamera.test.ts`
Expected: the 3 existing tests PASS, the 6 new ones FAIL (unknown `SheetView` members / no 6th parameter).

- [x] **Step 3: Implement**

Replace the full contents of `src/canvas/3d/geometry/sheetCamera.ts`:

```ts
// Orthographic camera frusta for exporting 2D sheets (mặt bằng / mặt đứng)
// from the 3D model. Bounds are the origin-centered local bounds the Scene
// renders in (drawing units, 100 = 1 m).
//
// "N/S/E/W" here are axis-aligned labels only (+Z/-Z/+X/-X) — the data model
// has no true geographic orientation, so these are just four fixed viewing
// directions, not a compass reference.
export type SheetView = "plan" | "front" | "side" | "elevation-N" | "elevation-S" | "elevation-E" | "elevation-W" | "section";
export interface SheetFrustum {
  left: number; right: number; top: number; bottom: number;
  position: [number, number, number];
  up: [number, number, number];
  target: [number, number, number];
}
export interface SectionLine { x1: number; z1: number; x2: number; z2: number }

export function sheetFrustum(
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
  view: SheetView,
  wallHeight: number,
  roofAllowance = 400,
  margin = 100,
  sectionLine?: SectionLine,
): SheetFrustum {
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;
  const halfX = (bounds.maxX - bounds.minX) / 2 + margin;
  const halfZ = (bounds.maxZ - bounds.minZ) / 2 + margin;
  const halfH = (wallHeight + roofAllowance) / 2 + margin;
  const midY = (wallHeight + roofAllowance) / 2;

  if (view === "plan") {
    return {
      left: -halfX, right: halfX, top: halfZ, bottom: -halfZ,
      position: [cx, 5000, cz], up: [0, 0, -1], target: [cx, 0, cz],
    };
  }
  if (view === "front" || view === "elevation-N") {
    return {
      left: -halfX, right: halfX, top: halfH, bottom: -halfH,
      position: [cx, midY, bounds.maxZ + 2000], up: [0, 1, 0], target: [cx, midY, cz],
    };
  }
  if (view === "elevation-S") {
    return {
      left: -halfX, right: halfX, top: halfH, bottom: -halfH,
      position: [cx, midY, bounds.minZ - 2000], up: [0, 1, 0], target: [cx, midY, cz],
    };
  }
  if (view === "side" || view === "elevation-E") {
    return {
      left: -halfZ, right: halfZ, top: halfH, bottom: -halfH,
      position: [bounds.maxX + 2000, midY, cz], up: [0, 1, 0], target: [cx, midY, cz],
    };
  }
  if (view === "elevation-W") {
    return {
      left: -halfZ, right: halfZ, top: halfH, bottom: -halfH,
      position: [bounds.minX - 2000, midY, cz], up: [0, 1, 0], target: [cx, midY, cz],
    };
  }
  // view === "section"
  if (!sectionLine) throw new Error("sheetFrustum: sectionLine is required for view 'section'");
  const dx = sectionLine.x2 - sectionLine.x1, dz = sectionLine.z2 - sectionLine.z1;
  const len = Math.hypot(dx, dz);
  const midX = (sectionLine.x1 + sectionLine.x2) / 2, midZ = (sectionLine.z1 + sectionLine.z2) / 2;
  const nx = -dz / len, nz = dx / len; // unit normal, perpendicular to the cut line
  const halfLen = len / 2 + margin;
  return {
    left: -halfLen, right: halfLen, top: halfH, bottom: -halfH,
    position: [midX + nx * 2000, midY, midZ + nz * 2000],
    up: [0, 1, 0],
    target: [midX, midY, midZ],
  };
}
```

- [x] **Step 4: Run the tests to verify they pass**

Run: `cd autocard/frontend && npx vitest run src/canvas/3d/geometry/sheetCamera.test.ts`
Expected: PASS (9 tests — 3 existing + 6 new).

- [x] **Step 5: Type-check and commit**

```bash
cd autocard/frontend && npx tsc --noEmit
git add src/canvas/3d/geometry/sheetCamera.ts src/canvas/3d/geometry/sheetCamera.test.ts
git commit -m "feat(views): extend sheetFrustum with elevation-N/S/E/W and section cameras"
```

---

### Task 2: Section-cut label helper + `sceneSlice.sectionCuts` store field

**Files:**
- Create: `src/canvas/3d/geometry/sectionCutLabel.ts`
- Test: `src/canvas/3d/geometry/sectionCutLabel.test.ts`
- Modify: `src/stores/slices/sceneSlice.ts`

**Interfaces:**
- Consumes: `RidgeLine` type from `src/canvas/3d/geometry/roofRidge.ts` (already exists — reused as the section-cut line shape, same `{x1,y1,x2,y2}` drawing-coords shape).
- Produces (used by Tasks 6, 7): `nextSectionCutLabel(existingCount: number): string`; store gains `sectionCuts: { id: string; label: string; line: RidgeLine }[]`, `addSectionCut(line: RidgeLine): void`, `removeSectionCut(id: string): void`.

- [x] **Step 1: Write the failing test**

```ts
// src/canvas/3d/geometry/sectionCutLabel.test.ts
import { describe, it, expect } from "vitest";
import { nextSectionCutLabel } from "./sectionCutLabel";

describe("nextSectionCutLabel", () => {
  it("labels the first cut A-A", () => expect(nextSectionCutLabel(0)).toBe("A-A"));
  it("labels the second cut B-B", () => expect(nextSectionCutLabel(1)).toBe("B-B"));
  it("labels the 26th cut Z-Z", () => expect(nextSectionCutLabel(25)).toBe("Z-Z"));
  it("wraps back to A-A after Z-Z", () => expect(nextSectionCutLabel(26)).toBe("A-A"));
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `cd autocard/frontend && npx vitest run src/canvas/3d/geometry/sectionCutLabel.test.ts`
Expected: FAIL — cannot resolve `./sectionCutLabel`.

- [x] **Step 3: Implement**

```ts
// src/canvas/3d/geometry/sectionCutLabel.ts
// Auto-labels section cuts A-A, B-B, C-C... in creation order.
export function nextSectionCutLabel(existingCount: number): string {
  const letter = String.fromCharCode(65 + (existingCount % 26));
  return `${letter}-${letter}`;
}
```

- [x] **Step 4: Run the test to verify it passes**

Run: `cd autocard/frontend && npx vitest run src/canvas/3d/geometry/sectionCutLabel.test.ts`
Expected: PASS (4 tests).

- [x] **Step 5: Add the store field**

In `src/stores/slices/sceneSlice.ts`:
- Add the import: `import { nextSectionCutLabel } from "../../canvas/3d/geometry/sectionCutLabel";`
- To the `SceneSlice` interface, add (near `roofRidge`):
```ts
  sectionCuts: { id: string; label: string; line: RidgeLine }[];
```
and (near `setRoofRidge`):
```ts
  addSectionCut(line: RidgeLine): void;
  removeSectionCut(id: string): void;
```
- To the creator, add the initial value (near `roofRidge: null,`):
```ts
  sectionCuts: [],
```
and the actions (near `setRoofRidge: (roofRidge) => set({ roofRidge }),`):
```ts
  addSectionCut: (line) => set((s) => ({
    sectionCuts: [...s.sectionCuts, { id: `cut-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, label: nextSectionCutLabel(s.sectionCuts.length), line }],
  })),
  removeSectionCut: (id) => set((s) => ({ sectionCuts: s.sectionCuts.filter((c) => c.id !== id) })),
```

- [x] **Step 6: Type-check and commit**

```bash
cd autocard/frontend && npx tsc --noEmit
git add src/canvas/3d/geometry/sectionCutLabel.ts src/canvas/3d/geometry/sectionCutLabel.test.ts src/stores/slices/sceneSlice.ts
git commit -m "feat(views): section-cut label helper + sceneSlice.sectionCuts store field"
```

---

### Task 3: Auto-dimensioning

**Files:**
- Create: `src/canvas/3d/geometry/autoDimension.ts`
- Test: `src/canvas/3d/geometry/autoDimension.test.ts`

**Interfaces:**
- Consumes: `DrawingElement` from `src/types.ts`.
- Produces (used by Task 5): `interface DimensionLine { x1: number; y1: number; x2: number; y2: number; label: string }`; `generateDimensions(walls: DrawingElement[]): DimensionLine[]`.

- [x] **Step 1: Write the failing tests**

```ts
// src/canvas/3d/geometry/autoDimension.test.ts
import { describe, it, expect } from "vitest";
import { generateDimensions } from "./autoDimension";
import type { DrawingElement } from "../../../types";

describe("generateDimensions", () => {
  it("returns nothing for an empty wall list", () => {
    expect(generateDimensions([])).toEqual([]);
  });

  it("emits one per-wall line plus 2 overall lines for a single wall", () => {
    const wall: DrawingElement = { id: "w1", type: "line", layerId: "0", archType: "wall", x1: 0, y1: 0, x2: 100, y2: 0 };
    const lines = generateDimensions([wall]);
    expect(lines).toHaveLength(3);
    expect(lines[0].label).toBe("1.00m"); // 100 units = 1m, per-wall
  });

  it("labels the overall width/height chains from the wall bounding box", () => {
    const a: DrawingElement = { id: "w1", type: "line", layerId: "0", archType: "wall", x1: 0, y1: 0, x2: 100, y2: 0 };
    const b: DrawingElement = { id: "w2", type: "line", layerId: "0", archType: "wall", x1: 0, y1: 0, x2: 0, y2: 50 };
    const lines = generateDimensions([a, b]);
    const overall = lines.slice(-2);
    expect(overall.map((l) => l.label).sort()).toEqual(["0.50m", "1.00m"]);
  });

  it("offsets each per-wall dimension line away from the footprint's center", () => {
    // Two parallel walls forming a 100x50 rectangle's long sides — each
    // dimension line must sit on the outside of its own wall, not overlap it.
    const north: DrawingElement = { id: "n", type: "line", layerId: "0", archType: "wall", x1: 0, y1: 0, x2: 100, y2: 0 };
    const south: DrawingElement = { id: "s", type: "line", layerId: "0", archType: "wall", x1: 0, y1: 50, x2: 100, y2: 50 };
    const [nDim, sDim] = generateDimensions([north, south]);
    expect(nDim.y1).toBeLessThan(0);    // pushed further north (away from center at y=25)
    expect(sDim.y1).toBeGreaterThan(50); // pushed further south
  });

  it("ignores walls missing endpoint coordinates instead of throwing", () => {
    const bad: DrawingElement = { id: "bad", type: "line", layerId: "0", archType: "wall" };
    expect(generateDimensions([bad])).toEqual([]);
  });
});
```

- [x] **Step 2: Run the tests to verify they fail**

Run: `cd autocard/frontend && npx vitest run src/canvas/3d/geometry/autoDimension.test.ts`
Expected: FAIL — cannot resolve `./autoDimension`.

- [x] **Step 3: Implement**

```ts
// src/canvas/3d/geometry/autoDimension.ts
// Auto-generates dimension lines from wall elements for the Views tab: one
// line per wall (offset outward, parallel to the wall) plus two overall
// chains (total width along the top, total height along the left), each
// labeled with its length in meters.
//
// v1 scope: walls only (no doors/windows), line-type walls only (polyline
// walls lack x1/y1/x2/y2 and are silently skipped), no per-room chains yet
// — see the design spec's non-goals.
import type { DrawingElement } from "../../../types";

export interface DimensionLine {
  x1: number; y1: number; x2: number; y2: number;
  label: string;
}

const PER_WALL_OFFSET = 30;   // drawing units outward from each wall
const OVERALL_OFFSET = 80;    // drawing units outward for the overall chains

function fmt(units: number): string {
  return `${(units / 100).toFixed(2)}m`;
}

export function generateDimensions(walls: DrawingElement[]): DimensionLine[] {
  const usable = walls.filter(
    (w): w is DrawingElement & { x1: number; y1: number; x2: number; y2: number } =>
      w.x1 != null && w.y1 != null && w.x2 != null && w.y2 != null,
  );
  if (usable.length === 0) return [];

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const w of usable) {
    minX = Math.min(minX, w.x1, w.x2); maxX = Math.max(maxX, w.x1, w.x2);
    minY = Math.min(minY, w.y1, w.y2); maxY = Math.max(maxY, w.y1, w.y2);
  }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;

  const lines: DimensionLine[] = [];

  for (const w of usable) {
    const dx = w.x2 - w.x1, dy = w.y2 - w.y1;
    const len = Math.hypot(dx, dy);
    if (len < 1) continue;
    const midX = (w.x1 + w.x2) / 2, midY = (w.y1 + w.y2) / 2;
    // Perpendicular unit normal, flipped to point away from the footprint's
    // center so the dimension line sits outside the building, not through it.
    let nx = -dy / len, ny = dx / len;
    if ((midX - cx) * nx + (midY - cy) * ny < 0) { nx = -nx; ny = -ny; }
    const ox = nx * PER_WALL_OFFSET, oy = ny * PER_WALL_OFFSET;
    lines.push({ x1: w.x1 + ox, y1: w.y1 + oy, x2: w.x2 + ox, y2: w.y2 + oy, label: fmt(len) });
  }

  // Overall width — along the top edge (minY side), offset further out.
  lines.push({ x1: minX, y1: minY - OVERALL_OFFSET, x2: maxX, y2: minY - OVERALL_OFFSET, label: fmt(maxX - minX) });
  // Overall height — along the left edge (minX side), offset further out.
  lines.push({ x1: minX - OVERALL_OFFSET, y1: minY, x2: minX - OVERALL_OFFSET, y2: maxY, label: fmt(maxY - minY) });

  return lines;
}
```

- [x] **Step 4: Run the tests to verify they pass**

Run: `cd autocard/frontend && npx vitest run src/canvas/3d/geometry/autoDimension.test.ts`
Expected: PASS (5 tests).

- [x] **Step 5: Type-check and commit**

```bash
cd autocard/frontend && npx tsc --noEmit
git add src/canvas/3d/geometry/autoDimension.ts src/canvas/3d/geometry/autoDimension.test.ts
git commit -m "feat(views): auto-dimensioning — per-wall + overall dimension chains"
```

---

### Task 4: `ViewRenderer` — standalone line-art view (plan + elevations)

**Files:**
- Create: `src/canvas/3d/components/ViewRenderer.tsx`

**Interfaces:**
- Consumes: `sheetFrustum`, `SheetView`, `SectionLine` (Task 1); `getPlanBounds` from `src/canvas/3d/geometry/planClassification.ts` (existing); `buildWallSegmentsFromSemanticWalls` from `src/canvas/3d/geometry/wallGeometry.ts` (existing); `RoofGenerator` from `src/canvas/3d/geometry/RoofGenerator.ts` (existing).
- Produces (used by Tasks 5, 6, 7): `<ViewRenderer elements center? view width height wallHeight roofType? roofPitch? sectionLine? />`. `sectionLine` here is in **local scene coords** (`{x1,z1,x2,z2}`), unlike `sceneSlice.sectionCuts[].line` which is in drawing coords — callers convert (Task 7 does this conversion at the call site).

- [x] **Step 1: Implement**

```tsx
// src/canvas/3d/components/ViewRenderer.tsx
// Standalone line-art renderer for the Views tab — a separate, lightweight
// <Canvas> (not the interactive 3D viewer's scene) that draws walls/roof as
// edge-only geometry through a fixed orthographic camera. Kept independent
// of ThreeViewer.tsx on purpose (matches the 3D-first doc's Phase 1B:
// "embedded Canvas riêng... không dùng chung với 3D scene để tránh
// conflict") so nothing here can destabilize the interactive 3D viewer.
import { useEffect, useMemo } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Edges } from "@react-three/drei";
import type { DrawingElement } from "../../../types";
import { getPlanBounds } from "../geometry/planClassification";
import { buildWallSegmentsFromSemanticWalls } from "../geometry/wallGeometry";
import { RoofGenerator, type RoofType } from "../geometry/RoofGenerator";
import { sheetFrustum, type SheetView, type SectionLine } from "../geometry/sheetCamera";

const LINE_COLOR = "#1f2937";

function CameraAim({ target, up }: { target: [number, number, number]; up: [number, number, number] }) {
  const { camera } = useThree();
  useEffect(() => {
    camera.up.set(...up);
    camera.lookAt(...target);
    camera.updateProjectionMatrix();
  }, [camera, target, up]);
  return null;
}

export interface ViewRendererProps {
  elements: DrawingElement[];
  view: SheetView;
  sectionLine?: SectionLine;
  width: number;
  height: number;
  wallHeight: number;
  roofType?: RoofType;
  roofPitch?: number;
}

export function ViewRenderer({ elements, view, sectionLine, width, height, wallHeight, roofType = "gable", roofPitch = 30 }: ViewRendererProps) {
  const rawBounds = useMemo(() => getPlanBounds(elements), [elements]);
  const walls = useMemo(
    () => elements.filter((el) => el.archType === "wall" && (el.type === "line" || el.type === "polyline")),
    [elements],
  );
  const segments = useMemo(() => buildWallSegmentsFromSemanticWalls(walls), [walls]);

  if (!rawBounds) {
    return (
      <div style={{ width, height }} className="flex items-center justify-center text-[10px] text-slate-500 bg-white rounded">
        Chưa có gì để hiển thị
      </div>
    );
  }

  const cx = (rawBounds.minX + rawBounds.maxX) / 2;
  const cz = (rawBounds.minZ + rawBounds.maxZ) / 2;
  const localBounds = { minX: rawBounds.minX - cx, maxX: rawBounds.maxX - cx, minZ: rawBounds.minZ - cz, maxZ: rawBounds.maxZ - cz };
  const frustum = sheetFrustum(localBounds, view, wallHeight, 400, 100, sectionLine);
  const footprintWidth = Math.max(1, localBounds.maxX - localBounds.minX);
  const footprintDepth = Math.max(1, localBounds.maxZ - localBounds.minZ);
  const roofGeometry = useMemo(
    () => (view === "plan" ? null : RoofGenerator.generate(roofType, localBounds.minX, localBounds.minZ, footprintWidth, footprintDepth, wallHeight, roofPitch)),
    [view, roofType, localBounds.minX, localBounds.minZ, footprintWidth, footprintDepth, wallHeight, roofPitch],
  );

  return (
    <Canvas
      style={{ width, height, background: "#ffffff" }}
      orthographic
      camera={{ left: frustum.left, right: frustum.right, top: frustum.top, bottom: frustum.bottom, near: 0.1, far: 20000, position: frustum.position, up: frustum.up }}
    >
      <CameraAim target={frustum.target} up={frustum.up} />
      <group position={[-cx, 0, -cz]}>
        {segments.map((seg) => (
          <mesh key={seg.id} position={[seg.centerX, (seg.heightOverride ?? wallHeight) / 2, seg.centerZ]}>
            <boxGeometry args={[seg.width, seg.heightOverride ?? wallHeight, seg.depth]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            <Edges color={LINE_COLOR} />
          </mesh>
        ))}
        {roofGeometry && (
          <mesh geometry={roofGeometry}>
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            <Edges color={LINE_COLOR} />
          </mesh>
        )}
      </group>
    </Canvas>
  );
}
```

- [x] **Step 2: Type-check**

Run: `cd autocard/frontend && npx tsc --noEmit` — clean.

- [x] **Step 3: Manual smoke test**

Add a temporary render of `<ViewRenderer elements={useDrawingStore.getState().elements} view="plan" width={400} height={300} wallHeight={260} />` anywhere currently mounted (e.g. temporarily in `App.tsx`) to confirm it renders wall outlines as black lines on white with no console errors, then remove the temporary mount — this is a throwaway check, not part of the final wiring (Task 7 does the real mount).

- [x] **Step 4: Commit**

```bash
git add src/canvas/3d/components/ViewRenderer.tsx
git commit -m "feat(views): ViewRenderer — standalone line-art plan/elevation renderer"
```

---

### Task 5: Dimension-line rendering in `ViewRenderer`

**Files:**
- Modify: `src/canvas/3d/components/ViewRenderer.tsx`

**Interfaces:**
- Consumes: `generateDimensions`, `DimensionLine` (Task 3).
- Produces: `ViewRenderer` gains an optional prop `showDimensions?: boolean` (default `false`) — when true, renders each `DimensionLine` as a scene line with an `<Html>` label at its midpoint, positioned correctly for any camera type since `<Html>` (drei) projects through the active camera automatically.

- [x] **Step 1: Extend the component**

In `src/canvas/3d/components/ViewRenderer.tsx`:

Add imports:
```tsx
import * as THREE from "three";
import { Html } from "@react-three/drei";
import { generateDimensions } from "../geometry/autoDimension";
```

Add the prop to `ViewRendererProps`:
```tsx
  showDimensions?: boolean;
```

Add to the destructured props (with a default):
```tsx
  showDimensions = false,
```

After the `segments`/`roofGeometry` memos, compute the dimension lines (only meaningful for walls, so reuse `walls` already computed above):
```tsx
  const dimensions = useMemo(() => (showDimensions ? generateDimensions(walls) : []), [showDimensions, walls]);
```

Inside the `<group position={[-cx, 0, -cz]}>`, after the roof block, add:
```tsx
        {dimensions.map((d, i) => (
          <group key={i}>
            <primitive object={(() => {
              const geo = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(d.x1, 1, d.y1),
                new THREE.Vector3(d.x2, 1, d.y2),
              ]);
              return new THREE.Line(geo, new THREE.LineBasicMaterial({ color: "#2563eb" }));
            })()} />
            <Html position={[(d.x1 + d.x2) / 2, 1, (d.y1 + d.y2) / 2]} center zIndexRange={[10, 20]}>
              <div className="bg-white/90 text-blue-700 font-mono text-[8px] font-bold px-1 rounded whitespace-nowrap select-none pointer-events-none">
                {d.label}
              </div>
            </Html>
          </group>
        ))}
```

Note: dimension lines use drawing-space `x1,y1,x2,y2` directly as scene `x,_,z` — this is correct because `DimensionLine` coordinates come from `generateDimensions(walls)`, and `walls` here are the *raw* (non-recentered) elements, matching the same raw-coordinate space `segments` are built from before the `<group position={[-cx,0,-cz]}>` wrapper recenters everything. No extra conversion needed.

- [x] **Step 2: Type-check**

Run: `cd autocard/frontend && npx tsc --noEmit` — clean.

- [x] **Step 3: Manual smoke test**

Same throwaway-mount technique as Task 4, this time with `showDimensions` on a drawing with at least one wall — confirm blue dimension lines + white-pill length labels appear outside the wall outlines, positioned correctly (not overlapping the walls).

- [x] **Step 4: Commit**

```bash
git add src/canvas/3d/components/ViewRenderer.tsx
git commit -m "feat(views): render auto-dimension lines and labels in ViewRenderer"
```

---

### Task 6: `SectionCutTool` — draw a section cut on the plan view

**Files:**
- Create: `src/canvas/3d/controllers/SectionCutTool.tsx`
- Modify: `src/canvas/3d/components/ViewRenderer.tsx`

**Interfaces:**
- Consumes: `useToolRaycast` (existing, `src/canvas/3d/interaction/useToolRaycast.ts`); `worldToDrawing`, `Center` (existing, `src/canvas/3d/geometry/coordBridge.ts`).
- Produces: `<SectionCutTool center onCommit={(line: {x1,y1,x2,y2}) => void} />`; `ViewRenderer` gains `drawingSectionCut?: boolean` and `onSectionCutDrawn?: (line: {x1,y1,x2,y2}) => void` props — when `drawingSectionCut` is true (only meaningful when `view === "plan"`), mounts `SectionCutTool` inside its own Canvas so raycasting works against its own ground plane, same technique the existing `RidgeLineController` uses in the interactive 3D viewer.

- [x] **Step 1: Implement the controller**

```tsx
// src/canvas/3d/controllers/SectionCutTool.tsx
// Two clicks on a ViewRenderer's plan-view ground plane define a section cut
// line (drawing coords). Only ever mounted inside the plan ViewRenderer
// instance, only while "add section cut" mode is active. Same 2-click UX and
// raycasting mechanism as RidgeLineController (interactive 3D viewer).
import { useEffect, useState } from "react";
import { Html } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useToolRaycast } from "../interaction/useToolRaycast";
import { worldToDrawing, type Center } from "../geometry/coordBridge";

export function SectionCutTool({ center, onCommit }: {
  center: Center;
  onCommit: (line: { x1: number; y1: number; x2: number; y2: number }) => void;
}) {
  const { raycastGround } = useToolRaycast();
  const { gl } = useThree();
  const [pending, setPending] = useState<THREE.Vector3 | null>(null);
  const [hover, setHover] = useState<THREE.Vector3 | null>(null);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const pt = raycastGround(e);
      if (!pt) return;
      if (!pending) { setPending(pt.clone()); return; }
      const a = worldToDrawing({ x: pending.x, z: pending.z }, center);
      const b = worldToDrawing({ x: pt.x, z: pt.z }, center);
      if (Math.hypot(b.x - a.x, b.y - a.y) < 1) { setPending(null); return; }
      onCommit({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
      setPending(null);
    };
    const onMove = (e: PointerEvent) => setHover(raycastGround(e));
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPending(null); };
    gl.domElement.addEventListener("pointerdown", onDown);
    gl.domElement.addEventListener("pointermove", onMove);
    window.addEventListener("keydown", onKey);
    return () => {
      gl.domElement.removeEventListener("pointerdown", onDown);
      gl.domElement.removeEventListener("pointermove", onMove);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, raycastGround, gl, center, onCommit]);

  return (
    <group>
      {pending && hover && (
        <>
          <primitive object={(() => {
            const geo = new THREE.BufferGeometry().setFromPoints([pending, hover]);
            return new THREE.Line(geo, new THREE.LineBasicMaterial({ color: "#38bdf8" }));
          })()} />
          <Html position={[(pending.x + hover.x) / 2, 20, (pending.z + hover.z) / 2]} center>
            <div className="bg-slate-900/90 text-sky-300 font-mono text-[9px] font-bold px-2 py-0.5 rounded border border-sky-500/30 whitespace-nowrap select-none">
              Click điểm cuối mặt cắt
            </div>
          </Html>
        </>
      )}
      {pending == null && (
        <Html position={[0, 20, 0]} center>
          <div className="bg-slate-900/90 text-sky-300 font-mono text-[9px] font-bold px-2 py-0.5 rounded border border-sky-500/30 whitespace-nowrap select-none">
            Click điểm đầu mặt cắt
          </div>
        </Html>
      )}
    </group>
  );
}
```

Note: the "click điểm đầu" hint is anchored at the scene origin `[0,20,0]` (rather than following the pointer before any click has happened) since there is no `hover` position to anchor to yet — acceptable for v1; it disappears once `pending` is set.

- [x] **Step 2: Host it in `ViewRenderer`**

In `src/canvas/3d/components/ViewRenderer.tsx`:

Add the import: `import { SectionCutTool } from "../controllers/SectionCutTool";`

Add two props to `ViewRendererProps`:
```tsx
  drawingSectionCut?: boolean;
  onSectionCutDrawn?: (line: { x1: number; y1: number; x2: number; y2: number }) => void;
```

Destructure them (with defaults):
```tsx
  drawingSectionCut = false,
  onSectionCutDrawn,
```

Inside the `<group position={[-cx, 0, -cz]}>`, after the dimensions block, add:
```tsx
        {drawingSectionCut && onSectionCutDrawn && (
          <SectionCutTool center={{ cx, cz }} onCommit={onSectionCutDrawn} />
        )}
```

- [x] **Step 3: Type-check**

Run: `cd autocard/frontend && npx tsc --noEmit` — clean.

- [x] **Step 4: Commit**

```bash
git add src/canvas/3d/controllers/SectionCutTool.tsx src/canvas/3d/components/ViewRenderer.tsx
git commit -m "feat(views): SectionCutTool — draw a section cut line on the plan view"
```

---

### Task 7: PNG export from `ViewRenderer`

**Files:**
- Modify: `src/canvas/3d/components/ViewRenderer.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `ViewRenderer` gains `exportRequestId?: number` and `onExported?: () => void` props — when `exportRequestId` changes to a truthy value, downloads the current frame as `<view-label>.png` and calls `onExported()`. Same trigger-prop pattern already used by `DrawingSheetExporter.tsx`'s `trigger` prop.

- [x] **Step 1: Add the export effect**

In `src/canvas/3d/components/ViewRenderer.tsx`:

Add props to `ViewRendererProps`:
```tsx
  exportRequestId?: number;
  onExported?: () => void;
  exportLabel?: string;
```

Destructure with defaults:
```tsx
  exportRequestId = 0,
  onExported,
  exportLabel = "view",
```

Add a small child component that has access to `gl` via `useThree` (the export effect must live *inside* the `<Canvas>` tree, like `CameraAim` does):
```tsx
function ExportOnRequest({ requestId, label, onDone }: { requestId: number; label: string; onDone?: () => void }) {
  const { gl } = useThree();
  const prevId = useRef(0);
  useEffect(() => {
    if (requestId === 0 || requestId === prevId.current) return;
    prevId.current = requestId;
    const url = gl.domElement.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${label}.png`;
    a.click();
    onDone?.();
  }, [requestId, gl, label, onDone]);
  return null;
}
```
Add `import { useRef } from "react";` to the existing `react` import line.

Mount it as a sibling of `CameraAim`, right after it:
```tsx
      <CameraAim target={frustum.target} up={frustum.up} />
      <ExportOnRequest requestId={exportRequestId} label={exportLabel} onDone={onExported} />
```

- [x] **Step 2: Type-check**

Run: `cd autocard/frontend && npx tsc --noEmit` — clean.

- [x] **Step 3: Commit**

```bash
git add src/canvas/3d/components/ViewRenderer.tsx
git commit -m "feat(views): per-view PNG export in ViewRenderer"
```

---

### Task 8: `ViewsPanel` tab + wiring into `EditorHeader`/`CanvasEditor`

**Files:**
- Create: `src/pages/CanvasEditor/components/ViewsPanel.tsx`
- Modify: `src/pages/CanvasEditor/components/EditorHeader.tsx`
- Modify: `src/pages/CanvasEditor.tsx`

**Interfaces:**
- Consumes: `ViewRenderer` (Tasks 4–7); `useDrawingStore` fields `sectionCuts`/`addSectionCut`/`removeSectionCut` (Task 2); `SheetView` (Task 1).
- Produces: `<ViewsPanel elements visible wallHeight />`; `EditorHeader` gains `showViews`/`setShowViews` props (mirroring `showPaperSpace`/`setShowPaperSpace`); `CanvasEditor` gains a `showViews` state slot and mounts the panel.

- [x] **Step 1: Implement `ViewsPanel`**

```tsx
// src/pages/CanvasEditor/components/ViewsPanel.tsx
// "Views" tab: renders plan + 4 elevations + user-defined section cuts, all
// live from the 3D model via ViewRenderer. Click a thumbnail to expand it
// with dimension lines; each view has its own PNG export. Section cuts are
// added by drawing a line on the expanded plan view.
import { useState } from "react";
import { ViewRenderer } from "../../../canvas/3d/components/ViewRenderer";
import { useDrawingStore } from "../../../stores/drawingStore";
import type { DrawingElement } from "../../../types";
import type { SheetView } from "../../../canvas/3d/geometry/sheetCamera";

const THUMB_W = 220, THUMB_H = 160;
const EXPANDED_W = 900, EXPANDED_H = 640;

interface ViewsPanelProps {
  elements: DrawingElement[];
  visible: boolean;
  wallHeight: number;
}

const FIXED_VIEWS: { view: SheetView; label: string }[] = [
  { view: "plan", label: "Mặt bằng" },
  { view: "elevation-N", label: "Mặt đứng Bắc" },
  { view: "elevation-S", label: "Mặt đứng Nam" },
  { view: "elevation-E", label: "Mặt đứng Đông" },
  { view: "elevation-W", label: "Mặt đứng Tây" },
];

interface ExpandedView { view: SheetView; label: string; sectionLine?: { x1: number; y1: number; x2: number; y2: number } }

export default function ViewsPanel({ elements, visible, wallHeight }: ViewsPanelProps) {
  const sectionCuts = useDrawingStore((s) => s.sectionCuts);
  const addSectionCut = useDrawingStore((s) => s.addSectionCut);
  const removeSectionCut = useDrawingStore((s) => s.removeSectionCut);
  const [expanded, setExpanded] = useState<ExpandedView | null>(null);
  const [addingCut, setAddingCut] = useState(false);
  const [exportId, setExportId] = useState(0);

  if (!visible) return null;

  const wallCount = elements.filter((el) => el.archType === "wall").length;
  const toLocalSection = (line?: { x1: number; y1: number; x2: number; y2: number }) =>
    line ? { x1: line.x1, z1: line.y1, x2: line.x2, z2: line.y2 } : undefined;

  return (
    <div className="absolute inset-0 top-9 bg-slate-100 dark:bg-slate-950 overflow-y-auto p-6">
      {wallCount === 0 ? (
        <div className="flex items-center justify-center h-full text-slate-500 text-sm">
          Chưa có gì để hiển thị — vẽ tường ở chế độ 3D trước.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-4 mb-8">
            {FIXED_VIEWS.map(({ view, label }) => (
              <button key={view} onClick={() => setExpanded({ view, label })} className="flex flex-col items-center gap-1 group">
                <div className="border border-slate-300 dark:border-slate-700 rounded overflow-hidden group-hover:border-blue-500 transition-colors">
                  <ViewRenderer elements={elements} view={view} width={THUMB_W} height={THUMB_H} wallHeight={wallHeight} />
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">{label} · 1:100</span>
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Mặt cắt</span>
            <button
              onClick={() => { setAddingCut(true); setExpanded({ view: "plan", label: "Mặt bằng" }); }}
              className="text-[10px] font-bold text-blue-500 hover:text-blue-400"
            >
              + Thêm mặt cắt
            </button>
          </div>
          <div className="grid grid-cols-4 gap-4">
            {sectionCuts.map((cut) => (
              <div key={cut.id} className="flex flex-col items-center gap-1 group relative">
                <button
                  onClick={() => setExpanded({ view: "section", label: cut.label, sectionLine: cut.line })}
                  className="border border-slate-300 dark:border-slate-700 rounded overflow-hidden group-hover:border-blue-500 transition-colors"
                >
                  <ViewRenderer elements={elements} view="section" sectionLine={toLocalSection(cut.line)} width={THUMB_W} height={THUMB_H} wallHeight={wallHeight} />
                </button>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">{cut.label} · 1:100</span>
                <button
                  onClick={() => removeSectionCut(cut.id)}
                  className="absolute top-1 right-1 text-[10px] text-slate-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Xoá mặt cắt"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {expanded && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center" onClick={() => { setExpanded(null); setAddingCut(false); }}>
          <div className="bg-white dark:bg-slate-900 rounded-lg p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                {expanded.label}{addingCut ? " — click 2 điểm để vẽ mặt cắt" : ""}
              </span>
              <div className="flex items-center gap-3">
                {!addingCut && (
                  <button onClick={() => setExportId((n) => n + 1)} className="text-[11px] font-bold text-blue-500 hover:text-blue-400">⬇ Xuất PNG</button>
                )}
                <button onClick={() => { setExpanded(null); setAddingCut(false); }} className="text-slate-400 hover:text-slate-700 dark:hover:text-white text-sm">✕</button>
              </div>
            </div>
            <ViewRenderer
              elements={elements}
              view={expanded.view}
              sectionLine={toLocalSection(expanded.sectionLine)}
              width={EXPANDED_W}
              height={EXPANDED_H}
              wallHeight={wallHeight}
              showDimensions={!addingCut}
              drawingSectionCut={addingCut}
              exportRequestId={exportId}
              exportLabel={expanded.label.replace(/\s+/g, "-")}
              onSectionCutDrawn={(line) => { addSectionCut(line); setAddingCut(false); setExpanded(null); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
```

- [x] **Step 2: Add the tab button in `EditorHeader`**

In `src/pages/CanvasEditor/components/EditorHeader.tsx`:

Add to `EditorHeaderProps` (after `setShowPaperSpace: (show: boolean) => void;`):
```tsx
  showViews: boolean;
  setShowViews: (show: boolean) => void;
```

Add to the destructured props in the component signature, in the same position.

Replace the view-switch button row (currently 4 buttons) with 5, updating every button's "off" conditions and click handlers to also reset `showViews`:
```tsx
          <button className={viewBtnCls(!show3D && !showPaperSpace && !showEstimation && !showViews)} onClick={() => { setShow3D(false); setShowPaperSpace(false); setShowEstimation(false); setShowViews(false); }}>Mô hình 2D</button>
          <button className={viewBtnCls(show3D)} onClick={() => { setShow3D(true); setShowPaperSpace(false); setShowEstimation(false); setShowViews(false); }}>Mô hình 3D</button>
          <button className={viewBtnCls(showViews)} onClick={() => { setShow3D(false); setShowPaperSpace(false); setShowEstimation(false); setShowViews(true); }} title="Bản vẽ 2D tự động từ mô hình 3D">Bản vẽ</button>
          <button className={viewBtnCls(showPaperSpace)} onClick={() => { setShow3D(false); setShowPaperSpace(true); setShowEstimation(false); setShowViews(false); }} title="Layout / Paper Space">Layout</button>
          <button className={viewBtnCls(showEstimation)} onClick={() => { setShow3D(false); setShowPaperSpace(false); setShowEstimation(true); setShowViews(false); }} title="Dự toán & Vật tư">Dự toán</button>
```

- [x] **Step 3: Wire it into `CanvasEditor`**

In `src/pages/CanvasEditor.tsx`:

Add state next to `showPaperSpace` (line 149):
```tsx
  const [showViews, setShowViews] = useState(false);
```

Pass the new props to `<EditorHeader>` (alongside the existing `showPaperSpace`/`setShowPaperSpace` props, around line 2487):
```tsx
        showViews={showViews}
        setShowViews={setShowViews}
```

Add the import: `import ViewsPanel from "./CanvasEditor/components/ViewsPanel";` (near the existing `PaperSpace` import).

Mount the panel next to the existing `PaperSpace` mount (around line 2728), following the same `ChunkErrorBoundary`/`Suspense` pattern:
```tsx
          <ChunkErrorBoundary label="views">
            <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 text-cyan-400 z-30 font-mono text-xs">Loading Views...</div>}>
              <ViewsPanel elements={elements} visible={showViews} wallHeight={wallHeight} />
            </Suspense>
          </ChunkErrorBoundary>
```
(`wallHeight` is already an in-scope variable in `CanvasEditor.tsx` — it's passed to `ThreeViewer` a few lines below this same block.)

Also hide the left CAD sidebar and its toolbar while Views is active, matching how `show3D`/`showEstimation` already do — update the two `style={{ width: ... }}`/`style={{ left: ..., display: ... }}` expressions at lines 2506 and 2559 to also include `|| showViews`:
```tsx
          style={{ width: (sidebarCollapsed || showEstimation || show3D || showViews) ? "0px" : "220px" }}
```
```tsx
          style={{ left: (sidebarCollapsed || showEstimation || show3D || showViews) ? "0px" : "220px", display: (showEstimation || show3D || showViews) ? "none" : "flex" }}
```

- [x] **Step 4: Type-check + manual smoke test**

Run: `cd autocard/frontend && npx tsc --noEmit` — clean.
Dev server: draw a few walls in "Mô hình 3D" → switch to the new "Bản vẽ" tab → confirm 5 thumbnails render (plan + 4 elevations) matching the walls just drawn → click the plan thumbnail → confirm it expands with dimension lines and labels → click "+ Thêm mặt cắt" → click 2 points on the expanded plan → confirm a new "A-A" section thumbnail appears in the Mặt cắt row → click it → confirm it expands showing a cross-section → click "⬇ Xuất PNG" on any expanded view → confirm a PNG downloads → switch back to "Mô hình 2D" → confirm the existing hand-drawing toolset is completely unchanged.

- [x] **Step 5: Commit**

```bash
git add src/pages/CanvasEditor/components/ViewsPanel.tsx src/pages/CanvasEditor/components/EditorHeader.tsx src/pages/CanvasEditor.tsx
git commit -m "feat(views): Views tab — plan/elevation/section thumbnails, dimensions, PNG export"
```

---

## Final verification (after all tasks)

- [x] `cd autocard/frontend && npx tsc --noEmit` — clean (ignoring the known `StoreOrderPage.tsx:493`).
- [x] `cd autocard/frontend && npx vitest run` — all tests pass (existing + 19 new: 6 sheetCamera + 4 sectionCutLabel + 5 autoDimension + the 3 pre-existing sheetCamera tests still passing... wait, recount: 6 new sheetCamera + 4 sectionCutLabel + 5 autoDimension = 15 new, plus the 3 pre-existing sheetCamera tests untouched).
- [x] `cd autocard/frontend && npm run build` — succeeds.
- [x] Full manual pass in the dev app (`npm run dev`, port 51530): the Task 8 smoke test above, plus confirm the existing `Mô hình 3D` tab's drawing tools (wall3d, roof-ridge, mep-fixture, etc.) and the existing `Mô hình 2D` tab's hand-drawing tools are both completely unaffected by this plan.
