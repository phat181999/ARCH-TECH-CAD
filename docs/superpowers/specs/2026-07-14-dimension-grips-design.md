# Dimension Grips — Mouse-Drag Object Editing Design Spec

## Context

User request: "the edit object i wanna we can edit without type measure height thickness length we can edit by the action mouse" — direct-manipulation editing of object dimensions in the 3D tab, as an alternative to typing into the numeric property panels (`WallPropertiesPanel`, `WidthHeightPropertiesPanel`, etc.).

Reference: a SketchUp screenshot showing small green square grips at a selected face's vertices/edge-midpoints, plus a floating "Measurements" readout with a live, type-to-override value while dragging.

**Grounding — what already exists (verified this session):**

1. **`TransformGizmoController`** (`canvas/3d/controllers/TransformGizmoController.tsx`) — drei `TransformControls` on the current selection; translate/rotate/scale-whole-object modes with G/R/S hotkeys, Ctrl-drag copy. Scale mode applies a single uniform `factor` to every selected element via `scalePatch` — it does not target one dimension field, and is not a fit for "make this wall 3.2m tall" edits.
2. **Numeric-buffer type-to-commit pattern** already exists in `WallDrawController.tsx` for wall drawing: while drawing, typing digits + Enter commits an exact length instead of the dragged value, Escape cancels. This is the exact mechanic the reference screenshot's "Measurements" box shows (SketchUp lets you type over the dragged value mid-drag) — we reuse it rather than building a new input mechanism.
3. **Property panels already write the target fields** — `wallHeightOverride`/`wallThicknessOverride`/`x1,y1,x2,y2` (walls), `width`/`height` (doors, stairs), `scale` (furniture), `elevation` (pipes) — all via `updateElement`, all already rendered live (including the BIM wall-render path, since `localBimBridge.ts` was fixed this session to honor the override fields). Grips write these same fields — no store/schema changes.
4. Per this session's clarifying question, **the numeric panels stay** alongside grips — drag for speed, type for precision.
5. `createPointerCoalescer` (just landed, `canvas/3d/interaction/pointerCoalescer.ts`) — a pure once-per-frame pointermove coalescing helper — is reused for grip drags.

## Goal

Select a single object (select tool) → small square grips appear at semantic points on the object. Dragging a grip live-updates the mapped dimension field (and the matching numeric panel), shows a floating readout with the current value, and lets the user type a number + Enter mid-drag to commit an exact value instead. Release commits one history entry; Escape cancels and restores.

## Approaches considered

- **A. Dimension grips (recommended).** Small draggable handles at semantic spots; each grip maps to exactly one dimension field. Precise, works for rotated walls, mirrors the panel fields 1:1, and lets us reuse the existing numeric-buffer pattern directly.
- B. Extend the gizmo's scale mode per-axis. Rejected: world axes ≠ wall-local axes for rotated walls, and a scale *factor* doesn't map cleanly to an absolute cm value the way a panel field does.
- C. SketchUp-style arbitrary face push-pull. Deferred: needs face classification per mesh type for a bigger build with the same practical outcome as A, given our objects are already field-parameterized (not arbitrary meshes).

## What you get

| Object | Grips | Drag → writes |
|---|---|---|
| **Wall** | 2 endpoint grips + 1 top-mid grip + 1 side-mid grip | End grip along wall axis → length (`x1,y1`/`x2,y2`; the *other* end stays fixed); top grip vertically → height (`wallHeightOverride`); side grip perpendicular to the wall → thickness (`wallThicknessOverride`) |
| **Door / Stair** | 2 edge grips (width axis, depth axis) | `width` / `height` (plan footprint, cm) |
| **Furniture** | 1 corner grip | uniform `scale` |
| **Pipe** | 1 vertical grip at midpoint | `elevation` (diameter stays panel/typed — too small a target to drag) |

Active when: select tool + exactly one element selected + its type has grips (mirrors the existing single-selection condition that shows the property panel today).

## Visual style

- Grips render as small square markers, **billboarded** (always face the camera, constant screen-space size regardless of zoom/distance) — matching the reference screenshot's fixed-size green squares, not scaled with the model.
- While dragging: a floating readout near the grip shows the live value with unit (e.g. "342 cm"), styled consistently with this app's existing floating HUD labels (e.g. `TransformGizmoController`'s selection-count `Html` badge).
- **Type-to-override mid-drag**: reuses the numeric-buffer pattern from `WallDrawController` — typing digits while dragging replaces the dragged value; Enter commits that exact number; Escape cancels the whole drag and restores the pre-drag value.
- The move/rotate/scale gizmo (`TransformGizmoController`) and grips coexist: the gizmo anchors at the selection's center, grips sit on edges/corners. A grip's `pointerdown` stops event propagation so grabbing a grip never also starts a gizmo drag.

## Architecture

```
canvas/3d/controllers/DimensionGripsController.tsx   (NEW)
  – active when: activeTool === "select" && exactly 1 element selected && its type has grips
  – renders grip meshes (small billboarded squares — reuse a Sprite/Html-anchored quad,
    consistent with existing snap-marker styling in WallDrawController)
  – pointerdown on grip: captures drag axis (derived from the element's own geometry,
    so it's correct for rotated walls), disables OrbitControls during drag (same as
    TransformControls does internally), pointermove coalesced once-per-frame via the
    existing createPointerCoalescer helper, live-writes via useDrawingStore.setState
    WITHOUT history churn (mirrors TransformGizmoController's proxy-then-commit pattern),
    single history commit on pointerup, Escape = cancel/restore
  – numeric buffer: same digit-accumulate + Enter-commit + Escape-cancel state machine
    already proven in WallDrawController, reused here (extract the buffer logic into
    a small shared hook if the duplication would otherwise exceed ~15 lines — judgment
    call for the implementer, see Global Constraints)
canvas/3d/geometry/dimensionGrips.ts                 (NEW, pure + vitest)
  – grip placement math per element type (world positions from element fields)
  – drag-delta → field-patch math (project pointer ray onto the grip's local axis;
    clamp to sane minimums: height >=10cm, thickness >=2cm, length >=10cm, scale 10-500%)
```

Mounted in `Scene` (`ThreeViewer.tsx`) next to `TransformGizmoController`.

No store/schema changes — grips write the exact same fields the panels write, so 2D/3D sync, persistence, and the BIM wall-render path all work unchanged.

## Error handling

- Dragging past a dimension's minimum clamps at the minimum (matches the panels' existing input `min` behavior) rather than allowing degenerate/negative geometry.
- Typing a non-numeric value mid-drag is ignored (same behavior as the existing wall-length buffer).
- Losing pointer capture mid-drag (e.g. window blur) cancels the drag and restores the pre-drag value — same failure mode `TransformGizmoController` already handles via its `draggingRef` reset.

## Testing

- **Vitest (`dimensionGrips.test.ts`):** grip placement per element type (including a rotated wall, to prove local-axis correctness), drag-delta → field-patch math, minimum clamps, the wall "other end stays fixed" rule.
- **Playwright E2E (final task):** drag each grip type and assert the field changed by the expected amount and the numeric panel reflects it live; type-to-override mid-drag commits the typed value, not the dragged one; Escape cancels and restores; undo restores the pre-drag state in one step; existing panel typing still works unchanged; grip drag doesn't trigger a gizmo drag and vice versa.

## Non-goals

- Multi-select grips (grips require exactly one selected element).
- Arbitrary face push-pull (approach C).
- Snapping grips to other geometry.
- A grip for pipe diameter (stays panel/typed only).
- Roof grips (roof isn't an element — same exclusion as the per-object-materials plan).
