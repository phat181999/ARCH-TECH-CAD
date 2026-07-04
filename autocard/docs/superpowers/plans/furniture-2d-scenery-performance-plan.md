# Plan: Furniture 2D Sync, Realistic Scenery, Performance/BIM Toggle

Based on codebase audit of `editor/packages/{core,nodes,viewer,editor,ifc-converter}`. Three issues, three tracks — can run in parallel.

---

## 1. Furniture not showing correctly in 2D plan view

**Finding**: The 3D→2D pipeline for furniture already exists — it isn't missing, it's silently failing.

- 3D render: `packages/nodes/src/item/renderer.tsx` (loads GLB, applies materials) — works.
- 2D footprint: `packages/nodes/src/item/floorplan.ts` builds a rotated rectangle from `asset.dimensions` + optional `asset.floorPlanUrl` thumbnail.
- Dispatch: `packages/editor/src/components/editor-2d/renderers/floorplan-registry-layer.tsx` calls the item's `floorplan()` builder and renders the result as SVG.

**Root causes of items disappearing/misplacing in 2D**:
1. `resolveItemTransform()` (`floorplan.ts` L42–126) returns `null` silently if the parent chain (wall/shelf/ceiling) can't be resolved — the item then renders nothing, with no warning.
2. `asset.dimensions` or `asset.floorPlanUrl` missing/empty on catalog assets → zero-size or blank footprint.
3. Wall-attached items depend on the wall already being loaded in the 2D context; race conditions during import can drop them.

**Plan**:
| Step | Action | Owner effort |
|---|---|---|
| 1 | Add dev-mode console warning when `resolveItemTransform` returns `null`, including nodeId + reason | 0.5 day |
| 2 | Fallback rendering: if `floorPlanUrl` missing, draw a generic labeled rectangle (dimensions + item name) instead of nothing | 0.5 day |
| 3 | Audit furniture catalog assets for missing `dimensions`/`floorPlanUrl` and backfill | 1 day |
| 4 | Add regression test: place one instance of every catalog item, assert non-null floorplan geometry | 1 day |

**Total: ~3 days.**

---

## 2. Scenery looks flat / "like a 2D game"

**Finding**: There is no sky, no HDRI, no fog, and the ground is an unlit flat plane.

- `packages/viewer/src/components/viewer/ground-occluder.tsx` — ground mesh uses `meshBasicMaterial` (line 86), which is **unlit**: it ignores every light in the scene and just shows a flat solid color (`#fafafa` / `#1f2433`). This is the single biggest reason the scene reads as "flat/game-like" — the largest surface in view has zero shading gradient.
- No `Sky` / `Environment` component used anywhere, despite `@react-three/drei` (which ships both) already being a dependency.
- `packages/viewer/src/components/viewer/lights.tsx` — 3 hard-coded directional lights + 1 ambient light (lines 122–150), flat colors, no sky/ground bounce fill light, and a hard shadow radius of only 2px (crisp, video-game-style shadow edges rather than a soft real-world penumbra).
- `packages/viewer/src/lib/materials.ts` — building materials (`baseMaterial`, glass, walls, roof) are already proper PBR (`MeshStandardMaterial`/`MeshStandardNodeMaterial` with roughness/metalness) — the buildings themselves aren't the problem, the empty space around them is.
- `packages/viewer/src/components/viewer/post-processing.tsx` — SSGI (ambient occlusion / global illumination) pass exists but runs with `giIntensity: 0`, i.e. effectively disabled.
- Fog is defined in the type system but never used.

### Two reference targets (from images provided)

| | Ref. 1 — "clean presentation" render | Ref. 2 — "realistic dusk" photo |
|---|---|---|
| Background | Neutral/white, no literal sky — reads as a studio/marketing render | Real sky gradient (dusk pastel), horizon visible |
| Lighting | Soft, diffuse, near-shadowless — even illumination from all sides | Directional warm key light (low sun) + long soft shadows |
| Ground | Clean paving/grass with a soft contact shadow under the building | Sand/ground with soft ambient shadow |
| Windows | Neutral, lightly tinted glass | **Emissive/glowing** — interior lights visible through glass, a huge realism cue |
| Materials | Matte stucco, natural wood accents, dark trim | Same, but color-graded warmer (dusk) |

Ref. 1 is cheap to reach (mostly a lighting/material fix, no sky needed) and directly answers "make it clean first." Ref. 2 (dynamic sky + dusk lighting + emissive windows) is the fuller realism pass, done second so the obvious visual bug doesn't wait on the bigger HDRI work.

**Plan — Phase 2A: "clean" look (do first)**
| Step | Action | File |
|---|---|---|
| 1 | Swap ground `meshBasicMaterial` → `meshStandardMaterial` (roughness ~0.9, metalness 0, soft neutral or subtle paving/grass texture) so it actually receives light and shadow | `ground-occluder.tsx` L86 |
| 2 | Set `receiveShadow` on the ground mesh | `ground-occluder.tsx` L84 |
| 3 | Add a `HemisphereLight` (sky-tint top / ground-tint bottom) for soft ambient fill, so surfaces aren't lit from one hard angle only | `lights.tsx` |
| 4 | Soften key-light shadows: raise `shadow-radius` (currently 2) and rely more on the new ambient/hemisphere fill, to remove the hard-edge "video game" shadow look | `lights.tsx` L129 |
| 5 | Turn on SSGI (`giIntensity` 0 → small positive value) for soft contact shadows under the building/furniture | `post-processing.tsx` |
| 6 | Keep background as a clean neutral flat color (already close to Ref. 1) — no sky needed for this phase | theme colors in `use-viewer` |

**Total: ~2 days.** This alone should visibly close most of the gap the user is pointing at.

**Plan — Phase 2B: full realism (dusk/dynamic sky)**
| Step | Action | Impact |
|---|---|---|
| 1 | Add `<Sky>` or `<Environment>` (drei) for a real sky + reflections on glass/metal, with adjustable sun position | High |
| 2 | Emissive window glow — drive `emissiveIntensity`/`emissiveColor` on `DEFAULT_WINDOW_MATERIAL` based on a time-of-day setting | High — the single biggest realism cue in Ref. 2 |
| 3 | Enable fog for distance falloff | Medium |
| 4 | Time-of-day control tied to directional light color/angle (warm low sun = dusk, per Ref. 2) | Nice-to-have |

**Total: ~3–4 days.** This phase costs more GPU than Phase 2A, so it should ship gated behind the performance toggle in track 3 — full realism on by default when perf allows, auto-drops to Phase 2A "clean" mode when it doesn't.

---

## 3. On/off toggle + performance fix for "BIM" / heavy 3D mode

**Clarification**: There's no separate "BIM mode" in the code — IFC import is just a data source, not a render mode. What's actually slow is the always-on 3D rendering pipeline itself. Two things needed: (a) a toggle the user can flip, (b) the underlying perf fixes so the "on" state doesn't tank the app.

**A 2D/3D/split view switch already exists** (`packages/editor/src/store/use-editor.tsx`, `viewMode: '3d' | '2d' | 'split'`) but there's no lighter-weight "fast 3D" toggle — it's all-or-nothing.

**Top performance bottlenecks found**:
1. Post-processing (SSGI + outline + denoise) — ~40–50% of GPU frame cost, runs unconditionally.
2. `SceneRenderer`/`NodeRenderer` (`packages/viewer/src/components/renderers/`) have no memoization — any single node edit re-renders/re-subscribes the entire scene tree.
3. Geometry rebuild system (`packages/viewer/src/systems/geometry/geometry-system.tsx`) rebuilds every dirty node synchronously in one frame with no batching/debounce.
4. No LOD or expanded instancing (already scoped in `docs/docs/bim_webgl_integration_plan.md` Phase W2, never implemented).

**Plan**:
| Step | Action | Priority |
|---|---|---|
| 1 | Add a "Performance mode" toggle in the toolbar (persisted setting), defaulting ON for scenes above a node-count threshold | P0 |
| 2 | Wire toggle to disable SSGI/outline/denoise post-processing passes when active | P0 |
| 3 | `React.memo` + per-node selectors on `SceneRenderer`/`NodeRenderer` so unrelated edits don't re-render the whole tree | P0 |
| 4 | Debounce/batch the geometry-rebuild system across 2–3 frames instead of one | P0 |
| 5 | Implement LOD + expand instanced rendering per existing `bim_webgl_integration_plan.md` (Phase W2) | P1 |
| 6 | Make frame-rate cap user-configurable (currently hard-coded 50fps) | P2 |

**Total: ~6–7 days for P0, +2–3 days for P1.**

---

## Suggested sequencing

1. **Week 1**: Track 3 steps 1–4 (perf toggle + core fixes) — unblocks everything else and stops active pain.
2. **Week 1–2 (parallel)**: Track 1 (furniture 2D fix) — independent, low risk.
3. **Week 2–3**: Track 2 (scenery realism), gated behind the performance toggle from track 3.
4. **Week 3+**: Track 3 step 5 (LOD/instancing) for long-term scalability.
