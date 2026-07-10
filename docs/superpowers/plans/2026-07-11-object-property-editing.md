# Object Property Editing (Doors, Furniture, Stairs, Pipes) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Selecting a door, furniture piece, stair, or pipe in the 3D tab shows a numeric property panel (like walls already have) alongside the existing move/rotate gizmo — width/depth for doors and stairs, scale for furniture, diameter/elevation for pipes.

**Architecture:** Mirrors the existing wall-properties mechanism in `ThreeViewer.tsx` (`selectedWallElement` memo → `wallPropsForPanel` memo → change handlers → `WallPropertiesPanel` render) three more times, with three new panel components in `ThreeViewerUI.tsx`. Stairs and pipes additionally need `onElementClick` wired into their mesh components (currently missing), and `DoorMesh` needs its click handler extended from eraser-only to also cover the select tool.

**Tech Stack:** React 19 + TypeScript, @react-three/fiber, Zustand (existing `updateElement` action only), Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-07-10-object-property-editing-design.md`

**Correction discovered while grounding this plan (not in the spec):** the spec says doors are "already clickable via `FlatElementMesh`". Partially wrong — elements with `archType === "door"` render through `DoorMesh` (see `ThreeViewer.tsx:1006`: `el.archType === "door" ? <DoorMesh …> : <FlatElementMesh …>`), and `DoorMesh`'s `onClick` handlers only fire when `activeTool === "eraser"` (`DoorMesh.tsx:30,58`) — select-tool clicks are ignored. Task 2 fixes this. Furniture (block instances) genuinely does go through `FlatElementMesh`, which already handles `["eraser", "select", "paint3d"]`.

## Global Constraints

- All frontend paths below are relative to `autocard/frontend/` unless prefixed otherwise.
- Type-check after every task: `cd autocard/frontend && npx tsc --noEmit` — must stay clean (the pre-existing error in `src/pages/StoreOrderPage.tsx:493` is ignorable).
- No new vitest test files — this is a mechanical extension of the proven wall-properties pattern with no new pure logic. Verification is a manual/scripted browser pass per task plus a final end-to-end Playwright pass (Task 5, explicitly requested by the user).
- The existing wall editing flow (`selectedWallElement`, `wallPropsForPanel`, `handleWallProp*Change`, `WallPropertiesPanel`) must remain completely untouched.
- `TransformGizmoController` (move/rotate on selection) must remain untouched — the new panels appear alongside it, exactly like the wall panel already does.
- Units: drawing coords are 1 unit = 1 cm on the plan (100 units = 1 m), so `el.width`/`el.height` are already cm — no conversion. Pipe `pipeDiameter` is mm, pipe `elevation` is cm (both stored as-is, matching `PipeMesh`'s own reading of them).
- Doors and stairs have NO vertical-height field in the data model (`DoorMesh` renders a fixed-height marker box; `StairMesh` derives height from `totalRise`). The shared panel's two fields are plan-footprint **Width** and **Depth** (writing `el.width`/`el.height`). Do not invent a vertical-height field.
- Match existing code style (see `WallPropertiesPanel` in `ThreeViewerUI.tsx:1093-1156` for the exact panel conventions: local string state per field, refresh-on-selection-change `useEffect`s keyed on id+value, `commitField` on blur/Enter, `fieldClass` styling); commit after every task.

---

### Task 1: Three new panel components in `ThreeViewerUI.tsx`

**Files:**
- Modify: `src/canvas/3d/components/ThreeViewerUI.tsx` (add three exported components directly after `WallPropertiesPanel`, which ends at line 1156)

**Interfaces:**
- Consumes: nothing new (pure presentational components; `useState`/`useEffect` already imported in this file).
- Produces (used by Task 4):
  - `<WidthHeightPropertiesPanel label width depth onChangeWidth onChangeDepth />` — `label: string` ("Door" | "Stair"), `width`/`depth: number` (cm), callbacks `(cm: number) => void`.
  - `<FurniturePropertiesPanel scalePct onChangeScale />` — `scalePct: number` (100 = catalog default), callback `(pct: number) => void`.
  - `<PipePropertiesPanel diameterMm elevationCm onChangeDiameter onChangeElevation />` — callbacks `(n: number) => void`.

- [ ] **Step 1: Add the three components**

Insert directly after `WallPropertiesPanel`'s closing brace (`ThreeViewerUI.tsx:1156`):

```tsx
/** Numeric properties for a selected door or stair — same appear-on-select
    mechanism as WallPropertiesPanel. Both fields are the plan-footprint
    rectangle (el.width / el.height) in cm; neither element type has a
    vertical-height field in the data model, so none is offered. */
export function WidthHeightPropertiesPanel({ label, width, depth, onChangeWidth, onChangeDepth }: {
  label: string;
  width: number;  // cm
  depth: number;  // cm
  onChangeWidth: (cm: number) => void;
  onChangeDepth: (cm: number) => void;
}) {
  const [w, setW] = useState(String(Math.round(width)));
  const [d, setD] = useState(String(Math.round(depth)));
  useEffect(() => setW(String(Math.round(width))), [label, width]);
  useEffect(() => setD(String(Math.round(depth))), [label, depth]);

  const commitField = (raw: string, min: number, current: number, apply: (n: number) => void) => {
    const n = Number(raw);
    apply(Number.isFinite(n) && n >= min ? n : current);
  };
  const fieldClass = "w-16 bg-slate-800 border border-slate-600 text-white text-xs px-2 py-1 rounded focus:outline-none focus:border-blue-500";

  return (
    <div className="absolute left-1/2 bottom-20 -translate-x-1/2 z-30 bg-slate-900/95 border border-slate-700/60 rounded-xl px-5 py-3 flex items-center gap-4 backdrop-blur-md shadow-2xl select-none">
      <span className="text-slate-500 text-[9px] font-bold uppercase tracking-wider">{label}</span>
      <label className="flex items-center gap-1.5">
        <span className="text-slate-300 text-xs">Width</span>
        <input type="number" value={w} min={10} step={5}
          onChange={e => setW(e.target.value)}
          onBlur={() => commitField(w, 10, width, onChangeWidth)}
          onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          className={fieldClass}
        />
        <span className="text-slate-500 text-[10px]">cm</span>
      </label>
      <label className="flex items-center gap-1.5">
        <span className="text-slate-300 text-xs">Depth</span>
        <input type="number" value={d} min={2} step={5}
          onChange={e => setD(e.target.value)}
          onBlur={() => commitField(d, 2, depth, onChangeDepth)}
          onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          className={fieldClass}
        />
        <span className="text-slate-500 text-[10px]">cm</span>
      </label>
      <span className="text-slate-600 text-[9px] pl-1 border-l border-white/10 whitespace-nowrap">Drag gizmo to move/rotate</span>
    </div>
  );
}

/** Numeric scale for a selected furniture/block instance — a single uniform
    multiplier (percent of catalog size), matching how block instances are
    modeled (el.scale applied on X/Z in FlatElementMesh). */
export function FurniturePropertiesPanel({ scalePct, onChangeScale }: {
  scalePct: number; // 100 = catalog default
  onChangeScale: (pct: number) => void;
}) {
  const [s, setS] = useState(String(Math.round(scalePct)));
  useEffect(() => setS(String(Math.round(scalePct))), [scalePct]);

  const commit = () => {
    const n = Number(s);
    onChangeScale(Number.isFinite(n) && n >= 10 && n <= 500 ? n : scalePct);
  };

  return (
    <div className="absolute left-1/2 bottom-20 -translate-x-1/2 z-30 bg-slate-900/95 border border-slate-700/60 rounded-xl px-5 py-3 flex items-center gap-4 backdrop-blur-md shadow-2xl select-none">
      <span className="text-slate-500 text-[9px] font-bold uppercase tracking-wider">Furniture</span>
      <label className="flex items-center gap-1.5">
        <span className="text-slate-300 text-xs">Scale</span>
        <input type="number" value={s} min={10} max={500} step={5}
          onChange={e => setS(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          className="w-16 bg-slate-800 border border-slate-600 text-white text-xs px-2 py-1 rounded focus:outline-none focus:border-blue-500"
        />
        <span className="text-slate-500 text-[10px]">%</span>
      </label>
      <span className="text-slate-600 text-[9px] pl-1 border-l border-white/10 whitespace-nowrap">Drag gizmo to move/rotate</span>
    </div>
  );
}

/** Numeric properties for a selected pipe run — diameter (mm) and elevation
    above the floor slab (cm), the two fields PipeMesh reads for rendering. */
export function PipePropertiesPanel({ diameterMm, elevationCm, onChangeDiameter, onChangeElevation }: {
  diameterMm: number;
  elevationCm: number;
  onChangeDiameter: (mm: number) => void;
  onChangeElevation: (cm: number) => void;
}) {
  const [dia, setDia] = useState(String(Math.round(diameterMm)));
  const [elev, setElev] = useState(String(Math.round(elevationCm)));
  useEffect(() => setDia(String(Math.round(diameterMm))), [diameterMm]);
  useEffect(() => setElev(String(Math.round(elevationCm))), [elevationCm]);

  const commitField = (raw: string, min: number, current: number, apply: (n: number) => void) => {
    const n = Number(raw);
    apply(Number.isFinite(n) && n >= min ? n : current);
  };
  const fieldClass = "w-16 bg-slate-800 border border-slate-600 text-white text-xs px-2 py-1 rounded focus:outline-none focus:border-blue-500";

  return (
    <div className="absolute left-1/2 bottom-20 -translate-x-1/2 z-30 bg-slate-900/95 border border-slate-700/60 rounded-xl px-5 py-3 flex items-center gap-4 backdrop-blur-md shadow-2xl select-none">
      <span className="text-slate-500 text-[9px] font-bold uppercase tracking-wider">Pipe</span>
      <label className="flex items-center gap-1.5">
        <span className="text-slate-300 text-xs">Diameter</span>
        <input type="number" value={dia} min={10} max={600} step={5}
          onChange={e => setDia(e.target.value)}
          onBlur={() => commitField(dia, 10, diameterMm, onChangeDiameter)}
          onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          className={fieldClass}
        />
        <span className="text-slate-500 text-[10px]">mm</span>
      </label>
      <label className="flex items-center gap-1.5">
        <span className="text-slate-300 text-xs">Elevation</span>
        <input type="number" value={elev} min={0} max={1000} step={10}
          onChange={e => setElev(e.target.value)}
          onBlur={() => commitField(elev, 0, elevationCm, onChangeElevation)}
          onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          className={fieldClass}
        />
        <span className="text-slate-500 text-[10px]">cm</span>
      </label>
      <span className="text-slate-600 text-[9px] pl-1 border-l border-white/10 whitespace-nowrap">Drag gizmo to move/rotate</span>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd autocard/frontend && npx tsc --noEmit`
Expected: clean (components are exported but unused so far — no other file changes needed yet).

- [ ] **Step 3: Commit**

```bash
git add src/canvas/3d/components/ThreeViewerUI.tsx
git commit -m "feat(3d-edit): property panel components for doors/stairs, furniture, pipes"
```

---

### Task 2: Make `DoorMesh` respond to select-tool clicks

**Files:**
- Modify: `src/canvas/3d/components/DoorMesh.tsx`

**Interfaces:**
- Consumes: existing `activeTool`/`onElementClick` props (already threaded to every `DoorMesh` call site — no call-site changes needed).
- Produces: doors become selectable with the select tool, which is what makes Task 4's door panel reachable.

- [ ] **Step 1: Extend the click condition in both branches**

`DoorMesh.tsx` has two render branches (arc-type door at lines 17-40, rectangle door at lines 46-67), each with an `onPointerOver` and `onClick` that check `activeTool === "eraser"`. Add one shared constant after the `hovered` state (line 15):

```tsx
  const [hovered, setHovered] = useState(false);
  // Select must also reach doors so the properties panel + gizmo work on
  // them — mirrors FlatElementMesh's interactiveTools approach. Hover
  // highlight stays eraser-only (red = "will delete"); select shows its
  // feedback via the gizmo/panel instead.
  const clickable = activeTool === "eraser" || activeTool === "select";
```

Then in all four handlers (both branches' `onPointerOver` and `onClick`), the changes are:
- Both `onClick` handlers: change `if (activeTool === "eraser")` to `if (clickable)`. Body unchanged (`e.stopPropagation(); onElementClick?.(door.id);` — the `onClick` in the arc branch and rect branch are identical in shape).
- Both `onPointerOver` handlers: leave the `activeTool === "eraser"` condition unchanged (hover-red is delete feedback only).

The resulting rect-branch handlers (arc branch identical except `door.id` context):

```tsx
      onPointerOver={(e) => {
        if (activeTool === "eraser") {
          e.stopPropagation();
          setHovered(true);
        }
      }}
      onPointerOut={() => setHovered(false)}
      onClick={(e) => {
        if (clickable) {
          e.stopPropagation();
          onElementClick?.(door.id);
        }
      }}
```

- [ ] **Step 2: Type-check**

Run: `cd autocard/frontend && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Manual smoke test**

Dev server (localhost:51530): open a drawing with a door (or place one), switch to 3D, select tool active, click the door marker box → the move/rotate gizmo must appear on it (that's `TransformGizmoController` reacting to `selectedElementIds`, which proves the click reached `handleElementClick`). Also confirm eraser-click still deletes a door.

- [ ] **Step 4: Commit**

```bash
git add src/canvas/3d/components/DoorMesh.tsx
git commit -m "feat(3d-edit): make doors selectable with the select tool"
```

---

### Task 3: Wire `onElementClick` into `StairMesh` and `PipeMesh`

**Files:**
- Modify: `src/canvas/3d/components/StairMesh.tsx`
- Modify: `src/canvas/3d/components/PipeMesh.tsx`
- Modify: `src/components/ThreeViewer.tsx:1144,1157` (the two call sites inside `Scene`)

**Interfaces:**
- Consumes: `activeTool`/`onElementClick` already in scope in `Scene` (the neighboring `FloorMesh` call site at `ThreeViewer.tsx:1140` already passes both).
- Produces: stairs and pipes become click-selectable/erasable, making Task 4's stair/pipe panels reachable.

- [ ] **Step 1: `StairMesh` — add props and a group-level click handler**

In `StairMesh.tsx`, extend the props interface (lines 16-20) and destructure (line 29):

```tsx
interface StairMeshProps {
  el: DrawingElement;
  cx: number;
  cz: number;
  activeTool?: string;
  onElementClick?: (id: string) => void;
}
```

```tsx
export function StairMesh({ el, cx, cz, activeTool, onElementClick }: StairMeshProps) {
```

Add the click handler on the existing `<group>` (line 53). R3F pointer events bubble from the step meshes up to the group, so one group-level handler covers every step box. No hover highlight — `stairMaterial` is a module-level shared material (see the comment at line 22), so a per-instance color change would tint every stair; skipping hover keeps the change minimal and correct:

```tsx
  // Shared module-level material means no per-instance hover tint; selection
  // feedback comes from the gizmo/panel, same as pipes.
  const clickable = activeTool === "select" || activeTool === "eraser";

  return (
    <group
      position={[x + width / 2, 0, z + depth / 2]}
      rotation={[0, rotation, 0]}
      onClick={(e) => {
        if (clickable) {
          e.stopPropagation();
          onElementClick?.(el.id);
        }
      }}
    >
```

- [ ] **Step 2: `PipeMesh` — same addition on its single mesh**

In `PipeMesh.tsx`, extend the props interface (lines 24-28) and destructure (line 30) the same way:

```tsx
interface PipeMeshProps {
  el: DrawingElement;
  cx: number;
  cz: number;
  activeTool?: string;
  onElementClick?: (id: string) => void;
}
```

```tsx
export function PipeMesh({ el, cx, cz, activeTool, onElementClick }: PipeMeshProps) {
```

And on the returned `<mesh>` (line 65), add the handler:

```tsx
  const clickable = activeTool === "select" || activeTool === "eraser";

  if (length < MIN_PIPE_LENGTH) return null;

  return (
    <mesh
      position={position}
      rotation={[0, -rotation, Math.PI / 2]}
      material={material}
      castShadow
      onClick={(e) => {
        if (clickable) {
          e.stopPropagation();
          onElementClick?.(el.id);
        }
      }}
    >
```

- [ ] **Step 3: Pass the props at both call sites in `ThreeViewer.tsx`'s `Scene`**

At `ThreeViewer.tsx:1144` (pipes) and `:1157` (stairs), matching the neighboring `FloorMesh` call site's pattern:

```tsx
        {/* Pipes / MEP — archType:"pipe" line elements */}
        {elements
          .filter((el) => el.archType === "pipe" && el.x1 != null && el.x2 != null)
          .map((el) => <PipeMesh key={el.id} el={el} cx={cx} cz={cz} activeTool={activeTool} onElementClick={onElementClick} />)}
```

```tsx
        {/* Stairs — archType:"stair" rectangle elements */}
        {elements
          .filter((el) => el.archType === "stair" && el.x != null && el.width != null)
          .map((el) => <StairMesh key={el.id} el={el} cx={cx} cz={cz} activeTool={activeTool} onElementClick={onElementClick} />)}
```

- [ ] **Step 4: Type-check**

Run: `cd autocard/frontend && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/canvas/3d/components/StairMesh.tsx src/canvas/3d/components/PipeMesh.tsx src/components/ThreeViewer.tsx
git commit -m "feat(3d-edit): make stairs and pipes click-selectable"
```

---

### Task 4: Selection memos, change handlers, and panel rendering in `ThreeViewer.tsx`

**Files:**
- Modify: `src/components/ThreeViewer.tsx` (import at line 27; memos/handlers after `handleWallPropLengthChange` which ends at line 1648; renders after the `WallPropertiesPanel` block at ~line 1859-1868)

**Interfaces:**
- Consumes: Task 1's three panel components; existing `selectedElementIds`, `elements`, `activeTool`, `updateElement` (all already in scope — the wall memos at lines 1599-1648 use exactly these).
- Produces: the user-facing feature — panels appear on selection.

- [ ] **Step 1: Extend the `ThreeViewerUI` import (line 27)**

Add `WidthHeightPropertiesPanel, FurniturePropertiesPanel, PipePropertiesPanel` to the existing named-import list from `"../canvas/3d/components/ThreeViewerUI"`.

- [ ] **Step 2: Add memos and handlers after `handleWallPropLengthChange` (ends line 1648)**

```tsx
  // ── Door / stair / furniture / pipe property panels ──────────────────────
  // Same appear-on-single-selection mechanism as selectedWallElement above;
  // each memo differs only in the archType check and the fields exposed.
  const selectedDoorOrStairElement = useMemo(() => {
    if (activeTool !== "select" || selectedElementIds.length !== 1) return null;
    const el = elements.find((e) => e.id === selectedElementIds[0]);
    if (!el) return null;
    if (el.archType !== "door" && el.archType !== "stair") return null;
    // Arc-type doors (swing symbol) have no plan rectangle to edit.
    if (el.archType === "door" && (el.width == null || el.height == null)) return null;
    if (el.x == null || el.y == null) return null;
    return el;
  }, [activeTool, selectedElementIds, elements]);

  const widthDepthPropsForPanel = useMemo(() => {
    if (!selectedDoorOrStairElement) return null;
    const el = selectedDoorOrStairElement;
    return {
      id: el.id,
      label: el.archType === "door" ? "Door" : "Stair",
      // Drawing units are 1:1 with cm on the plan. Stair defaults mirror
      // StairMesh's own rendering fallbacks (width 120, depth 240).
      widthCm: el.width ?? 120,
      depthCm: el.height ?? 240,
    };
  }, [selectedDoorOrStairElement]);

  const handleWidthDepthWidthChange = useCallback((cm: number) => {
    if (!widthDepthPropsForPanel) return;
    updateElement(widthDepthPropsForPanel.id, { width: cm });
  }, [widthDepthPropsForPanel, updateElement]);

  const handleWidthDepthDepthChange = useCallback((cm: number) => {
    if (!widthDepthPropsForPanel) return;
    updateElement(widthDepthPropsForPanel.id, { height: cm });
  }, [widthDepthPropsForPanel, updateElement]);

  const selectedFurnitureElement = useMemo(() => {
    if (activeTool !== "select" || selectedElementIds.length !== 1) return null;
    const el = elements.find((e) => e.id === selectedElementIds[0]);
    if (!el || !el.blockId) return null;
    return el;
  }, [activeTool, selectedElementIds, elements]);

  const furniturePropsForPanel = useMemo(() => {
    if (!selectedFurnitureElement) return null;
    // scale ?? 1 matches FlatElementMesh's own rendering default.
    return {
      id: selectedFurnitureElement.id,
      scalePct: Math.round((selectedFurnitureElement.scale ?? 1) * 100),
    };
  }, [selectedFurnitureElement]);

  const handleFurnitureScaleChange = useCallback((pct: number) => {
    if (!furniturePropsForPanel) return;
    updateElement(furniturePropsForPanel.id, { scale: pct / 100 });
  }, [furniturePropsForPanel, updateElement]);

  const selectedPipeElement = useMemo(() => {
    if (activeTool !== "select" || selectedElementIds.length !== 1) return null;
    const el = elements.find((e) => e.id === selectedElementIds[0]);
    if (!el || el.archType !== "pipe" || el.x1 == null || el.x2 == null) return null;
    return el;
  }, [activeTool, selectedElementIds, elements]);

  const pipePropsForPanel = useMemo(() => {
    if (!selectedPipeElement) return null;
    // 50 mm / 250 cm mirror PipeMesh's DEFAULT_PIPE_DIAMETER_MM /
    // DEFAULT_PIPE_ELEVATION_CM rendering fallbacks.
    return {
      id: selectedPipeElement.id,
      diameterMm: (selectedPipeElement.pipeDiameter as number | undefined) ?? 50,
      elevationCm: (selectedPipeElement.elevation as number | undefined) ?? 250,
    };
  }, [selectedPipeElement]);

  const handlePipeDiameterChange = useCallback((mm: number) => {
    if (!pipePropsForPanel) return;
    updateElement(pipePropsForPanel.id, { pipeDiameter: mm });
  }, [pipePropsForPanel, updateElement]);

  const handlePipeElevationChange = useCallback((cm: number) => {
    if (!pipePropsForPanel) return;
    updateElement(pipePropsForPanel.id, { elevation: cm });
  }, [pipePropsForPanel, updateElement]);
```

- [ ] **Step 3: Render the panels next to the existing `WallPropertiesPanel` block**

Directly after the `{!wallHeightEditor && wallPropsForPanel && (<WallPropertiesPanel …/>)}` block (~line 1859-1868). The four selections are mutually exclusive by `archType`, so at most one panel renders:

```tsx
        {widthDepthPropsForPanel && (
          <WidthHeightPropertiesPanel
            label={widthDepthPropsForPanel.label}
            width={widthDepthPropsForPanel.widthCm}
            depth={widthDepthPropsForPanel.depthCm}
            onChangeWidth={handleWidthDepthWidthChange}
            onChangeDepth={handleWidthDepthDepthChange}
          />
        )}
        {furniturePropsForPanel && (
          <FurniturePropertiesPanel
            scalePct={furniturePropsForPanel.scalePct}
            onChangeScale={handleFurnitureScaleChange}
          />
        )}
        {pipePropsForPanel && (
          <PipePropertiesPanel
            diameterMm={pipePropsForPanel.diameterMm}
            elevationCm={pipePropsForPanel.elevationCm}
            onChangeDiameter={handlePipeDiameterChange}
            onChangeElevation={handlePipeElevationChange}
          />
        )}
```

- [ ] **Step 4: Type-check**

Run: `cd autocard/frontend && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Manual smoke test**

Dev server: in the 3D tab with the select tool, click a furniture piece (insert one from the sidebar's Furn tab if needed) → Furniture panel appears; type 200 in Scale, blur → the piece visibly doubles on the plan. Click empty ground → panel disappears. Confirm selecting a wall still shows the wall panel, unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/components/ThreeViewer.tsx
git commit -m "feat(3d-edit): property panels appear on door/stair/furniture/pipe selection"
```

---

### Task 5: End-to-end Playwright verification (explicitly requested by the user)

**Files:**
- Create: `/private/tmp/claude-501/-Applications-project-ARCH-TECH-CAD/7099bd49-87ba-4bc0-afec-a3d675ac9348/scratchpad/verify-object-editing.mjs` (scratchpad — not committed)

**Interfaces:**
- Consumes: everything from Tasks 1-4, the running dev servers (frontend :51530, backend :8080 — check `lsof -i :51530` / `lsof -i :8080`; start with `cd autocard/frontend && npm run dev` / `cd autocard/backend && go run main.go` if down), credentials in `/Applications/project/ARCH-TECH-CAD/credential.md`.
- Produces: screenshots + a pass/fail log proving each object type is selectable and editable.

**Strategy:** seed a drawing via the API whose `data` JSON already contains one wall (for sane scene bounds), one door, one stair, and one pipe at known coordinates — this tests the *editing* feature without depending on each creation tool's UI. Furniture is inserted through the real UI (sidebar Furn tab) since block-instance element shape is defined by `insertBlock`. Selecting a 3D mesh at an exact screen pixel is not reliably computable, so the script probes: it clicks a coarse grid of canvas points until the expected panel appears (panel appearance is also the pass signal for click-to-select itself).

- [ ] **Step 1: Write the script**

```js
import { chromium } from "playwright";

const EMAIL = "hotanphat.htp99@gmail.com";
const PASSWORD = "Hotanphat@99";
const BASE = "http://localhost:51530";
const API = "http://localhost:8080";
const SHOT_DIR = "/Applications/project/ARCH-TECH-CAD/evidence-test";

const SEED = {
  layers: [{ id: "layer-1", name: "Layer 1", visible: true, locked: false }],
  elements: [
    { id: "wall-1", type: "line", layerId: "layer-1", archType: "wall", x1: 100, y1: 100, x2: 700, y2: 100, strokeColor: "#1f2937", strokeWidth: 2 },
    { id: "door-1", type: "rectangle", layerId: "layer-1", archType: "door", x: 300, y: 300, width: 90, height: 12 },
    { id: "stair-1", type: "rectangle", layerId: "layer-1", archType: "stair", x: 500, y: 350, width: 120, height: 240 },
    { id: "pipe-1", type: "line", layerId: "layer-1", archType: "pipe", x1: 150, y1: 550, x2: 650, y2: 550, pipeSystem: "water", pipeDiameter: 50, elevation: 100 },
  ],
};

// Click a grid of canvas points until `panelText` appears (or give up).
async function probeSelect(page, canvasBox, panelText) {
  const cols = 10, rows = 7;
  for (let r = 1; r < rows; r++) {
    for (let c = 1; c < cols; c++) {
      const x = canvasBox.x + (canvasBox.width * c) / cols;
      const y = canvasBox.y + (canvasBox.height * r) / rows;
      await page.mouse.click(x, y);
      await page.waitForTimeout(120);
      if (await page.getByText(panelText, { exact: true }).count() > 0) return { x, y };
    }
  }
  return null;
}

async function editField(page, labelText, newValue) {
  const input = page.locator(`label:has-text("${labelText}") input`).first();
  await input.fill(String(newValue));
  await input.press("Enter");
  await page.waitForTimeout(400);
}

async function main() {
  const { token } = await (await fetch(`${API}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })).json();

  const drawing = await (await fetch(`${API}/api/drawings`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: `obj-edit-test-${Date.now()}`, data: JSON.stringify(SEED) }),
  })).json();
  if (!drawing.id) { console.error("FATAL seed failed:", drawing); process.exit(1); }
  console.log("[setup] seeded drawing:", drawing.id);

  const browser = await chromium.launch({
    args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl", "--use-gl=angle", "--use-angle=swiftshader"],
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript((t) => window.localStorage.setItem("token", t), token);
  await page.goto(`${BASE}/#/editor/${drawing.id}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await page.getByRole("button", { name: /^Mô hình 3D$/i }).first().click();
  await page.waitForTimeout(2500);

  const canvasBox = await page.locator("canvas").first().boundingBox();
  const results = {};

  for (const [panel, fields] of [
    ["Door",  [["Width", 180], ["Depth", 30]]],
    ["Stair", [["Width", 300], ["Depth", 400]]],
    ["Pipe",  [["Diameter", 200], ["Elevation", 50]]],
  ]) {
    console.log(`=== ${panel} ===`);
    await page.keyboard.press("Escape");
    const hit = await probeSelect(page, canvasBox, panel);
    if (!hit) { results[panel] = "FAIL: never selected"; continue; }
    await page.screenshot({ path: `${SHOT_DIR}/objedit-${panel}-before.png` });
    for (const [label, val] of fields) await editField(page, label, val);
    await page.screenshot({ path: `${SHOT_DIR}/objedit-${panel}-after.png` });
    // Re-read the committed field values from the panel as the store-level check.
    const readBack = [];
    for (const [label] of fields) {
      readBack.push(await page.locator(`label:has-text("${label}") input`).first().inputValue());
    }
    results[panel] = `edited; panel reads back [${readBack.join(", ")}]`;
  }

  // Furniture: insert via the real UI (sidebar Furn tab), then select + scale.
  console.log("=== Furniture ===");
  await page.getByRole("button", { name: /^Furn\.$/i }).click();
  await page.getByRole("button", { name: /^Sofa$/i }).click();
  await page.waitForTimeout(800);
  await page.keyboard.press("Escape");
  const hit = await probeSelect(page, canvasBox, "Furniture");
  if (!hit) { results.Furniture = "FAIL: never selected"; }
  else {
    await page.screenshot({ path: `${SHOT_DIR}/objedit-Furniture-before.png` });
    await editField(page, "Scale", 250);
    await page.screenshot({ path: `${SHOT_DIR}/objedit-Furniture-after.png` });
    results.Furniture = `edited; scale reads back ${await page.locator('label:has-text("Scale") input').first().inputValue()}`;
  }

  // Regression: wall panel untouched.
  console.log("=== Wall regression ===");
  await page.keyboard.press("Escape");
  const wallHit = await probeSelect(page, canvasBox, "Wall");
  results.WallRegression = wallHit ? "wall panel still appears" : "FAIL: wall panel gone";

  await browser.close();
  console.log("\n=== RESULTS ===");
  for (const [k, v] of Object.entries(results)) console.log(`${k}: ${v}`);
  console.log("Page errors:", errors.length ? errors : "(none)");
  const failed = Object.values(results).some((v) => String(v).startsWith("FAIL"));
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error("FATAL", e); process.exit(1); });
```

- [ ] **Step 2: Run it**

```bash
cd /private/tmp/claude-501/-Applications-project-ARCH-TECH-CAD/7099bd49-87ba-4bc0-afec-a3d675ac9348/scratchpad && node verify-object-editing.mjs
```

Expected: exit 0; RESULTS shows all four object panels selected + edited with read-back values matching what was typed (Door `[180, 30]`, Stair `[300, 400]`, Pipe `[200, 50]`, Furniture `250`), wall regression passing, no page errors. Inspect the before/after screenshot pairs and confirm each mesh visibly changed size/position (pipe visibly thicker and lower, stair wider/deeper, door wider, sofa larger).

- [ ] **Step 3: Fix anything the run surfaces, re-run to green, then final suite check**

```bash
cd autocard/frontend && npx tsc --noEmit && npx vitest run
```

Expected: tsc clean; 119 tests passing (8 pre-existing `node:test`-style failing files are unrelated and expected).

- [ ] **Step 4: No commit** (script is scratchpad-only; any product-code fixes from Step 3 get their own descriptive commit)

---

## Final verification (after all tasks)

- [ ] `cd autocard/frontend && npx tsc --noEmit` — clean.
- [ ] `cd autocard/frontend && npx vitest run` — 119 passing, no new failures.
- [ ] `cd autocard/frontend && npm run build` — succeeds.
- [ ] Task 5's Playwright run green with visually-confirmed before/after screenshots for all four object types plus the wall-panel regression check.
