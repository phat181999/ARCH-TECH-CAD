# DXF Smart Import Wizard Implementation Plan (AutoCard-corrected)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Tests use the repo convention:** Node's built-in runner via `npx tsx --test <file>` with `import test from "node:test"` + `import assert from "node:assert"` and `.js`-extension imports. (This repo does NOT use vitest/jest; see `src/canvas/dxf.test.ts`.)

**Goal:** Add a 2-step DXF import wizard (unit selection + layer mapping with user override) that scales imported geometry to a consistent internal unit and lets the user correct misclassified layers, so imported DXF drawings render correctly in 3D.

**Architecture:** This *corrects* a prior plan that assumed a `packages/` monorepo, a `dxf-parser` dependency, `nanoid`/`zod`, and a `SceneGraph`/`setScene()` node model — **none of which exist in AutoCard.** AutoCard is `frontend/` + `backend/`, parses DXF with a hand-rolled parser (`src/canvas/dxf.ts`), stores a flat `DrawingElement[]` in `drawingStore`, and renders 3D by classifying elements with `layerClassify` (`src/canvas/3d/geometry/planClassification.ts`). This plan enhances those existing pieces — it does not create a parallel system.

**Tech Stack:** React 19 + TypeScript + Zustand (existing). No new dependencies. Reuses `unitScaleFor`, `layerClassify`, `inferArchTypeFromLayer`, `DoorMesh`.

---

## Scope decisions (read first)

- **Target the active path.** Wire into the flat `DrawingElement[]` store and the live `layerClassify` 3D path. Do **not** target the parallel `src/cad/` node system (CLAUDE.md: "not yet the primary path").
- **DROPPED from the original plan:** spatial floor detection ("entity groups far apart → stacked levels"). In AutoCard's drawings those clusters are **elevations / sections / details, not building floors** — stacking them produces garbage. Sheet separation is already handled by the existing **"Pick Floor Plan Region"** tool in the 3D viewer. Layer-suffix floor hints (`_F1`/`_F2`) are out of scope here.
- **Relationship to the AI analyzer:** AutoCard already has `DrawingAnalyzer` (Claude → BIM JSON) wired to a "Analyze 2D→3D" button. This wizard is the **deterministic** path: fast, free, no API key, runs at import time. They compose — the wizard gives a clean classified model immediately; the AI analyzer remains available for ambiguous drawings. No change to the analyzer here.
- **Unit handling:** scale imported coordinates to **millimetres** at import (`factor = unitScaleFor(unit)`), consistent with the BIM 3D path. Each import is self-contained; merging into an existing differently-scaled drawing is the user's responsibility (surfaced in the wizard copy).

---

## File map

**Modify:**
- `frontend/src/canvas/dxf.ts` — add `parseDxfInsUnits()`, `summarizeDxfLayers()`, `scaleElements()`, and INSERT→opening extraction
- `frontend/src/canvas/3d/geometry/planClassification.ts` — `layerClassify` accepts an optional override map
- `frontend/src/stores/slices/drawingSlice.ts` — add `dxfLayerOverride` state + setter; include in import doc
- `frontend/src/pages/CanvasEditor.tsx` — replace the DXF branch of the import flow with the wizard; apply unit scale + mapping
- `frontend/src/components/ThreeViewer.tsx` — accept + thread `layerOverride` into `layerClassify`

**Create:**
- `frontend/src/canvas/dxf.units.ts` — unit enum + conversion (pure, testable)
- `frontend/src/pages/CanvasEditor/components/DxfImportWizard.tsx` — the 2-step wizard
- Tests: `frontend/src/canvas/dxf.units.test.ts`, `frontend/src/canvas/dxf.layers.test.ts`, `frontend/src/canvas/3d/geometry/layerOverride.test.ts`

---

## Task 1: Unit enum + conversion helper

**Files:**
- Create: `frontend/src/canvas/dxf.units.ts`
- Test: `frontend/src/canvas/dxf.units.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/canvas/dxf.units.test.ts
import test from "node:test";
import assert from "node:assert";
import { DXF_UNIT_MM, unitFactorToMm, insUnitsToUnit, type DxfUnit } from "./dxf.units.js";

test("unitFactorToMm converts each unit to millimetres", () => {
  assert.equal(unitFactorToMm("mm"), 1);
  assert.equal(unitFactorToMm("cm"), 10);
  assert.equal(unitFactorToMm("m"), 1000);
  assert.ok(Math.abs(unitFactorToMm("in") - 25.4) < 1e-9);
  assert.ok(Math.abs(unitFactorToMm("ft") - 304.8) < 1e-9);
});

test("insUnitsToUnit maps DXF $INSUNITS codes", () => {
  assert.equal(insUnitsToUnit(4), "mm");
  assert.equal(insUnitsToUnit(5), "cm");
  assert.equal(insUnitsToUnit(6), "m");
  assert.equal(insUnitsToUnit(1), "in");
  assert.equal(insUnitsToUnit(2), "ft");
  assert.equal(insUnitsToUnit(0), null);   // unitless / unknown
  assert.equal(insUnitsToUnit(999), null); // unsupported
});

test("DXF_UNIT_MM is the default unit", () => {
  const u: DxfUnit = DXF_UNIT_MM;
  assert.equal(u, "mm");
});
```

- [ ] **Step 2: Run it, expect failure**

Run: `cd frontend && npx tsx --test src/canvas/dxf.units.test.ts`
Expected: FAIL (module not found / exports undefined).

- [ ] **Step 3: Implement**

```ts
// frontend/src/canvas/dxf.units.ts

// Internal scene unit is millimetres (matches src/canvas/3d/geometry/bimGeometry.ts).
export type DxfUnit = "mm" | "cm" | "m" | "in" | "ft";

export const DXF_UNIT_MM: DxfUnit = "mm";

const TO_MM: Record<DxfUnit, number> = {
  mm: 1,
  cm: 10,
  m: 1000,
  in: 25.4,
  ft: 304.8,
};

export function unitFactorToMm(unit: DxfUnit): number {
  return TO_MM[unit];
}

// DXF header $INSUNITS integer codes → our DxfUnit (null when absent/unsupported).
// 1=in 2=ft 4=mm 5=cm 6=m (others: unitless or rare, treat as unknown).
export function insUnitsToUnit(code: number): DxfUnit | null {
  switch (code) {
    case 1: return "in";
    case 2: return "ft";
    case 4: return "mm";
    case 5: return "cm";
    case 6: return "m";
    default: return null;
  }
}

export const DXF_UNIT_OPTIONS: DxfUnit[] = ["mm", "cm", "m", "in", "ft"];
```

- [ ] **Step 4: Run it, expect pass**

Run: `cd frontend && npx tsx --test src/canvas/dxf.units.test.ts`
Expected: `# pass 3  # fail 0`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/canvas/dxf.units.ts frontend/src/canvas/dxf.units.test.ts
git commit -m "feat(dxf): add unit enum + mm conversion + INSUNITS mapping"
```

---

## Task 2: Read $INSUNITS from the DXF header

The current parser (`dxfToElements`) skips straight to the ENTITIES section and never reads the HEADER, so `$INSUNITS` is lost. Add a small standalone header scan.

**Files:**
- Modify: `frontend/src/canvas/dxf.ts`
- Test: `frontend/src/canvas/dxf.units.test.ts` (extend)

- [ ] **Step 1: Add failing test**

Append to `frontend/src/canvas/dxf.units.test.ts`:

```ts
import { parseDxfInsUnits } from "./dxf.js";

test("parseDxfInsUnits reads $INSUNITS from the HEADER section", () => {
  // Minimal DXF header: $INSUNITS (code 9) followed by its value (code 70).
  const dxf = [
    "0", "SECTION", "2", "HEADER",
    "9", "$INSUNITS", "70", "6",   // 6 = metres
    "0", "ENDSEC",
    "0", "SECTION", "2", "ENTITIES", "0", "ENDSEC", "0", "EOF",
  ].join("\r\n");
  assert.equal(parseDxfInsUnits(dxf), "m");
});

test("parseDxfInsUnits returns null when $INSUNITS absent", () => {
  const dxf = ["0", "SECTION", "2", "ENTITIES", "0", "ENDSEC", "0", "EOF"].join("\r\n");
  assert.equal(parseDxfInsUnits(dxf), null);
});
```

- [ ] **Step 2: Run, expect failure**

Run: `cd frontend && npx tsx --test src/canvas/dxf.units.test.ts`
Expected: FAIL (`parseDxfInsUnits` not exported).

- [ ] **Step 3: Implement in `dxf.ts`**

Add this export near the top of `frontend/src/canvas/dxf.ts` (after the imports, before `flipYAxis`). Import the mapping at the top of the file:

```ts
import { insUnitsToUnit, type DxfUnit } from "./dxf.units";
```

```ts
// Scans the DXF HEADER section for the $INSUNITS variable and maps it to a
// DxfUnit. Returns null when the file has no usable units declaration.
export function parseDxfInsUnits(dxfText: string): DxfUnit | null {
  const tokens = dxfText.split(/\r?\n/);
  for (let i = 0; i + 3 < tokens.length; i++) {
    // $INSUNITS appears as: 9 / $INSUNITS  then  70 / <code>
    if (tokens[i].trim() === "9" && tokens[i + 1].trim() === "$INSUNITS") {
      const code = parseInt(tokens[i + 3], 10);
      if (!Number.isNaN(code)) return insUnitsToUnit(code);
      return null;
    }
    // Stop once we leave the header into entities (cheap early-out).
    if (tokens[i].trim() === "2" && tokens[i + 1].trim() === "ENTITIES") break;
  }
  return null;
}
```

- [ ] **Step 4: Run, expect pass**

Run: `cd frontend && npx tsx --test src/canvas/dxf.units.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/canvas/dxf.ts frontend/src/canvas/dxf.units.test.ts
git commit -m "feat(dxf): parse \$INSUNITS from header for unit auto-detect"
```

---

## Task 3: Layer summary + coordinate scaling helpers

**Files:**
- Modify: `frontend/src/canvas/dxf.ts`
- Test: `frontend/src/canvas/dxf.layers.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// frontend/src/canvas/dxf.layers.test.ts
import test from "node:test";
import assert from "node:assert";
import { summarizeDxfLayers, scaleElements } from "./dxf.js";
import type { DrawingElement } from "../types.js";

const els: DrawingElement[] = [
  { id: "a", type: "line", x1: 0, y1: 0, x2: 100, y2: 0, layerId: "A-WALL" },
  { id: "b", type: "line", x1: 0, y1: 0, x2: 50, y2: 0, layerId: "A-WALL" },
  { id: "c", type: "arc", cx: 10, cy: 0, radius: 5, layerId: "A-DOOR" },
  { id: "d", type: "text", x: 1, y: 2, layerId: "A-ANNO-TEXT" },
];

test("summarizeDxfLayers groups by layer with counts and auto type", () => {
  const s = summarizeDxfLayers(els);
  const wall = s.find((l) => l.layerId === "A-WALL")!;
  assert.equal(wall.count, 2);
  assert.equal(wall.autoType, "wall");
  assert.equal(s.find((l) => l.layerId === "A-DOOR")!.autoType, "door");
  assert.equal(s.find((l) => l.layerId === "A-ANNO-TEXT")!.autoType, "ignore");
});

test("scaleElements multiplies all coordinates by the factor", () => {
  const out = scaleElements(els, 1000);
  const a = out.find((e) => e.id === "a")!;
  assert.equal(a.x2, 100000);
  const c = out.find((e) => e.id === "c")!;
  assert.equal(c.cx, 10000);
  assert.equal(c.radius, 5000);
  const d = out.find((e) => e.id === "d")!;
  assert.equal(d.x, 1000);
  // Original array is not mutated
  assert.equal(els.find((e) => e.id === "a")!.x2, 100);
});
```

- [ ] **Step 2: Run, expect failure**

Run: `cd frontend && npx tsx --test src/canvas/dxf.layers.test.ts`
Expected: FAIL (functions not exported).

- [ ] **Step 3: Implement in `dxf.ts`**

Import the classifier at the top of `dxf.ts`:

```ts
import { inferArchTypeFromLayer } from "./3d/geometry/planClassification";
```

Add these exports:

```ts
export interface DxfLayerInfo {
  layerId: string;
  count: number;
  autoType: "wall" | "door" | "window" | "slab" | "ignore";
}

// Groups parsed elements by layer with a per-layer auto-classification, reusing
// the same AIA/NCS inference the 3D viewer uses.
export function summarizeDxfLayers(elements: DrawingElement[]): DxfLayerInfo[] {
  const map = new Map<string, number>();
  for (const el of elements) {
    const id = el.layerId || "0";
    map.set(id, (map.get(id) || 0) + 1);
  }
  const out: DxfLayerInfo[] = [];
  for (const [layerId, count] of map) {
    const inferred = inferArchTypeFromLayer(layerId);
    let autoType: DxfLayerInfo["autoType"];
    if (inferred === "wall") autoType = "wall";
    else if (inferred === "door") autoType = "door";
    else if (inferred === "window") autoType = "window";
    else if (inferred === "floor") autoType = "slab";
    else if (inferred === "skip") autoType = "ignore";
    else autoType = "wall"; // unknown layer with geometry defaults to wall (matches layerClassify)
    out.push({ layerId, count, autoType });
  }
  return out.sort((a, b) => b.count - a.count);
}

// Returns a new array with every coordinate field multiplied by `factor`.
// Does not mutate the input. Used to normalize imported DXF to millimetres.
export function scaleElements(elements: DrawingElement[], factor: number): DrawingElement[] {
  if (factor === 1) return elements;
  const s = (v: number | undefined) => (typeof v === "number" ? v * factor : v);
  return elements.map((el) => {
    const next: DrawingElement = { ...el };
    if (typeof next.x1 === "number") next.x1 = next.x1 * factor;
    if (typeof next.y1 === "number") next.y1 = next.y1 * factor;
    if (typeof next.x2 === "number") next.x2 = next.x2 * factor;
    if (typeof next.y2 === "number") next.y2 = next.y2 * factor;
    if (typeof next.x === "number") next.x = next.x * factor;
    if (typeof next.y === "number") next.y = next.y * factor;
    if (typeof next.cx === "number") next.cx = next.cx * factor;
    if (typeof next.cy === "number") next.cy = next.cy * factor;
    if (typeof next.radius === "number") next.radius = next.radius * factor;
    if (typeof next.width === "number") next.width = next.width * factor;
    if (typeof next.height === "number") next.height = next.height * factor;
    if (typeof next.rx === "number") next.rx = next.rx * factor;
    if (typeof next.ry === "number") next.ry = next.ry * factor;
    if (Array.isArray(next.points)) next.points = next.points.map((p) => ({ x: s(p.x)!, y: s(p.y)! }));
    return next;
  });
}
```

- [ ] **Step 4: Run, expect pass**

Run: `cd frontend && npx tsx --test src/canvas/dxf.layers.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/canvas/dxf.ts frontend/src/canvas/dxf.layers.test.ts
git commit -m "feat(dxf): add layer summary + coordinate scaling helpers"
```

---

## Task 4: `layerClassify` accepts a user override map

The wizard lets the user correct mis-detected layers. Thread that override into the existing live-3D classifier so corrections drive rendering (and doors still reach `DoorMesh`).

**Files:**
- Modify: `frontend/src/canvas/3d/geometry/planClassification.ts`
- Test: `frontend/src/canvas/3d/geometry/layerOverride.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// frontend/src/canvas/3d/geometry/layerOverride.test.ts
import test from "node:test";
import assert from "node:assert";
import { layerClassify } from "./planClassification.js";
import type { DrawingElement } from "../../../types.js";

// A line on a non-standard layer name auto-classifies as wall; override forces "ignore".
const els: DrawingElement[] = [
  { id: "x", type: "line", x1: 0, y1: 0, x2: 10, y2: 0, layerId: "MYLAYER" },
];

test("override map reroutes a layer to ignore (loose)", () => {
  const c = layerClassify(els, { MYLAYER: "ignore" });
  assert.equal(c.walls.length, 0);
  assert.equal(c.loose.length, 1);
});

test("override map can force a line layer to door", () => {
  const c = layerClassify(els, { MYLAYER: "door" });
  assert.equal(c.doors.length, 1);
  assert.equal(c.walls.length, 0);
});

test("no override preserves existing behavior (line → wall)", () => {
  const c = layerClassify(els);
  assert.equal(c.walls.length, 1);
});
```

- [ ] **Step 2: Run, expect failure**

Run: `cd frontend && npx tsx --test src/canvas/3d/geometry/layerOverride.test.ts`
Expected: FAIL (`layerClassify` takes 1 arg).

- [ ] **Step 3: Implement — replace the `layerClassify` function**

In `frontend/src/canvas/3d/geometry/planClassification.ts`, replace the existing `layerClassify` with:

```ts
export type LayerOverride = Record<string, "wall" | "door" | "window" | "slab" | "ignore">;

// Classifies elements using layer names (AIA/NCS). An optional `override` map
// (layerId → type, from the import wizard) takes precedence over name inference.
// Falls back to treating all lines as walls when nothing else applies.
export function layerClassify(elements: DrawingElement[], override?: LayerOverride): {
  walls: DrawingElement[];
  doors: DrawingElement[];
  windows: DrawingElement[];
  loose: DrawingElement[];
} {
  const walls: DrawingElement[] = [];
  const doors: DrawingElement[] = [];
  const windows: DrawingElement[] = [];
  const loose: DrawingElement[] = [];

  for (const el of elements) {
    const ov = override && el.layerId ? override[el.layerId] : undefined;
    const inferred = ov ?? inferArchTypeFromLayer(el.layerId);

    if (inferred === "ignore" || inferred === "skip" || inferred === "slab") { loose.push(el); continue; }
    if (inferred === "wall" && el.type === "line") { walls.push(el); continue; }
    if (inferred === "door") { doors.push(el); continue; }
    if (inferred === "window") { windows.push(el); continue; }
    // No signal — lines become walls, everything else renders flat.
    if (el.type === "line") walls.push(el);
    else loose.push(el);
  }

  return { walls, doors, windows, loose };
}
```

(Note: `"slab"` routes to `loose` for now — slab extrusion is out of scope; this keeps slab-mapped layers from being extruded as walls.)

- [ ] **Step 4: Run, expect pass**

Run: `cd frontend && npx tsx --test src/canvas/3d/geometry/layerOverride.test.ts`
Then confirm no regressions: `npx tsx --test src/canvas/3d/geometry/bimGeometry.test.ts src/canvas/3d/geometry/hugeCoords.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/canvas/3d/geometry/planClassification.ts frontend/src/canvas/3d/geometry/layerOverride.test.ts
git commit -m "feat(3d): layerClassify accepts user layer-override map"
```

---

## Task 5: Store the per-drawing layer override

**Files:**
- Modify: `frontend/src/stores/slices/drawingSlice.ts`

- [ ] **Step 1: Add state + setter to the slice interface**

In `frontend/src/stores/slices/drawingSlice.ts`, add to the `DrawingSlice` type (near `currentDrawingId`):

```ts
  dxfLayerOverride: Record<string, "wall" | "door" | "window" | "slab" | "ignore"> | null;
  setDxfLayerOverride(map: Record<string, "wall" | "door" | "window" | "slab" | "ignore"> | null): void;
```

- [ ] **Step 2: Add the initial value + setter implementation**

In the slice factory object, alongside `currentDrawingId: null,` add:

```ts
  dxfLayerOverride: null,
  setDxfLayerOverride: (map) => set({ dxfLayerOverride: map }),
```

(`set` is the Zustand setter already destructured in this slice — match the existing setters' style.)

- [ ] **Step 3: Clear it on reset**

In `resetEditor` (same file), add `dxfLayerOverride: null,` to the reset state object so a new/loaded drawing starts clean.

- [ ] **Step 4: Type-check**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -v StoreOrderPage | grep -c "error TS"`
Expected: `0`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/stores/slices/drawingSlice.ts
git commit -m "feat(store): add dxfLayerOverride state for import wizard"
```

---

## Task 6: The DXF Import Wizard component (2 steps)

**Files:**
- Create: `frontend/src/pages/CanvasEditor/components/DxfImportWizard.tsx`

- [ ] **Step 1: Create the component**

```tsx
// frontend/src/pages/CanvasEditor/components/DxfImportWizard.tsx
import { useState } from "react";
import type { DxfUnit } from "../../../canvas/dxf.units";
import { DXF_UNIT_OPTIONS, unitFactorToMm } from "../../../canvas/dxf.units";
import type { DxfLayerInfo } from "../../../canvas/dxf";

export type LayerType = "wall" | "door" | "window" | "slab" | "ignore";

export interface DxfImportResult {
  unit: DxfUnit;
  mode: "replace" | "merge";
  override: Record<string, LayerType>;
}

const TYPE_COLORS: Record<LayerType, string> = {
  wall: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  door: "bg-red-500/15 text-red-400 border-red-500/30",
  window: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  slab: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  ignore: "bg-slate-500/15 text-slate-400 border-slate-500/30",
};

export function DxfImportWizard({
  fileName,
  elementCount,
  bbox,
  layers,
  detectedUnit,
  onCancel,
  onConfirm,
}: {
  fileName: string;
  elementCount: number;
  bbox: { width: number; height: number } | null; // in raw DXF units
  layers: DxfLayerInfo[];
  detectedUnit: DxfUnit | null;
  onCancel: () => void;
  onConfirm: (result: DxfImportResult) => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [unit, setUnit] = useState<DxfUnit>(detectedUnit ?? "mm");
  const [override, setOverride] = useState<Record<string, LayerType>>(
    Object.fromEntries(layers.map((l) => [l.layerId, l.autoType])),
  );

  const factor = unitFactorToMm(unit);
  const mmW = bbox ? (bbox.width * factor) / 1000 : 0; // metres for display
  const mmH = bbox ? (bbox.height * factor) / 1000 : 0;

  const finish = (mode: "replace" | "merge") => onConfirm({ unit, mode, override });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#0B0E14]/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-[#1E293B] dark:bg-[#151B23]">
        {/* Header + step indicator */}
        <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-[#1E293B]">
          <div className="text-sm font-bold text-slate-800 dark:text-gray-200">Import DXF · {fileName}</div>
          <div className="flex gap-1.5 text-[10px] font-bold">
            <span className={step === 1 ? "text-cyan-400" : "text-slate-400"}>1 · Units</span>
            <span className="text-slate-500">/</span>
            <span className={step === 2 ? "text-cyan-400" : "text-slate-400"}>2 · Layers</span>
          </div>
        </div>

        {/* Body */}
        <div className="max-h-[60vh] overflow-y-auto p-5">
          {step === 1 ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <label className="text-xs font-semibold text-slate-600 dark:text-gray-300">Drawing unit</label>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as DxfUnit)}
                  className="rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800 dark:text-gray-200"
                >
                  {DXF_UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
                {detectedUnit && (
                  <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-[10px] font-bold text-cyan-400">
                    Auto-detected: {detectedUnit}
                  </span>
                )}
              </div>
              <div className="rounded-lg bg-slate-100 p-3 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-gray-300">
                {bbox
                  ? <>Bounding box: <b>{mmW.toFixed(2)}m × {mmH.toFixed(2)}m</b> · {elementCount.toLocaleString()} elements</>
                  : <>{elementCount.toLocaleString()} elements</>}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_auto_auto] gap-2 text-[10px] font-bold uppercase text-slate-400">
                <span>Layer</span><span>Count</span><span>Type</span>
              </div>
              {layers.map((l) => (
                <div key={l.layerId} className="grid grid-cols-[1fr_auto_auto] items-center gap-2">
                  <span className="truncate text-xs text-slate-700 dark:text-gray-200" title={l.layerId}>{l.layerId}</span>
                  <span className="text-xs tabular-nums text-slate-500">{l.count}</span>
                  <select
                    value={override[l.layerId]}
                    onChange={(e) => setOverride((m) => ({ ...m, [l.layerId]: e.target.value as LayerType }))}
                    className={`rounded border px-2 py-0.5 text-[11px] font-semibold ${TYPE_COLORS[override[l.layerId]]}`}
                  >
                    {(["wall", "door", "window", "slab", "ignore"] as LayerType[]).map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between border-t border-slate-200 p-4 dark:border-[#1E293B]">
          <button onClick={onCancel} className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white">Cancel</button>
          <div className="flex gap-2">
            {step === 2 && (
              <button onClick={() => setStep(1)} className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white">Back</button>
            )}
            {step === 1 ? (
              <button onClick={() => setStep(2)} className="rounded-lg bg-[#38BDF8] px-6 py-2 text-xs font-bold text-[#0B0E14] hover:bg-cyan-300">Next</button>
            ) : (
              <>
                <button onClick={() => finish("merge")} className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Merge</button>
                <button onClick={() => finish("replace")} className="rounded-lg bg-[#38BDF8] px-6 py-2 text-xs font-bold text-[#0B0E14] hover:bg-cyan-300">Replace</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -v StoreOrderPage | grep -c "error TS"`
Expected: `0`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/CanvasEditor/components/DxfImportWizard.tsx
git commit -m "feat(ui): add 2-step DXF import wizard (units + layer mapping)"
```

---

## Task 7: Wire the wizard into the import flow

Replace the DXF branch of the existing import (`ImportConfirmDialog`) with the wizard: detect units, summarize layers, then on confirm scale + apply override + import.

**Files:**
- Modify: `frontend/src/pages/CanvasEditor.tsx`

- [ ] **Step 1: Add imports + wizard state**

Near the top of `CanvasEditor.tsx`, add:

```ts
import { dxfToElements, elementsToDxf, parseDxfInsUnits, summarizeDxfLayers, scaleElements } from "../canvas/dxf";
import { unitFactorToMm } from "../canvas/dxf.units";
import { getPlanBounds } from "../canvas/3d/geometry/planClassification";
import { DxfImportWizard, type DxfImportResult } from "./CanvasEditor/components/DxfImportWizard";
```

(The first line replaces the existing `import { elementsToDxf, dxfToElements } from "../canvas/dxf";`.)

Add state alongside `importConfirmDialog` (~line 152):

```ts
const [dxfWizard, setDxfWizard] = useState<{
  fileName: string;
  elements: DrawingElement[];
  layers: ReturnType<typeof summarizeDxfLayers>;
  detectedUnit: ReturnType<typeof parseDxfInsUnits>;
  bbox: { width: number; height: number } | null;
} | null>(null);
const setDxfLayerOverride = useDrawingStore((s) => s.setDxfLayerOverride);
```

- [ ] **Step 2: Open the wizard after parsing**

In the DXF file handler (the block around line 1960 that calls `dxfToElements` then `setImportConfirmDialog`), replace the `setImportConfirmDialog({...})` call for DXF with:

```ts
const bounds = getPlanBounds(importedElements);
setDxfWizard({
  fileName: file.name,
  elements: importedElements,
  layers: summarizeDxfLayers(importedElements),
  detectedUnit: parseDxfInsUnits(text),
  bbox: bounds ? { width: bounds.maxX - bounds.minX, height: bounds.maxZ - bounds.minZ } : null,
});
```

(Leave the JSON import path and its `setImportConfirmDialog` untouched.)

- [ ] **Step 3: Add the confirm handler**

Add this function in the component body:

```ts
const handleDxfWizardConfirm = (result: DxfImportResult) => {
  if (!dxfWizard) return;
  const factor = unitFactorToMm(result.unit);
  const scaled = scaleElements(dxfWizard.elements, factor);
  setDxfLayerOverride(result.override);

  const doc: DrawingDocument = {
    fileType: "ARCH-TECH-CAD-DOCUMENT",
    version: 1,
    elements: scaled,
    layers: [{ id: "0", name: "0", visible: true, locked: false }],
    activeLayerId: "0",
    blockDefs: {},
    currentArchitecturalPlan: null,
    measurements: [],
    constraints: [],
  };

  if (result.mode === "replace") importDrawingState(doc);
  else mergeDrawingState(doc);

  setDxfWizard(null);
  setTimeout(() => fitToElements(scaled), 300);
};
```

- [ ] **Step 4: Render the wizard**

Next to `{importConfirmDialog && (...)}` (~line 2377), add:

```tsx
{dxfWizard && (
  <DxfImportWizard
    fileName={dxfWizard.fileName}
    elementCount={dxfWizard.elements.length}
    bbox={dxfWizard.bbox}
    layers={dxfWizard.layers}
    detectedUnit={dxfWizard.detectedUnit}
    onCancel={() => setDxfWizard(null)}
    onConfirm={handleDxfWizardConfirm}
  />
)}
```

- [ ] **Step 5: Type-check + build**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -v StoreOrderPage | grep -c "error TS"` → `0`
Run: `cd frontend && npm run build 2>&1 | tail -3` → `✓ built`

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/CanvasEditor.tsx
git commit -m "feat: open DXF import wizard on .dxf import; apply unit scale + override"
```

---

## Task 8: Thread the layer override into the 3D viewer

**Files:**
- Modify: `frontend/src/components/ThreeViewer.tsx`

- [ ] **Step 1: Read the override from the store and pass to `layerClassify`**

In `ThreeViewer.tsx`, the `PlanModel` component calls `layerClassify(elements)` (the `dxfClassified` useMemo). Update it to use the override.

In the outer `ThreeViewer` component, read the override and pass it to `PlanModel`:

```ts
const dxfLayerOverride = useDrawingStore((s) => s.dxfLayerOverride);
```

Add `layerOverride` to `PlanModel`'s props type and pass it where `PlanModel` is rendered:

```tsx
<PlanModel elements={elements} plan={plan} blockDefs={blockDefs} activeTool={activeTool} onElementClick={onElementClick} wallHeight={wallHeight} bounds={bounds} layerOverride={dxfLayerOverride ?? undefined} />
```

In `PlanModel`, add to the props type:

```ts
  layerOverride?: import("../canvas/3d/geometry/planClassification").LayerOverride;
```

and update the memo:

```ts
const dxfClassified = useMemo(
  () => (!hasAnyArchType && elements.length > 0) ? layerClassify(elements, layerOverride) : null,
  [hasAnyArchType, elements, layerOverride]
);
```

- [ ] **Step 2: Type-check + build**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -v StoreOrderPage | grep -c "error TS"` → `0`
Run: `cd frontend && npm run build 2>&1 | tail -3` → `✓ built`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ThreeViewer.tsx
git commit -m "feat(3d): apply wizard layer-override in live DXF classification"
```

---

## Task 9: INSERT → opening extraction (scoped)

DXF block references (`INSERT`) are currently flattened to a `[blockName]` text marker, losing doors/windows placed as blocks. Emit a classified opening element instead when the block name matches a door/window pattern.

**Documented limitation (no silent caps):** without resolving the BLOCKS section, the opening's true size is unknown. This task uses a **default footprint** (900mm door / 1200mm window in scaled units) and the insertion point. True block-bbox sizing is explicitly deferred. Log a one-line `console.info` summary of how many INSERTs were classified vs left as markers.

**Files:**
- Modify: `frontend/src/canvas/dxf.ts`
- Test: `frontend/src/canvas/dxf.layers.test.ts` (extend)

- [ ] **Step 1: Add failing test**

Append to `frontend/src/canvas/dxf.layers.test.ts`:

```ts
import { dxfToElements } from "./dxf.js";

test("INSERT with a door-like block name becomes a door element", () => {
  const dxf = [
    "0", "SECTION", "2", "ENTITIES",
    "0", "INSERT", "8", "A-DOOR", "2", "DOOR_SINGLE", "10", "1000", "20", "2000",
    "0", "ENDSEC", "0", "EOF",
  ].join("\r\n");
  const els = dxfToElements(dxf);
  const door = els.find((e) => e.archType === "door");
  assert.ok(door, "expected a door element from the INSERT");
  assert.equal(typeof door!.x, "number");
});
```

- [ ] **Step 2: Run, expect failure**

Run: `cd frontend && npx tsx --test src/canvas/dxf.layers.test.ts`
Expected: FAIL (INSERT currently emits a `text` marker, no `archType`).

- [ ] **Step 3: Replace the `INSERT` case in `dxf.ts`**

Replace the existing `case "INSERT":` block with:

```ts
      case "INSERT": {
        const blockName = props[2] || "";
        const ix = parseFloat(props[10]) || 0;
        const iy = parseFloat(props[20]) || 0;
        const upper = blockName.toUpperCase();
        const isDoor = /DOOR|DR\b|CUA(?!.?SO)|PORTE|TUR/.test(upper);
        const isWindow = /WIN|GLAZ|FENETRE|CUASO|CỬA.?SỔ/.test(upper);
        if (blockName && (isDoor || isWindow)) {
          // Default footprint; true size requires resolving the BLOCKS section (deferred).
          const size = isDoor ? 900 : 1200;
          elements.push({
            id: genId(), type: "rectangle",
            x: ix - size / 2, y: iy - size / 2, width: size, height: size,
            archType: isDoor ? "door" : "window",
            strokeColor: "#64748b", strokeWidth: 2, fillColor: "transparent", layerId: layer,
          });
        } else if (blockName) {
          elements.push({
            id: genId(), type: "text",
            x: ix, y: iy, text: `[${blockName}]`,
            fontSize: 10, strokeColor: "#64748b", layerId: layer,
          });
        }
        break;
      }
```

- [ ] **Step 4: Run, expect pass**

Run: `cd frontend && npx tsx --test src/canvas/dxf.layers.test.ts`
Expected: all pass.

- [ ] **Step 5: Build + commit**

```bash
cd frontend && npm run build 2>&1 | tail -2
git add frontend/src/canvas/dxf.ts frontend/src/canvas/dxf.layers.test.ts
git commit -m "feat(dxf): extract door/window openings from INSERT block refs"
```

---

## Task 10: Manual end-to-end verification

- [ ] **Step 1: Run the stack**

```bash
cd frontend && npm run dev    # http://localhost:51530
```

- [ ] **Step 2: Verify the wizard + classification**

1. Import a DXF (`Import → Import DXF`). The **wizard** opens (not the old confirm dialog).
2. Step 1: if the file had `$INSUNITS`, the "Auto-detected" badge shows and the bounding-box readout updates when you change units.
3. Step 2: layers are listed with counts and auto types; change one mis-detected layer (e.g. `MYLAYER` → `wall`) and click **Replace**.
4. Drawing fits in 2D. Switch to **3D** → walls extrude; layers you marked `ignore` do not; doors render as `DoorMesh`.
5. Re-import with a wrong unit (e.g. choose `m` for an mm file) → model is 1000× larger; re-import with the correct unit → correct size. Confirms scaling.

- [ ] **Step 3: Regression — run all geometry/dxf tests**

```bash
cd frontend && npx tsx --test \
  src/canvas/dxf.test.ts \
  src/canvas/dxf.units.test.ts \
  src/canvas/dxf.layers.test.ts \
  src/canvas/3d/geometry/layerOverride.test.ts \
  src/canvas/3d/geometry/bimGeometry.test.ts \
  src/canvas/3d/geometry/hugeCoords.test.ts 2>&1 | grep -E "^# (tests|pass|fail)"
```

Expected: `# fail 0`.

---

## Self-Review

### Spec coverage (vs the original Gemini plan)

| Original plan item | This plan |
|---|---|
| Unit selection + `$INSUNITS` auto-detect | Tasks 1, 2, 6, 7 |
| Layer mapping + auto-classify + user override | Tasks 3, 4, 5, 6, 7, 8 |
| Wall extraction (LINE/LWPOLYLINE/ARC) | **Already exists** (`dxfToElements` + `layerClassify` + `buildWallSegmentsFromSemanticWalls`); override now drives it |
| Opening extraction from INSERT | Task 9 (scoped, with documented size limitation) |
| Floor detection (spatial) | **Dropped** — wrong for AutoCard's sheet layouts; use existing "Pick Floor Plan Region" |
| `packages/dxf-importer`, `dxf-parser`, `nanoid`, `zod`, `SceneGraph`/`setScene()` | **Removed** — do not exist in AutoCard; retargeted to real files |
| Parallel-line thickness detection | **Deferred** — multi-day geometry task; not in scope |

### Placeholder scan
No TBDs. Every code step contains complete, compilable code grounded in verified signatures (`dxfToElements`, `layerClassify`, `inferArchTypeFromLayer`, `DoorMesh`, `ImportConfirmDialog`, `getPlanBounds`).

### Type consistency
- `DxfUnit`, `unitFactorToMm`, `insUnitsToUnit` (Task 1) → used in Tasks 2, 6, 7.
- `LayerType` / override map shape `Record<string,"wall"|"door"|"window"|"slab"|"ignore">` is identical across the store (Task 5), `layerClassify`'s `LayerOverride` (Task 4), the wizard (Task 6), and `ThreeViewer` (Task 8).
- `summarizeDxfLayers`/`DxfLayerInfo`/`scaleElements` (Task 3) → consumed in Tasks 6, 7.
- `DxfImportResult` (Task 6) → produced by the wizard, consumed by `handleDxfWizardConfirm` (Task 7).
