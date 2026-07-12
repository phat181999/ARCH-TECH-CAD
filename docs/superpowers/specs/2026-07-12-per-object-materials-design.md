# Per-Object Material Apply + Unified Material Registry Design Spec

## Context

Source: `material-apply-per-object-plan.docx` (repo root, Vietnamese, user-provided) + its interactive prototype `material-apply-demo.html`, which carries a Vietnamese-market materials catalog (families: Gạch xây, Sơn, Ốp ngoại thất, Gạch lát nền, Đá/Gỗ sàn, Ngói, Tôn, …; each entry has `id`, `family`, `name`, `color`, optional `pattern`, and a descriptive `note`). The docx targets three goals: (a) apply materials to individually selected objects instead of only globally, (b) unify three divergent hard-coded catalogs into one JSON-driven source, (c) make new object types/materials addable by editing JSON only.

**Grounding corrections (the docx was written against imagined code — these override it):**

1. **Per-object wall material already exists in miniature.** The `paint3d` tool writes `element.material` (`ThreeViewer.tsx` `handleElementClick`), a `materialById` map derives from elements, and `WallMesh` renders `materialById.get(segment.id) || facadeMaterial`. This plan extends that proven path to selection-driven apply — it is not greenfield.
2. **Persistence lives on `DrawingElement.material`** (`types.ts`, already exists, already saved with the drawing). The docx's proposed `core/entities.ts` metadata changes are unnecessary — `entities.ts` is not in the 3D viewer's render path — and are dropped.
3. **The roof is not an element.** It's auto-generated geometry (`RoofGenerator` from scene bounds), so there is nothing to click and nowhere per-object to store a roof material. Roof material stays a global picker (existing `roofMaterial` control, unchanged). Per-object roof material is deferred until roofs become elements.
4. **Selection infrastructure already exists**: `selectedElementIds` (Zustand) with single and shift-click multi-select, and this week's object-property-editing work made walls, floors, doors, stairs, and pipes click-selectable.

## Goal

Select one or more objects in the 3D tab → the sidebar's Materials tab becomes contextual: it shows the material families valid for the selected object's type (from a JSON registry) as a swatch grid with hover notes; clicking a swatch applies to the whole selection. With nothing selected, the tab shows a type rail (from the registry) for browsing and an "apply to all of type X" action. All three existing hard-coded catalogs are unified into one JSON-driven registry.

## Architecture

```
public/config/object-types.json      — object types: id, label (vi), materialFamilies[], defaultMaterial
public/config/materials.catalog.json — unified catalog: id, family, name (vi), color, pattern?, note, objectTypes[]
        │  fetched once at app init
        ▼
MaterialRegistry (new, canvas/3d/materials/materialRegistry.ts)
   getByObjectType(type) · getFamilies(type) · get(id) · listObjectTypes() · in-memory cache
   invalid entries: skipped with console.warn, never crash
        │
        ├─→ MaterialService.getMaterial(name)  — SAME signature, same "plaster" fallback,
        │     reads registry instead of MATERIAL_PRESETS (WallMesh/RoofMesh call sites untouched)
        ├─→ FloorMesh — FINISH_COLORS deleted; floor finish colors come from the registry
        ├─→ mepFixtures — MEP_FIXTURES data moves into the registry (objectType "mep_fixture");
        │     closed union MepFixtureType widens to string, validated via registry lookup
        └─→ Materials tab (ThreeViewerUI RightSidebar "Mat.") — contextual:
              selection of type T → families/swatches for T → click applies
              updateElement(id, { material }) for every selected id (existing store action)
              no selection → type rail from registry + "apply to all of type" per swatch
              roof section: unchanged global picker (see correction 3)
```

Bootstrapping: the registry seeds synchronously from a bundled default snapshot (the same JSON content imported at build time) and then refreshes from `public/config/*.json` at runtime — so meshes never render before materials exist, while runtime JSON edits still take effect on reload without a rebuild.

## Components

| File | Change |
|---|---|
| `public/config/object-types.json` | **New.** Entries for `wall`, `floor`, `mep_fixture` (+ the demo's types as data). Each: `id`, `label`, `materialFamilies[]`, `defaultMaterial`. MEP fixture entries carry their placement data (`heightCm`) as type-specific `items` — fixture kinds are catalog data, not TypeScript. |
| `public/config/materials.catalog.json` | **New.** The demo's full Vietnamese catalog, each entry tagged `objectTypes[]`. Existing `MATERIAL_PRESETS` ids (brick, plaster, wood_dark, roof_tile, …) are preserved as entries so every already-saved `element.material` value keeps resolving. |
| `canvas/3d/materials/materialRegistry.ts` (+ `.test.ts`) | **New.** Load/validate/cache; API above. Pure logic → vitest (valid lookups, invalid-entry skip + warn, unknown-id fallback behavior). |
| `canvas/3d/materials/materialService.ts` | `getMaterial()`/`getPresetList()` read from the registry; signatures and "plaster" fallback unchanged. `MATERIAL_PRESETS` literal becomes the bundled seed data (moved to JSON). |
| `canvas/3d/components/FloorMesh.tsx` | Delete local `FINISH_COLORS`; resolve finish color via registry. Same defaults preserved as catalog entries. |
| `canvas/3d/materials/mepFixtures.ts` | `MepFixtureType` widens to `string`; `MEP_FIXTURES` served from the registry. Call sites (`FixturePalettePanel`, `MepFixturePlacerController`, `MepFixtureMesh`, `ThreeViewer` state) keep working — lookups go through a registry-backed accessor with the same shape. |
| `ThreeViewerUI.tsx` (RightSidebar "Mat." tab) | The facade-material grid is replaced by the contextual panel (selection-aware families/swatches with `note` tooltips, multi-select apply, "apply to all of type X", reset-to-defaults). The roof grid stays. |
| `ThreeViewer.tsx` | Wire selection → Materials tab (pass `selectedElementIds`-derived type + apply handlers); apply = `updateElement(id, { material })` per selected id. `facadeMaterial` remains as the fallback for walls with no per-element material (unchanged render precedence: `materialById.get(id) || facadeMaterial`). |

## Behavior details

- **Apply to selection:** every id in `selectedElementIds` whose type matches the swatch's `objectTypes` gets `material` set; mismatched selected ids are skipped (prevents applying a floor tile to a selected wall in a mixed selection).
- **Apply to all of type X:** all elements of that type in the scene get `material` set — mirrors the demo's `applyToAllInCategory()`.
- **Reset:** clears `material` from all elements (per type or all), returning to global defaults (plaster walls / default floor finish) — the demo's reset behavior.
- **Tooltip:** swatch hover shows the catalog `note` (plain `title` attribute is acceptable; a styled tooltip matching the demo is preferred if cheap).
- **2D↔3D sync:** `element.material` is part of the drawing's persisted elements — save/load and the existing store flows carry it with no new mechanism (the docx's "phụ thuộc 3.1" dependency dissolves).

## Acceptance criteria (dynamic extensibility — the docx's deciding test, adapted)

Adding a new object type by editing ONLY the two JSON files must: (1) make it appear in the Materials tab's type rail after reload; (2) selecting an element of that `archType` shows its families and applies/persists material correctly — provided elements of that type already exist and are click-selectable in the scene (registering a *renderer* for a brand-new geometry kind still requires code; the docx's own example concedes this by naming a `meshComponent`, and rendering new geometry is out of scope here).

## Error handling

- Malformed catalog/type entries: skipped with a single console.warn each; app never crashes; registry falls back to bundled seed if a JSON fetch fails entirely.
- Unknown `element.material` value (e.g. catalog entry later removed): `MaterialService.getMaterial` falls back to plaster exactly as today.
- Texture cache behavior in `MaterialService` unchanged — two objects sharing a material share cached textures.

## Testing

- **Vitest (new):** `materialRegistry.test.ts` — type lookups, family lists, invalid-entry skip+warn, id fallback; a `materialService` test asserting the unchanged plaster fallback; a catalog-integrity test asserting every legacy `MATERIAL_PRESETS` id still resolves (backward compatibility with saved drawings).
- **Playwright E2E (final task):** select one wall → apply → only that wall changes (others keep global material); multi-select three walls → one click changes all three; "apply to all walls" changes every wall and no floor; floor apply via floor selection; reset returns defaults; save → reload → per-object materials persist. Screenshots as evidence.

## Non-goals

- Per-object roof material (roof isn't an element — correction 3).
- Rendering brand-new geometry kinds from JSON alone (registry covers cataloging/UI, not mesh creation).
- Moving the JSON to Supabase/admin UI (docx explicitly defers this).
- Changing `core/entities.ts` (correction 2).
- The 2D canvas's own material/hatch UI.
