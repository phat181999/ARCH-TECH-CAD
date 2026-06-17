# 3D Architectural Drawing Tools — Implementation Plan (Reviewed / Corrected)

> Reviewed as **Senior Dev Lead + Product Owner + Constructor/BIM**. This is the
> original Gemini plan with corrections applied inline. Changes from the original
> are marked **[AMEND]**, **[CUT]**, **[REUSE]**, **[ADD]**. The headline fixes:
> 1. Target the **existing `src/cad/` node model + command pipeline** — do NOT add a 4th data store.
> 2. **Reuse the decomposition-based opening cuts** we already shipped — do NOT add CSG.
> 3. Re-scope the MVP to **"edit the AI-generated model in 3D"** (round-trips to 2D), not from-scratch authoring.
> 4. Sequence this **behind** the two higher-ROI fixes (DXF block expansion, analysis reliability).
> 5. Estimates corrected to ~35–50 days for full scope.

---

## 0. Guardrails (read before any phase) **[ADD]**

These are non-negotiable given the current codebase:

- **Data model = `src/cad/` nodes.** The node contracts already define `wall`, `door`,
  `window`, `slab`, `column`, `level` (`src/cad/contracts/nodes/architectural.ts`,
  `bim.ts`), and `src/cad/core/commands/` already provides a command/reducer pipeline
  (`create/delete/update/move-node`) with history. **Use these.** A new `scene3dStore`
  with `Object3D[]` + `history: Object3D[][]` would be a 4th parallel model that can't
  persist, can't round-trip to 2D, and re-implements undo/redo that already exists.
- **No CSG.** Door/window openings already work via pier+lintel+sill **decomposition**
  in `src/canvas/3d/geometry/bimGeometry.ts` (tested, no dependency, no per-edit boolean
  cost). Reuse it. Do not add `three-bvh-csg`.
- **Floating origin.** The 3D scene renders inside a group translated by `-boundsCenter`
  (fix shipped this week for far-from-origin DXFs). Every new tool must create/raycast/
  place geometry in that **recentered space**, or huge-coordinate imports will mis-place
  everything.
- **2D↔3D round-trip is a requirement, not a nicety.** A 3D edit must write a `cad/` node
  so it can surface in 2D plan/section/elevation and persist with the drawing.

---

## 1. Reuse / Replace Audit **[ADD]**

The original plan treated everything as greenfield. It isn't:

| Plan item | Already exists | Action |
|---|---|---|
| `scene3dStore` + `Object3D` + history | `src/cad/store/*`, `cad/contracts/nodes/*`, `cad/core/commands/*` | **REUSE** node model + command pipeline; **CUT** new store |
| Wall geometry | `wallGeometry.ts`, `bimGeometry.ts` (`buildWallBoxes`) | **EXTEND**, don't rewrite |
| Door/window opening cuts (CSG) | `bimGeometry.ts` decomposition + `DoorMesh` | **REUSE** decomposition; **CUT** CSG |
| Materials library/panel | `BIMPanel` material categories; `bim.ts` node `material?` | **EXTEND** existing |
| Undo/redo | `cad/core/commands` history | **REUSE** |
| 2D→3D classification | `planClassification.ts` (`layerClassify`, AIA + Vietnamese layers) | **REUSE** |
| BIM Analyze "✅ Working" | Fails silently on Render (no key / worker killed) — fixed surfacing this week | **Mark as ⚠️, not a foundation** |

---

## 2. Re-scoped MVP **[AMEND]**

**Original framing:** "draw a complete house in 3D from scratch (SketchUp-style)."
**Corrected framing:** **"edit and correct the AI-generated 3D model in 3D, with edits round-tripping to 2D."**

Why: AutoCard's differentiators are 2D precision + AI 2D→3D. Greenfield 3D authoring
competes with mature tools (Revit/SketchUp) a short MVP can't match, and produces a
3D-only silo. Editing the AI output is unique, defensible, and reinforces the core loop.

**MVP = corrected Phases 1–3:**
1. Bridge AI `bim_data` / classified 2D → editable `cad/` wall/door/window/level nodes.
2. Move/adjust walls (length, thickness, height) via gizmo → writes `update-node` command.
3. Place/move doors & windows hosted on a wall (decomposition opening) → `create/move-node`.
4. Every edit round-trips: the `cad/` node updates, 2D reflects it, it persists with the drawing.

Everything below the MVP line is **backlog**, added incrementally only if validated.

---

## 3. Sequencing — do these FIRST **[ADD]**

This plan should NOT start until the two higher-ROI items that block the *existing*
workflow are done (both surfaced in real use this week):

- **A. DXF block expansion.** `dxfToElements` only reads `ENTITIES` and flattens `INSERT`
  to a marker — block-based drawings (e.g. `blocks_and_tables.dxf` → 3 elements) import
  near-empty. Expanding the `BLOCKS` section + applying `INSERT` transforms is the real
  "nothing draws" fix for many files.
- **B. Analysis reliability.** Analyze jobs get killed by Render free-tier restarts and
  (if no key) 401. Decide hosting/worker durability + set `ANTHROPIC_API_KEY`. Without a
  reliable AI model, "edit the AI model" (the MVP) has nothing to edit.

---

## Phases (corrected)

### Phase 1: Bridge to the `cad/` node model **[AMEND — was "new scene3dStore"]**
- **[CUT]** `src/canvas/3d/store/scene3dStore.ts` and `src/canvas/3d/types/archTypes.ts`.
- **[ADD]** `src/canvas/3d/bridge/bimToNodes.ts` — convert a `BIMResult` (and/or
  `layerClassify` output) into `cad/` `wall`/`door`/`window`/`level` nodes via the
  command pipeline (`createNode`), so the 3D scene reads from `useCadDocumentStore`.
- Selection/history come from the existing `cad` selection + command stores.
- **Verify:** import → analyze → nodes exist in `useCadDocumentStore`; undo/redo works
  through `cad/core/commands` (no new history code).
- **Effort: 2–3 days** (was 1–2; bridging + round-trip is more than a store).

### Phase 2: Wall edit/draw tool 🔴 **[AMEND]**
- Controller under `src/canvas/3d/controllers/` (matches existing `DrawOnFaceController`
  etc.), not a new `tools/` dir.
- Click-click drawing (confirm Open Q#3 → click-click, consistent with Draw-on-Face).
- Operates in the **floating-origin group space**.
- Wall = `WallNode` (start/end/height/thickness); geometry via extended `bimGeometry`.
- **[AMEND] Wall joins (T/L/X merge): treat as its own sub-task, budget 2–3× .** Robust
  joinery is the hard part of every BIM tool. MVP: butt joints + visual corner cleanup;
  true mitered/merged joins later.
- **Effort: 6–8 days** (was 3–4).

### Phase 3: Door & Window placement 🔴 **[AMEND]**
- Hover wall → highlight → click to place; door/window is a node **hosted by the wall id**
  (so it moves with the wall — a BIM relationship, not a free object).
- **[REUSE]** opening via `bimGeometry` decomposition (pier + lintel + sill). **[CUT]** CSG.
- Drag-along-wall = `move-node` constrained to the host wall axis.
- **Effort: 5–6 days** (was 3–4; hosting + constrained drag).

> **[CUT] CSG dependency section.** Not needed. Decomposition already produces real
> openings and is unit-tested.

---

### Backlog (post-MVP, validate before committing) **[AMEND priorities]**

| Phase | Feature | Notes |
|---|---|---|
| 4 | Floor/Slab | `SlabNode` exists; extrude polygon. Auto-detect from enclosed walls is hard — ship manual outline first. |
| 5 | **Section Cut** | **[AMEND] raise priority** — constructors live in sections; clipping plane is cheaper than roofs/stairs and higher value. |
| 6 | Roof builder | gable/hip/shed; parametric. |
| 7 | Materials | extend `BIMPanel` materials + `material?` node field, don't build fresh. |
| 8 | Stairs / Columns / Move-Copy gizmo | `ColumnNode` exists; Move via drei `TransformControls`. |

---

## Updated Toolbar Layout **[KEEP — good as-is]**
The STRUCTURE / EDIT / CAMERA grouping is a real UX improvement; keep it. Just gate each
tool button on whether its node type is wired through the `cad/` pipeline yet (don't show
dead buttons).

---

## Open Questions — resolved **[AMEND]**
1. **CSG library** → **None.** Reuse decomposition (`bimGeometry.ts`).
2. **Separate store vs existing** → **Existing `cad/` node model + command pipeline.** A
   separate 3D store is the plan's biggest risk; reject it.
3. **Wall drawing mode** → **Click-click**, consistent with Draw-on-Face.
4. **Export GLTF/OBJ** → Valuable and *easy* once geometry is node-derived (one
   `GLTFExporter` pass over the scene group). Keep as a small backlog item; it's a strong
   differentiator for a construction tool (hand off to renderers).

---

## Corrected Estimate
| Bucket | Original | Corrected |
|---|---|---|
| MVP (Phase 1–3) | 7–10 days | **13–17 days** |
| Full (Phase 1–8) | 16–24 days | **35–50 days** |

The estimate gap is itself the argument for the tight MVP + sequencing above.

## Verification (additions) **[ADD]**
- Round-trip test: create a wall in 3D → assert a `WallNode` exists in
  `useCadDocumentStore` → assert it renders in the 2D canvas.
- Floating-origin test: place a door on a wall in a DXF offset by ~1e6 units → assert the
  door lands on the wall (not at world origin).
- Undo test: 3D edit → `undo()` via command store → node reverts (no bespoke history).
- (Keep the original's "draw a house / export GLTF" manual checks.)
