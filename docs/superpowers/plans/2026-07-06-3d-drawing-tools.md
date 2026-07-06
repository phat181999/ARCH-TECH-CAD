# 3D Drawing Tools Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add SketchUp/AutoCAD-hybrid 3D tools to the AutoCard 3D viewer: snapping + exact numeric input, a Move/Rotate/Scale/Copy gizmo, rectangle/circle/arc/primitive creation tools, wall offset, per-element material paint, draggable section planes, and undo/redo wiring.

**Architecture:** Every tool is a controller component in `autocard/frontend/src/canvas/3d/controllers/` (pattern: `WallDrawController`), mounted in `Scene` inside `ThreeViewer.tsx`, gated by an `activeTool` string, committing `DrawingElement`s through `useDrawingStore` (which already provides history/undo). Pure geometry/snapping logic lives in `canvas/3d/interaction/` and `canvas/3d/geometry/` modules with vitest unit tests.

**Tech Stack:** React 19 + TypeScript, @react-three/fiber, @react-three/drei (`TransformControls`, `Html`), three.js, Zustand, vitest.

**Spec:** `docs/superpowers/specs/2026-07-06-3d-drawing-tools-design.md`

## Global Constraints

- All frontend paths below are relative to `autocard/frontend/` unless prefixed otherwise.
- Type-check after every task: `cd autocard/frontend && npx tsc --noEmit` — must stay clean (the pre-existing error in `src/pages/StoreOrderPage.tsx:493` is ignorable).
- Unit tests: `cd autocard/frontend && npx vitest run <file>`.
- Coordinate conventions (from `src/canvas/3d/geometry/coordBridge.ts`): 2D drawing coords are pixels (X right, Y down); 3D world maps X→X, Y→Z; 100 scene units = 1 m. The scene renders inside a group offset by `(-cx, 0, -cz)`; controllers receive `center: { cx, cz }` and convert with `worldToDrawing` / `drawingToWorld`.
- Arc elements store `startAngle`/`endAngle` in **degrees** (see `LineMeshes.tsx:69-70`).
- Frontend tools only call store methods — never direct API calls.
- Do NOT touch the new CAD system under `src/cad/` — the 3D viewer belongs to the old drawing system (`src/types.ts` + `drawingStore.ts`).
- Match existing code style; commit after every task.

---

### Task 1: SnapEngine3D (`snap3d.ts`)

**Files:**
- Create: `src/canvas/3d/interaction/snap3d.ts`
- Test: `src/canvas/3d/interaction/snap3d.test.ts`

**Interfaces:**
- Consumes: `DrawingElement` from `src/types.ts`; `drawingToWorld`, `Center` from `src/canvas/3d/geometry/coordBridge.ts`.
- Produces (used by Tasks 4, 8, 10, 11):
  - `type SnapType = "endpoint" | "midpoint" | "axis" | "grid" | "none"`
  - `interface SnapPoint2D { x: number; z: number }`
  - `interface SnapCandidates { endpoints: SnapPoint2D[]; midpoints: SnapPoint2D[] }`
  - `collectSnapCandidates(elements: DrawingElement[], center: Center): SnapCandidates`
  - `applySnap(raw: SnapPoint2D, candidates: SnapCandidates, opts?: SnapOptions): SnapResult` where `SnapResult = { point: SnapPoint2D; type: SnapType }` and `SnapOptions = { tolerance?: number; gridSize?: number; anchor?: SnapPoint2D | null; axisLock?: boolean }`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/canvas/3d/interaction/snap3d.test.ts
import { describe, it, expect } from "vitest";
import { collectSnapCandidates, applySnap } from "./snap3d";
import type { DrawingElement } from "../../../types";

const center = { cx: 0, cz: 0 };
const line: DrawingElement = { id: "l1", type: "line", layerId: "0", x1: 0, y1: 0, x2: 100, y2: 0 };

describe("collectSnapCandidates", () => {
  it("collects line endpoints and midpoint in world coords", () => {
    const c = collectSnapCandidates([line], center);
    expect(c.endpoints).toContainEqual({ x: 0, z: 0 });
    expect(c.endpoints).toContainEqual({ x: 100, z: 0 });
    expect(c.midpoints).toContainEqual({ x: 50, z: 0 });
  });

  it("applies the center offset", () => {
    const c = collectSnapCandidates([line], { cx: 10, cz: 20 });
    expect(c.endpoints).toContainEqual({ x: -10, z: -20 });
  });

  it("collects rectangle corners", () => {
    const rect: DrawingElement = { id: "r1", type: "rectangle", layerId: "0", x: 0, y: 0, width: 40, height: 30 };
    const c = collectSnapCandidates([rect], center);
    expect(c.endpoints).toContainEqual({ x: 0, z: 0 });
    expect(c.endpoints).toContainEqual({ x: 40, z: 30 });
  });
});

describe("applySnap", () => {
  const candidates = collectSnapCandidates([line], center);

  it("snaps to an endpoint within tolerance", () => {
    const r = applySnap({ x: 5, z: 4 }, candidates, { tolerance: 12 });
    expect(r).toEqual({ point: { x: 0, z: 0 }, type: "endpoint" });
  });

  it("does not snap beyond tolerance", () => {
    const r = applySnap({ x: 30, z: 30 }, candidates, { tolerance: 12 });
    expect(r.type).toBe("none");
    expect(r.point).toEqual({ x: 30, z: 30 });
  });

  it("prefers endpoint over midpoint when both are in range", () => {
    const r = applySnap({ x: 3, z: 0 }, candidates, { tolerance: 60 });
    expect(r.type).toBe("endpoint");
  });

  it("snaps to midpoint when endpoint is out of range", () => {
    const r = applySnap({ x: 52, z: 5 }, candidates, { tolerance: 12 });
    expect(r).toEqual({ point: { x: 50, z: 0 }, type: "midpoint" });
  });

  it("locks to the dominant axis from the anchor when axisLock is set", () => {
    const r = applySnap({ x: 80, z: 15 }, { endpoints: [], midpoints: [] }, { anchor: { x: 0, z: 0 }, axisLock: true });
    expect(r).toEqual({ point: { x: 80, z: 0 }, type: "axis" });
  });

  it("snaps to grid when gridSize is set and no point snap hits", () => {
    const r = applySnap({ x: 23, z: 48 }, { endpoints: [], midpoints: [] }, { gridSize: 25, tolerance: 12 });
    expect(r).toEqual({ point: { x: 25, z: 50 }, type: "grid" });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd autocard/frontend && npx vitest run src/canvas/3d/interaction/snap3d.test.ts`
Expected: FAIL — cannot resolve `./snap3d`.

- [ ] **Step 3: Implement `snap3d.ts`**

```ts
// src/canvas/3d/interaction/snap3d.ts
// 3D drawing snapping/inference: endpoint > midpoint > axis lock > grid.
// All coordinates are world-space ground-plane points ({x, z}, y = 0).
import type { DrawingElement } from "../../../types";
import { drawingToWorld, type Center } from "../geometry/coordBridge";

export type SnapType = "endpoint" | "midpoint" | "axis" | "grid" | "none";
export interface SnapPoint2D { x: number; z: number }
export interface SnapCandidates { endpoints: SnapPoint2D[]; midpoints: SnapPoint2D[] }
export interface SnapOptions {
  tolerance?: number;           // world units; 12 = 12 cm
  gridSize?: number;            // world units; unset disables grid snap
  anchor?: SnapPoint2D | null;  // chain start point, required for axisLock
  axisLock?: boolean;           // Shift held: constrain to dominant axis
}
export interface SnapResult { point: SnapPoint2D; type: SnapType }

const DEFAULT_TOLERANCE = 12;

export function collectSnapCandidates(elements: DrawingElement[], center: Center): SnapCandidates {
  const endpoints: SnapPoint2D[] = [];
  const midpoints: SnapPoint2D[] = [];
  const toWorld = (x: number, y: number): SnapPoint2D => {
    const w = drawingToWorld({ x, y }, center);
    return { x: w.x, z: w.z };
  };
  for (const el of elements) {
    if (el.type === "line" && el.x1 != null && el.y1 != null && el.x2 != null && el.y2 != null) {
      const a = toWorld(el.x1, el.y1);
      const b = toWorld(el.x2, el.y2);
      endpoints.push(a, b);
      midpoints.push({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 });
    } else if (el.type === "rectangle" && el.x != null && el.y != null && el.width != null && el.height != null) {
      endpoints.push(
        toWorld(el.x, el.y),
        toWorld(el.x + el.width, el.y),
        toWorld(el.x, el.y + el.height),
        toWorld(el.x + el.width, el.y + el.height),
      );
      midpoints.push(toWorld(el.x + el.width / 2, el.y + el.height / 2));
    } else if (el.type === "circle" && el.cx != null && el.cy != null) {
      midpoints.push(toWorld(el.cx, el.cy));
    } else if (Array.isArray(el.points) && el.points.length > 0) {
      for (const p of el.points) endpoints.push(toWorld(p.x, p.y));
      for (let i = 0; i + 1 < el.points.length; i++) {
        const a = el.points[i], b = el.points[i + 1];
        midpoints.push(toWorld((a.x + b.x) / 2, (a.y + b.y) / 2));
      }
    }
  }
  return { endpoints, midpoints };
}

function nearestWithin(pts: SnapPoint2D[], raw: SnapPoint2D, tolerance: number): SnapPoint2D | null {
  let best: SnapPoint2D | null = null;
  let bestD = tolerance;
  for (const p of pts) {
    const d = Math.hypot(p.x - raw.x, p.z - raw.z);
    if (d <= bestD) { best = p; bestD = d; }
  }
  return best;
}

export function applySnap(raw: SnapPoint2D, candidates: SnapCandidates, opts: SnapOptions = {}): SnapResult {
  const tolerance = opts.tolerance ?? DEFAULT_TOLERANCE;

  // Axis lock takes over completely: constrain to the dominant axis from the anchor.
  if (opts.axisLock && opts.anchor) {
    const dx = Math.abs(raw.x - opts.anchor.x);
    const dz = Math.abs(raw.z - opts.anchor.z);
    const point = dx >= dz ? { x: raw.x, z: opts.anchor.z } : { x: opts.anchor.x, z: raw.z };
    return { point, type: "axis" };
  }

  const ep = nearestWithin(candidates.endpoints, raw, tolerance);
  if (ep) return { point: ep, type: "endpoint" };

  const mp = nearestWithin(candidates.midpoints, raw, tolerance);
  if (mp) return { point: mp, type: "midpoint" };

  if (opts.gridSize && opts.gridSize > 0) {
    const gx = Math.round(raw.x / opts.gridSize) * opts.gridSize;
    const gz = Math.round(raw.z / opts.gridSize) * opts.gridSize;
    if (Math.hypot(gx - raw.x, gz - raw.z) <= tolerance) {
      return { point: { x: gx, z: gz }, type: "grid" };
    }
  }

  return { point: raw, type: "none" };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd autocard/frontend && npx vitest run src/canvas/3d/interaction/snap3d.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Type-check and commit**

```bash
cd autocard/frontend && npx tsc --noEmit
git add src/canvas/3d/interaction/snap3d.ts src/canvas/3d/interaction/snap3d.test.ts
git commit -m "feat(3d): add SnapEngine3D — endpoint/midpoint/axis/grid snapping"
```

---

### Task 2: Numeric input (parser + `useNumericInput` hook)

**Files:**
- Create: `src/canvas/3d/interaction/numericInput.ts`
- Create: `src/canvas/3d/interaction/useNumericInput.ts`
- Test: `src/canvas/3d/interaction/numericInput.test.ts`

**Interfaces:**
- Produces (used by Tasks 4, 8, 10, 11):
  - `parseNumericInput(buffer: string): number | null` — returns meters (> 0) or null.
  - `useNumericInput(active: boolean): { buffer: string; committed: number | null; consume: () => number | null }` — while `active`, digits/`.`/Backspace typed anywhere build `buffer`; Enter parses it into `committed` (meters); Escape clears the buffer. `consume()` returns-and-clears `committed`.

- [ ] **Step 1: Write the failing parser tests**

```ts
// src/canvas/3d/interaction/numericInput.test.ts
import { describe, it, expect } from "vitest";
import { parseNumericInput } from "./numericInput";

describe("parseNumericInput", () => {
  it("parses a plain number as meters", () => {
    expect(parseNumericInput("3.5")).toBe(3.5);
  });
  it("trims whitespace", () => {
    expect(parseNumericInput(" 2 ")).toBe(2);
  });
  it("rejects empty, zero, negative and garbage", () => {
    expect(parseNumericInput("")).toBeNull();
    expect(parseNumericInput("0")).toBeNull();
    expect(parseNumericInput("-3")).toBeNull();
    expect(parseNumericInput("abc")).toBeNull();
    expect(parseNumericInput("1.2.3")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd autocard/frontend && npx vitest run src/canvas/3d/interaction/numericInput.test.ts`
Expected: FAIL — cannot resolve `./numericInput`.

- [ ] **Step 3: Implement parser and hook**

```ts
// src/canvas/3d/interaction/numericInput.ts
// Parses the numeric-entry buffer typed while drawing. Value is in meters.
export function parseNumericInput(buffer: string): number | null {
  const s = buffer.trim();
  if (!/^\d*\.?\d+$/.test(s)) return null;
  const v = parseFloat(s);
  return Number.isFinite(v) && v > 0 ? v : null;
}
```

```ts
// src/canvas/3d/interaction/useNumericInput.ts
// AutoCAD-style numeric entry while a 3D tool is active: type digits, Enter
// commits the exact value (meters), Escape clears. Consumers watch `committed`
// (or call consume()) to finalize the in-progress gesture with the exact length.
import { useCallback, useEffect, useState } from "react";
import { parseNumericInput } from "./numericInput";

export function useNumericInput(active: boolean): {
  buffer: string;
  committed: number | null;
  consume: () => number | null;
} {
  const [buffer, setBuffer] = useState("");
  const [committed, setCommitted] = useState<number | null>(null);

  useEffect(() => {
    if (!active) { setBuffer(""); setCommitted(null); return; }
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9.]$/.test(e.key)) {
        setBuffer((b) => b + e.key);
      } else if (e.key === "Backspace") {
        setBuffer((b) => b.slice(0, -1));
      } else if (e.key === "Enter") {
        setBuffer((b) => {
          const v = parseNumericInput(b);
          if (v != null) setCommitted(v);
          return "";
        });
      } else if (e.key === "Escape") {
        setBuffer("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  const consume = useCallback(() => {
    const v = committed;
    if (v != null) setCommitted(null);
    return v;
  }, [committed]);

  return { buffer, committed, consume };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd autocard/frontend && npx vitest run src/canvas/3d/interaction/numericInput.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Type-check and commit**

```bash
cd autocard/frontend && npx tsc --noEmit
git add src/canvas/3d/interaction/numericInput.ts src/canvas/3d/interaction/useNumericInput.ts src/canvas/3d/interaction/numericInput.test.ts
git commit -m "feat(3d): add numeric input parser and hook for exact-length entry"
```

---

### Task 3: `useToolRaycast` hook + retrofit `WallDrawController`

**Files:**
- Create: `src/canvas/3d/interaction/useToolRaycast.ts`
- Modify: `src/canvas/3d/controllers/WallDrawController.tsx` (replace inline `toGround`)

**Interfaces:**
- Produces (used by Tasks 4, 6, 8, 10, 11, 13):
  - `useToolRaycast(): { raycastGround: (e: PointerEvent) => THREE.Vector3 | null; raycastMeshes: (e: PointerEvent) => THREE.Intersection | null }`
  - Must be called from a component inside `<Canvas>` (uses `useThree`).

- [ ] **Step 1: Implement the hook**

```ts
// src/canvas/3d/interaction/useToolRaycast.ts
// Shared pointer→ray→(ground plane | scene meshes) casting for 3D tools.
// Replaces the per-controller copy-pasted `toGround` helpers.
import { useCallback, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

export function useToolRaycast() {
  const { camera, gl, scene } = useThree();
  const groundPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);

  const toRay = useCallback((event: PointerEvent | MouseEvent): THREE.Raycaster => {
    const rect = gl.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    return raycaster;
  }, [camera, gl]);

  const raycastGround = useCallback((event: PointerEvent | MouseEvent): THREE.Vector3 | null => {
    const hit = new THREE.Vector3();
    return toRay(event).ray.intersectPlane(groundPlane, hit) ? hit : null;
  }, [toRay, groundPlane]);

  const raycastMeshes = useCallback((event: PointerEvent | MouseEvent): THREE.Intersection | null => {
    const hits = toRay(event).intersectObjects(scene.children, true);
    return hits.find((h) => h.object instanceof THREE.Mesh && h.object.visible) ?? null;
  }, [toRay, scene]);

  return { raycastGround, raycastMeshes };
}
```

- [ ] **Step 2: Retrofit `WallDrawController`**

In `src/canvas/3d/controllers/WallDrawController.tsx`:
- Add import: `import { useToolRaycast } from "../interaction/useToolRaycast";`
- Inside the component, add `const { raycastGround } = useToolRaycast();`
- Delete the `groundPlane` useMemo (line 28) and the inline `toGround` function (lines 37–47); replace calls `toGround(event)` with `raycastGround(event)`.
- Update the `useEffect` dependency array: remove `groundPlane`, add `raycastGround`.

- [ ] **Step 3: Type-check and run existing tests**

Run: `cd autocard/frontend && npx tsc --noEmit && npx vitest run`
Expected: clean type-check, all existing tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/canvas/3d/interaction/useToolRaycast.ts src/canvas/3d/controllers/WallDrawController.tsx
git commit -m "refactor(3d): extract shared useToolRaycast hook"
```

---

### Task 4: Snap + numeric input in wall & floor drawing

**Files:**
- Modify: `src/canvas/3d/controllers/WallDrawController.tsx`
- Modify: `src/canvas/3d/controllers/FloorDrawController.tsx`

**Interfaces:**
- Consumes: `collectSnapCandidates`, `applySnap`, `SnapType` (Task 1); `useNumericInput` (Task 2); `useToolRaycast` (Task 3).
- Produces: no new exports — behavior change only. The snap-glyph color mapping defined here (`endpoint` #22c55e, `midpoint` #38bdf8, `axis` #f59e0b, `grid` #94a3b8) is reused verbatim by Tasks 8/10/11.

- [ ] **Step 1: Update `WallDrawController` with snap + numeric entry**

Replace the body so the pointer-move preview snaps and Enter commits exact lengths. Key changes (full updated flow):

```tsx
// additional imports
import { collectSnapCandidates, applySnap, type SnapType } from "../interaction/snap3d";
import { useNumericInput } from "../interaction/useNumericInput";

// inside the component:
const elements = useDrawingStore((s) => s.elements);
const [snapType, setSnapType] = useState<SnapType>("none");
const shiftRef = useRef(false);
const numeric = useNumericInput(active);
const candidates = useMemo(
  () => (active ? collectSnapCandidates(elements, { cx: center.cx, cz: center.cz }) : { endpoints: [], midpoints: [] }),
  [active, elements, center.cx, center.cz],
);

// track Shift for axis lock (inside the active useEffect):
const onShift = (e: KeyboardEvent) => { shiftRef.current = e.shiftKey; };
window.addEventListener("keydown", onShift);
window.addEventListener("keyup", onShift);
// (remove both in the cleanup)

// snap helper used by both pointerdown and pointermove:
const snap = (pt: THREE.Vector3): THREE.Vector3 => {
  const anchor = startWorld ? { x: startWorld.x, z: startWorld.z } : null;
  const r = applySnap({ x: pt.x, z: pt.z }, candidates, { anchor, axisLock: shiftRef.current, gridSize: 25 });
  setSnapType(r.type);
  return new THREE.Vector3(r.point.x, 0, r.point.z);
};
// in handlePointerDown: const pt = raycastGround(event); if (!pt) return; const p = snap(pt);
//   ... use `p` everywhere `pt` was used.
// in handlePointerMove: setHoverWorld(pt ? snap(pt) : null);
```

Numeric commit — add a `useEffect` after the handlers:

```tsx
// Enter with a typed length: commit a wall of exactly N meters in the
// direction of the current hover preview (100 scene units = 1 m).
useEffect(() => {
  if (!active || numeric.committed == null || !startWorld || !hoverWorld) return;
  const meters = numeric.consume();
  if (meters == null) return;
  const dir = hoverWorld.clone().sub(startWorld);
  if (dir.lengthSq() < 1e-6) return;
  dir.normalize().multiplyScalar(meters * 100);
  const end = startWorld.clone().add(dir);
  const a = worldToDrawingXY({ x: startWorld.x, z: startWorld.z }, center);
  const b = worldToDrawingXY({ x: end.x, z: end.z }, center);
  if (isValidWall(a, b)) {
    const { activeLayerId, currentStyle, addElement } = useDrawingStore.getState();
    addElement(makeWallElement(a, b, { layerId: activeLayerId, strokeColor: currentStyle?.strokeColor }));
  }
  setStartWorld(end);
}, [active, numeric.committed]);
```

Preview label — extend the existing `<Html>` label to show the snap glyph and typed buffer:

```tsx
<div className="bg-slate-900/90 text-emerald-400 font-mono text-[9px] font-bold px-2 py-0.5 rounded border border-emerald-500/30 whitespace-nowrap shadow-md select-none">
  🧱 {formatLength(previewLen)}
  {numeric.buffer && <span className="ml-1 text-amber-300">⌨ {numeric.buffer} m</span>}
</div>
```

Snap marker — render a colored dot at the hover point when snapped:

```tsx
{hoverWorld && snapType !== "none" && (
  <mesh position={hoverWorld}>
    <sphereGeometry args={[3, 12, 12]} />
    <meshBasicMaterial
      color={snapType === "endpoint" ? "#22c55e" : snapType === "midpoint" ? "#38bdf8" : snapType === "axis" ? "#f59e0b" : "#94a3b8"}
      depthTest={false}
    />
  </mesh>
)}
```

- [ ] **Step 2: Update `FloorDrawController` the same way**

Read `src/canvas/3d/controllers/FloorDrawController.tsx` first. Apply the identical pattern: `useToolRaycast` replaces its inline ground raycast; every vertex click and hover preview goes through the same `snap()` helper (anchor = last placed vertex); render the same snap marker. Numeric input is not needed for floors (polygon vertices), skip it there.

- [ ] **Step 3: Type-check**

Run: `cd autocard/frontend && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Manual smoke test**

Run: `cd autocard/frontend && npm run dev` → open `http://localhost:51530`, switch to 3D, draw a wall near an existing wall's end.
Expected: green dot appears and the new wall starts exactly at the existing endpoint; holding Shift locks the preview to X/Z axis (orange dot); typing `3` then Enter creates a 3 m wall segment.

- [ ] **Step 5: Commit**

```bash
git add src/canvas/3d/controllers/WallDrawController.tsx src/canvas/3d/controllers/FloorDrawController.tsx
git commit -m "feat(3d): endpoint/midpoint/axis snapping and exact numeric entry for wall/floor drawing"
```

---

### Task 5: Transform geometry helpers

**Files:**
- Create: `src/canvas/3d/geometry/transformGeometry.ts`
- Test: `src/canvas/3d/geometry/transformGeometry.test.ts`

**Interfaces:**
- Produces (used by Task 6):
  - `elementAnchor(el: DrawingElement): { x: number; y: number } | null` — drawing-coords pivot (line midpoint, rect center, circle center, points centroid, block position).
  - `translatePatch(el: DrawingElement, dx: number, dy: number): Partial<DrawingElement>`
  - `rotatePatch(el: DrawingElement, deltaDeg: number): Partial<DrawingElement>`
  - `scalePatch(el: DrawingElement, factor: number): Partial<DrawingElement>`
  - `duplicateElement(el: DrawingElement): DrawingElement` — deep copy with fresh id.

- [ ] **Step 1: Write the failing tests**

```ts
// src/canvas/3d/geometry/transformGeometry.test.ts
import { describe, it, expect } from "vitest";
import { elementAnchor, translatePatch, rotatePatch, scalePatch, duplicateElement } from "./transformGeometry";
import type { DrawingElement } from "../../../types";

const line: DrawingElement = { id: "l1", type: "line", layerId: "0", x1: 0, y1: 0, x2: 100, y2: 0 };
const rect: DrawingElement = { id: "r1", type: "rectangle", layerId: "0", x: 10, y: 10, width: 40, height: 20 };
const circle: DrawingElement = { id: "c1", type: "circle", layerId: "0", cx: 5, cy: 5, radius: 10 };
const block: DrawingElement = { id: "b1", type: "block", layerId: "0", blockId: "sofa", x: 30, y: 40, rotation: 90, scale: 1 };

describe("elementAnchor", () => {
  it("line midpoint", () => expect(elementAnchor(line)).toEqual({ x: 50, y: 0 }));
  it("rect center", () => expect(elementAnchor(rect)).toEqual({ x: 30, y: 20 }));
  it("circle center", () => expect(elementAnchor(circle)).toEqual({ x: 5, y: 5 }));
  it("block position", () => expect(elementAnchor(block)).toEqual({ x: 30, y: 40 }));
});

describe("translatePatch", () => {
  it("shifts line endpoints", () => {
    expect(translatePatch(line, 10, 5)).toEqual({ x1: 10, y1: 5, x2: 110, y2: 5 });
  });
  it("shifts rect origin", () => {
    expect(translatePatch(rect, -10, 0)).toEqual({ x: 0, y: 10 });
  });
  it("shifts circle center", () => {
    expect(translatePatch(circle, 1, 2)).toEqual({ cx: 6, cy: 7 });
  });
  it("shifts polygon points", () => {
    const poly: DrawingElement = { id: "p1", type: "polygon", layerId: "0", points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] };
    expect(translatePatch(poly, 5, 5)).toEqual({ points: [{ x: 5, y: 5 }, { x: 15, y: 5 }] });
  });
});

describe("rotatePatch", () => {
  it("adds to the rotation field for blocks", () => {
    expect(rotatePatch(block, 45)).toEqual({ rotation: 135 });
  });
  it("rotates line endpoints around the midpoint", () => {
    const p = rotatePatch(line, 90);
    expect(p.x1).toBeCloseTo(50); expect(p.y1).toBeCloseTo(-50);
    expect(p.x2).toBeCloseTo(50); expect(p.y2).toBeCloseTo(50);
  });
});

describe("scalePatch", () => {
  it("multiplies block scale", () => expect(scalePatch(block, 2)).toEqual({ scale: 2 }));
  it("scales circle radius", () => expect(scalePatch(circle, 2)).toEqual({ radius: 20 }));
  it("scales rect about its center", () => {
    expect(scalePatch(rect, 2)).toEqual({ x: -10, y: 0, width: 80, height: 40 });
  });
  it("scales line about its midpoint", () => {
    const p = scalePatch(line, 2);
    expect(p.x1).toBeCloseTo(-50); expect(p.x2).toBeCloseTo(150);
  });
});

describe("duplicateElement", () => {
  it("deep-copies with a fresh id", () => {
    const poly: DrawingElement = { id: "p1", type: "polygon", layerId: "0", points: [{ x: 0, y: 0 }] };
    const copy = duplicateElement(poly);
    expect(copy.id).not.toBe("p1");
    expect(copy.points).toEqual(poly.points);
    expect(copy.points).not.toBe(poly.points);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd autocard/frontend && npx vitest run src/canvas/3d/geometry/transformGeometry.test.ts`
Expected: FAIL — cannot resolve `./transformGeometry`.

- [ ] **Step 3: Implement**

```ts
// src/canvas/3d/geometry/transformGeometry.ts
// Pure element-transform helpers for the 3D gizmo. All coords are 2D drawing
// space; patches are fed to drawingStore.updateElement / batch commits.
import type { DrawingElement, Point } from "../../../types";

export function elementAnchor(el: DrawingElement): { x: number; y: number } | null {
  if (el.type === "line" && el.x1 != null && el.x2 != null) {
    return { x: (el.x1 + el.x2) / 2, y: ((el.y1 ?? 0) + (el.y2 ?? 0)) / 2 };
  }
  if (el.cx != null && el.cy != null) return { x: el.cx, y: el.cy };
  if (el.x != null && el.width != null && el.height != null) {
    return { x: el.x + el.width / 2, y: (el.y ?? 0) + el.height / 2 };
  }
  if (el.x != null) return { x: el.x, y: el.y ?? 0 };
  if (Array.isArray(el.points) && el.points.length > 0) {
    const n = el.points.length;
    return {
      x: el.points.reduce((s, p) => s + p.x, 0) / n,
      y: el.points.reduce((s, p) => s + p.y, 0) / n,
    };
  }
  return null;
}

export function translatePatch(el: DrawingElement, dx: number, dy: number): Partial<DrawingElement> {
  const p: Partial<DrawingElement> = {};
  if (el.x1 != null) { p.x1 = el.x1 + dx; p.y1 = (el.y1 ?? 0) + dy; }
  if (el.x2 != null) { p.x2 = el.x2 + dx; p.y2 = (el.y2 ?? 0) + dy; }
  if (el.x != null) { p.x = el.x + dx; p.y = (el.y ?? 0) + dy; }
  if (el.cx != null) { p.cx = el.cx + dx; p.cy = (el.cy ?? 0) + dy; }
  if (Array.isArray(el.points)) p.points = el.points.map((pt) => ({ x: pt.x + dx, y: pt.y + dy }));
  return p;
}

function rotateAbout(pt: Point, pivot: Point, rad: number): Point {
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const dx = pt.x - pivot.x, dy = pt.y - pivot.y;
  return { x: pivot.x + dx * cos - dy * sin, y: pivot.y + dx * sin + dy * cos };
}

export function rotatePatch(el: DrawingElement, deltaDeg: number): Partial<DrawingElement> {
  // Elements whose renderers honor `rotation` rotate via the field.
  if (el.type === "block" || el.type === "rectangle" || el.type === "text") {
    return { rotation: (((el.rotation ?? 0) + deltaDeg) % 360 + 360) % 360 };
  }
  const anchor = elementAnchor(el);
  if (!anchor) return {};
  const rad = (deltaDeg * Math.PI) / 180;
  const p: Partial<DrawingElement> = {};
  if (el.x1 != null && el.x2 != null) {
    const a = rotateAbout({ x: el.x1, y: el.y1 ?? 0 }, anchor, rad);
    const b = rotateAbout({ x: el.x2, y: el.y2 ?? 0 }, anchor, rad);
    p.x1 = a.x; p.y1 = a.y; p.x2 = b.x; p.y2 = b.y;
  }
  if (Array.isArray(el.points)) p.points = el.points.map((pt) => rotateAbout(pt, anchor, rad));
  return p;
}

export function scalePatch(el: DrawingElement, factor: number): Partial<DrawingElement> {
  if (factor <= 0) return {};
  if (el.type === "block") return { scale: (el.scale ?? 1) * factor };
  if (el.type === "circle" && el.radius != null) return { radius: el.radius * factor };
  if (el.type === "rectangle" && el.x != null && el.width != null && el.height != null) {
    const cx = el.x + el.width / 2, cy = (el.y ?? 0) + el.height / 2;
    const w = el.width * factor, h = el.height * factor;
    return { x: cx - w / 2, y: cy - h / 2, width: w, height: h };
  }
  const anchor = elementAnchor(el);
  if (!anchor) return {};
  const p: Partial<DrawingElement> = {};
  if (el.x1 != null && el.x2 != null) {
    p.x1 = anchor.x + (el.x1 - anchor.x) * factor;
    p.y1 = anchor.y + ((el.y1 ?? 0) - anchor.y) * factor;
    p.x2 = anchor.x + (el.x2 - anchor.x) * factor;
    p.y2 = anchor.y + ((el.y2 ?? 0) - anchor.y) * factor;
  }
  if (Array.isArray(el.points)) {
    p.points = el.points.map((pt) => ({
      x: anchor.x + (pt.x - anchor.x) * factor,
      y: anchor.y + (pt.y - anchor.y) * factor,
    }));
  }
  return p;
}

export function duplicateElement(el: DrawingElement): DrawingElement {
  const copy: DrawingElement = JSON.parse(JSON.stringify(el));
  copy.id = `${el.type}-${Math.random().toString(36).slice(2, 10)}`;
  return copy;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd autocard/frontend && npx vitest run src/canvas/3d/geometry/transformGeometry.test.ts`
Expected: PASS (14 tests).

- [ ] **Step 5: Type-check and commit**

```bash
cd autocard/frontend && npx tsc --noEmit
git add src/canvas/3d/geometry/transformGeometry.ts src/canvas/3d/geometry/transformGeometry.test.ts
git commit -m "feat(3d): pure transform helpers (translate/rotate/scale/duplicate)"
```

---

### Task 6: 3D selection + TransformGizmoController

**Files:**
- Create: `src/canvas/3d/controllers/TransformGizmoController.tsx`
- Modify: `src/canvas/3d/controllers/index.ts` (export it)
- Modify: `src/components/ThreeViewer.tsx` (`handleElementClick` select path; mount controller in `Scene`; toolbar already has select)
- Modify: `src/canvas/3d/components/FlatElementMesh.tsx` and `src/canvas/3d/components/WallMesh.tsx` (click gating includes `select`)

**Interfaces:**
- Consumes: `selectedElementIds` / `setSelectedElementIds` from `elementSlice` (already exist); Task 5 helpers; `drawingToWorld` from `coordBridge`.
- Produces: `<TransformGizmoController activeTool={string} center={{cx,cz}} />`. Keyboard: `g` = translate, `r` = rotate, `s` = scale while a selection exists; Ctrl/Cmd held at drag start duplicates the selection first.

- [ ] **Step 1: Make meshes clickable in select mode**

In `FlatElementMesh.tsx`, change the two guards (lines 21 and 32):
```tsx
const interactiveTools = ["eraser", "select", "paint3d"];
// handlePointerOver: if (activeTool && interactiveTools.includes(activeTool)) { ... }
// handleClick:       if (activeTool && interactiveTools.includes(activeTool)) { e.stopPropagation(); onElementClick?.(el.id); }
```
In `WallMesh.tsx`, extend the same way: the `onPointerOver` guard (line 74), the `onClick` handler (lines 76–79 — add `if ((activeTool === "select" || activeTool === "paint3d") && segment.id) { e.stopPropagation(); onElementClick?.(segment.id); }`), and the `interactive` flag in `InstancedWallsMesh` (line 136: `["eraser", "wall-height", "select", "paint3d"].includes(activeTool ?? "")`).

- [ ] **Step 2: Selection state in `ThreeViewer`**

In `src/components/ThreeViewer.tsx`:
```tsx
const selectedElementIds = useDrawingStore((s) => s.selectedElementIds);
const setSelectedElementIds = useDrawingStore((s) => s.setSelectedElementIds);
const shiftRef = useRef(false);
useEffect(() => {
  const onKey = (e: KeyboardEvent) => { shiftRef.current = e.shiftKey; };
  window.addEventListener("keydown", onKey);
  window.addEventListener("keyup", onKey);
  return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onKey); };
}, []);
```
Extend `handleElementClick` (line 1284) — add before the eraser branch:
```tsx
if (activeTool === "select") {
  if (shiftRef.current) {
    const cur = useDrawingStore.getState().selectedElementIds;
    setSelectedElementIds(cur.includes(id) ? cur.filter((s) => s !== id) : [...cur, id]);
  } else {
    setSelectedElementIds([id]);
  }
  return;
}
```
Also clear selection in the existing Escape handler (line 1233): `useDrawingStore.getState().setSelectedElementIds([]);`

- [ ] **Step 3: Implement the gizmo controller**

```tsx
// src/canvas/3d/controllers/TransformGizmoController.tsx
// Move/Rotate/Scale/Copy gizmo for selected elements. A proxy group sits at
// the selection's anchor; drei TransformControls manipulates the proxy, and on
// drag end the world-space delta is converted to drawing-space patches and
// committed as ONE history entry. Ctrl/Cmd at drag start duplicates first.
import { useEffect, useMemo, useRef, useState } from "react";
import { TransformControls, Html } from "@react-three/drei";
import * as THREE from "three";
import { useDrawingStore } from "../../../stores/drawingStore";
import type { DrawingElement } from "../../../types";
import { elementAnchor, translatePatch, rotatePatch, scalePatch, duplicateElement } from "../geometry/transformGeometry";
import { drawingToWorld, type Center } from "../geometry/coordBridge";

type GizmoMode = "translate" | "rotate" | "scale";

export function TransformGizmoController({ activeTool, center }: { activeTool: string; center: Center }) {
  const selectedIds = useDrawingStore((s) => s.selectedElementIds);
  const elements = useDrawingStore((s) => s.elements);
  const [mode, setMode] = useState<GizmoMode>("translate");
  const proxyRef = useRef<THREE.Group>(null!);
  const draggingRef = useRef(false);
  const copiedRef = useRef(false);
  const ctrlRef = useRef(false);

  const selected = useMemo(
    () => elements.filter((el) => selectedIds.includes(el.id)),
    [elements, selectedIds],
  );

  // Anchor = average of selected anchors, in world space.
  const anchorWorld = useMemo(() => {
    const anchors = selected.map(elementAnchor).filter((a): a is { x: number; y: number } => a != null);
    if (anchors.length === 0) return null;
    const ax = anchors.reduce((s, a) => s + a.x, 0) / anchors.length;
    const ay = anchors.reduce((s, a) => s + a.y, 0) / anchors.length;
    const w = drawingToWorld({ x: ax, y: ay }, center);
    return new THREE.Vector3(w.x, 0, w.z);
  }, [selected, center]);

  const active = activeTool === "select" && selected.length > 0 && anchorWorld != null;

  // Mode hotkeys + Ctrl tracking.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      ctrlRef.current = e.ctrlKey || e.metaKey;
      if (e.type !== "keydown") return;
      if (e.key === "g") setMode("translate");
      if (e.key === "r" && selected.length === 1) setMode("rotate");
      if (e.key === "s" && selected.length === 1) setMode("scale");
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onKey); };
  }, [active, selected.length]);

  // Multi-select supports translate only.
  useEffect(() => { if (selected.length > 1) setMode("translate"); }, [selected.length]);

  // Keep the proxy parked at the anchor whenever not mid-drag.
  useEffect(() => {
    if (!active || draggingRef.current || !proxyRef.current) return;
    proxyRef.current.position.copy(anchorWorld!);
    proxyRef.current.rotation.set(0, 0, 0);
    proxyRef.current.scale.set(1, 1, 1);
  }, [active, anchorWorld]);

  if (!active) return null;

  // Commit patches for all ids as a single history entry.
  const commitPatches = (patches: Map<string, Partial<DrawingElement>>) => {
    useDrawingStore.setState((state) => {
      const newElements = state.elements.map((el) => {
        const patch = patches.get(el.id);
        return patch ? { ...el, ...patch, editedIn3D: true } : el;
      });
      return {
        elements: newElements,
        history: [...state.history.slice(0, state.historyIndex + 1), newElements],
        historyIndex: state.historyIndex + 1,
      };
    });
  };

  const handleMouseDown = () => {
    draggingRef.current = true;
    copiedRef.current = false;
    if (ctrlRef.current && mode === "translate") {
      // Copy: duplicate selection in place; the drag then moves the copies.
      const copies = selected.map(duplicateElement);
      const { addElements, setSelectedElementIds } = useDrawingStore.getState();
      addElements(copies);
      setSelectedElementIds(copies.map((c) => c.id));
      copiedRef.current = true;
    }
  };

  const handleMouseUp = () => {
    draggingRef.current = false;
    const proxy = proxyRef.current;
    if (!proxy) return;
    const ids = useDrawingStore.getState().selectedElementIds;
    const els = useDrawingStore.getState().elements.filter((el) => ids.includes(el.id));
    const patches = new Map<string, Partial<DrawingElement>>();

    if (mode === "translate") {
      const dx = proxy.position.x - anchorWorld!.x;
      const dz = proxy.position.z - anchorWorld!.z;
      if (Math.hypot(dx, dz) > 0.01) {
        for (const el of els) patches.set(el.id, translatePatch(el, dx, dz));
      }
    } else if (mode === "rotate") {
      // Canvas 2D y-down: +θ on screen = −θ around three.js Y.
      const deltaDeg = -THREE.MathUtils.radToDeg(proxy.rotation.y);
      if (Math.abs(deltaDeg) > 0.1) {
        for (const el of els) patches.set(el.id, rotatePatch(el, deltaDeg));
      }
    } else {
      const factor = proxy.scale.x;
      if (Math.abs(factor - 1) > 0.01 && factor > 0) {
        for (const el of els) patches.set(el.id, scalePatch(el, factor));
      }
    }

    if (patches.size > 0) commitPatches(patches);
    // Reset the proxy — element re-render reflects the committed state.
    proxy.position.copy(anchorWorld!);
    proxy.rotation.set(0, 0, 0);
    proxy.scale.set(1, 1, 1);
  };

  return (
    <>
      <TransformControls
        object={proxyRef}
        mode={mode}
        showY={mode !== "translate"}
        showX={mode !== "rotate"}
        showZ={mode !== "rotate"}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
      />
      <group ref={proxyRef} />
      <Html position={[anchorWorld.x, 40, anchorWorld.z]} center zIndexRange={[30, 40]}>
        <div className="bg-slate-900/90 border border-slate-700 rounded-full px-2 py-0.5 text-[9px] font-bold text-slate-300 whitespace-nowrap select-none">
          {selected.length} selected · <span className="text-blue-400">{mode}</span> · G/R/S · Ctrl+drag = copy
        </div>
      </Html>
    </>
  );
}
```

Note on `TransformControls` + `OrbitControls`: add `makeDefault` to the existing `<OrbitControls>` in `Scene` (ThreeViewer.tsx line 1001). drei's `TransformControls` automatically disables the default controls while dragging.

- [ ] **Step 4: Wire into `Scene`**

- `src/canvas/3d/controllers/index.ts`: add `export { TransformGizmoController } from "./TransformGizmoController";`
- In `ThreeViewer.tsx`, import it with the other controllers and mount inside `Scene`'s returned fragment (next to `WallMoveController`): `<TransformGizmoController activeTool={activeTool} center={{ cx, cz }} />`.

- [ ] **Step 5: Type-check + manual smoke test**

Run: `cd autocard/frontend && npx tsc --noEmit` — clean.
Dev server: select tool → click a furniture block → gizmo appears → drag: block moves on release → Ctrl+Z restores → `r` then rotate ring → block rotates → Ctrl+drag creates a copy. Shift-click a second element → both translate together.

- [ ] **Step 6: Commit**

```bash
git add src/canvas/3d/controllers/TransformGizmoController.tsx src/canvas/3d/controllers/index.ts src/components/ThreeViewer.tsx src/canvas/3d/components/FlatElementMesh.tsx src/canvas/3d/components/WallMesh.tsx
git commit -m "feat(3d): Move/Rotate/Scale/Copy transform gizmo with multi-select"
```

---

### Task 7: Shape factories + offset (`shapeDraw.ts`)

**Files:**
- Create: `src/canvas/3d/geometry/shapeDraw.ts`
- Test: `src/canvas/3d/geometry/shapeDraw.test.ts`

**Interfaces:**
- Consumes: `DrawingElement` from `src/types.ts`.
- Produces (used by Tasks 8, 10, 11): with `type Pt = { x: number; y: number }` (drawing coords) and `type ShapeOpts = { layerId: string; strokeColor?: string }`:
  - `makeRectangleElement(a: Pt, b: Pt, opts: ShapeOpts): DrawingElement | null` — null if either side < 1.
  - `makeCircleElement(c: Pt, radius: number, opts: ShapeOpts): DrawingElement | null` — null if radius < 1.
  - `makeArcElement(p1: Pt, p2: Pt, p3: Pt, opts: ShapeOpts): DrawingElement | null` — 3-point arc (start, through, end); angles in **degrees**; null if collinear.
  - `offsetWall(el: DrawingElement, distance: number): DrawingElement | null` — parallel copy of a line wall, signed distance to the left of the a→b direction; null for non-line input or zero length.

- [ ] **Step 1: Write the failing tests**

```ts
// src/canvas/3d/geometry/shapeDraw.test.ts
import { describe, it, expect } from "vitest";
import { makeRectangleElement, makeCircleElement, makeArcElement, offsetWall } from "./shapeDraw";
import type { DrawingElement } from "../../../types";

const opts = { layerId: "0" };

describe("makeRectangleElement", () => {
  it("normalizes corners to x/y/width/height", () => {
    const el = makeRectangleElement({ x: 100, y: 80 }, { x: 20, y: 20 }, opts)!;
    expect(el.type).toBe("rectangle");
    expect(el).toMatchObject({ x: 20, y: 20, width: 80, height: 60, layerId: "0" });
  });
  it("rejects degenerate rectangles", () => {
    expect(makeRectangleElement({ x: 0, y: 0 }, { x: 0.5, y: 100 }, opts)).toBeNull();
  });
});

describe("makeCircleElement", () => {
  it("builds a circle", () => {
    const el = makeCircleElement({ x: 10, y: 20 }, 50, opts)!;
    expect(el).toMatchObject({ type: "circle", cx: 10, cy: 20, radius: 50 });
  });
  it("rejects tiny radius", () => {
    expect(makeCircleElement({ x: 0, y: 0 }, 0.5, opts)).toBeNull();
  });
});

describe("makeArcElement", () => {
  it("builds a 3-point arc through (0,0),(50,50),(100,0) centered at (50,0)", () => {
    const el = makeArcElement({ x: 0, y: 0 }, { x: 50, y: 50 }, { x: 100, y: 0 }, opts)!;
    expect(el.type).toBe("arc");
    expect(el.cx).toBeCloseTo(50);
    expect(el.cy).toBeCloseTo(0);
    expect(el.radius).toBeCloseTo(50);
  });
  it("rejects collinear points", () => {
    expect(makeArcElement({ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }, opts)).toBeNull();
  });
});

describe("offsetWall", () => {
  const wall: DrawingElement = { id: "w1", type: "line", layerId: "0", archType: "wall", x1: 0, y1: 0, x2: 100, y2: 0 };
  it("creates a parallel wall at the signed distance", () => {
    const off = offsetWall(wall, 30)!;
    expect(off.id).not.toBe("w1");
    expect(off.archType).toBe("wall");
    expect(off.y1).toBeCloseTo(30);
    expect(off.y2).toBeCloseTo(30);
    expect(off.x1).toBeCloseTo(0);
    expect(off.x2).toBeCloseTo(100);
  });
  it("negative distance offsets the other side", () => {
    expect(offsetWall(wall, -30)!.y1).toBeCloseTo(-30);
  });
  it("rejects non-line elements", () => {
    expect(offsetWall({ id: "c", type: "circle", layerId: "0", cx: 0, cy: 0, radius: 5 }, 10)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd autocard/frontend && npx vitest run src/canvas/3d/geometry/shapeDraw.test.ts`
Expected: FAIL — cannot resolve `./shapeDraw`.

- [ ] **Step 3: Implement**

```ts
// src/canvas/3d/geometry/shapeDraw.ts
// Factories for shape elements created by the 3D drawing tools. All inputs are
// 2D drawing coords; outputs are DrawingElements that render in both 2D and 3D.
import type { DrawingElement } from "../../../types";

type Pt = { x: number; y: number };
export interface ShapeOpts { layerId: string; strokeColor?: string }

let shapeSeq = 0;
const nextId = (kind: string) => `${kind}3d-${++shapeSeq}-${Math.random().toString(36).slice(2, 7)}`;

export function makeRectangleElement(a: Pt, b: Pt, opts: ShapeOpts): DrawingElement | null {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  const width = Math.abs(b.x - a.x), height = Math.abs(b.y - a.y);
  if (width < 1 || height < 1) return null;
  return { id: nextId("rect"), type: "rectangle", layerId: opts.layerId, x, y, width, height, strokeColor: opts.strokeColor ?? "#1f2937" };
}

export function makeCircleElement(c: Pt, radius: number, opts: ShapeOpts): DrawingElement | null {
  if (radius < 1) return null;
  return { id: nextId("circle"), type: "circle", layerId: opts.layerId, cx: c.x, cy: c.y, radius, strokeColor: opts.strokeColor ?? "#1f2937" };
}

// 3-point arc (start, through, end) via circumcenter. Angles stored in degrees
// (the convention of ElementRenderer and ArcMesh3D).
export function makeArcElement(p1: Pt, p2: Pt, p3: Pt, opts: ShapeOpts): DrawingElement | null {
  const d = 2 * (p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y));
  if (Math.abs(d) < 1e-6) return null; // collinear
  const s1 = p1.x * p1.x + p1.y * p1.y;
  const s2 = p2.x * p2.x + p2.y * p2.y;
  const s3 = p3.x * p3.x + p3.y * p3.y;
  const cx = (s1 * (p2.y - p3.y) + s2 * (p3.y - p1.y) + s3 * (p1.y - p2.y)) / d;
  const cy = (s1 * (p3.x - p2.x) + s2 * (p1.x - p3.x) + s3 * (p2.x - p1.x)) / d;
  const radius = Math.hypot(p1.x - cx, p1.y - cy);
  if (radius < 1) return null;

  const angleOf = (p: Pt) => (Math.atan2(p.y - cy, p.x - cx) * 180) / Math.PI;
  let startAngle = angleOf(p1);
  let endAngle = angleOf(p3);
  const midAngle = angleOf(p2);
  // Ensure the arc sweeps through p2: if the CCW sweep start→end skips the
  // mid angle, swap direction.
  const norm = (a: number) => ((a % 360) + 360) % 360;
  const sweepContains = (s: number, e: number, m: number) => {
    const span = norm(e - s), off = norm(m - s);
    return off <= span;
  };
  if (!sweepContains(startAngle, endAngle, midAngle)) [startAngle, endAngle] = [endAngle, startAngle];

  return { id: nextId("arc"), type: "arc", layerId: opts.layerId, cx, cy, radius, startAngle, endAngle, strokeColor: opts.strokeColor ?? "#1f2937" };
}

// Parallel copy of a line wall. Positive distance offsets to the left of the
// a→b direction (screen coords, y down).
export function offsetWall(el: DrawingElement, distance: number): DrawingElement | null {
  if (el.type !== "line" || el.x1 == null || el.y1 == null || el.x2 == null || el.y2 == null) return null;
  const dx = el.x2 - el.x1, dy = el.y2 - el.y1;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return null;
  const nx = (dy / len) * distance, ny = (-dx / len) * distance;
  return {
    ...JSON.parse(JSON.stringify(el)),
    id: nextId("wall-offset"),
    x1: el.x1 + nx, y1: el.y1 + ny,
    x2: el.x2 + nx, y2: el.y2 + ny,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd autocard/frontend && npx vitest run src/canvas/3d/geometry/shapeDraw.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Type-check and commit**

```bash
cd autocard/frontend && npx tsc --noEmit
git add src/canvas/3d/geometry/shapeDraw.ts src/canvas/3d/geometry/shapeDraw.test.ts
git commit -m "feat(3d): shape element factories (rect/circle/arc) and wall offset geometry"
```

---

### Task 8: ShapeDrawController (rect3d / circle3d / arc3d) + toolbar

**Files:**
- Create: `src/canvas/3d/controllers/ShapeDrawController.tsx`
- Modify: `src/canvas/3d/controllers/index.ts`
- Modify: `src/components/ThreeViewer.tsx` (mount in `Scene`)
- Modify: `src/canvas/3d/components/ThreeViewerUI.tsx` (toolbar buttons)

**Interfaces:**
- Consumes: Tasks 1, 2, 3, 7 (`applySnap`/`collectSnapCandidates`, `useNumericInput`, `useToolRaycast`, `makeRectangleElement`/`makeCircleElement`/`makeArcElement`); `worldToDrawing` from `coordBridge`.
- Produces: `<ShapeDrawController activeTool={string} center={{cx,cz}} />` handling tools `"rect3d" | "circle3d" | "arc3d"`.

- [ ] **Step 1: Implement the controller**

```tsx
// src/canvas/3d/controllers/ShapeDrawController.tsx
// Ground-plane shape drawing: rectangle (2 clicks), circle (center + radius
// click), arc (3 clicks). Snapping and numeric entry (rect: side length along
// the drag direction is not meaningful → numeric applies to circle radius).
import { useEffect, useMemo, useRef, useState } from "react";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { useDrawingStore } from "../../../stores/drawingStore";
import { useToolRaycast } from "../interaction/useToolRaycast";
import { useNumericInput } from "../interaction/useNumericInput";
import { collectSnapCandidates, applySnap, type SnapType } from "../interaction/snap3d";
import { makeRectangleElement, makeCircleElement, makeArcElement } from "../geometry/shapeDraw";
import { worldToDrawing, type Center } from "../geometry/coordBridge";

const SHAPE_TOOLS = ["rect3d", "circle3d", "arc3d"] as const;
type ShapeTool = (typeof SHAPE_TOOLS)[number];

export function ShapeDrawController({ activeTool, center }: { activeTool: string; center: Center }) {
  const active = (SHAPE_TOOLS as readonly string[]).includes(activeTool);
  const tool = activeTool as ShapeTool;
  const { raycastGround } = useToolRaycast();
  const { gl } = useThree();
  const elements = useDrawingStore((s) => s.elements);
  const formatLength = useDrawingStore((s) => s.formatLength);
  const [clicks, setClicks] = useState<THREE.Vector3[]>([]);
  const [hover, setHover] = useState<THREE.Vector3 | null>(null);
  const [snapType, setSnapType] = useState<SnapType>("none");
  const shiftRef = useRef(false);
  const numeric = useNumericInput(active && tool === "circle3d");

  const candidates = useMemo(
    () => (active ? collectSnapCandidates(elements, center) : { endpoints: [], midpoints: [] }),
    [active, elements, center],
  );

  const commit = (pts: THREE.Vector3[]) => {
    const { activeLayerId, currentStyle, addElement } = useDrawingStore.getState();
    const opts = { layerId: activeLayerId, strokeColor: currentStyle?.strokeColor };
    const d = pts.map((p) => worldToDrawing({ x: p.x, z: p.z }, center));
    const el =
      tool === "rect3d" ? makeRectangleElement(d[0], d[1], opts)
      : tool === "circle3d" ? makeCircleElement(d[0], Math.hypot(d[1].x - d[0].x, d[1].y - d[0].y), opts)
      : makeArcElement(d[0], d[1], d[2], opts);
    if (el) addElement(el);
    setClicks([]);
  };

  useEffect(() => {
    if (!active) { setClicks([]); setHover(null); return; }
    const snap = (pt: THREE.Vector3): THREE.Vector3 => {
      const anchor = clicks.length > 0 ? { x: clicks[0].x, z: clicks[0].z } : null;
      const r = applySnap({ x: pt.x, z: pt.z }, candidates, { anchor, axisLock: shiftRef.current, gridSize: 25 });
      setSnapType(r.type);
      return new THREE.Vector3(r.point.x, 0, r.point.z);
    };
    const need = tool === "arc3d" ? 3 : 2;
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const pt = raycastGround(e);
      if (!pt) return;
      const p = snap(pt);
      const next = [...clicks, p];
      if (next.length >= need) commit(next);
      else setClicks(next);
    };
    const onMove = (e: PointerEvent) => {
      const pt = raycastGround(e);
      setHover(pt ? snap(pt) : null);
    };
    const onKey = (e: KeyboardEvent) => {
      shiftRef.current = e.shiftKey;
      if (e.key === "Escape") setClicks([]);
    };
    gl.domElement.addEventListener("pointerdown", onDown);
    gl.domElement.addEventListener("pointermove", onMove);
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      gl.domElement.removeEventListener("pointerdown", onDown);
      gl.domElement.removeEventListener("pointermove", onMove);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, [active, tool, clicks, candidates, raycastGround, gl]);

  // Circle: typed radius (meters) + Enter commits with exact radius.
  useEffect(() => {
    if (!active || tool !== "circle3d" || numeric.committed == null || clicks.length !== 1) return;
    const meters = numeric.consume();
    if (meters == null) return;
    const c = clicks[0];
    commit([c, c.clone().add(new THREE.Vector3(meters * 100, 0, 0))]);
  }, [active, tool, numeric.committed, clicks]);

  if (!active) return null;

  // Preview
  const previewPts = hover ? [...clicks, hover] : clicks;
  return (
    <group>
      {previewPts.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[2.5, 12, 12]} />
          <meshBasicMaterial
            color={i === previewPts.length - 1 && snapType !== "none"
              ? snapType === "endpoint" ? "#22c55e" : snapType === "midpoint" ? "#38bdf8" : snapType === "axis" ? "#f59e0b" : "#94a3b8"
              : "#3b82f6"}
            depthTest={false}
          />
        </mesh>
      ))}
      {tool === "rect3d" && clicks.length === 1 && hover && (
        <primitive object={(() => {
          const pts = [
            clicks[0],
            new THREE.Vector3(hover.x, 0, clicks[0].z),
            hover,
            new THREE.Vector3(clicks[0].x, 0, hover.z),
            clicks[0],
          ].map((p) => new THREE.Vector3(p.x, 0.3, p.z));
          const geo = new THREE.BufferGeometry().setFromPoints(pts);
          return new THREE.Line(geo, new THREE.LineBasicMaterial({ color: "#3b82f6" }));
        })()} />
      )}
      {tool === "circle3d" && clicks.length === 1 && hover && (
        <mesh position={[clicks[0].x, 0.3, clicks[0].z]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[Math.max(clicks[0].distanceTo(hover) - 0.8, 0.1), clicks[0].distanceTo(hover), 48]} />
          <meshBasicMaterial color="#3b82f6" transparent opacity={0.8} side={THREE.DoubleSide} />
        </mesh>
      )}
      {clicks.length > 0 && hover && (
        <Html position={[hover.x, 10, hover.z]} center>
          <div className="bg-slate-900/90 text-blue-300 font-mono text-[9px] font-bold px-2 py-0.5 rounded border border-blue-500/30 whitespace-nowrap select-none">
            {tool === "circle3d" ? `r = ${formatLength(clicks[0].distanceTo(hover) / 100)}` : formatLength(clicks[clicks.length - 1].distanceTo(hover) / 100)}
            {numeric.buffer && <span className="ml-1 text-amber-300">⌨ {numeric.buffer} m</span>}
          </div>
        </Html>
      )}
    </group>
  );
}
```

Add `import { useThree } from "@react-three/fiber";` at the top. (The stub in the first code block exists only to show the file skeleton — the final file contains only the real implementation.)

- [ ] **Step 2: Export and mount**

- `controllers/index.ts`: `export { ShapeDrawController } from "./ShapeDrawController";`
- `ThreeViewer.tsx` `Scene` fragment (next to `WallDrawController`): `<ShapeDrawController activeTool={activeTool} center={{ cx, cz }} />`
- Disable orbit while drawing: extend the `OrbitControls` `enabled` expression (line 1008) with `&& activeTool !== "rect3d" && activeTool !== "circle3d" && activeTool !== "arc3d"`.

- [ ] **Step 3: Toolbar buttons**

In `ThreeViewerUI.tsx` `ThreeToolbar`, after the `floor3d` button (line 68), add:

```tsx
<button onClick={() => setActiveTool("rect3d")} className={cls("rect3d")} title="Rectangle — 2 clicks on the ground">
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <rect x="4" y="6" width="16" height="12" rx="1" strokeWidth={2} />
  </svg>
</button>
<button onClick={() => setActiveTool("circle3d")} className={cls("circle3d")} title="Circle — center + radius; type radius + Enter for exact">
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="8" strokeWidth={2} />
  </svg>
</button>
<button onClick={() => setActiveTool("arc3d")} className={cls("arc3d")} title="Arc — 3 points (start, through, end)">
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeWidth={2} d="M4 18 A 12 12 0 0 1 20 18" />
  </svg>
</button>
```

- [ ] **Step 4: Type-check + manual smoke test**

Run: `cd autocard/frontend && npx tsc --noEmit` — clean.
Dev server: rect3d → two clicks → rectangle outline appears on the ground (and in the 2D view); circle3d → click center, type `2`, Enter → circle radius 2 m; arc3d → 3 clicks → arc through the middle point; Ctrl+Z removes each.

- [ ] **Step 5: Commit**

```bash
git add src/canvas/3d/controllers/ShapeDrawController.tsx src/canvas/3d/controllers/index.ts src/components/ThreeViewer.tsx src/canvas/3d/components/ThreeViewerUI.tsx
git commit -m "feat(3d): rectangle/circle/arc drawing tools with snap and numeric entry"
```

---

### Task 9: Extruded rendering for `pushPullDepth`

**Files:**
- Modify: `src/canvas/3d/components/FlatElementMesh.tsx`

**Interfaces:**
- Consumes: `el.pushPullDepth?: number` (already written by `PushPullDragController` and `ThreeDPropertiesPanel`, in cm ≡ scene units) and `el.material?: string` (Task 12 adds the setter; render support lands here).
- Produces: rectangles/circles with `pushPullDepth > 0` render as extruded box/cylinder; Task 10's primitives rely on this.

- [ ] **Step 1: Add extrusion branches**

In `FlatElementMesh.tsx`, inside the `isRectangle(el)` branch, before the `fillColor` check, insert:

```tsx
const depth = typeof (el as Record<string, unknown>).pushPullDepth === "number"
  ? ((el as Record<string, unknown>).pushPullDepth as number)
  : 0;
if (depth > 0.5) {
  return (
    <mesh
      position={[cx, depth / 2, cz]}
      rotation={[0, rotY, 0]}
      castShadow
      receiveShadow
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
    >
      <boxGeometry args={[el.width, depth, el.height]} />
      <meshStandardMaterial color={hovered && activeTool === "eraser" ? "#ef4444" : (fillColor || "#cbd5e1")} roughness={0.8} />
    </mesh>
  );
}
```

Inside the circle branch (after the field guard, before `fillColor`):

```tsx
const cDepth = typeof (el as Record<string, unknown>).pushPullDepth === "number"
  ? ((el as Record<string, unknown>).pushPullDepth as number)
  : 0;
if (cDepth > 0.5) {
  return (
    <mesh
      position={[el.cx, cDepth / 2, el.cy]}
      castShadow
      receiveShadow
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
    >
      <cylinderGeometry args={[el.radius, el.radius, cDepth, 32]} />
      <meshStandardMaterial color={hovered && activeTool === "eraser" ? "#ef4444" : (fillColor || "#cbd5e1")} roughness={0.8} />
    </mesh>
  );
}
```

- [ ] **Step 2: Type-check + manual smoke test**

Run: `cd autocard/frontend && npx tsc --noEmit` — clean.
Dev server: draw a rectangle (Task 8), select it, open the 3D properties panel and set Extrusion to 150 → a 1.5 m tall box appears. Same for a circle → cylinder.

- [ ] **Step 3: Commit**

```bash
git add src/canvas/3d/components/FlatElementMesh.tsx
git commit -m "feat(3d): render pushPullDepth as real extruded box/cylinder geometry"
```

---

### Task 10: Primitive tools (box3d / cylinder3d)

**Files:**
- Create: `src/canvas/3d/controllers/PrimitiveDrawController.tsx`
- Modify: `src/canvas/3d/controllers/index.ts`
- Modify: `src/components/ThreeViewer.tsx` (mount; orbit-disable list)
- Modify: `src/canvas/3d/components/ThreeViewerUI.tsx` (toolbar buttons)

**Interfaces:**
- Consumes: Tasks 1, 2, 3, 7, 9. Same snap/numeric/raycast plumbing as `ShapeDrawController`.
- Produces: `<PrimitiveDrawController activeTool={string} center={{cx,cz}} />` handling `"box3d" | "cylinder3d"`. Commits a rectangle/circle element with `pushPullDepth` set.

- [ ] **Step 1: Implement the controller**

```tsx
// src/canvas/3d/controllers/PrimitiveDrawController.tsx
// Box/cylinder primitives: footprint stage (2 clicks, same as rect/circle),
// then a height stage — move the pointer up/down, click or type meters +
// Enter to commit. Height is derived from vertical pointer movement mapped
// through the camera so dragging up grows the preview intuitively.
import { useEffect, useMemo, useRef, useState } from "react";
import { useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { useDrawingStore } from "../../../stores/drawingStore";
import { useToolRaycast } from "../interaction/useToolRaycast";
import { useNumericInput } from "../interaction/useNumericInput";
import { collectSnapCandidates, applySnap } from "../interaction/snap3d";
import { makeRectangleElement, makeCircleElement } from "../geometry/shapeDraw";
import { worldToDrawing, type Center } from "../geometry/coordBridge";

export function PrimitiveDrawController({ activeTool, center }: { activeTool: string; center: Center }) {
  const active = activeTool === "box3d" || activeTool === "cylinder3d";
  const isBox = activeTool === "box3d";
  const { raycastGround } = useToolRaycast();
  const { gl } = useThree();
  const elements = useDrawingStore((s) => s.elements);
  const formatLength = useDrawingStore((s) => s.formatLength);
  const [footprint, setFootprint] = useState<THREE.Vector3[]>([]); // 0–2 points
  const [hover, setHover] = useState<THREE.Vector3 | null>(null);
  const [height, setHeight] = useState(0);
  const heightStage = footprint.length === 2;
  const heightStartY = useRef(0);
  const numeric = useNumericInput(active);

  const candidates = useMemo(
    () => (active ? collectSnapCandidates(elements, center) : { endpoints: [], midpoints: [] }),
    [active, elements, center],
  );

  const commit = (h: number) => {
    if (h < 1) { setFootprint([]); setHeight(0); return; }
    const { activeLayerId, currentStyle, addElement } = useDrawingStore.getState();
    const opts = { layerId: activeLayerId, strokeColor: currentStyle?.strokeColor };
    const a = worldToDrawing({ x: footprint[0].x, z: footprint[0].z }, center);
    const b = worldToDrawing({ x: footprint[1].x, z: footprint[1].z }, center);
    const el = isBox
      ? makeRectangleElement(a, b, opts)
      : makeCircleElement(a, Math.hypot(b.x - a.x, b.y - a.y), opts);
    if (el) addElement({ ...el, pushPullDepth: h, fillColor: "#cbd5e1", editedIn3D: true });
    setFootprint([]); setHeight(0);
  };

  useEffect(() => {
    if (!active) { setFootprint([]); setHover(null); setHeight(0); return; }
    const snap = (pt: THREE.Vector3): THREE.Vector3 => {
      const r = applySnap({ x: pt.x, z: pt.z }, candidates, { gridSize: 25 });
      return new THREE.Vector3(r.point.x, 0, r.point.z);
    };
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      if (heightStage) { commit(height); return; }
      const pt = raycastGround(e);
      if (!pt) return;
      const p = snap(pt);
      const next = [...footprint, p];
      setFootprint(next);
      if (next.length === 2) heightStartY.current = e.clientY;
    };
    const onMove = (e: PointerEvent) => {
      if (heightStage) {
        // 1 px of upward mouse travel ≈ 1 cm of height.
        setHeight(Math.max(0, heightStartY.current - e.clientY));
        return;
      }
      const pt = raycastGround(e);
      setHover(pt ? snap(pt) : null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setFootprint([]); setHeight(0); }
    };
    gl.domElement.addEventListener("pointerdown", onDown);
    gl.domElement.addEventListener("pointermove", onMove);
    window.addEventListener("keydown", onKey);
    return () => {
      gl.domElement.removeEventListener("pointerdown", onDown);
      gl.domElement.removeEventListener("pointermove", onMove);
      window.removeEventListener("keydown", onKey);
    };
  }, [active, footprint, heightStage, height, candidates, raycastGround, gl]);

  // Typed height in meters commits immediately during the height stage.
  useEffect(() => {
    if (!active || !heightStage || numeric.committed == null) return;
    const meters = numeric.consume();
    if (meters != null) commit(meters * 100);
  }, [active, heightStage, numeric.committed]);

  if (!active || footprint.length === 0) return null;

  const a = footprint[0];
  const b = footprint[1] ?? hover;
  if (!b) return null;
  const cx = (a.x + b.x) / 2, cz = (a.z + b.z) / 2;
  const w = Math.abs(b.x - a.x), d = Math.abs(b.z - a.z);
  const r = a.distanceTo(b);
  const h = heightStage ? Math.max(height, 1) : 1;

  return (
    <group>
      <mesh position={[cx, h / 2, cz]}>
        {isBox
          ? <boxGeometry args={[Math.max(w, 1), h, Math.max(d, 1)]} />
          : <cylinderGeometry args={[Math.max(r, 1), Math.max(r, 1), h, 32]} />}
        {/* cylinder preview is centered on the first click, not the midpoint */}
        <meshStandardMaterial color="#3b82f6" transparent opacity={0.35} depthWrite={false} />
      </mesh>
      <Html position={[cx, h + 12, cz]} center>
        <div className="bg-slate-900/90 text-blue-300 font-mono text-[9px] font-bold px-2 py-0.5 rounded border border-blue-500/30 whitespace-nowrap select-none">
          {heightStage ? `h = ${formatLength(h / 100)} — click or type m + Enter` : (isBox ? `${formatLength(w / 100)} × ${formatLength(d / 100)}` : `r = ${formatLength(r / 100)}`)}
          {numeric.buffer && <span className="ml-1 text-amber-300">⌨ {numeric.buffer} m</span>}
        </div>
      </Html>
    </group>
  );
}
```

Note: for the cylinder the preview mesh position should use `[a.x, h / 2, a.z]` (center = first click) — apply that instead of `cx/cz` in the cylinder case:
```tsx
<mesh position={isBox ? [cx, h / 2, cz] : [a.x, h / 2, a.z]}>
```

- [ ] **Step 2: Export, mount, orbit-disable, toolbar**

- `controllers/index.ts`: `export { PrimitiveDrawController } from "./PrimitiveDrawController";`
- Mount in `Scene`: `<PrimitiveDrawController activeTool={activeTool} center={{ cx, cz }} />`
- `OrbitControls` `enabled` (line 1008): also exclude `"box3d"` and `"cylinder3d"`.
- Toolbar (after the arc button from Task 8):

```tsx
<button onClick={() => setActiveTool("box3d")} className={cls("box3d")} title="Box — 2 clicks footprint, then height">
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinejoin="round" strokeWidth={2} d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zM12 12l8-4.5M12 12v9M12 12L4 7.5" />
  </svg>
</button>
<button onClick={() => setActiveTool("cylinder3d")} className={cls("cylinder3d")} title="Cylinder — center + radius, then height">
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <ellipse cx="12" cy="6" rx="7" ry="3" strokeWidth={2} />
    <path strokeWidth={2} d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6" />
  </svg>
</button>
```

- [ ] **Step 3: Type-check + manual smoke test**

Run: `cd autocard/frontend && npx tsc --noEmit` — clean.
Dev server: box3d → 2 clicks → move mouse up → ghost box grows → type `2.5` Enter → solid 2.5 m box appears (extruded via Task 9); cylinder3d same; Ctrl+Z undoes.

- [ ] **Step 4: Commit**

```bash
git add src/canvas/3d/controllers/PrimitiveDrawController.tsx src/canvas/3d/controllers/index.ts src/components/ThreeViewer.tsx src/canvas/3d/components/ThreeViewerUI.tsx
git commit -m "feat(3d): box and cylinder primitive tools with height stage"
```

---

### Task 11: OffsetWallController

**Files:**
- Create: `src/canvas/3d/controllers/OffsetWallController.tsx`
- Modify: `src/canvas/3d/controllers/index.ts`
- Modify: `src/components/ThreeViewer.tsx` (mount; pass `allWallElements`)
- Modify: `src/canvas/3d/components/ThreeViewerUI.tsx` (toolbar button)

**Interfaces:**
- Consumes: `offsetWall` (Task 7), `useToolRaycast` (Task 3), `useNumericInput` (Task 2); `allWallElements` prop already computed in ThreeViewer (line 1512).
- Produces: `<OffsetWallController activeTool={string} center={{cx,cz}} wallElements={DrawingElement[]} />` handling tool `"wall-offset"`.

- [ ] **Step 1: Implement the controller**

```tsx
// src/canvas/3d/controllers/OffsetWallController.tsx
// Offset tool: click a wall to select it, move the pointer to preview a
// parallel wall at the pointer's perpendicular distance (or type meters +
// Enter), click again to commit.
import { useEffect, useMemo, useState } from "react";
import { useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { DrawingElement } from "../../../types";
import { useDrawingStore } from "../../../stores/drawingStore";
import { useToolRaycast } from "../interaction/useToolRaycast";
import { useNumericInput } from "../interaction/useNumericInput";
import { offsetWall } from "../geometry/shapeDraw";
import { worldToDrawing, drawingToWorld, type Center } from "../geometry/coordBridge";

// Signed perpendicular distance (drawing coords) from wall line a→b to point p.
function signedDistance(wall: DrawingElement, p: { x: number; y: number }): number {
  const dx = (wall.x2 ?? 0) - (wall.x1 ?? 0);
  const dy = (wall.y2 ?? 0) - (wall.y1 ?? 0);
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return 0;
  return ((p.x - (wall.x1 ?? 0)) * dy - (p.y - (wall.y1 ?? 0)) * dx) / len;
}

export function OffsetWallController({ activeTool, center, wallElements }: {
  activeTool: string; center: Center; wallElements: DrawingElement[];
}) {
  const active = activeTool === "wall-offset";
  const { raycastGround } = useToolRaycast();
  const { gl } = useThree();
  const formatLength = useDrawingStore((s) => s.formatLength);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [distance, setDistance] = useState(0);
  const numeric = useNumericInput(active && sourceId != null);

  const source = useMemo(
    () => wallElements.find((w) => w.id === sourceId && w.type === "line") ?? null,
    [wallElements, sourceId],
  );
  const preview = useMemo(
    () => (source && Math.abs(distance) > 1 ? offsetWall(source, distance) : null),
    [source, distance],
  );

  const commit = (d: number) => {
    if (!source) return;
    const el = offsetWall(source, d);
    if (el) useDrawingStore.getState().addElement(el);
    setSourceId(null); setDistance(0);
  };

  useEffect(() => {
    if (!active) { setSourceId(null); setDistance(0); return; }
    const pick = (e: PointerEvent): { pt: { x: number; y: number } } | null => {
      const g = raycastGround(e);
      return g ? { pt: worldToDrawing({ x: g.x, z: g.z }, center) } : null;
    };
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const hit = pick(e);
      if (!hit) return;
      if (!sourceId) {
        // Nearest wall whose perpendicular distance is under 40 drawing units.
        let best: { id: string; d: number } | null = null;
        for (const w of wallElements) {
          if (w.type !== "line" || w.x1 == null) continue;
          const d = Math.abs(signedDistance(w, hit.pt));
          if (d < 40 && (!best || d < best.d)) best = { id: w.id, d };
        }
        if (best) setSourceId(best.id);
      } else {
        commit(distance);
      }
    };
    const onMove = (e: PointerEvent) => {
      if (!source) return;
      const hit = pick(e);
      if (hit) setDistance(signedDistance(source, hit.pt));
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setSourceId(null); setDistance(0); }
    };
    gl.domElement.addEventListener("pointerdown", onDown);
    gl.domElement.addEventListener("pointermove", onMove);
    window.addEventListener("keydown", onKey);
    return () => {
      gl.domElement.removeEventListener("pointerdown", onDown);
      gl.domElement.removeEventListener("pointermove", onMove);
      window.removeEventListener("keydown", onKey);
    };
  }, [active, sourceId, source, distance, wallElements, raycastGround, gl, center]);

  // Typed distance (meters): offset to the side the pointer is currently on.
  useEffect(() => {
    if (!active || numeric.committed == null || !source) return;
    const meters = numeric.consume();
    if (meters != null) commit(Math.sign(distance || 1) * meters * 100);
  }, [active, numeric.committed, source, distance]);

  if (!active || !preview) return null;
  const a = drawingToWorld({ x: preview.x1!, y: preview.y1! }, center);
  const b = drawingToWorld({ x: preview.x2!, y: preview.y2! }, center);
  return (
    <group>
      <primitive object={(() => {
        const geo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(a.x, 2, a.z), new THREE.Vector3(b.x, 2, b.z),
        ]);
        return new THREE.Line(geo, new THREE.LineBasicMaterial({ color: "#f59e0b" }));
      })()} />
      <Html position={[(a.x + b.x) / 2, 12, (a.z + b.z) / 2]} center>
        <div className="bg-slate-900/90 text-amber-300 font-mono text-[9px] font-bold px-2 py-0.5 rounded border border-amber-500/30 whitespace-nowrap select-none">
          ↔ {formatLength(Math.abs(distance) / 100)}
          {numeric.buffer && <span className="ml-1">⌨ {numeric.buffer} m</span>}
        </div>
      </Html>
    </group>
  );
}
```

- [ ] **Step 2: Export, mount, toolbar**

- `controllers/index.ts`: `export { OffsetWallController } from "./OffsetWallController";`
- Mount in `Scene` (it already receives `allWallElements`): `<OffsetWallController activeTool={activeTool} center={{ cx, cz }} wallElements={allWallElements} />`
- Toolbar, after the `wall-move` button (line 172):

```tsx
<button onClick={() => setActiveTool("wall-offset")} className={cls("wall-offset")} title="Offset Wall — click a wall, then distance (or type m + Enter)">
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeWidth={2} d="M6 4v16M14 4v16M18 8l3 4-3 4" />
  </svg>
</button>
```

- [ ] **Step 3: Type-check + manual smoke test**

Run: `cd autocard/frontend && npx tsc --noEmit` — clean.
Dev server: wall-offset → click a wall → amber preview follows pointer → type `1.5` Enter → parallel wall 1.5 m away appears; drawn wall extrudes in 3D like any wall.

- [ ] **Step 4: Commit**

```bash
git add src/canvas/3d/controllers/OffsetWallController.tsx src/canvas/3d/controllers/index.ts src/components/ThreeViewer.tsx src/canvas/3d/components/ThreeViewerUI.tsx
git commit -m "feat(3d): wall offset tool with live preview and exact distance entry"
```

---

### Task 12: Paint tool — per-element material override

**Files:**
- Modify: `src/types.ts` (add `material?: string` to `DrawingElement`)
- Modify: `src/components/ThreeViewer.tsx` (paint branch in `handleElementClick`; palette state; mount panel)
- Modify: `src/canvas/3d/components/ThreeViewerUI.tsx` (toolbar button + `PaintPalettePanel`)
- Modify: `src/canvas/3d/components/FloorMesh.tsx` (read the override; `WallMesh` already takes `materialName` — the override is passed from the render sites)
- Modify: `src/components/ThreeViewer.tsx` `Scene`/`PlanModel` (pass per-wall override via a lookup)

Note: `RoomMesh` is a translucent room overlay, not a paintable surface — it is intentionally out of scope for paint.

**Interfaces:**
- Consumes: `MaterialService.getPresetList(): { id, label, color }[]` and `MaterialService.getMaterial(name)` (existing); element click plumbing from Task 6 (`paint3d` already in the click gates).
- Produces: `el.material?: string`; walls/floors/rooms render `el.material ?? <current default>`.

- [ ] **Step 1: Type field**

In `src/types.ts`, `DrawingElement`, after `pattern?: string;` (line 111) add:
```ts
  material?: string;   // 3D material preset override (MaterialService id)
```

- [ ] **Step 2: Paint state + click behavior in ThreeViewer**

```tsx
const [paintMaterial, setPaintMaterial] = useState("brick");
```
In `handleElementClick`, before the select branch:
```tsx
if (activeTool === "paint3d") {
  updateElement(id, { material: paintMaterial });
  return;
}
```
Mount the palette panel next to `PushPullPanel`:
```tsx
{activeTool === "paint3d" && (
  <PaintPalettePanel selected={paintMaterial} onSelect={setPaintMaterial} />
)}
```

- [ ] **Step 3: Palette panel + toolbar button in `ThreeViewerUI.tsx`**

```tsx
/** Bottom material palette shown while the paint tool is active. */
export function PaintPalettePanel({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  const presets = MaterialService.getPresetList();
  return (
    <div className="absolute left-1/2 -translate-x-1/2 bottom-8 z-20 bg-slate-900/90 backdrop-blur-md border border-slate-700/60 p-3 rounded-xl shadow-2xl flex items-center space-x-2 select-none">
      <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider mr-1">Paint</span>
      {presets.map((p) => (
        <button
          key={p.id}
          onClick={() => onSelect(p.id)}
          title={p.label}
          className={`w-7 h-7 rounded-lg border-2 transition-all ${selected === p.id ? "border-blue-500 scale-110" : "border-white/10 hover:border-white/40"}`}
          style={{ background: p.color }}
        />
      ))}
    </div>
  );
}
```
Toolbar button (after the measure button):
```tsx
<button onClick={() => setActiveTool("paint3d")} className={cls("paint3d")} title="Paint — pick a material, click a surface">
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l6-6 4 4 6-6M4 16v4h16v-4M9 3l6 6" />
  </svg>
</button>
```

- [ ] **Step 4: Meshes read the override**

- `WallMesh` / `InstancedWallsMesh` already take `materialName`. In `PlanModel` and the DXF branch of `ThreeViewer.tsx`, walls are built from elements — build a lookup and pass it through:
```tsx
// in Scene (ThreeViewer.tsx), near the top:
const materialById = useMemo(() => {
  const m = new Map<string, string>();
  for (const el of elements) if (typeof el.material === "string") m.set(el.id, el.material);
  return m;
}, [elements]);
```
  Pass `materialName={materialById.get(segment.id) ?? facadeMaterial}` at every `WallMesh` render site in `PlanModel` (add a `materialById?: Map<string, string>` prop to `PlanModel`, default empty map, and forward it from `Scene`). `InstancedWallsMesh` keeps the shared facade material (instanced = one material; per-instance override is out of scope — the instanced path only activates above 100 walls, which is fine for v1).
- `FloorMesh.tsx`: the material is built in a `useMemo` keyed on `finish` (lines 40–49). Add the override branch:

```tsx
// add import at top:
import { MaterialService } from "../materials/materialService";

// replace the material useMemo:
const material = useMemo(() => {
  if (typeof el.material === "string") {
    const m = MaterialService.getMaterial(el.material).clone();
    m.side = THREE.DoubleSide;
    return m;
  }
  return new THREE.MeshStandardMaterial({
    color: FINISH_COLORS[finish] ?? FINISH_COLORS[DEFAULT_FINISH],
    roughness: 0.9,
    metalness: 0,
    side: THREE.DoubleSide,
  });
}, [finish, el.material]);
```
- `FloorMesh` also needs click plumbing for paint: add optional `activeTool` / `onElementClick` props mirroring `FlatElementMesh` (`onClick={(e) => { if (activeTool === "paint3d" || activeTool === "select" || activeTool === "eraser") { e.stopPropagation(); onElementClick?.(el.id); } }}` on the mesh) and pass both props at the `FloorMesh` render site in `Scene` (ThreeViewer.tsx line 958).

- [ ] **Step 5: Type-check + manual smoke test**

Run: `cd autocard/frontend && npx tsc --noEmit` — clean.
Dev server: paint3d → palette appears → pick "Gạch đỏ" (brick) → click a wall → that wall alone renders brick; Ctrl+Z reverts it.

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/components/ThreeViewer.tsx src/canvas/3d/components/ThreeViewerUI.tsx src/canvas/3d/components/FloorMesh.tsx
git commit -m "feat(3d): paint tool — per-element material override"
```

---

### Task 13: Draggable section planes

**Files:**
- Modify: `src/stores/slices/sceneSlice.ts` (section state)
- Create: `src/canvas/3d/controllers/SectionPlaneController.tsx`
- Modify: `src/canvas/3d/controllers/index.ts`
- Modify: `src/components/ThreeViewer.tsx` (replace `sectionCut` boolean plumbing)
- Modify: `src/canvas/3d/components/ThreeViewerUI.tsx` (section UI: axis picker replaces the toggle)

**Interfaces:**
- Consumes: `gl.clippingPlanes` wiring in `Scene` (ThreeViewer.tsx lines 776–787).
- Produces: `sceneSlice` gains `section: { enabled: boolean; axis: "x" | "y" | "z"; offset: number }` and `setSection(patch: Partial<SectionState>): void`. `sectionCut` local state in ThreeViewer is removed.

- [ ] **Step 1: Store state**

In `sceneSlice.ts` add:
```ts
export interface SectionState { enabled: boolean; axis: "x" | "y" | "z"; offset: number }
```
To `SceneSlice` interface: `section: SectionState; setSection(patch: Partial<SectionState>): void;`
To the creator: `section: { enabled: false, axis: "x", offset: 0 },` and
```ts
setSection: (patch) => set((s) => ({ section: { ...s.section, ...patch } })),
```

- [ ] **Step 2: Replace the boolean plumbing**

In `ThreeViewer.tsx`:
- Delete `const [sectionCut, setSectionCut] = useState(false);` (line 1120); read `const section = useDrawingStore((s) => s.section);` and `const setSection = useDrawingStore((s) => s.setSection);`
- `Scene` prop `sectionCut: boolean` → `section: SectionState` (import the type from the slice). Update the clipping effect:
```tsx
useEffect(() => {
  gl.localClippingEnabled = section.enabled;
  if (section.enabled) {
    const normal = section.axis === "x" ? new THREE.Vector3(1, 0, 0)
      : section.axis === "y" ? new THREE.Vector3(0, -1, 0)
      : new THREE.Vector3(0, 0, 1);
    const constant = section.axis === "x" ? -(cx + section.offset)
      : section.axis === "y" ? section.offset
      : -(cz + section.offset);
    gl.clippingPlanes = [new THREE.Plane(normal, constant)];
  } else {
    gl.clippingPlanes = [];
  }
  return () => { gl.clippingPlanes = []; };
}, [section, cx, cz, gl]);
```
- In `RightSidebar` (`ThreeViewerUI.tsx`), replace the `["Section cut", sectionCut, setSectionCut]` toggle row (line 840) with an enabled toggle plus an axis segment control (X/Y/Z buttons calling `setSection({ axis })`) and pass `section`/`setSection` down instead of `sectionCut`/`setSectionCut` (update the prop types at lines 698/718 accordingly).

- [ ] **Step 3: Drag gizmo controller**

```tsx
// src/canvas/3d/controllers/SectionPlaneController.tsx
// Visualizes the active section plane and lets the user drag it along its
// axis. Dragging updates sceneSlice.section.offset live.
import { useRef, useState } from "react";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { useDrawingStore } from "../../../stores/drawingStore";

export function SectionPlaneController({ span, orbitTarget }: { span: number; orbitTarget: [number, number, number] }) {
  const section = useDrawingStore((s) => s.section);
  const setSection = useDrawingStore((s) => s.setSection);
  const [dragging, setDragging] = useState(false);
  const startRef = useRef<{ mouse: number; offset: number }>({ mouse: 0, offset: 0 });

  if (!section.enabled) return null;

  const size = Math.max(600, span * 1.2);
  const pos: [number, number, number] =
    section.axis === "x" ? [section.offset, size / 4, orbitTarget[2]]
    : section.axis === "y" ? [orbitTarget[0], section.offset, orbitTarget[2]]
    : [orbitTarget[0], size / 4, section.offset];
  const rot: [number, number, number] =
    section.axis === "x" ? [0, Math.PI / 2, 0]
    : section.axis === "y" ? [-Math.PI / 2, 0, 0]
    : [0, 0, 0];

  return (
    <group>
      <mesh
        position={pos}
        rotation={rot}
        onPointerDown={(e) => {
          e.stopPropagation();
          (e.target as Element).setPointerCapture?.(e.pointerId);
          setDragging(true);
          startRef.current = { mouse: section.axis === "y" ? e.clientY : e.clientX, offset: section.offset };
        }}
        onPointerMove={(e) => {
          if (!dragging) return;
          e.stopPropagation();
          const cur = section.axis === "y" ? e.clientY : e.clientX;
          const delta = (section.axis === "y" ? -(cur - startRef.current.mouse) : cur - startRef.current.mouse) * (span / 500);
          setSection({ offset: startRef.current.offset + delta });
        }}
        onPointerUp={() => setDragging(false)}
      >
        <planeGeometry args={[size, size / 2]} />
        <meshBasicMaterial color="#3b82f6" transparent opacity={dragging ? 0.25 : 0.12} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <Html position={[pos[0], pos[1] + size / 4 + 10, pos[2]]} center>
        <div className="bg-blue-700/90 text-white text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap select-none">
          Section {section.axis.toUpperCase()} — drag to move
        </div>
      </Html>
    </group>
  );
}
```
Export from `controllers/index.ts`, mount in `Scene` (after `<RoomLabels …/>`): `<SectionPlaneController span={span} orbitTarget={orbitTarget} />`. While dragging, orbit must not rotate: pointer events on the plane call `stopPropagation()`, which drei/R3F respects for OrbitControls-vs-mesh conflicts; verify during smoke test and if the camera still moves, set `enabled={… && !sectionDragging}` on OrbitControls with a piece of state lifted to `Scene`.

- [ ] **Step 4: Type-check + manual smoke test**

Run: `cd autocard/frontend && npx tsc --noEmit` — clean.
Dev server: enable Section in the sidebar → translucent blue plane appears → drag it → building clips progressively; switch axis to Z → plane reorients; disable → clipping gone.

- [ ] **Step 5: Commit**

```bash
git add src/stores/slices/sceneSlice.ts src/canvas/3d/controllers/SectionPlaneController.tsx src/canvas/3d/controllers/index.ts src/components/ThreeViewer.tsx src/canvas/3d/components/ThreeViewerUI.tsx
git commit -m "feat(3d): draggable section planes on X/Y/Z axes"
```

---

### Task 14: Undo/redo wiring + toolbar grouping + Esc consistency

**Files:**
- Modify: `src/components/ThreeViewer.tsx` (keyboard undo/redo; two-stage Esc)
- Modify: `src/canvas/3d/components/ThreeViewerUI.tsx` (toolbar flyout groups + undo/redo buttons)

**Interfaces:**
- Consumes: `undo()`, `redo()`, `history`, `historyIndex` from `elementSlice` (already exist).
- Produces: final toolbar structure; no new exports.

- [ ] **Step 1: Undo/redo keys in the 3D view**

In `ThreeViewer.tsx`, add alongside the Escape handler effect:
```tsx
useEffect(() => {
  if (!visible) return;
  const onKey = (e: KeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;
    if (e.key.toLowerCase() === "z") {
      e.preventDefault();
      const { undo, redo } = useDrawingStore.getState();
      if (e.shiftKey) redo(); else undo();
    } else if (e.key.toLowerCase() === "y") {
      e.preventDefault();
      useDrawingStore.getState().redo();
    }
  };
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}, [visible]);
```

- [ ] **Step 2: Two-stage Escape**

Replace the existing Escape effect (lines 1232–1243): first Esc cancels the in-progress gesture (drawing state, measure points, selection) but keeps the tool; second Esc (nothing in progress) returns to `select`:
```tsx
useEffect(() => {
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    const hadGesture = activeDrawingState !== null || measurePoints.start !== null
      || useDrawingStore.getState().selectedElementIds.length > 0;
    setActiveDrawingState(null);
    setMeasurePoints({ start: null, end: null });
    useDrawingStore.getState().setSelectedElementIds([]);
    if (!hadGesture) setActiveTool("select");
  };
  window.addEventListener("keydown", handleEscape);
  return () => window.removeEventListener("keydown", handleEscape);
}, [activeDrawingState, measurePoints.start]);
```
(Controllers keep their own Escape cleanup for tool-local state like chain points — that is the "gesture" layer and already exists.)

- [ ] **Step 3: Toolbar flyout groups**

`ThreeToolbar` in `ThreeViewerUI.tsx` now has ~24 buttons. Restructure into collapsible groups with a small header per group (keep every existing button and `cls` styling; this is layout-only):

```tsx
function ToolGroup({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="w-full flex flex-col items-center">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full text-[7px] font-black text-slate-500 uppercase tracking-widest py-0.5 hover:text-slate-300"
        title={open ? `Collapse ${label}` : `Expand ${label}`}
      >
        {label}
      </button>
      {open && <div className="flex flex-col space-y-1 items-center w-full">{children}</div>}
    </div>
  );
}
```
Group assignment (order top→bottom):
1. **Edit** — select, eraser, undo, redo
2. **Draw** — wall3d, floor3d, rect3d, circle3d, arc3d, box3d, cylinder3d, line (draw-on-face)
3. **Modify** — pushpull, wall-move, wall-offset, wall-height, door-place3d, window-place3d, paint3d
4. **View** — orbit, pan, zoom, walk
5. **Analyze** — measure, floor-pick (+ reset), analyze, detect-rooms

Undo/redo buttons inside **Edit**:
```tsx
<button onClick={() => useDrawingStore.getState().undo()} className={idle + " p-1.5 rounded-lg"} title="Undo (Ctrl+Z)">
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a5 5 0 015 5v1M3 10l5-5M3 10l5 5" />
  </svg>
</button>
<button onClick={() => useDrawingStore.getState().redo()} className={idle + " p-1.5 rounded-lg"} title="Redo (Ctrl+Shift+Z)">
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a5 5 0 00-5 5v1M21 10l-5-5M21 10l-5 5" />
  </svg>
</button>
```
Add `import { useDrawingStore } from "../../../stores/drawingStore";` to `ThreeViewerUI.tsx`. The toolbar container may need `overflow-y-auto max-h-[80vh]` to stay on screen with all groups open.

- [ ] **Step 3b: Per-tool cursor**

In `ThreeViewer.tsx`, on the canvas-area div (line 1436, `className="absolute inset-0 top-9 right-56"`), add a cursor style driven by the tool:

```tsx
const TOOL_CURSORS: Record<string, string> = {
  select: "default", eraser: "not-allowed", pan: "grab", zoom: "zoom-in",
  wall3d: "crosshair", floor3d: "crosshair", rect3d: "crosshair", circle3d: "crosshair",
  arc3d: "crosshair", box3d: "crosshair", cylinder3d: "crosshair", line: "crosshair",
  measure: "crosshair", "wall-offset": "crosshair", paint3d: "cell",
  "door-place3d": "copy", "window-place3d": "copy", "wall-move": "ew-resize",
};
// on the div:
style={{ cursor: TOOL_CURSORS[activeTool] ?? "default" }}
```

- [ ] **Step 4: Type-check, full test run, manual smoke test**

Run: `cd autocard/frontend && npx tsc --noEmit && npx vitest run`
Expected: clean type-check, all tests PASS.
Dev server: draw a wall → Ctrl+Z removes → Ctrl+Shift+Z restores; Esc mid-wall-chain cancels the chain but keeps the wall tool; second Esc returns to select; toolbar groups collapse/expand.

- [ ] **Step 5: Commit**

```bash
git add src/components/ThreeViewer.tsx src/canvas/3d/components/ThreeViewerUI.tsx
git commit -m "feat(3d): undo/redo wiring, grouped toolbar, two-stage Escape"
```

---

### Task 15: Avatar walkthrough — humanoid figure walking into rooms

**Files:**
- Create: `src/canvas/3d/geometry/roomLookup.ts`
- Test: `src/canvas/3d/geometry/roomLookup.test.ts`
- Create: `src/canvas/3d/components/AvatarMesh.tsx`
- Create: `src/canvas/3d/controllers/AvatarWalkController.tsx`
- Modify: `src/canvas/3d/controllers/index.ts`
- Modify: `src/components/ThreeViewer.tsx` (mount controller; visited-rooms + toast UI state)
- Modify: `src/canvas/3d/components/ThreeViewerUI.tsx` (toolbar button + `VisitedRoomsPanel`)

**Interfaces:**
- Consumes: `detectRooms(elements): DetectedRoom[]` (existing, `src/canvas/3d/geometry/roomDetector.ts`, returns `{ id, polygon: {x,y}[], area }[]`); `worldToDrawing`/`Center` from `coordBridge`; `useToolRaycast` (Task 3).
- Produces: `pointInRoom(pt, rooms: RoomPolygon[]): RoomPolygon | null`; `<AvatarMesh walkingRef={React.RefObject<boolean>} />`; `<AvatarWalkController activeTool center elements onRoomChange={(name: string | null) => void} />` handling tool `"walk-avatar"`.

- [ ] **Step 1: Write the failing test for room lookup**

```ts
// src/canvas/3d/geometry/roomLookup.test.ts
import { describe, it, expect } from "vitest";
import { pointInRoom } from "./roomLookup";

const room = { id: "r1", polygon: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }] };

describe("pointInRoom", () => {
  it("finds the room containing the point", () => {
    expect(pointInRoom({ x: 50, y: 50 }, [room])).toBe(room);
  });
  it("returns null outside every room", () => {
    expect(pointInRoom({ x: 200, y: 200 }, [room])).toBeNull();
  });
  it("returns null when there are no rooms", () => {
    expect(pointInRoom({ x: 1, y: 1 }, [])).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd autocard/frontend && npx vitest run src/canvas/3d/geometry/roomLookup.test.ts`
Expected: FAIL — cannot resolve `./roomLookup`.

- [ ] **Step 3: Implement `roomLookup.ts`**

```ts
// src/canvas/3d/geometry/roomLookup.ts
// Point-in-room lookup for the avatar walkthrough — reuses detectRooms'
// polygon output (drawing-space coords) to answer "which room is pt in?".
export interface RoomPolygon { id: string; polygon: { x: number; y: number }[] }

export function pointInRoom(pt: { x: number; y: number }, rooms: RoomPolygon[]): RoomPolygon | null {
  for (const room of rooms) {
    if (pointInPolygon(pt, room.polygon)) return room;
  }
  return null;
}

function pointInPolygon(p: { x: number; y: number }, poly: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
    const intersect = yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi + 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd autocard/frontend && npx vitest run src/canvas/3d/geometry/roomLookup.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Implement `AvatarMesh`**

```tsx
// src/canvas/3d/components/AvatarMesh.tsx
// Walking avatar body for the room-to-room walkthrough tool. Same
// proportions as the static scale Mannequin in ThreeViewer.tsx, with a
// simple leg-swing cycle read from a ref (not a prop) so the parent
// controller can drive it without forcing a React re-render every frame.
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export function AvatarMesh({ walkingRef }: { walkingRef: React.RefObject<boolean> }) {
  const legL = useRef<THREE.Mesh>(null!);
  const legR = useRef<THREE.Mesh>(null!);
  const phase = useRef(0);

  useFrame((_, dt) => {
    if (walkingRef.current) phase.current += dt * 9;
    const swing = walkingRef.current ? Math.sin(phase.current) * 0.5 : 0;
    if (legL.current) legL.current.rotation.x = swing;
    if (legR.current) legR.current.rotation.x = -swing;
  });

  const mat = <meshStandardMaterial color="#fb7185" roughness={0.7} />;
  return (
    <group>
      <mesh position={[0, 0.95, 0]} castShadow><cylinderGeometry args={[0.22, 0.2, 0.85, 8]} />{mat}</mesh>
      <mesh position={[0, 1.62, 0]} castShadow><sphereGeometry args={[0.17, 12, 12]} />{mat}</mesh>
      <mesh ref={legL} position={[-0.12, 0.33, 0]} castShadow>
        <cylinderGeometry args={[0.085, 0.075, 0.66, 6]} />{mat}
      </mesh>
      <mesh ref={legR} position={[0.12, 0.33, 0]} castShadow>
        <cylinderGeometry args={[0.085, 0.075, 0.66, 6]} />{mat}
      </mesh>
    </group>
  );
}
```

- [ ] **Step 6: Implement `AvatarWalkController`**

```tsx
// src/canvas/3d/controllers/AvatarWalkController.tsx
// "Walk into rooms" tool: click the ground to send the avatar there at human
// walking speed; reports the room it's currently standing in via onRoomChange
// so the UI can show a toast and track visited rooms. Position/rotation are
// driven imperatively each frame (group ref, not React state) to avoid a
// re-render at 60fps.
import { useEffect, useMemo, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { DrawingElement } from "../../../types";
import { useToolRaycast } from "../interaction/useToolRaycast";
import { detectRooms } from "../geometry/roomDetector";
import { pointInRoom } from "../geometry/roomLookup";
import { worldToDrawing, type Center } from "../geometry/coordBridge";
import { AvatarMesh } from "../components/AvatarMesh";

const WALK_SPEED = 140; // scene units / s ≈ 1.4 m/s

export function AvatarWalkController({ activeTool, center, elements, onRoomChange }: {
  activeTool: string;
  center: Center;
  elements: DrawingElement[];
  onRoomChange: (roomName: string | null) => void;
}) {
  const active = activeTool === "walk-avatar";
  const { raycastGround } = useToolRaycast();
  const { gl } = useThree();
  const groupRef = useRef<THREE.Group>(null!);
  const posRef = useRef(new THREE.Vector3(0, 0, 0));
  const targetRef = useRef<THREE.Vector3 | null>(null);
  const walkingRef = useRef(false);
  const currentRoomId = useRef<string | null>(null);

  const rooms = useMemo(
    () => detectRooms(elements).map((r) => ({ id: r.id, polygon: r.polygon })),
    [elements],
  );

  useEffect(() => {
    if (!active) return;
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const p = raycastGround(e);
      if (p) targetRef.current = p.clone();
    };
    gl.domElement.addEventListener("pointerdown", onDown);
    return () => gl.domElement.removeEventListener("pointerdown", onDown);
  }, [active, raycastGround, gl]);

  useFrame((_, dt) => {
    const group = groupRef.current;
    if (!group) return;
    const target = targetRef.current;
    walkingRef.current = target != null;
    if (target) {
      const dir = target.clone().sub(posRef.current);
      const dist = dir.length();
      const step = Math.min(dist, WALK_SPEED * dt);
      if (dist > 1e-3) {
        dir.normalize();
        posRef.current.addScaledVector(dir, step);
        group.rotation.y = Math.atan2(dir.x, dir.z);
      }
      if (dist <= step + 1e-3) targetRef.current = null;
      group.position.set(posRef.current.x, 0, posRef.current.z);
    }

    const drawingPt = worldToDrawing({ x: posRef.current.x, z: posRef.current.z }, center);
    const room = pointInRoom(drawingPt, rooms);
    if ((room?.id ?? null) !== currentRoomId.current) {
      currentRoomId.current = room?.id ?? null;
      onRoomChange(room ? `Phòng ${room.id}` : null);
    }
  });

  return (
    <group ref={groupRef}>
      <AvatarMesh walkingRef={walkingRef} />
    </group>
  );
}
```

- [ ] **Step 7: Export, mount, wire the room-enter UI**

- `controllers/index.ts`: `export { AvatarWalkController } from "./AvatarWalkController";`
- In `ThreeViewer.tsx`, add state near the other viewer-local state:
```tsx
const [visitedRooms, setVisitedRooms] = useState<Set<string>>(new Set());
const [roomToast, setRoomToast] = useState<string | null>(null);
const roomToastTimer = useRef<ReturnType<typeof setTimeout>>();
const handleRoomChange = useCallback((roomName: string | null) => {
  if (!roomName) return;
  setVisitedRooms((prev) => new Set(prev).add(roomName));
  setRoomToast(`Đã bước vào ${roomName}`);
  clearTimeout(roomToastTimer.current);
  roomToastTimer.current = setTimeout(() => setRoomToast(null), 1800);
}, []);
```
  Mount in `Scene`'s fragment: `<AvatarWalkController activeTool={activeTool} center={{ cx, cz }} elements={elements} onRoomChange={handleRoomChange} />`
  Render the toast + visited list as HTML overlays in the canvas area (next to the existing `notice` banner), and pass `visitedRooms` to a new `VisitedRoomsPanel` in `ThreeViewerUI.tsx` shown when `activeTool === "walk-avatar" || visitedRooms.size > 0`.
- Toolbar button (after `walk`, in `ThreeToolbar`):
```tsx
<button onClick={() => setActiveTool("walk-avatar")} className={cls("walk-avatar")} title="Đi bộ vào phòng — click điểm đến, nhân vật tự đi tới và báo phòng đang đứng trong">
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM10 7l-1.5 4 2 1.5-.5 5m3-9.5l1.5 3.5-2 2 2.5 4.5M8 12l-2.5 1.5" />
  </svg>
</button>
```
- `OrbitControls` `enabled` (ThreeViewer.tsx line 1008): leave enabled for `walk-avatar` (orbiting while the avatar walks is intended, per spec Phase 6).

- [ ] **Step 8: Type-check + manual smoke test**

Run: `cd autocard/frontend && npx tsc --noEmit` — clean.
Dev server: switch to `walk-avatar` → click across a room boundary → avatar walks there, legs swing, faces travel direction; toast "Đã bước vào <room>" appears; visited-rooms panel marks that room; switching to another tool mid-walk does not stop the avatar (it keeps walking, per the always-mounted controller).

- [ ] **Step 9: Commit**

```bash
git add src/canvas/3d/geometry/roomLookup.ts src/canvas/3d/geometry/roomLookup.test.ts src/canvas/3d/components/AvatarMesh.tsx src/canvas/3d/controllers/AvatarWalkController.tsx src/canvas/3d/controllers/index.ts src/components/ThreeViewer.tsx src/canvas/3d/components/ThreeViewerUI.tsx
git commit -m "feat(3d): avatar walkthrough — humanoid walks to a clicked point and reports the room it enters"
```

---

## Final verification (after all tasks)

- [ ] `cd autocard/frontend && npx tsc --noEmit` — clean (ignoring the known `StoreOrderPage.tsx:493`).
- [ ] `cd autocard/frontend && npx vitest run` — all tests pass (existing + ~37 new).
- [ ] Full manual pass in the dev app (`npm run dev`, port 51530, 3D mode): draw snapped walls with exact lengths → draw shapes/primitives → transform-gizmo move/rotate/scale/copy → offset a wall → paint materials → drag a section plane → walk the avatar through every room → undo the whole stack with Ctrl+Z.
- [ ] Use the superpowers:verification-before-completion skill before claiming done.
