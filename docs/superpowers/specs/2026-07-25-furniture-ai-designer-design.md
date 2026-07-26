# Furniture AI Designer — Design / Import Photo / Extract from Room Design Spec

## Context

User request: let a user grow the furniture catalog three ways — hand-design a block, import a photo of a single furniture item and have AI turn it into a catalog block, or extract multiple furniture items from a room photo to auto-furnish a plan. AI use is explicitly welcomed. A default/pre-made catalog stays as the baseline and doubles as the fallback whenever AI extraction is low-confidence.

Prototype: `furniture-ai-designer-demo.html`, repo root.

**Grounding — what already exists (verified this session):**

1. A full Block Store already exists: `my-blocks` (user-private) and `organizations/{id}/blocks` (org-shared), full CRUD, publish/unpublish, thumbnail upload (`blockStoreService.ts`, `handlers/block_handler.go`). `CreateBlockPayload { name, description, category, tags, block_def: BlockDef, preview_svg }` is the shape every new block already gets saved through.
2. `blockImporter.ts` already parses file-based imports (JSON drawing export, SVG, DXF) into a `BlockDef`; `BlockStorePage.tsx`'s upload form already consumes this and lets the user fill name/category/tags/description before saving. There is no visual "design from scratch" canvas and no raster-photo path today.
3. Blocks are 2D vector footprints — `blockLibrary.ts`'s ~11 categories are hand-built from `rectangle`/`circle` `DrawingElement`s. In the 3D viewer they render as simple extruded boxes/discs (`BlockElementMesh.tsx`) with a small per-category height table (door=20, window=10, car=18, default=3) — not photorealistic meshes. Anything AI-generated should target this same schematic representation.
4. Existing AI plumbing (`aiDrawingService.ts` → `POST /api/ai/generate` → `ai_handler.go`) is text-prompt-only today, with multi-provider fallback (OpenAI → DeepSeek → Gemini, whichever key is configured in `config.Config`) and a JSON-extraction-from-model-output pattern already proven for structured results. No image input yet, but the configured models (Gemini, GPT-4o-class) support multimodal input through the same key — adding an image part is additive, not a new integration.

## Goal

Three intake paths, one save pipeline: Design (draw + save), Import a photo of one item (AI identifies it → draft block), Extract from a room photo (AI detects multiple items → auto-furnish). All three end at the existing Block Store create-block form for review before saving. A confidence gate on both AI paths falls back to the nearest default catalog item rather than fabricating a bad block.

## Approaches considered

- **A. Three intake paths feeding one save pipeline (recommended).** Scoped below. Reuses the existing Block Store, existing drawing tools, and existing multi-provider AI plumbing; only the vision call and the response→BlockDef mapping are new.
- B. Full parametric 3D modeler + true image-to-3D mesh generation. Rejected for this pass: there is no GLTF/mesh rendering pipeline for blocks today — everything is extruded 2D footprints. Standing that up is a separate, much larger initiative, disproportionate to what was asked.
- C. Room-photo extraction only, skip manual design and single-item photo. Rejected: the user wants all three, and the single-item pipeline (identify → BlockDef → confidence gate) is a prerequisite that room extraction reuses per detected item anyway.

## Architecture

### A. Design → Save
No new drawing tool — reuse the existing rectangle/circle/line canvas tools (the same primitives `blockLibrary.ts` entries are hand-built from). New: a "Save selection as Block" action that takes the current selection, centers it (reusing `blockImporter.ts`'s `centroid()` logic), and opens the existing create-block form pre-filled with those elements instead of a file import.

### B. Single-item photo → Block
- Frontend: an image upload input (on `BlockStorePage` or a new modal) posts to a new endpoint.
- Backend: `POST /api/ai/furniture/identify` — extends `ai_handler.go`'s multi-provider pattern. Sends the image plus a structured prompt to whichever vision-capable provider is configured, asking for strict JSON: `{category, name, width_cm, depth_cm, height_cm, dominant_color, confidence}` (same JSON-extraction approach already used for text generation).
- Frontend maps the response to a `BlockDef`: one rectangle sized to `width_cm × depth_cm`, `fillColor` = dominant color, category → `BlockCategory`. `height_cm` is stored for the 3D box-height table rather than affecting the flat footprint (blocks don't have a footprint role for height today).
- **Confidence gate**: below a threshold (e.g. 0.5), don't fabricate a block — present the nearest category match from `blockLibrary.ts` as the starting point instead, with a visible "AI wasn't sure — starting from [X]" affordance. The user edits from there.
- Result pre-fills the same create-block form as path A.

### C. Room photo → auto-furnish
- Backend: `POST /api/ai/furniture/detect-room` — same vision call, prompted for a list: `[{category, confidence, bbox_relative: [x, y, w, h]}]` (relative 0–1 bounding boxes; a single photo has no depth/scale reference).
- Frontend runs each detected item through B's per-item pipeline (generate or fall back to nearest catalog match) and places it on the current 2D plan by mapping the photo's relative bbox center onto the plan's known bounds.
- Placement is approximate by construction — presented in the UI as an editable starting layout, not exact placement. This is called out explicitly to the user, not just noted here.
- Placed items go through the normal insert/history path (`editedIn3D` unset like any other insert) — undo works unchanged.

## Error handling

- No vision-capable API key configured → same graceful-fallback message pattern `ai_handler.go` already uses on its text path (try providers in order; a clear "AI not configured" error if none are set, never a silent failure).
- Image too large / wrong format → validate client-side before upload (match whatever limits `uploadBlockThumbnail` already enforces; confirm exact limits at implementation time).
- Low-confidence single item, or any low-confidence item within a room-photo batch → catalog fallback (above), never a blank or nonsensical block.
- Room photo with zero detected items → a clear empty state, not a silent no-op.

## Testing

- Vitest: AI-response → `BlockDef` mapping including the confidence-gate fallback; relative-bbox → plan-coordinate placement math.
- Go tests: the two new endpoints' JSON-extraction/parsing (mirroring `ai_handler_test.go`'s existing patterns) and provider-fallback order.
- Playwright E2E: upload a fixture image on the single-item path and assert the pre-filled form matches; run the room-photo path and assert at least one item lands on the plan.

## Suggested sequencing

Design→Save first (no AI dependency, de-risks the save-pipeline reuse), then single-item photo, then room-photo extraction (reuses the single-item pipeline per detected item). Not a scope cut — all three are in this spec — just a sane build order.

## Non-goals

- Photorealistic 3D furniture meshes / true image-to-3D generation (approach B above).
- Sub-pixel-accurate placement from room photos — explicitly approximate, user-adjustable.
- A new parametric modeler for "Design" — reuses the existing 2D drawing tools only.
