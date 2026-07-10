# Object Property Editing (Doors, Windows, Furniture) Design Spec

## Context

The user asked for a "click an object, then edit it (height, width, thickness, moving)" workflow in the 3D tab. Investigation before scoping found this is substantially already built for walls: selecting any element (any type) already shows a generic move/rotate gizmo (`TransformGizmoController`), and selecting a wall specifically also shows a numeric property panel (`WallPropertiesPanel` in `canvas/3d/components/ThreeViewerUI.tsx`) with typed-number fields for height, thickness, and length — fully wired to `ThreeViewer.tsx`'s `wallPropsForPanel` memo and `handleWallPropHeightChange`/`handleWallPropThicknessChange`/`handleWallPropLengthChange` handlers, all correctly converting units and calling the same `updateElement` store action every other tool uses.

What's missing: that same numeric-panel treatment for anything other than walls. Selecting a door, window, or furniture piece today only gets the generic gizmo — no precise numeric entry.

## Goal

Extend the already-proven wall-properties pattern to doors, windows, and furniture: selecting one of these shows a small numeric panel (width/height for doors and windows, scale for furniture) alongside the existing gizmo.

## Scope

**In scope:** doors, windows (share the same `width`/`height` fields, already used by `FlatElementMesh` for rendering — no new data model), furniture/blocks (uses the existing `el.scale` field — a single uniform size multiplier, not independent width/height, matching how block instances are already modeled).

**Out of scope (resolved during brainstorming):**
- **MEP fixtures** (switches, sockets, valves, etc.) — no established per-object size/dimension model exists for these yet; would need separate investigation before this pattern is applicable.
- **Roof** — has its own global type/pitch controls already in the sidebar's Render tab; not a per-selection "click to edit" case.
- Move/rotate itself — already fully generic and working via `TransformGizmoController` for every element type, untouched by this spec.
- The existing `WallPropertiesPanel`/wall editing flow — untouched, used only as the reference pattern.

## Architecture

No new architecture — this mirrors the existing wall-properties mechanism exactly, twice:

```
selectedElementIds (existing Zustand store state, unchanged)
        │
        ├─→ selectedWallElement → wallPropsForPanel → WallPropertiesPanel        (existing, untouched)
        ├─→ selectedDoorWindowElement → doorWindowPropsForPanel → DoorWindowPropertiesPanel  (NEW)
        └─→ selectedFurnitureElement → furniturePropsForPanel → FurniturePropertiesPanel     (NEW)
```

Exactly one of the three panels can be visible at a time, since a single selection is either a wall, a door/window, or a furniture piece — same mutual exclusivity the existing wall memo already has via its `activeTool === "select" && selectedElementIds.length === 1` guard, which the two new memos reuse verbatim (only the element-type check differs).

## Components

| File | Change | Notes |
|---|---|---|
| `canvas/3d/components/ThreeViewerUI.tsx` | Add `DoorWindowPropertiesPanel` and `FurniturePropertiesPanel`, placed next to the existing `WallPropertiesPanel` in the same file. | `DoorWindowPropertiesPanel` takes `width`/`height` (cm) + `onChangeWidth`/`onChangeHeight` callbacks — same shape as `WallPropertiesPanel`'s props, one field fewer (no length/thickness distinction for a door/window). `FurniturePropertiesPanel` takes a single `scale` (as a percentage, e.g. 100 = catalog default) + `onChangeScale`. |
| `components/ThreeViewer.tsx` | Add two new memos (`selectedDoorWindowElement`/`doorWindowPropsForPanel`, `selectedFurnitureElement`/`furniturePropsForPanel`) mirroring `selectedWallElement`/`wallPropsForPanel` exactly; two new change-handler pairs mirroring `handleWallPropHeightChange` etc.; two new conditional render blocks next to the existing `WallPropertiesPanel` mount. | No changes to the existing wall memos/handlers/panel — purely additive siblings. |

## Data flow

Identical to walls: typing a value calls the existing `updateElement(id, { width: cm })` / `{ height: cm }` / `{ scale: pct / 100 }` store action — the same action every other tool in this app already uses to mutate elements. No new store fields, no new backend/schema changes. The 3D mesh (`FlatElementMesh`, which already reads `el.width`/`el.height`/`el.scale` for rendering) updates live the same way it already does when any other tool changes these fields.

## Error handling / edge cases

- Selecting multiple elements at once (any mix of types): no panel shows, matching the existing wall behavior (`selectedElementIds.length !== 1` guard) — the gizmo still works for multi-select move, but precise numeric editing is single-selection only, consistent with what's already built.
- A furniture piece with no `scale` field yet (older elements, field never set): treat as `scale ?? 1` (100%), matching how `FlatElementMesh` already defaults it for rendering.

## Testing

No new pure logic is introduced — this is a mechanical extension of an already-built, already-manually-verified pattern (typed input → `updateElement` → live mesh update). Verification is a manual browser pass: select a door, type a width, confirm the door mesh resizes; same for a window's height and a furniture piece's scale; confirm the wall properties panel and gizmo are both completely unaffected by this change.
