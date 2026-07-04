# Plan: AutoCard 3D Viewer — Furniture/2D Correctness, Scenery Realism, Performance

Based on a direct code audit of `frontend/src/components/ThreeViewer.tsx` and `frontend/src/canvas/3d/`
(not a re-use of the `editor/` monorepo plan — that plan's file paths belong to a different,
unrelated project and don't exist here). Three tracks, can run mostly in parallel.

---

## 1. Furniture / block 2D-3D correctness

**Finding 1.1 — Block bounds computation ignores scale, breaking camera/grid framing**
`canvas/3d/geometry/planClassification.ts:74-78` — `getPlanBounds()` extends the bounding box using
only `el.x`/`el.y` for block elements, ignoring `el.scale`/`el.width`/`el.height`. A scaled block
(e.g. a large furniture block placed at `scale=5`) computes an incorrect bounding box, so camera
framing, grid extent, and fog distance are all wrong for scenes containing scaled blocks.
**Real user-visible bug.**

**Finding 1.2 — Block rotation pivot mismatch between 2D and 3D**
`canvas/3d/components/FlatElementMesh.tsx:42-53` vs. 2D `ElementRenderer.ts:581-583` — both rotate
around the block's insertion point, but if a block definition's visual content isn't centered on
that insertion point, 2D and 3D will apply the rotation identically in principle — this needs
verification against real block definitions before treating it as broken; audit whether any
shipped block definitions are actually off-center before fixing.

**Finding 1.3 — 3D view is read-only for furniture (no 3D→2D edit path)**
No 3D component (`FlatElementMesh`, `WallMesh`, `DoorMesh`) wires pointer interaction back to the
drawing store for repositioning/deleting. This is a real gap but is a **feature**, not a bug — out
of scope for this pass. Noted for a future initiative, not scheduled here.

**Plan:**
| Step | Action | File |
|---|---|---|
| 1 | Fix `getPlanBounds()` to account for `scale`/`width`/`height` on block elements | `planClassification.ts:74-78` |
| 2 | Audit real block definitions for insertion-point vs. visual-center mismatches; fix `FlatElementMesh` pivot only if a real mismatch is found (don't fix a non-issue) | `FlatElementMesh.tsx`, block definitions |
| 3 | Regression test: a scaled block's contribution to `getPlanBounds()` matches its actual footprint | new test near `planClassification.ts` |

---

## 2. Scenery / visual realism

**Finding 2.1 — `enablePBRShaders` toggle is dead code**
`ThreeViewer.tsx:962,1413`, `ThreeViewerUI.tsx:825` — the toggle is read from the store, threaded
through props, and rendered as a UI control, but never consumed by any material/shader code.
`TriplanarWallMaterial.ts` and `usePBRWallMaterial.ts` exist but are never imported by `WallMesh`
or `InstancedWallsMesh`. Toggling it produces no visual change. **Real user-visible bug** (dead
control) — either wire it up or remove the toggle; wiring it up is the higher-value fix given the
existing triplanar material was clearly built for this purpose.

**Finding 2.2 — Window glass has no emissive/interior-glow properties**
`canvas/3d/components/InstancedWindowsMesh.tsx:43-54` — glass material has no `emissive`/
`emissiveIntensity`; at dusk/evening `timeOfDay` settings windows should glow warmly (interior
lights). `MaterialService` already supports emissive params (`materialService.ts:115-118`) but
window glass doesn't use them. **Realism gap, high impact** — matches the same "single biggest
realism cue" finding as the analogous fix in a comparable project.

**Finding 2.3 — No fallback ambient occlusion when quality is "low"**
`ThreeViewer.tsx:1347` — EffectComposer (and therefore SSAO) isn't mounted at all below `"low"`
quality, so low-quality scenes have zero ambient occlusion; `ContactShadows` partially compensates
but the general scene reads flatter than necessary. **Minor realism gap.**

**Finding 2.4 — Bloom threshold too high for architectural materials**
`ThreeViewer.tsx:1364-1369` — `luminanceThreshold={0.85}` means most real-world architectural
materials (concrete, brick, steel — 30-50% brightness) never bloom even in direct sun. **Minor
realism gap** — lower the threshold or make it material/light-intensity aware.

**Plan:**
| Step | Action | File | Priority |
|---|---|---|---|
| 1 | Wire `enablePBRShaders` to actually apply `TriplanarWallMaterial`/`usePBRWallMaterial` on walls when enabled | `WallMesh.tsx`, `InstancedWallsMesh.tsx` | P0 |
| 2 | Add emissive glass material driven by `timeOfDay` (warm glow at dusk/night, off at midday) | `InstancedWindowsMesh.tsx`, `materialService.ts` | P0 — highest visual impact |
| 3 | Add a lightweight fallback AO (e.g. always mount a cheap SSAO pass, or strengthen `ContactShadows`) for `"low"` quality instead of zero AO | `ThreeViewer.tsx:1347` | P1 |
| 4 | Lower/soften bloom `luminanceThreshold`, or scale it to actual scene light intensity, so sunlit architectural materials get a visible glow | `ThreeViewer.tsx:1364-1369` | P2 |

---

## 3. Performance

**Finding 3.1 — ThreeViewer re-renders on unrelated store state (pan/zoom/layer overrides)**
`ThreeViewer.tsx:948-970` — 17 separate Zustand selectors mean any change to `panOffset`, `zoom`,
`dxfLayerOverride`, etc. re-renders `ThreeViewer` and re-runs `PlanModel`/`Scene` `useMemo`s (most
expensive: `sceneElements`, line 1159-1173) even though the rendered 3D scene doesn't need to
change for a 2D pan/zoom. **Performance smell** — split into narrower memoized subcomponents or
move 2D-only state out of the props ThreeViewer depends on.

**Finding 3.2 — Per-wall hover raycasting has no throttle and loses interactivity at scale**
`canvas/3d/components/WallMesh.tsx:59` — individual `WallMesh` instances get `onPointerOver` hover
raycasting; `InstancedWallsMesh` (used for 1000+ walls) has none — hover feedback silently
disappears exactly when scenes get large enough to need instancing. **Performance/UX smell** —
either accept the interactivity trade-off explicitly (document it) or add a lightweight
instance-aware raycast (e.g. `instanceId` from R3F's instanced intersection) so large DXF imports
keep hover feedback.

**Finding 3.3 — PerformanceMonitor downgrade threshold too lenient**
`ThreeViewer.tsx:1300-1304` — `threshold={0.9}`, `flipflops={3}` means quality only downgrades after
sustained stutter (drop to ~54fps from 60, 3 flip-flops) rather than reacting quickly to a real
frame-rate crisis (e.g. 20fps). **Minor perf issue** — tune thresholds for faster reaction, or make
configurable (ties into Finding 3.4's quality-respecting particle systems).

**Finding 3.4 — Rain/snow particles and neighborhood buildings ignore the quality tier**
`canvas/3d/components/RainSystem.tsx:72-121`, `ThreeViewer.tsx:759` — 3000/1500 particles animate
every frame regardless of `quality`, and procedural neighbor buildings always render — exactly the
GPU cost that should be cut first when FPS is already low, undermining `PerformanceMonitor`'s
auto-downgrade. **Real performance issue** — gate particle count and neighbor building count/count
on `quality`.

**Finding 3.5 — Material cache clears synchronously in bulk on texture toggle**
`canvas/3d/materials/materialService.ts:100-137` — toggling "use textures" clears the entire
material cache and every element (potentially 500+ walls) re-fetches/reallocates materials
synchronously in one frame, causing a visible stutter. **Minor perf issue** — batch/stagger the
reallocation across a few frames, or accept as a rare one-off toggle cost (lowest priority fix
here).

**Plan:**
| Step | Action | File | Priority |
|---|---|---|---|
| 1 | Gate `RainSystem` particle count and `NeighborBuildings` count on `quality` | `RainSystem.tsx`, `ThreeViewer.tsx:759` | P0 |
| 2 | Narrow `ThreeViewer`'s store subscriptions / split 2D-only state so 2D pan/zoom doesn't re-render the 3D scene tree | `ThreeViewer.tsx:948-970` | P0 |
| 3 | Tune `PerformanceMonitor` thresholds for faster downgrade reaction | `ThreeViewer.tsx:1300-1304` | P1 |
| 4 | Add instance-aware hover raycasting for `InstancedWallsMesh` (or explicitly document the interactivity trade-off if not worth the complexity) | `WallMesh.tsx`, `InstancedWallsMesh.tsx` | P1 |
| 5 | Stagger/batch material reallocation on texture toggle across frames | `materialService.ts:100-137` | P2 |

---

## Suggested sequencing

1. **First**: Track 3 steps 1-2 (rain/neighbor quality gating, re-render scoping) — stops active perf
   pain with the least risk.
2. **Parallel**: Track 2 steps 1-2 (PBR wiring, emissive windows) — the two highest-visual-impact,
   independent fixes.
3. **Parallel**: Track 1 step 1 (block bounds fix) — small, independent, real bug.
4. **After**: Track 1 step 2 (pivot audit — may turn out to be a non-issue), Track 2 steps 3-4,
   Track 3 steps 3-5 (P1/P2 polish).
5. **Not scheduled**: Track 1 finding 1.3 (3D→2D furniture editing) — a real feature gap, not a bug;
   flagged for a future initiative.
