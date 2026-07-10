# Object Property Editing (Doors, Furniture, Stairs, Pipes) Design Spec

## Context

The user asked for a "click an object, then edit it (height, width, thickness, moving)" workflow in the 3D tab, then asked to extend it to "all objects existed in the system." Investigation before scoping found this is substantially already built for walls: selecting any element (any type) already shows a generic move/rotate gizmo (`TransformGizmoController`), and selecting a wall specifically also shows a numeric property panel (`WallPropertiesPanel` in `canvas/3d/components/ThreeViewerUI.tsx`) with typed-number fields for height, thickness, and length — fully wired to `ThreeViewer.tsx`'s `wallPropsForPanel` memo and `handleWallPropHeightChange`/`handleWallPropThicknessChange`/`handleWallPropLengthChange` handlers, all correctly converting units and calling the same `updateElement` store action every other tool uses.

**Full inventory of object types** (every `DrawingElement.archType`, checked against actual rendering code, not assumed):

| Tier | Types | Why |
|---|---|---|
| Done | Wall | Already has `WallPropertiesPanel` — untouched by this spec. |
| **In scope** | Door, furniture/blocks | Individually clickable via `FlatElementMesh` (`onElementClick` wired), has `width`/`height`/`scale` fields matching this pattern exactly. |
| **In scope** | Stair, pipe | Has a matching numeric data model (`width`/`height` for stairs; `pipeDiameter`/`elevation` for pipes) but isn't wired to `onElementClick` yet — `StairMesh`/`PipeMesh` need one small addition before the panel pattern applies. |
| **Deferred, not this spec** | Window | Assumed to work like doors; it doesn't. The primary render path uses `InstancedWindowsMesh` (one batched draw call for all windows), which has no per-window click handling. May only be selectable via a secondary/fallback path. Needs its own investigation before promising a panel for it. |
| **Deferred, not this spec** | Column, grade-beam, foundation-strip/spread/raft/pile | All render via `THREE.InstancedMesh` (`InstancedColumnsMesh`, `FoundationMesh`) — no per-instance click-to-select exists at all. Adding it means raycasting against instance IDs, a genuinely different and larger mechanism than anything this pattern needs — a separate project, not an extension of this one. |
| **Not applicable** | Room, grid, dimension, meta, floor | Not rectangle/line-shaped the way walls/doors/stairs are (floor is an arbitrary polygon via `points`; the rest are annotation/reference elements, not physical objects with a width/height to type in). |
| **Already cut (unchanged)** | MEP fixture, roof | MEP fixtures have no established size model. Roof already has global type/pitch controls in the sidebar, not a per-selection case. |

## Goal

Extend the already-proven wall-properties pattern to doors, furniture, stairs, and pipes: selecting one of these shows a small numeric panel alongside the existing gizmo, matching what walls already have.

## Scope

**In scope:**
- **Doors** — `width`/`height` fields, already used by `FlatElementMesh` for rendering, already clickable.
- **Furniture/blocks** — `scale` field (a single uniform size multiplier, not independent width/height, matching how block instances are already modeled), already clickable.
- **Stairs** — `width`/`height` fields (same shape as doors — `StairMesh` already reads `el.width`/`el.height`, defaulting to 120/240), needs `onElementClick` wired to `StairMesh` (currently missing).
- **Pipes** — `pipeDiameter` (mm) and `elevation` (cm above floor) fields, already used by `PipeMesh` for rendering, needs `onElementClick` wired to `PipeMesh` (currently missing).

**Out of scope (resolved during brainstorming):**
- **Windows** — deferred; the instanced rendering path needs separate investigation before a panel can be promised to work.
- **Columns, grade-beams, foundation types** — deferred; needs new per-instance click-selection infrastructure first, a separate, larger project.
- **MEP fixtures** — no established per-object size/dimension model exists yet.
- **Roof** — already has global controls in the sidebar; not a per-selection case.
- **Rooms, grid, dimension, meta, floor** — not rectangle/line-shaped objects with a simple width/height to edit.
- Move/rotate itself — already fully generic and working via `TransformGizmoController` for every element type, untouched by this spec.
- The existing `WallPropertiesPanel`/wall editing flow — untouched, used only as the reference pattern.

## Architecture

No new architecture for doors/furniture/stairs — this mirrors the existing wall-properties mechanism. Pipes follow the same panel pattern with a different field pair. Stairs and pipes additionally need one click-handling wire-up each before the pattern applies:

```
selectedElementIds (existing Zustand store state, unchanged)
        │
        ├─→ selectedWallElement → wallPropsForPanel → WallPropertiesPanel              (existing, untouched)
        ├─→ selectedDoorOrStairElement → widthHeightPropsForPanel → WidthHeightPropertiesPanel  (NEW — shared by doors + stairs, same field shape)
        ├─→ selectedFurnitureElement → furniturePropsForPanel → FurniturePropertiesPanel        (NEW)
        └─→ selectedPipeElement → pipePropsForPanel → PipePropertiesPanel                       (NEW)
```

Exactly one panel is visible at a time — a single selection is one element, and each element has exactly one `archType`. The new memos reuse the existing wall memo's `activeTool === "select" && selectedElementIds.length === 1` guard verbatim; only the element-type check differs per memo.

Doors and stairs share one panel component (`WidthHeightPropertiesPanel`) since both need exactly the same two fields with the same semantics — avoids two near-identical components for an identical shape.

## Components

| File | Change | Notes |
|---|---|---|
| `canvas/3d/components/ThreeViewerUI.tsx` | Add `WidthHeightPropertiesPanel` (used for both doors and stairs), `FurniturePropertiesPanel`, `PipePropertiesPanel` — placed next to the existing `WallPropertiesPanel` in the same file. | `WidthHeightPropertiesPanel` takes `width`/`height` (cm) + `onChangeWidth`/`onChangeHeight`. `FurniturePropertiesPanel` takes a single `scale` (as a percentage, 100 = catalog default) + `onChangeScale`. `PipePropertiesPanel` takes `diameterMm`/`elevationCm` + `onChangeDiameter`/`onChangeElevation`. |
| `components/ThreeViewer.tsx` | Add three new memos (`selectedDoorOrStairElement`/`widthHeightPropsForPanel`, `selectedFurnitureElement`/`furniturePropsForPanel`, `selectedPipeElement`/`pipePropsForPanel`) mirroring `selectedWallElement`/`wallPropsForPanel`; matching change-handler pairs mirroring the existing wall handlers; three new conditional render blocks next to the existing `WallPropertiesPanel` mount. | No changes to the existing wall memos/handlers/panel. |
| `canvas/3d/components/StairMesh.tsx` | Add `onElementClick` prop, forwarded to the mesh's click handler (same pattern `WallMesh`/`DoorMesh`/`FlatElementMesh` already use). | Also requires threading `onElementClick={handleElementClick}` through the `<StairMesh>` call site in `ThreeViewer.tsx`'s `Scene` component. |
| `canvas/3d/components/PipeMesh.tsx` | Same addition as `StairMesh` — `onElementClick` prop + call-site wiring. | |

## Data flow

Identical to walls: typing a value calls the existing `updateElement(id, { width: cm })` / `{ height: cm }` / `{ scale: pct / 100 }` / `{ pipeDiameter: mm }` / `{ elevation: cm }` store action — the same action every other tool in this app already uses to mutate elements. No new store fields, no new backend/schema changes. Each mesh component already reads these exact fields for rendering, so a value change reflects immediately.

## Error handling / edge cases

- Selecting multiple elements at once (any mix of types): no panel shows, matching the existing wall behavior (`selectedElementIds.length !== 1` guard) — the gizmo still works for multi-select move, but precise numeric editing is single-selection only, consistent with what's already built.
- A furniture piece with no `scale` field yet (older elements, field never set): treat as `scale ?? 1` (100%), matching how `FlatElementMesh` already defaults it for rendering.
- A pipe/stair with no `pipeDiameter`/`elevation`/`width`/`height` yet: use the same defaults `PipeMesh`/`StairMesh` already fall back to for rendering (`DEFAULT_PIPE_DIAMETER_MM`, `DEFAULT_PIPE_ELEVATION_CM`, 120, 240) — the panel must never show a blank/NaN field for an element that renders fine today.

## Testing

No new pure logic is introduced — this is a mechanical extension of an already-built, already-manually-verified pattern (typed input → `updateElement` → live mesh update), plus two small, well-understood click-handler wiring additions (`StairMesh`, `PipeMesh`) following an existing, proven pattern (`WallMesh`/`DoorMesh` already do exactly this). Verification is a manual browser pass: select a door, type a width, confirm the door mesh resizes; same for a furniture piece's scale; select a stair (after the click-wiring addition) and confirm the same width/height panel works; select a pipe and confirm diameter/elevation editing works; confirm the wall properties panel and gizmo are both completely unaffected by this change.
