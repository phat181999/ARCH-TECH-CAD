# House-Planner Parity (Roofs · Wall Fixtures · 2D Sheets) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the capabilities of the user's `house_planner_demo.html` / `house_planner_demo_2.html` that AutoCard lacks into the 3D viewer: (1) roofs whose orientation/shape follow a user-drawn ridge line, (2) MEP fixtures (công tắc, ổ cắm, hộp nối, tủ điện, van, co ống) that snap onto walls at type-appropriate heights, (3) one-click 2D drawing export (mặt bằng / mặt đứng trước / mặt đứng bên) as PNG rendered from the 3D model, and (4) the demo-2 toolbar redesign — compact icon rail with hover tooltips, flyout tool groups, and a persistent current-tool badge.

**Architecture:** Follows the patterns established by the 2026-07-06 plan: pure geometry in `canvas/3d/geometry/` with vitest tests; tools as controllers in `canvas/3d/controllers/` gated by `activeTool` and mounted in `Scene`; state in Zustand slices; UI panels in `ThreeViewerUI.tsx`. The 2D export reuses the existing `exportTrigger` pattern (a trigger component inside `<Canvas>`).

**Tech Stack:** React 19 + TypeScript, @react-three/fiber, @react-three/drei, three.js, Zustand, vitest.

**Source spec:** `~/Downloads/Tai_lieu_cong_cu_ve_nha_3D.docx` + `~/Downloads/house_planner_demo.html` (demo source; its `generateRoof`, `nearestWall`, MEP height table, and `captureAndDownload` are the reference implementations) + `~/Downloads/house_planner_demo_2.html` (toolbar redesign reference: `#rail` icon buttons with `.tt` tooltips, `.flyout` group menus via `wireGroup`, `#toolBadge` current-tool pill).

## Gap analysis (why only these three)

| Demo feature | AutoCard today | Verdict |
|---|---|---|
| Wall drawing w/ grid snap | `wall3d` tool with endpoint/midpoint/axis/grid snap + numeric entry (better) | ✅ exists |
| Furniture placement | Block library + `BlockElementMesh` (richer) | ✅ exists |
| Doors/windows on walls | `DoorPlacerController` | ✅ exists |
| Save/load project | Backend persistence + DXF import | ✅ exists |
| Roof style + pitch | `RoofGenerator` (flat/gable/hip/shed) + RightSidebar controls | ⚠️ partial — no ridge-line control (orientation is auto, hip ridge length fixed, shed side fixed) |
| Wall-snapped MEP fixtures | MEP *runs* exist (Task 17/18); no wall-mounted devices | ❌ new |
| 2D sheet export (PNG) from 3D | GLTF/IFC export only | ❌ new |
| Icon-rail toolbar: flyout groups + tooltips + current-tool badge (demo 2) | ~30 buttons stacked in tall collapsible columns; no flyouts, no active-tool indicator | ⚠️ partial — redesign in Task 8 |

Out of scope (per demo's own "limitations/future" sections): CSG wall openings, vector (SVG/DXF) sheet export with dimensions, multi-storey roof subdivision.

## Global Constraints

- All frontend paths relative to `autocard/frontend/`.
- Type-check after every task: `cd autocard/frontend && npx tsc --noEmit` — must stay clean.
- Unit tests: `cd autocard/frontend && npx vitest run <file>`.
- Coordinates: 2D drawing coords are px (X right, Y down); 3D maps X→X, Y→Z; 100 units = 1 m; scene group offset by `(-cx, 0, -cz)`.
- Frontend tools only call store methods; do NOT touch `src/cad/`.
- Match existing code style; commit after every task.

---

### Task 1: Ridge-line math + store state

**Files:**
- Create: `src/canvas/3d/geometry/roofRidge.ts`
- Test: `src/canvas/3d/geometry/roofRidge.test.ts`
- Modify: `src/stores/slices/sceneSlice.ts` (add `roofRidge` + `setRoofRidge`)

**Interfaces:**
- Produces (used by Tasks 2, 3):
  - `interface RidgeLine { x1: number; y1: number; x2: number; y2: number }` (drawing coords)
  - `interface RidgeParams { alongX: boolean; ridgeLen: number; highSide: 1 | -1 }`
  - `deriveRidgeParams(ridge: RidgeLine, bounds: { minX: number; maxX: number; minZ: number; maxZ: number }): RidgeParams`
  - Store: `roofRidge: RidgeLine | null`, `setRoofRidge(r: RidgeLine | null): void`

- [x] **Step 1: Write the failing tests**

```ts
// src/canvas/3d/geometry/roofRidge.test.ts
import { describe, it, expect } from "vitest";
import { deriveRidgeParams } from "./roofRidge";

const bounds = { minX: 0, maxX: 1000, minZ: 0, maxZ: 600 };

describe("deriveRidgeParams", () => {
  it("detects an X-aligned ridge and its length", () => {
    const p = deriveRidgeParams({ x1: 100, y1: 300, x2: 700, y2: 300 }, bounds);
    expect(p.alongX).toBe(true);
    expect(p.ridgeLen).toBeCloseTo(600);
  });

  it("detects a Z-aligned ridge", () => {
    const p = deriveRidgeParams({ x1: 500, y1: 100, x2: 520, y2: 500 }, bounds);
    expect(p.alongX).toBe(false);
  });

  it("highSide is +1 when the ridge sits past the footprint center on the cross axis", () => {
    // X-aligned ridge at y=500; center y is 300 → +1
    expect(deriveRidgeParams({ x1: 0, y1: 500, x2: 800, y2: 500 }, bounds).highSide).toBe(1);
    expect(deriveRidgeParams({ x1: 0, y1: 100, x2: 800, y2: 100 }, bounds).highSide).toBe(-1);
  });

  it("highSide for a Z-aligned ridge uses the X axis", () => {
    expect(deriveRidgeParams({ x1: 900, y1: 0, x2: 900, y2: 600 }, bounds).highSide).toBe(1);
    expect(deriveRidgeParams({ x1: 100, y1: 0, x2: 100, y2: 600 }, bounds).highSide).toBe(-1);
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `cd autocard/frontend && npx vitest run src/canvas/3d/geometry/roofRidge.test.ts`
Expected: FAIL — cannot resolve `./roofRidge`.

- [x] **Step 3: Implement**

```ts
// src/canvas/3d/geometry/roofRidge.ts
// Interprets the user-drawn ridge line (mặt bằng, drawing coords) as roof
// parameters: which axis the ridge runs along, its length (drives the hip
// ridge — 0 → pyramid), and which side of the footprint is "high" (drives
// the shed roof's tall edge). Mirrors house_planner_demo.html's generateRoof.
export interface RidgeLine { x1: number; y1: number; x2: number; y2: number }
export interface RidgeParams { alongX: boolean; ridgeLen: number; highSide: 1 | -1 }

export function deriveRidgeParams(
  ridge: RidgeLine,
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
): RidgeParams {
  const dx = ridge.x2 - ridge.x1;
  const dy = ridge.y2 - ridge.y1;
  const alongX = Math.abs(dx) >= Math.abs(dy);
  const ridgeLen = Math.hypot(dx, dy);
  // Cross-axis midpoint of the ridge vs footprint center decides the high side.
  const mid = alongX ? (ridge.y1 + ridge.y2) / 2 : (ridge.x1 + ridge.x2) / 2;
  const center = alongX ? (bounds.minZ + bounds.maxZ) / 2 : (bounds.minX + bounds.maxX) / 2;
  return { alongX, ridgeLen, highSide: mid >= center ? 1 : -1 };
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `cd autocard/frontend && npx vitest run src/canvas/3d/geometry/roofRidge.test.ts`
Expected: PASS (4 tests).

- [x] **Step 5: Store state**

In `src/stores/slices/sceneSlice.ts`, next to the `section` field added by the previous plan:
- Import the type: `import type { RidgeLine } from "../../canvas/3d/geometry/roofRidge";`
- `SceneSlice` interface: add `roofRidge: RidgeLine | null;` and `setRoofRidge(r: RidgeLine | null): void;`
- Creator: add `roofRidge: null,` and `setRoofRidge: (roofRidge) => set({ roofRidge }),`

- [x] **Step 6: Type-check and commit**

```bash
cd autocard/frontend && npx tsc --noEmit
git add src/canvas/3d/geometry/roofRidge.ts src/canvas/3d/geometry/roofRidge.test.ts src/stores/slices/sceneSlice.ts
git commit -m "feat(3d): ridge-line math + roofRidge store state"
```

---

### Task 2: RoofGenerator honors ridge parameters

**Files:**
- Modify: `src/canvas/3d/geometry/RoofGenerator.ts`
- Test: `src/canvas/3d/geometry/RoofGenerator.test.ts`

**Interfaces:**
- Consumes: `RidgeParams` from Task 1.
- Produces: `RoofGenerator.generate(type, x, z, width, depth, wallHeight, pitchAngle = 30, ridge?: RidgeParams)` — same return (`THREE.BufferGeometry`); with `ridge` set: gable/hip orientation follows `ridge.alongX`, hip ridge length follows `ridge.ridgeLen` (clamped; 0 → pyramid), shed's high edge follows `ridge.alongX` + `ridge.highSide`. Without `ridge`, behavior is unchanged.

- [x] **Step 1: Write the failing tests**

```ts
// src/canvas/3d/geometry/RoofGenerator.test.ts
import { describe, it, expect } from "vitest";
import { RoofGenerator } from "./RoofGenerator";

// Collect [x,y,z] triples with the maximum y from a generated geometry.
function apexVerts(geo: import("three").BufferGeometry): [number, number, number][] {
  const pos = geo.getAttribute("position");
  let maxY = -Infinity;
  for (let i = 0; i < pos.count; i++) maxY = Math.max(maxY, pos.getY(i));
  const out: [number, number, number][] = [];
  for (let i = 0; i < pos.count; i++) {
    if (Math.abs(pos.getY(i) - maxY) < 1e-6) out.push([pos.getX(i), pos.getY(i), pos.getZ(i)]);
  }
  return out;
}

describe("RoofGenerator with ridge params", () => {
  it("gable ridge follows alongX=false even on a wide footprint", () => {
    const geo = RoofGenerator.generate("gable", 0, 0, 1000, 600, 260, 30, { alongX: false, ridgeLen: 600, highSide: 1 });
    // ridge along Z → every apex vertex sits at x = width/2
    for (const [x] of apexVerts(geo)) expect(x).toBeCloseTo(500);
  });

  it("hip with ridgeLen 0 degenerates to a pyramid (single apex point)", () => {
    const geo = RoofGenerator.generate("hip", 0, 0, 1000, 600, 260, 30, { alongX: true, ridgeLen: 0, highSide: 1 });
    const apex = apexVerts(geo);
    for (const [x, , z] of apex) { expect(x).toBeCloseTo(500); expect(z).toBeCloseTo(300); }
  });

  it("hip ridge length is respected", () => {
    const geo = RoofGenerator.generate("hip", 0, 0, 1000, 600, 260, 30, { alongX: true, ridgeLen: 400, highSide: 1 });
    const xs = apexVerts(geo).map(([x]) => x);
    expect(Math.min(...xs)).toBeCloseTo(300); // (1000-400)/2
    expect(Math.max(...xs)).toBeCloseTo(700);
  });

  it("shed high edge follows highSide across the ridge's cross axis", () => {
    const hi = RoofGenerator.generate("shed", 0, 0, 1000, 600, 260, 30, { alongX: true, ridgeLen: 0, highSide: 1 });
    for (const [, , z] of apexVerts(hi)) expect(z).toBeCloseTo(600); // +Z edge high
    const lo = RoofGenerator.generate("shed", 0, 0, 1000, 600, 260, 30, { alongX: true, ridgeLen: 0, highSide: -1 });
    for (const [, , z] of apexVerts(lo)) expect(z).toBeCloseTo(0);
  });

  it("without ridge params behavior is unchanged (gable ridge along the long axis)", () => {
    const geo = RoofGenerator.generate("gable", 0, 0, 1000, 600, 260, 30);
    for (const [, , z] of apexVerts(geo)) expect(z).toBeCloseTo(300);
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `cd autocard/frontend && npx vitest run src/canvas/3d/geometry/RoofGenerator.test.ts`
Expected: FAIL — `generate` does not accept an 8th argument / apex positions wrong.

- [x] **Step 3: Implement**

In `src/canvas/3d/geometry/RoofGenerator.ts`:

1. Import the type: `import type { RidgeParams } from "./roofRidge";`
2. Extend the signature:
```ts
  public static generate(
    type: RoofType,
    x: number,
    z: number,
    width: number,
    depth: number,
    wallHeight: number,
    pitchAngle: number = 30,
    ridge?: RidgeParams
  ): THREE.BufferGeometry {
```
3. **Gable case** — replace `const isWide = width >= depth;` with:
```ts
        const isWide = ridge ? ridge.alongX : width >= depth;
```
(rest of the gable case unchanged — `isWide` already selects ridge-along-X vs ridge-along-Z.)

4. **Hip case** — replace the whole case body with a ridge-length-aware version:
```ts
      case "hip": {
        const isWide = ridge ? ridge.alongX : width >= depth;
        // Ridge segment length: user-drawn if provided (0 → pyramid), else the
        // legacy symmetric inset of span/2 per side.
        const extent = isWide ? width : depth;
        const ridgeLen = ridge
          ? Math.max(0, Math.min(ridge.ridgeLen, extent - 1))
          : Math.max(0, extent - span);
        const s = (extent - ridgeLen) / 2;

        if (isWide) {
          const E = [x + s,          wh + rh, z + depth / 2];
          const F = [x + extent - s, wh + rh, z + depth / 2];
          verts = [
            // front slope (A -> B -> F -> E)
            ...A, ...B, ...F,
            ...A, ...F, ...E,
            // back slope (C -> D -> E -> F)
            ...C, ...D, ...E,
            ...C, ...E, ...F,
            // left hip slope (A -> E -> D)
            ...A, ...E, ...D,
            // right hip slope (B -> C -> F)
            ...B, ...C, ...F,
          ];
        } else {
          const E = [x + width / 2, wh + rh, z + s];
          const F = [x + width / 2, wh + rh, z + extent - s];
          verts = [
            // left slope (A -> D -> F -> E)
            ...A, ...D, ...F,
            ...A, ...F, ...E,
            // right slope (B -> E -> F -> C)
            ...B, ...E, ...F,
            ...B, ...F, ...C,
            // front hip slope (A -> B -> E)
            ...A, ...B, ...E,
            // back hip slope (D -> F -> C)
            ...D, ...F, ...C,
          ];
        }
        break;
      }
```
Note: `span` is already defined at the top of `generate` as `Math.min(width, depth)`; the legacy expression `extent - span` reproduces the old fixed inset `s = span / 2` per side.

5. **Shed case** — replace the whole case body with an orientation/high-side-aware version (legacy default: rise toward +X, exactly matching the old B/C-high geometry):
```ts
      case "shed": {
        // Which corners are on the high edge: legacy rises toward +X; with a
        // ridge, the ridge's side of the footprint (highSide on the cross
        // axis) is the high edge.
        let highA = false, highB = true, highC = true, highD = false;
        if (ridge) {
          if (ridge.alongX) {           // slope runs across Z
            const plusZ = ridge.highSide >= 0;
            highA = !plusZ; highB = !plusZ; highC = plusZ; highD = plusZ;
          } else {                       // slope runs across X
            const plusX = ridge.highSide >= 0;
            highA = !plusX; highD = !plusX; highB = plusX; highC = plusX;
          }
        }
        const yFor = (high: boolean) => (high ? wh + rh : wh);
        const A_s = [x,         yFor(highA), z];
        const B_s = [x + width, yFor(highB), z];
        const C_s = [x + width, yFor(highC), z + depth];
        const D_s = [x,         yFor(highD), z + depth];

        verts = [
          // Top sloped face
          ...A_s, ...B_s, ...C_s,
          ...A_s, ...C_s, ...D_s,
          // Front side wall (A -> B edge)
          ...A, ...B_s, ...B,
          ...A, ...A_s, ...B_s,
          // Right side wall (B -> C edge)
          ...B, ...C_s, ...C,
          ...B, ...B_s, ...C_s,
          // Back side wall (C -> D edge)
          ...C, ...D_s, ...D,
          ...C, ...C_s, ...D_s,
          // Left side wall (D -> A edge)
          ...D, ...A_s, ...A,
          ...D, ...D_s, ...A_s,
        ];
        break;
      }
```

- [x] **Step 4: Run tests to verify they pass**

Run: `cd autocard/frontend && npx vitest run src/canvas/3d/geometry/RoofGenerator.test.ts`
Expected: PASS (5 tests).

- [x] **Step 5: Type-check and commit**

```bash
cd autocard/frontend && npx tsc --noEmit
git add src/canvas/3d/geometry/RoofGenerator.ts src/canvas/3d/geometry/RoofGenerator.test.ts
git commit -m "feat(3d): RoofGenerator honors user ridge line (orientation, hip ridge length, shed high side)"
```

---

### Task 3: RidgeLineController + wiring into the roof render path

**Files:**
- Create: `src/canvas/3d/controllers/RidgeLineController.tsx`
- Modify: `src/canvas/3d/controllers/index.ts`
- Modify: `src/canvas/3d/components/RoofMesh.tsx` (accept + forward `ridge`)
- Modify: `src/components/ThreeViewer.tsx` (mount controller; PlanModel passes ridge; orbit-disable)
- Modify: `src/canvas/3d/components/ThreeViewerUI.tsx` (toolbar button in the Draw group)

**Interfaces:**
- Consumes: `deriveRidgeParams`, `RidgeLine` (Task 1); `useToolRaycast`; store `roofRidge`/`setRoofRidge`; `worldToDrawing` from `coordBridge`.
- Produces: tool id `"roof-ridge"`; `RoofMesh` gains optional prop `ridge?: RidgeParams`.

- [x] **Step 1: Implement the controller**

```tsx
// src/canvas/3d/controllers/RidgeLineController.tsx
// Two clicks on the ground plane define the roof ridge line (đường nóc mái).
// The line is stored in drawing coords (sceneSlice.roofRidge) so PlanModel can
// derive roof orientation/shape from it. The committed ridge renders as an
// orange line above the walls whenever it exists; drawing again replaces it.
import { useEffect, useState } from "react";
import { Html } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useDrawingStore } from "../../../stores/drawingStore";
import { useToolRaycast } from "../interaction/useToolRaycast";
import { worldToDrawing, drawingToWorld, type Center } from "../geometry/coordBridge";

const RIDGE_Y = 285; // just above the default wall height so it reads as "on the roof"

export function RidgeLineController({ activeTool, center }: { activeTool: string; center: Center }) {
  const active = activeTool === "roof-ridge";
  const { raycastGround } = useToolRaycast();
  const { gl } = useThree();
  const roofRidge = useDrawingStore((s) => s.roofRidge);
  const setRoofRidge = useDrawingStore((s) => s.setRoofRidge);
  const [pending, setPending] = useState<THREE.Vector3 | null>(null);
  const [hover, setHover] = useState<THREE.Vector3 | null>(null);

  useEffect(() => {
    if (!active) { setPending(null); setHover(null); return; }
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const pt = raycastGround(e);
      if (!pt) return;
      if (!pending) { setPending(pt.clone()); return; }
      const a = worldToDrawing({ x: pending.x, z: pending.z }, center);
      const b = worldToDrawing({ x: pt.x, z: pt.z }, center);
      setRoofRidge({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
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
  }, [active, pending, raycastGround, gl, center]);

  // Committed ridge visual — shown whenever a ridge exists (any tool).
  const committed = roofRidge
    ? [drawingToWorld({ x: roofRidge.x1, y: roofRidge.y1 }, center), drawingToWorld({ x: roofRidge.x2, y: roofRidge.y2 }, center)]
    : null;

  return (
    <group>
      {committed && (
        <primitive object={(() => {
          const geo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(committed[0].x, RIDGE_Y, committed[0].z),
            new THREE.Vector3(committed[1].x, RIDGE_Y, committed[1].z),
          ]);
          return new THREE.Line(geo, new THREE.LineBasicMaterial({ color: "#f2a65a" }));
        })()} />
      )}
      {active && pending && hover && (
        <>
          <primitive object={(() => {
            const geo = new THREE.BufferGeometry().setFromPoints([
              new THREE.Vector3(pending.x, RIDGE_Y, pending.z),
              new THREE.Vector3(hover.x, RIDGE_Y, hover.z),
            ]);
            return new THREE.Line(geo, new THREE.LineBasicMaterial({ color: "#f2a65a" }));
          })()} />
          <Html position={[(pending.x + hover.x) / 2, RIDGE_Y + 14, (pending.z + hover.z) / 2]} center>
            <div className="bg-slate-900/90 text-amber-300 font-mono text-[9px] font-bold px-2 py-0.5 rounded border border-amber-500/30 whitespace-nowrap select-none">
              Đường nóc mái — click điểm cuối
            </div>
          </Html>
        </>
      )}
      {active && !pending && hover && (
        <Html position={[hover.x, RIDGE_Y + 14, hover.z]} center>
          <div className="bg-slate-900/90 text-amber-300 font-mono text-[9px] font-bold px-2 py-0.5 rounded border border-amber-500/30 whitespace-nowrap select-none">
            Click điểm đầu đường nóc
          </div>
        </Html>
      )}
    </group>
  );
}
```

- [x] **Step 2: Export, mount, orbit-disable, toolbar**

- `controllers/index.ts`: `export { RidgeLineController } from "./RidgeLineController";`
- `ThreeViewer.tsx`: import it with the other controllers; mount in `Scene`'s fragment next to `SectionPlaneController`: `<RidgeLineController activeTool={activeTool} center={{ cx, cz }} />`
- `OrbitControls` `enabled` expression: append `&& activeTool !== "roof-ridge"`.
- `ThreeToolbar` (Draw group, after the `cylinder3d` button):
```tsx
<button onClick={() => setActiveTool("roof-ridge")} className={cls("roof-ridge")} title="Vẽ đường nóc mái — 2 click; mái xoay theo hướng đường nóc (hip: độ dài nóc, shed: bên cao)">
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l9-8 9 8M7 12v8h10v-8" />
    <path strokeLinecap="round" strokeWidth={2} strokeDasharray="2 2" d="M6 8.5h12" />
  </svg>
</button>
```

- [x] **Step 3: PlanModel derives + forwards ridge params**

In `ThreeViewer.tsx` `PlanModel` (first lines of the function body, before any conditional return so hook order is stable):
```tsx
  const roofRidge = useDrawingStore((s) => s.roofRidge);
  const ridgeParams = useMemo(
    () => (roofRidge && bounds ? deriveRidgeParams(roofRidge, bounds) : undefined),
    [roofRidge, bounds],
  );
```
Add imports: `import { deriveRidgeParams } from "../canvas/3d/geometry/roofRidge";` (useDrawingStore and useMemo are already imported).
Pass `ridge={ridgeParams}` to **both** `<RoofMesh …/>` call sites inside `PlanModel` (the `architecturalPlan` branch and the `plan.shell` branch).

In `src/canvas/3d/components/RoofMesh.tsx`:
```tsx
// add to imports
import type { RidgeParams } from "../geometry/roofRidge";
// add prop
  ridge,
// prop type
  ridge?: RidgeParams;
// forward in the useMemo
  const geometry = useMemo(() => {
    return RoofGenerator.generate(type, x, z, width, depth, wallHeight, pitch, ridge);
  }, [type, x, z, width, depth, wallHeight, pitch, ridge]);
```

- [x] **Step 4: Type-check + manual smoke test**

Run: `cd autocard/frontend && npx tsc --noEmit` — clean.
Dev server: draw a rectangular plan → choose Hip roof in the sidebar → select "Vẽ đường nóc mái" → draw a short ridge across the *short* axis → roof reorients to the ridge direction and the hip faces grow; drag the ridge to length ~0 → pyramid; switch to Shed → ridge drawn near the +Z edge makes that edge the high side.

- [x] **Step 5: Commit**

```bash
git add src/canvas/3d/controllers/RidgeLineController.tsx src/canvas/3d/controllers/index.ts src/canvas/3d/components/RoofMesh.tsx src/components/ThreeViewer.tsx src/canvas/3d/components/ThreeViewerUI.tsx
git commit -m "feat(3d): user-drawn roof ridge line drives roof orientation and shape"
```

---

### Task 4: Fixture catalog + wall-snap math

**Files:**
- Create: `src/canvas/3d/geometry/fixtureSnap.ts`
- Test: `src/canvas/3d/geometry/fixtureSnap.test.ts`
- Create: `src/canvas/3d/materials/mepFixtures.ts`
- Modify: `src/types.ts` (`DrawingElement` gains `fixtureType`)

**Interfaces:**
- Produces (used by Tasks 5, 6):
  - `type MepFixtureType = "switch" | "socket" | "juncbox" | "dboard" | "valve" | "elbow"`
  - `MEP_FIXTURES: Record<MepFixtureType, { label: string; heightCm: number }>`
  - `interface FixtureSnap { x: number; y: number; angleDeg: number; wallId?: string }`
  - `snapFixtureToWall(p: {x: number; y: number}, walls: DrawingElement[], maxDist: number, offset: number): FixtureSnap | null` — projects `p` onto the nearest wall line, pushes the point `offset` units off the wall face toward `p`'s side, and returns the wall's angle in degrees. Null when no wall is within `maxDist`.
  - `DrawingElement.fixtureType?: string`

- [x] **Step 1: Write the failing tests**

```ts
// src/canvas/3d/geometry/fixtureSnap.test.ts
import { describe, it, expect } from "vitest";
import { snapFixtureToWall } from "./fixtureSnap";
import type { DrawingElement } from "../../../types";

const wall: DrawingElement = { id: "w1", type: "line", layerId: "0", archType: "wall", x1: 0, y1: 0, x2: 100, y2: 0 };

describe("snapFixtureToWall", () => {
  it("projects onto the wall and offsets toward the click side", () => {
    const s = snapFixtureToWall({ x: 50, y: 10 }, [wall], 60, 12)!;
    expect(s.x).toBeCloseTo(50);
    expect(s.y).toBeCloseTo(12);
    expect(s.angleDeg).toBeCloseTo(0);
    expect(s.wallId).toBe("w1");
  });

  it("offsets to the other side for a click below the wall", () => {
    const s = snapFixtureToWall({ x: 50, y: -10 }, [wall], 60, 12)!;
    expect(s.y).toBeCloseTo(-12);
  });

  it("clamps the projection to the wall segment", () => {
    const s = snapFixtureToWall({ x: 130, y: 10 }, [wall], 60, 12)!;
    expect(s.x).toBeCloseTo(100);
  });

  it("returns null when no wall is within maxDist", () => {
    expect(snapFixtureToWall({ x: 50, y: 100 }, [wall], 60, 12)).toBeNull();
  });

  it("returns null with no walls", () => {
    expect(snapFixtureToWall({ x: 0, y: 0 }, [], 60, 12)).toBeNull();
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `cd autocard/frontend && npx vitest run src/canvas/3d/geometry/fixtureSnap.test.ts`
Expected: FAIL — cannot resolve `./fixtureSnap`.

- [x] **Step 3: Implement**

```ts
// src/canvas/3d/geometry/fixtureSnap.ts
// Wall-snap for MEP fixtures: project the click onto the nearest wall line,
// push the point off the wall face toward the click's side, keep the wall
// angle so the fixture plate sits flush. Port of house_planner_demo.html's
// nearestWall + normal-offset logic, in 2D drawing coords.
import type { DrawingElement } from "../../../types";

export interface FixtureSnap { x: number; y: number; angleDeg: number; wallId?: string }

export function snapFixtureToWall(
  p: { x: number; y: number },
  walls: DrawingElement[],
  maxDist: number,
  offset: number,
): FixtureSnap | null {
  let best: { fx: number; fy: number; dx: number; dy: number; len: number; dist: number; id?: string } | null = null;
  for (const w of walls) {
    if (w.type !== "line" || w.x1 == null || w.y1 == null || w.x2 == null || w.y2 == null) continue;
    const dx = w.x2 - w.x1, dy = w.y2 - w.y1;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1e-9) continue;
    let t = ((p.x - w.x1) * dx + (p.y - w.y1) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const fx = w.x1 + t * dx, fy = w.y1 + t * dy;
    const dist = Math.hypot(p.x - fx, p.y - fy);
    if (!best || dist < best.dist) best = { fx, fy, dx, dy, len: Math.sqrt(len2), dist, id: w.id };
  }
  if (!best || best.dist > maxDist) return null;
  const nx = -best.dy / best.len, ny = best.dx / best.len;
  const side = (p.x - best.fx) * nx + (p.y - best.fy) * ny >= 0 ? 1 : -1;
  return {
    x: best.fx + nx * side * offset,
    y: best.fy + ny * side * offset,
    angleDeg: (Math.atan2(best.dy, best.dx) * 180) / Math.PI,
    wallId: best.id,
  };
}
```

```ts
// src/canvas/3d/materials/mepFixtures.ts
// Wall-mounted MEP fixture catalog — labels + default mounting heights from
// the house-planner demo (công tắc ~1.1m, ổ cắm ~0.3m, hộp nối gần trần…).
export type MepFixtureType = "switch" | "socket" | "juncbox" | "dboard" | "valve" | "elbow";

export const MEP_FIXTURES: Record<MepFixtureType, { label: string; heightCm: number }> = {
  switch:  { label: "Công tắc",  heightCm: 110 },
  socket:  { label: "Ổ cắm",     heightCm: 30 },
  juncbox: { label: "Hộp nối",   heightCm: 235 },
  dboard:  { label: "Tủ điện",   heightCm: 150 },
  valve:   { label: "Van cầu",   heightCm: 55 },
  elbow:   { label: "Co ống",    heightCm: 30 },
};
```

In `src/types.ts`, `DrawingElement`, directly after the `material?: string;` line:
```ts
  fixtureType?: string;  // wall-mounted MEP fixture kind (mepFixtures.ts id)
```

- [x] **Step 4: Run tests to verify they pass**

Run: `cd autocard/frontend && npx vitest run src/canvas/3d/geometry/fixtureSnap.test.ts`
Expected: PASS (5 tests).

- [x] **Step 5: Type-check and commit**

```bash
cd autocard/frontend && npx tsc --noEmit
git add src/canvas/3d/geometry/fixtureSnap.ts src/canvas/3d/geometry/fixtureSnap.test.ts src/canvas/3d/materials/mepFixtures.ts src/types.ts
git commit -m "feat(3d): MEP fixture catalog + wall-snap projection math"
```

---

### Task 5: MepFixtureMesh renderer

**Files:**
- Create: `src/canvas/3d/components/MepFixtureMesh.tsx`
- Modify: `src/canvas/3d/components/FlatElementMesh.tsx` (skip fixtures — they render via MepFixtureMesh)
- Modify: `src/components/ThreeViewer.tsx` (render list in `Scene`)

**Interfaces:**
- Consumes: elements with `archType: "mepFixture"`, `fixtureType`, `elevation` (cm), `rotation` (deg), `x/y/width/height` (small 2D marker rect; 3D anchor = rect center).
- Produces: `<MepFixtureMesh el={DrawingElement} cx={number} cz={number} />`.

- [x] **Step 1: Implement the mesh**

Geometry recipes are scaled-up (cm) versions of `buildMEP` in `house_planner_demo.html` and the electric/PVC reference viewers (`docs/superpowers/specs/references/`).

```tsx
// src/canvas/3d/components/MepFixtureMesh.tsx
// Wall-mounted MEP fixtures (công tắc, ổ cắm, hộp nối, tủ điện, van, co ống).
// Anchor = 2D marker rect center; `elevation` (cm) is the mounting height;
// `rotation` matches the wall angle so plates sit flush against the wall.
import type { DrawingElement } from "../../../types";

export function MepFixtureMesh({ el, cx, cz }: { el: DrawingElement; cx: number; cz: number }) {
  const x = (el.x ?? 0) + (el.width ?? 0) / 2 - cx;
  const z = (el.y ?? 0) + (el.height ?? 0) / 2 - cz;
  const y = (el.elevation as number | undefined) ?? 110;
  const rotY = -((el.rotation ?? 0) * Math.PI) / 180;
  const kind = el.fixtureType ?? "switch";

  return (
    <group position={[x, y, z]} rotation={[0, rotY, 0]}>
      {kind === "switch" && (
        <>
          <mesh castShadow><boxGeometry args={[18, 28, 3]} /><meshStandardMaterial color="#f4efe6" roughness={0.35} /></mesh>
          <mesh position={[0, 0, 2.5]} castShadow><boxGeometry args={[8, 12, 2]} /><meshStandardMaterial color="#ffffff" roughness={0.3} /></mesh>
        </>
      )}
      {kind === "socket" && (
        <>
          <mesh castShadow><boxGeometry args={[18, 28, 3]} /><meshStandardMaterial color="#f4efe6" roughness={0.35} /></mesh>
          <mesh position={[0, 0, 2.5]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[8, 8, 2, 20]} /><meshStandardMaterial color="#ffffff" roughness={0.3} />
          </mesh>
          {[-2.5, 2.5].map((px) => (
            <mesh key={px} position={[px, 2, 3.6]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.8, 0.8, 2, 10]} /><meshStandardMaterial color="#2b2b2b" />
            </mesh>
          ))}
        </>
      )}
      {kind === "juncbox" && (
        <>
          <mesh position={[0, -10, 0]} castShadow><boxGeometry args={[26, 1.5, 18]} /><meshStandardMaterial color="#d9c9a8" roughness={0.55} /></mesh>
          <mesh position={[-13, 0, 0]} castShadow><boxGeometry args={[1.5, 20, 18]} /><meshStandardMaterial color="#d9c9a8" roughness={0.55} /></mesh>
          <mesh position={[13, 0, 0]} castShadow><boxGeometry args={[1.5, 20, 18]} /><meshStandardMaterial color="#d9c9a8" roughness={0.55} /></mesh>
          <mesh position={[0, 0, -9]} castShadow><boxGeometry args={[26, 20, 1.5]} /><meshStandardMaterial color="#d9c9a8" roughness={0.55} /></mesh>
          <mesh position={[0, 0, 9]} castShadow><boxGeometry args={[26, 20, 1.5]} /><meshStandardMaterial color="#d9c9a8" roughness={0.55} /></mesh>
          {[-6, 2, 10].map((px) => (
            <mesh key={px} position={[px, -5, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[2, 2, 5, 10]} /><meshStandardMaterial color="#d9832e" roughness={0.4} />
            </mesh>
          ))}
        </>
      )}
      {kind === "dboard" && (
        <>
          <mesh position={[0, 0, -6]} castShadow><boxGeometry args={[50, 40, 2]} /><meshStandardMaterial color="#d9c9a8" roughness={0.55} /></mesh>
          <mesh position={[0, 5, -1]} castShadow><boxGeometry args={[42, 2, 3]} /><meshStandardMaterial color="#9aa0a6" metalness={0.7} roughness={0.35} /></mesh>
          {[-14, 0, 14].map((px) => (
            <group key={px}>
              <mesh position={[px, 13, 1]} castShadow><boxGeometry args={[8, 16, 7]} /><meshStandardMaterial color="#2b2b2b" roughness={0.5} /></mesh>
              <mesh position={[px, 19, 4]} castShadow><boxGeometry args={[3, 6, 2]} /><meshStandardMaterial color="#d8442e" roughness={0.35} /></mesh>
            </group>
          ))}
          <mesh position={[0, -8, -2]} castShadow><boxGeometry args={[42, 2, 1.5]} /><meshStandardMaterial color="#c79a4b" metalness={0.85} roughness={0.25} /></mesh>
        </>
      )}
      {kind === "valve" && (
        <>
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow><cylinderGeometry args={[9, 9, 22, 16]} /><meshStandardMaterial color="#2f6fb0" roughness={0.45} metalness={0.2} /></mesh>
          <mesh position={[0, 12, 0]} castShadow><cylinderGeometry args={[1.5, 1.5, 14, 8]} /><meshStandardMaterial color="#c79a4b" metalness={0.8} roughness={0.3} /></mesh>
          <mesh position={[0, 20, 0]} castShadow><boxGeometry args={[16, 3, 5]} /><meshStandardMaterial color="#d8442e" roughness={0.4} /></mesh>
          {[-18, 18].map((px) => (
            <mesh key={px} position={[px, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[5, 5, 14, 12]} /><meshStandardMaterial color="#8b96a0" roughness={0.55} />
            </mesh>
          ))}
        </>
      )}
      {kind === "elbow" && (
        <>
          <mesh position={[-14, 0, 0]} rotation={[Math.PI / 2, 0, Math.PI / 2]} castShadow>
            <torusGeometry args={[14, 5, 12, 20, Math.PI / 2]} /><meshStandardMaterial color="#8b96a0" roughness={0.55} />
          </mesh>
          <mesh position={[-29, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[5, 5, 30, 12]} /><meshStandardMaterial color="#8b96a0" roughness={0.55} />
          </mesh>
          <mesh position={[-14, 29, 0]} castShadow>
            <cylinderGeometry args={[5, 5, 30, 12]} /><meshStandardMaterial color="#8b96a0" roughness={0.55} />
          </mesh>
        </>
      )}
    </group>
  );
}
```

- [x] **Step 2: Skip fixtures in FlatElementMesh, render list in Scene**

`FlatElementMesh.tsx` — first line of the component body (before the hover state usage is fine; place directly after the destructuring):
```tsx
  // Wall-mounted MEP fixtures render via MepFixtureMesh in Scene, not as flat 2D geometry.
  if (el.archType === "mepFixture") return null;
```
Note: `FlatElementMesh` uses a `useState` hook — place the early return *after* the `useState(false)` line so hook order stays stable.

`ThreeViewer.tsx`, inside `Scene`'s `<group position={[-cx, 0, -cz]}>`, next to the PipeMesh list:
```tsx
        {/* Wall-mounted MEP fixtures — archType:"mepFixture" */}
        {elements
          .filter((el) => el.archType === "mepFixture")
          .map((el) => <MepFixtureMesh key={el.id} el={el} cx={cx} cz={cz} />)}
```
Add the import: `import { MepFixtureMesh } from "../canvas/3d/components/MepFixtureMesh";`

- [x] **Step 3: Type-check and commit**

Run: `cd autocard/frontend && npx tsc --noEmit` — clean.

```bash
git add src/canvas/3d/components/MepFixtureMesh.tsx src/canvas/3d/components/FlatElementMesh.tsx src/components/ThreeViewer.tsx
git commit -m "feat(3d): MepFixtureMesh renderer for wall-mounted MEP fixtures"
```

---

### Task 6: MepFixturePlacerController + palette + toolbar

**Files:**
- Create: `src/canvas/3d/controllers/MepFixturePlacerController.tsx`
- Modify: `src/canvas/3d/controllers/index.ts`
- Modify: `src/components/ThreeViewer.tsx` (fixture-type state; mount; palette; orbit-disable)
- Modify: `src/canvas/3d/components/ThreeViewerUI.tsx` (toolbar button + `FixturePalettePanel`)

**Interfaces:**
- Consumes: `snapFixtureToWall`, `MEP_FIXTURES`, `MepFixtureType` (Task 4); `MepFixtureMesh` (Task 5); `useToolRaycast`; `allWallElements` (already computed in ThreeViewer).
- Produces: tool id `"mep-fixture"`; `<MepFixturePlacerController activeTool center wallElements fixtureType />`; `<FixturePalettePanel selected onSelect />`.

- [x] **Step 1: Implement the controller**

```tsx
// src/canvas/3d/controllers/MepFixturePlacerController.tsx
// Places wall-mounted MEP fixtures: hover shows a ghost snapped to the
// nearest wall (within 60 units) at the fixture's default mounting height,
// rotated flush with the wall; clicking far from any wall places it free at
// the click point. Click commits an archType:"mepFixture" element.
import { useEffect, useState } from "react";
import { useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { DrawingElement } from "../../../types";
import { useDrawingStore } from "../../../stores/drawingStore";
import { useToolRaycast } from "../interaction/useToolRaycast";
import { snapFixtureToWall } from "../geometry/fixtureSnap";
import { MEP_FIXTURES, type MepFixtureType } from "../materials/mepFixtures";
import { worldToDrawing, drawingToWorld, type Center } from "../geometry/coordBridge";

const WALL_SNAP_DIST = 60;   // drawing units
const FACE_OFFSET = 12;      // half wall thickness (9) + small gap
let fixtureSeq = 0;

export function MepFixturePlacerController({ activeTool, center, wallElements, fixtureType }: {
  activeTool: string;
  center: Center;
  wallElements: DrawingElement[];
  fixtureType: MepFixtureType;
}) {
  const active = activeTool === "mep-fixture";
  const { raycastGround } = useToolRaycast();
  const { gl } = useThree();
  const [ghost, setGhost] = useState<{ x: number; y: number; angleDeg: number; onWall: boolean } | null>(null);
  const def = MEP_FIXTURES[fixtureType];

  useEffect(() => {
    if (!active) { setGhost(null); return; }
    const locate = (e: PointerEvent) => {
      const pt = raycastGround(e);
      if (!pt) return null;
      const d = worldToDrawing({ x: pt.x, z: pt.z }, center);
      const snap = snapFixtureToWall(d, wallElements, WALL_SNAP_DIST, FACE_OFFSET);
      return snap
        ? { x: snap.x, y: snap.y, angleDeg: snap.angleDeg, onWall: true }
        : { x: d.x, y: d.y, angleDeg: 0, onWall: false };
    };
    const onMove = (e: PointerEvent) => setGhost(locate(e));
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const g = locate(e);
      if (!g) return;
      const { activeLayerId, addElement } = useDrawingStore.getState();
      addElement({
        id: `fixture-${++fixtureSeq}-${Math.random().toString(36).slice(2, 7)}`,
        type: "rectangle", archType: "mepFixture", layerId: activeLayerId,
        x: g.x - 9, y: g.y - 4, width: 18, height: 8,
        rotation: g.angleDeg,
        elevation: def.heightCm,
        fixtureType,
        strokeColor: "#ca8a04",
      } as DrawingElement);
    };
    gl.domElement.addEventListener("pointermove", onMove);
    gl.domElement.addEventListener("pointerdown", onDown);
    return () => {
      gl.domElement.removeEventListener("pointermove", onMove);
      gl.domElement.removeEventListener("pointerdown", onDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, wallElements, fixtureType, raycastGround, gl, center]);

  if (!active || !ghost) return null;
  const w = drawingToWorld({ x: ghost.x, y: ghost.y }, center);
  return (
    <group>
      <mesh position={[w.x, def.heightCm, w.z]} rotation={[0, -(ghost.angleDeg * Math.PI) / 180, 0]}>
        <boxGeometry args={[26, 30, 10]} />
        <meshBasicMaterial color={ghost.onWall ? "#22c55e" : "#f59e0b"} wireframe />
      </mesh>
      <Html position={[w.x, def.heightCm + 26, w.z]} center>
        <div className="bg-slate-900/90 text-slate-200 font-mono text-[9px] font-bold px-2 py-0.5 rounded border border-white/10 whitespace-nowrap select-none">
          {def.label} · +{def.heightCm}cm {ghost.onWall ? "· áp tường" : "· tự do"}
        </div>
      </Html>
    </group>
  );
}
```

- [x] **Step 2: Palette panel**

Append to `ThreeViewerUI.tsx` (same pattern as `PaintPalettePanel`):
```tsx
/** Bottom fixture picker shown while the MEP-fixture tool is active. */
export function FixturePalettePanel({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  const entries = Object.entries(MEP_FIXTURES) as [MepFixtureType, { label: string; heightCm: number }][];
  return (
    <div className="absolute left-1/2 -translate-x-1/2 bottom-8 z-20 bg-slate-900/90 backdrop-blur-md border border-slate-700/60 p-3 rounded-xl shadow-2xl flex items-center space-x-2 select-none">
      <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider mr-1">Thiết bị</span>
      {entries.map(([id, f]) => (
        <button
          key={id}
          onClick={() => onSelect(id)}
          title={`${f.label} — cao ${f.heightCm}cm`}
          className={`px-2 py-1 rounded-lg border text-[10px] font-bold transition-all ${selected === id ? "border-blue-500 bg-blue-500/20 text-blue-300" : "border-white/10 text-slate-400 hover:border-white/40 hover:text-slate-200"}`}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
```
Add to `ThreeViewerUI.tsx` imports: `import { MEP_FIXTURES, type MepFixtureType } from "../materials/mepFixtures";`

Toolbar — MEP group, after the `mep-gas` button:
```tsx
<button onClick={() => setActiveTool("mep-fixture")} className={cls("mep-fixture")} title="Thiết bị gắn tường — công tắc, ổ cắm, hộp nối, tủ điện, van, co ống">
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <rect x="7" y="4" width="10" height="16" rx="1.5" strokeWidth={2} />
    <circle cx="12" cy="12" r="2.5" strokeWidth={2} />
  </svg>
</button>
```

- [x] **Step 3: Wire into ThreeViewer**

- State (next to `paintMaterial`): `const [fixtureType, setFixtureType] = useState<MepFixtureType>("switch");` with import `import type { MepFixtureType } from "../canvas/3d/materials/mepFixtures";`
- Panel (next to the `PaintPalettePanel` mount): `{activeTool === "mep-fixture" && (<FixturePalettePanel selected={fixtureType} onSelect={(id) => setFixtureType(id as MepFixtureType)} />)}` — add `FixturePalettePanel` to the ThreeViewerUI import list.
- `Scene`: add prop `fixtureType: MepFixtureType` (destructure + prop type + pass from the `<Scene …/>` call), and mount next to `MepDrawController`:
  `<MepFixturePlacerController activeTool={activeTool} center={{ cx, cz }} wallElements={allWallElements} fixtureType={fixtureType} />`
  (export it from `controllers/index.ts` and add it to the controllers import in ThreeViewer.)
- `OrbitControls` `enabled`: the existing `!activeTool.startsWith("mep-")` clause already covers `mep-fixture` — no change needed.

- [x] **Step 4: Type-check + manual smoke test**

Run: `cd autocard/frontend && npx tsc --noEmit` — clean.
Dev server: MEP group → thiết bị gắn tường → palette shows 6 fixture types → hover near a wall → green wireframe ghost sticks to the wall face at 110cm (công tắc) → click → switch plate renders flush on the wall; pick "Tủ điện" → ghost at 150cm; click far from walls → amber ghost, places free-standing; Ctrl+Z removes.

- [x] **Step 5: Commit**

```bash
git add src/canvas/3d/controllers/MepFixturePlacerController.tsx src/canvas/3d/controllers/index.ts src/components/ThreeViewer.tsx src/canvas/3d/components/ThreeViewerUI.tsx
git commit -m "feat(3d): wall-snapped MEP fixture placement (công tắc/ổ cắm/hộp nối/tủ điện/van/co)"
```

---

### Task 7: 2D drawing export (mặt bằng / mặt đứng) as PNG

**Files:**
- Create: `src/canvas/3d/geometry/sheetCamera.ts`
- Test: `src/canvas/3d/geometry/sheetCamera.test.ts`
- Create: `src/canvas/3d/components/DrawingSheetExporter.tsx`
- Modify: `src/components/ThreeViewer.tsx` (extend `exportTrigger`; mount exporter; tag hide-on-export objects)
- Modify: `src/canvas/3d/components/ThreeViewerUI.tsx` (`RightSidebar` export tab buttons)

**Interfaces:**
- Consumes: `Scene`'s `localBounds` convention (origin-centered bounds); existing `exportTrigger`/`ExportManager` pattern (`ThreeViewer.tsx` line ~1186 / ~1640).
- Produces:
  - `type SheetView = "plan" | "front" | "side"`
  - `interface SheetFrustum { left: number; right: number; top: number; bottom: number; position: [number, number, number]; up: [number, number, number]; target: [number, number, number] }`
  - `sheetFrustum(bounds: { minX: number; maxX: number; minZ: number; maxZ: number }, view: SheetView, wallHeight: number, roofAllowance?: number, margin?: number): SheetFrustum`
  - `<DrawingSheetExporter trigger onDone bounds wallHeight />`
  - `RightSidebar` gains `onExport2D?: (view: "plan-png" | "front-png" | "side-png") => void`

- [x] **Step 1: Write the failing tests**

```ts
// src/canvas/3d/geometry/sheetCamera.test.ts
import { describe, it, expect } from "vitest";
import { sheetFrustum } from "./sheetCamera";

const bounds = { minX: -500, maxX: 500, minZ: -300, maxZ: 300 };

describe("sheetFrustum", () => {
  it("plan view: top-down ortho covering the footprint plus margin", () => {
    const f = sheetFrustum(bounds, "plan", 260, 400, 100);
    expect(f.right - f.left).toBeCloseTo(1000 + 200);
    expect(f.top - f.bottom).toBeCloseTo(600 + 200);
    expect(f.position[1]).toBeGreaterThan(1000);
    expect(f.up).toEqual([0, 0, -1]);
  });

  it("front view: looks along -Z, height covers walls + roof allowance", () => {
    const f = sheetFrustum(bounds, "front", 260, 400, 100);
    expect(f.position[2]).toBeGreaterThan(bounds.maxZ);
    expect(f.top - f.bottom).toBeCloseTo(260 + 400 + 200);
    expect(f.right - f.left).toBeCloseTo(1000 + 200);
  });

  it("side view: looks along -X, width covers the Z extent", () => {
    const f = sheetFrustum(bounds, "side", 260, 400, 100);
    expect(f.position[0]).toBeGreaterThan(bounds.maxX);
    expect(f.right - f.left).toBeCloseTo(600 + 200);
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `cd autocard/frontend && npx vitest run src/canvas/3d/geometry/sheetCamera.test.ts`
Expected: FAIL — cannot resolve `./sheetCamera`.

- [x] **Step 3: Implement the frustum math**

```ts
// src/canvas/3d/geometry/sheetCamera.ts
// Orthographic camera frusta for exporting 2D sheets (mặt bằng / mặt đứng)
// from the 3D model. Bounds are the origin-centered local bounds the Scene
// renders in (drawing units, 100 = 1 m).
export type SheetView = "plan" | "front" | "side";
export interface SheetFrustum {
  left: number; right: number; top: number; bottom: number;
  position: [number, number, number];
  up: [number, number, number];
  target: [number, number, number];
}

export function sheetFrustum(
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
  view: SheetView,
  wallHeight: number,
  roofAllowance = 400,
  margin = 100,
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
  if (view === "front") {
    return {
      left: -halfX, right: halfX, top: halfH, bottom: -halfH,
      position: [cx, midY, bounds.maxZ + 2000], up: [0, 1, 0], target: [cx, midY, cz],
    };
  }
  return {
    left: -halfZ, right: halfZ, top: halfH, bottom: -halfH,
    position: [bounds.maxX + 2000, midY, cz], up: [0, 1, 0], target: [cx, midY, cz],
  };
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `cd autocard/frontend && npx vitest run src/canvas/3d/geometry/sheetCamera.test.ts`
Expected: PASS (3 tests).

- [x] **Step 5: Exporter component + tagging + wiring**

```tsx
// src/canvas/3d/components/DrawingSheetExporter.tsx
// Renders one frame through a sheet-view ortho camera on a white background
// (hiding grid/sky/environment via userData.exportHide, and the roof for plan
// view via userData.exportRoof), downloads it as PNG, then restores the scene.
import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { sheetFrustum, type SheetView } from "../geometry/sheetCamera";

const FILENAMES: Record<SheetView, string> = {
  plan: "mat-bang-2d.png", front: "mat-dung-truoc.png", side: "mat-dung-ben.png",
};

export function DrawingSheetExporter({ trigger, onDone, bounds, wallHeight }: {
  trigger: "" | "plan-png" | "front-png" | "side-png";
  onDone: () => void;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number } | null;
  wallHeight: number;
}) {
  const { gl, scene } = useThree();

  useEffect(() => {
    if (!trigger || !bounds) { if (trigger) onDone(); return; }
    const view: SheetView = trigger === "plan-png" ? "plan" : trigger === "front-png" ? "front" : "side";
    const f = sheetFrustum(bounds, view, wallHeight);
    const cam = new THREE.OrthographicCamera(f.left, f.right, f.top, f.bottom, 0.1, 20000);
    cam.position.set(...f.position);
    cam.up.set(...f.up);
    cam.lookAt(...f.target);
    cam.updateProjectionMatrix();

    const prevBg = scene.background;
    const hidden: THREE.Object3D[] = [];
    scene.traverse((o) => {
      if (!o.visible) return;
      if (o.userData.exportHide || (view === "plan" && o.userData.exportRoof)) {
        o.visible = false;
        hidden.push(o);
      }
    });
    scene.background = new THREE.Color("#ffffff");

    gl.render(scene, cam);
    const url = gl.domElement.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = FILENAMES[view];
    a.click();

    scene.background = prevBg;
    for (const o of hidden) o.visible = true;
    onDone();
  }, [trigger, bounds, wallHeight, gl, scene, onDone]);

  return null;
}
```

In `ThreeViewer.tsx`:
1. Extend the trigger type: `const [exportTrigger, setExportTrigger] = useState<"" | "gltf" | "plan-png" | "front-png" | "side-png">("");` — and the `ExportManager` mount only fires on `"gltf"`, so guard it: `<ExportManager trigger={exportTrigger === "gltf" ? "gltf" : ""} onDone={() => setExportTrigger("")} />`.
2. Mount the sheet exporter right next to `ExportManager` (inside `<Canvas>`):
```tsx
<DrawingSheetExporter
  trigger={exportTrigger === "gltf" ? "" : exportTrigger}
  onDone={() => setExportTrigger("")}
  bounds={canvasBounds ? {
    minX: canvasBounds.minX - (canvasBounds.minX + canvasBounds.maxX) / 2,
    maxX: canvasBounds.maxX - (canvasBounds.minX + canvasBounds.maxX) / 2,
    minZ: canvasBounds.minZ - (canvasBounds.minZ + canvasBounds.maxZ) / 2,
    maxZ: canvasBounds.maxZ - (canvasBounds.minZ + canvasBounds.maxZ) / 2,
  } : null}
  wallHeight={wallHeight}
/>
```
(`canvasBounds` already exists at ThreeViewer level; geometry is rendered origin-centered, hence the recentering.)
3. Tag hide-on-export scenery inside `Scene`'s returned fragment: wrap the `<Grid …/>`, `<Sky …/>` (or `<Environment/>`), `<ContactShadows …/>`, `<NeighborBuildings …/>` and the scale `<Mannequin …/>` each in `<group userData={{ exportHide: true }}>…</group>`. Wrap both `<RoofMesh …/>` call sites in `PlanModel` in `<group userData={{ exportRoof: true }}>…</group>`.
4. `RightSidebar` call site: add `onExport2D={(v) => setExportTrigger(v)}`.

In `ThreeViewerUI.tsx` `RightSidebar`: add prop `onExport2D` (destructure + type `onExport2D?: (view: "plan-png" | "front-png" | "side-png") => void;`) and, inside the `tab === "export"` block after the existing export buttons:
```tsx
<p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-3 mb-1">Bản vẽ 2D (PNG)</p>
<button onClick={() => onExport2D?.("plan-png")} className="w-full py-1.5 rounded text-[10px] font-bold bg-white/5 text-slate-300 hover:bg-white/10 mb-1">Xuất mặt bằng</button>
<button onClick={() => onExport2D?.("front-png")} className="w-full py-1.5 rounded text-[10px] font-bold bg-white/5 text-slate-300 hover:bg-white/10 mb-1">Xuất mặt đứng trước</button>
<button onClick={() => onExport2D?.("side-png")} className="w-full py-1.5 rounded text-[10px] font-bold bg-white/5 text-slate-300 hover:bg-white/10">Xuất mặt đứng bên</button>
```

- [x] **Step 6: Type-check + manual smoke test**

Run: `cd autocard/frontend && npx tsc --noEmit` — clean.
Dev server: build a small house (walls + roof + a few fixtures) → Export tab → "Xuất mặt bằng" downloads a white-background top-down PNG with no grid/sky/roof; "Xuất mặt đứng trước" shows the facade with roof; the live viewport is restored (background/sky/grid back) after each export.

- [x] **Step 7: Commit**

```bash
git add src/canvas/3d/geometry/sheetCamera.ts src/canvas/3d/geometry/sheetCamera.test.ts src/canvas/3d/components/DrawingSheetExporter.tsx src/components/ThreeViewer.tsx src/canvas/3d/components/ThreeViewerUI.tsx
git commit -m "feat(3d): export 2D sheets (mặt bằng, mặt đứng trước/bên) as PNG from the 3D model"
```

---

### Task 8: Icon-rail toolbar with flyout groups + current-tool badge

Redesign of `ThreeToolbar` following `house_planner_demo_2.html`: a slim icon rail (no text headers), hover tooltips to the right of each icon, grouped tools opening a **flyout menu** (icon + Vietnamese label rows) beside the rail, and a persistent **tool badge** pill above the canvas showing the active tool. Pure presentation — every tool id, callback, and behavior stays identical.

**Files:**
- Create: `src/canvas/3d/components/ToolRail.tsx`
- Modify: `src/canvas/3d/components/ThreeViewerUI.tsx` (delete `ToolGroup` + the old `ThreeToolbar` body; keep all other exports)
- Modify: `src/components/ThreeViewer.tsx` (swap `ThreeToolbar` → `ToolRail`; mount `ToolBadge`)

**Interfaces:**
- Consumes: the same props `ThreeToolbar` takes today: `activeTool`, `setActiveTool`, `onLineClick`, `onShow2DNotice`, `onShowInteractionNotice`, `hasRegion?`, `onResetRegion?`, `onAnalyze?`, `analyzeStatus?`, `onDetectRooms?`; `useDrawingStore` for undo/redo.
- Produces: `<ToolRail …same props… />` and `<ToolBadge activeTool={string} />`; exported `TOOL_LABELS: Record<string, string>` (used by the badge; other components may reuse it).

- [x] **Step 1: Build the tool registry + rail component**

Create `src/canvas/3d/components/ToolRail.tsx`. The icon JSX for every existing tool is **copied verbatim from the current `ThreeToolbar`** buttons in `ThreeViewerUI.tsx` (each button's `<svg>…</svg>` child, keyed by the tool id in its `setActiveTool("<id>")` call). Structure:

```tsx
// src/canvas/3d/components/ToolRail.tsx
// Icon-rail toolbar (house_planner_demo_2 pattern): slim rail of icon buttons
// with hover tooltips; grouped tools open a flyout beside the rail; the
// group button stays highlighted while one of its tools is active. Pure
// presentation over the same activeTool/setActiveTool contract as the old
// ThreeToolbar.
import { useEffect, useState } from "react";
import { useDrawingStore } from "../../../stores/drawingStore";

interface RailTool { id: string; label: string; icon: React.ReactNode }
interface RailGroup { id: string; label: string; icon: React.ReactNode; tools: RailTool[] }

// ---- icons: every <svg> below is moved unchanged from the old ThreeToolbar ----
// (example entries shown; copy the rest 1:1 from ThreeViewerUI.tsx)
const ICONS: Record<string, React.ReactNode> = {
  select: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l7 14 3-5 5 3-4-15z" />
    </svg>
  ),
  eraser: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  ),
  // …wall3d, floor3d, rect3d, circle3d, arc3d, box3d, cylinder3d, "roof-ridge",
  // line, pushpull, "wall-move", "wall-offset", "wall-height", "door-place3d",
  // "window-place3d", paint3d, "mep-water", "mep-drain", "mep-electric",
  // "mep-hvac", "mep-gas", "mep-fixture", orbit, pan, zoom, walk,
  // "walk-avatar", measure, "floor-pick", undo, redo — copied verbatim.
};

export const TOOL_LABELS: Record<string, string> = {
  select: "Chọn (V)", eraser: "Tẩy — click để xoá (E)",
  wall3d: "Vẽ tường (W)", floor3d: "Vẽ sàn", rect3d: "Chữ nhật", circle3d: "Hình tròn",
  arc3d: "Cung tròn", box3d: "Hộp 3D", cylinder3d: "Trụ 3D", "roof-ridge": "Vẽ đường nóc mái",
  line: "Vẽ trên bề mặt", pushpull: "Đẩy/Kéo (P)",
  "wall-move": "Dời tường", "wall-offset": "Offset tường", "wall-height": "Chiều cao tường",
  "door-place3d": "Đặt cửa đi", "window-place3d": "Đặt cửa sổ", paint3d: "Sơn vật liệu",
  "mep-water": "Cấp nước (+30cm)", "mep-drain": "Thoát nước (−20cm)", "mep-electric": "Điện (+280cm)",
  "mep-hvac": "Điều hòa (+300cm)", "mep-gas": "Gas (+30cm)", "mep-fixture": "Thiết bị gắn tường",
  orbit: "Xoay camera (O)", pan: "Di chuyển (H)", zoom: "Thu phóng (Z)",
  walk: "Đi bộ WASD", "walk-avatar": "Nhân vật đi vào phòng",
  measure: "Thước đo", "floor-pick": "Chọn vùng mặt bằng",
};

const GROUPS: RailGroup[] = [
  { id: "draw", label: "Vẽ", icon: ICONS.wall3d, tools: [
    "wall3d", "floor3d", "rect3d", "circle3d", "arc3d", "box3d", "cylinder3d", "roof-ridge", "line",
  ].map((id) => ({ id, label: TOOL_LABELS[id], icon: ICONS[id] })) },
  { id: "modify", label: "Chỉnh sửa", icon: ICONS.pushpull, tools: [
    "pushpull", "wall-move", "wall-offset", "wall-height", "door-place3d", "window-place3d", "paint3d",
  ].map((id) => ({ id, label: TOOL_LABELS[id], icon: ICONS[id] })) },
  { id: "mep", label: "MEP", icon: ICONS["mep-water"], tools: [
    "mep-water", "mep-drain", "mep-electric", "mep-hvac", "mep-gas", "mep-fixture",
  ].map((id) => ({ id, label: TOOL_LABELS[id], icon: ICONS[id] })) },
  { id: "view", label: "Camera", icon: ICONS.orbit, tools: [
    "orbit", "pan", "zoom", "walk", "walk-avatar",
  ].map((id) => ({ id, label: TOOL_LABELS[id], icon: ICONS[id] })) },
];

export function ToolRail({
  activeTool, setActiveTool, onLineClick,
  hasRegion, onResetRegion, onAnalyze, analyzeStatus, onDetectRooms,
}: {
  activeTool: string;
  setActiveTool: (tool: string) => void;
  onLineClick: () => void;
  onShow2DNotice: (name: string) => void;
  onShowInteractionNotice: (name: string) => void;
  hasRegion?: boolean;
  onResetRegion?: () => void;
  onAnalyze?: () => void;
  analyzeStatus?: "idle" | "pending" | "running" | "done" | "error";
  onDetectRooms?: () => void;
}) {
  const [openGroup, setOpenGroup] = useState<{ id: string; top: number } | null>(null);

  // Click-away closes any open flyout (demo_2's document click handler).
  useEffect(() => {
    if (!openGroup) return;
    const close = () => setOpenGroup(null);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [openGroup]);

  const pick = (id: string) => {
    setOpenGroup(null);
    if (id === "line") onLineClick();
    else setActiveTool(id);
  };

  const railBtn = "relative group/rb w-9 h-9 rounded-lg flex items-center justify-center transition-all";
  const idle = "text-slate-400 hover:text-white hover:bg-slate-700";
  const activeCls = "bg-blue-600 text-white shadow-lg shadow-blue-600/25";
  const tooltip = (label: string) => (
    <span className="absolute left-11 top-1/2 -translate-y-1/2 bg-slate-800 text-slate-100 text-[11px] font-semibold px-2.5 py-1 rounded-md whitespace-nowrap opacity-0 group-hover/rb:opacity-100 pointer-events-none transition-opacity shadow-xl z-[60]">
      {label}
    </span>
  );

  const groupOfActive = GROUPS.find((g) => g.tools.some((t) => t.id === activeTool));

  return (
    <>
      <div className="absolute left-3 top-1/2 -translate-y-1/2 z-20 bg-slate-950/80 border border-white/[0.08] p-1.5 rounded-xl shadow-2xl flex flex-col space-y-0.5 backdrop-blur-sm select-none items-center overflow-y-auto max-h-[86vh]">
        {/* Edit */}
        <button onClick={() => pick("select")} className={`${railBtn} ${activeTool === "select" ? activeCls : idle}`}>{ICONS.select}{tooltip(TOOL_LABELS.select)}</button>
        <button onClick={() => pick("eraser")} className={`${railBtn} ${activeTool === "eraser" ? activeCls : idle}`}>{ICONS.eraser}{tooltip(TOOL_LABELS.eraser)}</button>
        <button onClick={() => useDrawingStore.getState().undo()} className={`${railBtn} ${idle}`}>{ICONS.undo}{tooltip("Hoàn tác (Ctrl+Z)")}</button>
        <button onClick={() => useDrawingStore.getState().redo()} className={`${railBtn} ${idle}`}>{ICONS.redo}{tooltip("Làm lại (Ctrl+Shift+Z)")}</button>
        <div className="w-6 border-t border-slate-800 my-1" />

        {/* Flyout groups */}
        {GROUPS.map((g) => (
          <button
            key={g.id}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              const top = (e.currentTarget as HTMLElement).getBoundingClientRect().top;
              setOpenGroup(openGroup?.id === g.id ? null : { id: g.id, top });
            }}
            className={`${railBtn} ${groupOfActive?.id === g.id ? activeCls : idle}`}
          >
            {g.tools.find((t) => t.id === activeTool)?.icon ?? g.icon}
            {tooltip(g.tools.find((t) => t.id === activeTool)?.label ?? g.label)}
          </button>
        ))}
        <div className="w-6 border-t border-slate-800 my-1" />

        {/* Analyze */}
        <button onClick={() => pick("measure")} className={`${railBtn} ${activeTool === "measure" ? activeCls : idle}`}>{ICONS.measure}{tooltip(TOOL_LABELS.measure)}</button>
        <button onClick={() => pick("floor-pick")} className={`${railBtn} ${activeTool === "floor-pick" ? activeCls : idle}`}>{ICONS["floor-pick"]}{tooltip(TOOL_LABELS["floor-pick"])}</button>
        {hasRegion && (
          <button onClick={onResetRegion} className={`${railBtn} text-amber-400 hover:text-white hover:bg-amber-700`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            {tooltip("Bỏ vùng đã chọn")}
          </button>
        )}
        {onAnalyze && (
          <button onClick={onAnalyze} disabled={analyzeStatus === "pending" || analyzeStatus === "running"} className={`${railBtn} text-violet-400 hover:text-white hover:bg-violet-700 disabled:opacity-40`}>
            {analyzeStatus === "pending" || analyzeStatus === "running"
              ? <span className="block w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
              : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" /></svg>}
            {tooltip("Phân tích 2D → BIM 3D")}
          </button>
        )}
        <button onClick={() => onDetectRooms?.()} className={`${railBtn} ${idle} hover:bg-emerald-700`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
          {tooltip("Tự động nhận phòng (R)")}
        </button>
      </div>

      {/* Flyout menu — fixed beside the rail at the group button's height */}
      {openGroup && (() => {
        const g = GROUPS.find((x) => x.id === openGroup.id)!;
        return (
          <div
            className="fixed left-[60px] z-30 bg-slate-900/95 border border-slate-700/70 rounded-xl p-1.5 flex flex-col gap-0.5 min-w-[190px] shadow-2xl backdrop-blur-md"
            style={{ top: Math.max(8, Math.min(openGroup.top, window.innerHeight - 40 * g.tools.length - 16)) }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {g.tools.map((t) => (
              <button
                key={t.id}
                onClick={() => pick(t.id)}
                className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[12px] text-left transition-all ${activeTool === t.id ? "bg-blue-600/25 text-blue-300" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`}
              >
                <span className="flex-shrink-0">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        );
      })()}
    </>
  );
}

/** Persistent pill above the canvas naming the active tool (demo_2's #toolBadge). */
export function ToolBadge({ activeTool }: { activeTool: string }) {
  const label = TOOL_LABELS[activeTool];
  if (!label) return null;
  return (
    <div className="absolute top-4 left-16 z-30 flex items-center gap-2 bg-blue-950/80 border border-blue-500/50 text-blue-300 px-3 py-1.5 rounded-full text-[11px] font-bold select-none pointer-events-none backdrop-blur">
      {ICONS[activeTool]}
      {label}
    </div>
  );
}
```

Fill the `ICONS` map completely: for each id listed in its comment, copy that tool's `<svg>` block from the old `ThreeToolbar` in `ThreeViewerUI.tsx` (match by the `setActiveTool("<id>")` call / `title`); `undo`/`redo` icons come from the Edit-group buttons; `roof-ridge` and `mep-fixture` come from Tasks 3/6 of this plan.

- [x] **Step 2: Swap it in**

- `ThreeViewer.tsx`: replace the `ThreeToolbar` import with `import { ToolRail, ToolBadge } from "../canvas/3d/components/ToolRail";`, replace `<ThreeToolbar …/>` with `<ToolRail …/>` (identical props), and render `<ToolBadge activeTool={activeTool} />` directly after the `notice` banner div.
- `ThreeViewerUI.tsx`: delete the `ToolGroup` helper and the `ThreeToolbar` function (now unused); keep every other export. Remove the then-unused `useDrawingStore` import **only if** nothing else in the file still uses it (`PaintPalettePanel`/`RightSidebar` don't; check with grep first).

- [x] **Step 3: Type-check + manual smoke test**

Run: `cd autocard/frontend && npx tsc --noEmit` — clean.
Dev server: rail shows ~12 icons instead of ~30; hovering shows Vietnamese tooltips; clicking "Vẽ" opens the flyout with 9 labeled tools; picking "Vẽ tường" closes it, highlights the group with the wall icon, and the badge pill reads "Vẽ tường (W)"; clicking elsewhere closes an open flyout; undo/redo and analyze/detect-rooms still work; every tool from the old toolbar is reachable.

- [x] **Step 4: Commit**

```bash
git add src/canvas/3d/components/ToolRail.tsx src/canvas/3d/components/ThreeViewerUI.tsx src/components/ThreeViewer.tsx
git commit -m "feat(3d): icon-rail toolbar with flyout groups and current-tool badge"
```

---

## Final verification (after all tasks)

- [x] `cd autocard/frontend && npx tsc --noEmit` — clean.
- [x] `cd autocard/frontend && npx vitest run` — all vitest tests pass (existing 87 + ~17 new; the 8 pre-existing `node:test` files remain incompatible with the vitest runner, unchanged).
- [ ] Manual pass (`npm run dev`, port 51530, 3D mode): draw a rectangular house → hip roof + short ridge across the short axis → roof reorients, hip faces grow; ridge → 0 gives a pyramid; shed + ridge near an edge raises that edge → place công tắc/ổ cắm/tủ điện on walls (flush, correct heights) → export all three 2D sheets and open the PNGs → Ctrl+Z undoes fixtures → toolbar: flyouts open/close, tooltips show, tool badge tracks the active tool, every old tool remains reachable.
