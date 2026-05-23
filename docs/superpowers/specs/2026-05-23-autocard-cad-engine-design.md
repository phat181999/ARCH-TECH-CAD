# AutoCard CAD Engine Architecture Design

## Status

- Date: 2026-05-23
- Scope: `autocard` frontend CAD engine, backend document model, collaboration model, AI planning pipeline
- Source reference: `/editor` as the baseline for layered CAD engine design
- Target direction: `2D-first, BIM/3D-ready`
- Migration mode: `strangler migration`, not full product rewrite

## Executive Summary

`autocard` should not continue scaling on top of the current broad `DrawingElement` model, centralized `drawingStore`, and renderer-heavy `CadEngine` flow. That shape is workable for early iteration, but it becomes unstable as architectural features, collaboration behavior, AI generation, and versioning get more complex.

The recommended direction is to keep the existing product shell, backend shell, auth, dashboard, and collaboration entry points, while rebuilding the CAD engine internals around a shared versioned document model. The new architecture should separate:

- pure CAD domain logic
- scene/document state
- 2D rendering
- editor interactions and tools
- backend persistence/versioning/collaboration
- AI planning and patch generation

The implementation scope for the first major phase is still 2D CAD. The architecture, however, must be prepared for later BIM/3D expansion without forcing another engine rewrite.

## Why the Current AutoCard Shape Will Not Scale Cleanly

## Current strengths

- The product already has frontend pages, auth, persistence, sharing, collaboration hooks, and AI entry points.
- The frontend already includes some domain-specific pieces such as walls, rooms, openings, snapping, layers, and 3D viewer experiments.
- The backend already has drawing and collaboration-related handlers, models, and repositories.

## Current structural weaknesses

### 1. The element model is too broad

`autocard/frontend/src/types.ts` uses a wide `DrawingElement` object with many optional fields. That makes the model easy to extend quickly, but it weakens correctness:

- tools can write inconsistent fields
- validation is weak
- logic becomes full of type guards and optional field checks
- rendering and editing behavior become coupled to ad hoc conventions

For a serious CAD engine, node/entity types need explicit schemas, not an open-ended bucket.

### 2. Rendering and domain logic are too mixed

`autocard/frontend/src/canvas/CadEngine.ts` currently combines:

- canvas lifecycle
- viewport transforms
- grid drawing
- architectural plan drawing
- wall geometry presentation
- opening rendering
- selection rendering
- preview rendering
- cursor rendering

This concentration makes it difficult to change geometry rules, add new object types, or test behavior in isolation.

### 3. Store boundaries are too weak

`autocard/frontend/src/stores/drawingStore.ts` currently owns too many concerns:

- document data
- selection
- viewport
- history
- layers
- measurements
- constraints
- comments
- permissions
- sharing UI state
- architectural plan

This raises regression risk because many unrelated flows depend on the same large store.

### 4. Architectural data exists in parallel models

The current app has both:

- generic drawing elements
- architectural plan objects
- specialized wall/room/opening helpers

This creates duplication risk. Over time, the same real-world concept can end up represented multiple ways.

### 5. AI integration is at risk of bypassing domain rules

If AI writes directly to generic drawing payloads, the system becomes fragile:

- invalid geometry can be stored
- collaboration diffs become hard to audit
- undo/redo becomes inconsistent
- schema evolution becomes expensive

AI must operate through the same document and command pipeline as users.

## Reference Principles Taken from `/editor`

The `/editor` project provides the right architectural lessons, even though `autocard` should not copy it 1:1.

## Key principles to adopt

### 1. Separation of layers

`editor` separates:

- core domain logic
- viewer/rendering logic
- editor interaction logic

This is the single most important idea to carry into `autocard`.

### 2. Typed node schemas

Each domain object in `editor` has a dedicated schema. This creates:

- safe creation and update paths
- consistent IDs
- explicit contracts
- easier migrations

### 3. System-based derivation

Derived behavior should not live inside tools or renderers. Geometry generation, validation, snapping, wall joins, room detection, and derived caches should live in dedicated systems or pure domain services.

### 4. Registry-based runtime lookup

Runtime objects should be discoverable without tree traversal. For `autocard`, this idea applies not only to 3D objects, but also to 2D rendering/hit-test references.

### 5. Tool isolation

Each tool should do one interaction job and write committed changes through the document pipeline. Preview state should remain transient.

## Architectural Goals for AutoCard

## Primary goals

- Build a stable 2D CAD engine for architectural drawing
- Make the engine maintainable under rapid feature growth
- Support versioned, validated, collaboration-safe document editing
- Ensure AI-generated changes flow through the same validation pipeline
- Leave a clean path to BIM/3D without redoing the document core

## Non-goals for phase 1

- Full 3D editing parity with `/editor`
- Full IFC-native object graph
- Complex multi-user CRDT engine from day one
- Perfect BIM semantics for every architectural object

## Product constraints

- Keep the current `autocard` app shell and business flows alive
- Avoid a hard stop rewrite of the entire product
- Preserve compatibility with current drawing, sharing, and AI entry points where practical

## Recommended Migration Strategy

The right strategy is: `migrate the product, rebuild the engine inside it`.

## Why not a full rewrite

A full rewrite would discard valuable existing work:

- auth and user management
- drawing APIs and persistence shell
- dashboard pages
- collaboration entry points
- AI user flows
- existing tools and UX patterns

It would also create a long period where the product stalls while the new stack catches up.

## Why not a frontend-only refactor

A frontend-only refactor would leave backend persistence and collaboration tied to an older document model. That would create permanent impedance mismatch between:

- what the editor wants to represent
- what the backend stores
- what collaboration can safely sync

## Recommended strategy: strangler migration on a shared document model

The architecture should be rebuilt around a shared, versioned, strongly typed document model. Frontend and backend both depend on this model. Existing screens and services can continue running while the new engine progressively replaces old internals.

## Target Architecture Overview

The target platform should be split into six major layers.

## 1. Shared CAD contract

Responsibility:

- document schema
- node schemas
- patch schema
- command schema
- validation error schema
- schema versioning

Consumers:

- frontend CAD core
- backend document service
- collaboration service
- AI planning pipeline
- import/export jobs

This layer is the source of truth for what a drawing document is.

## 2. Frontend CAD core

Responsibility:

- node creation/update/delete rules
- geometry math
- snapping
- constraints
- wall joins
- room detection
- dimension calculations
- command execution
- undo/redo semantics
- derived cache generation

This layer must be pure TypeScript business logic. It should not know about React components, UI panels, or backend APIs.

## 3. Frontend rendering/view runtime

Responsibility:

- 2D canvas rendering
- render object registry
- hit-test acceleration structures
- viewport transforms
- preview overlays
- optional later WebGL or 3D runtime adapters

This layer consumes document state and derived geometry from the CAD core. It should not own business rules.

## 4. Frontend editor layer

Responsibility:

- tools
- selection workflows
- editor mode state
- command line behavior
- side panels
- keyboard shortcuts
- property editing
- UX around AI preview and approval

This layer translates user input into commands or patches against the CAD document.

## 5. Backend document platform

Responsibility:

- load/save/version document
- permission-aware access
- patch commit
- event recording
- collaboration session sync
- AI plan execution approval flow

This layer should store and serve versioned CAD documents, not generic unstructured drawing blobs.

## 6. AI planning and automation pipeline

Responsibility:

- prompt interpretation
- design intent parsing
- spatial planning
- CAD patch generation
- validation
- preview
- explainability

This layer must never bypass the document model or command validation path.

## Frontend Architecture in Detail

The frontend should be reorganized into focused modules instead of one large state and rendering flow.

## Proposed frontend module layout

```text
autocard/frontend/src/
  cad/
    contracts/
    core/
      commands/
      geometry/
      validation/
      systems/
      queries/
    store/
    render2d/
    interaction/
    tools/
    adapters/
  app/
    pages/
    panels/
    layout/
    services/
```

## Frontend layer responsibilities

### `cad/contracts`

Contains shared frontend-facing TypeScript definitions generated from or aligned with the canonical schema:

- document types
- node types
- command types
- patch types
- error types

This replaces reliance on a single wide `DrawingElement`.

### `cad/core`

Contains pure engine logic:

- geometry kernels for lines, walls, arcs, hatches, rooms, dimensions
- derived calculations such as room labels, wall polygons, opening placement
- node graph and query helpers
- validation logic
- command reducers
- history behavior

This is the heart of the engine.

### `cad/store`

Contains focused state stores rather than one large store. Suggested split:

- `useCadDocumentStore`
- `useCadSelectionStore`
- `useCadViewportStore`
- `useCadToolStore`
- `useCadPresenceStore`
- `useCadUiStore`

This reduces coupling and makes testing easier.

### `cad/render2d`

Contains the 2D renderer and runtime registries:

- canvas scene renderer
- draw order management
- layer visibility application
- render object registry
- selection overlay
- hover overlay
- snap indicator rendering

This is where current `CadEngine.ts` responsibilities should be decomposed.

### `cad/interaction`

Contains pointer and keyboard translation logic:

- screen-to-world transforms
- hit-testing
- selection boxes
- drag interaction coordinators
- transient preview state

This isolates low-level interaction mechanics from tool semantics.

### `cad/tools`

Contains isolated editor tools:

- line tool
- polyline tool
- wall tool
- door tool
- window tool
- move tool
- trim/extend tool
- text tool
- dimension tool
- hatch tool

Each tool should:

- own only its interaction state
- emit committed commands
- use transient preview state for incomplete interactions

## Frontend data flow

The target data flow should be:

1. user performs input
2. tool interprets interaction
3. tool emits command or patch intent
4. CAD core validates and applies it locally
5. document store updates canonical client document
6. derived systems recompute dirty results
7. renderer redraws from canonical state
8. collaboration layer sends committed patch upstream

This removes renderer-owned business behavior and keeps the document as the source of truth.

## Backend Architecture in Detail

The backend should evolve from generic drawing handlers toward a document platform.

## Proposed backend module layout

```text
autocard/backend/
  cad/
    schema/
    validation/
    patches/
    events/
  services/
    document_service.go
    version_service.go
    collaboration_service.go
    ai_plan_service.go
  handlers/
  repository/
  models/
  jobs/
```

## Backend layer responsibilities

### Document service

Owns:

- create document
- load current version
- save full document snapshot when needed
- apply patch set
- validate schema version
- manage upgrade path for old documents

This service should be the authoritative write gate.

### Version service

Owns:

- version numbering
- commit metadata
- actor identity
- change summaries
- restore previous version
- branch-ready extension point if needed later

This service should support auditability for both human and AI changes.

### Collaboration service

Owns:

- realtime session membership
- presence
- patch broadcast
- lightweight locking or edit claims
- reconciliation of concurrent edits

Phase 1 does not need to implement a full CRDT if the current collaboration model does not demand it. A server-ordered patch stream with validation and optimistic client updates is enough to start if commands are deterministic.

### AI plan service

Owns:

- prompt intake
- context assembly
- plan generation
- patch generation
- validation
- preview package creation
- commit after approval

This service must be explainable and observable.

## Shared Document Model

The new document model is the center of the whole migration. Both frontend and backend must speak this shape.

## Top-level document structure

```ts
type CadDocument = {
  schemaVersion: number
  documentId: string
  name: string
  createdAt: string
  updatedAt: string
  units: 'mm' | 'cm' | 'm' | 'inch' | 'ft'
  settings: DocumentSettings
  roots: string[]
  nodes: Record<string, CadNode>
  layers: Record<string, LayerDef>
  styles: Record<string, StyleDef>
  blocks: Record<string, BlockDef>
  views: Record<string, ViewDef>
  sheets: Record<string, SheetDef>
  constraints: Record<string, ConstraintDef>
  annotations: Record<string, AnnotationDef>
  derived?: DerivedDocumentState
  metadata?: Record<string, unknown>
}
```

## Why this is better than the current shape

- It creates explicit ownership boundaries.
- It allows typed nodes instead of loose drawing records.
- It supports both model space and paper space.
- It gives the backend a stable persistence contract.
- It gives AI a structured target.

## Node graph model

The document should use a flat map of nodes plus parent references, not nested mutable trees. This follows the same scaling logic used in `/editor`.

## Base node

```ts
type BaseNode = {
  id: string
  type: string
  parentId: string | null
  name?: string
  visible: boolean
  locked: boolean
  layerId: string
  styleId?: string
  metadata?: Record<string, unknown>
}
```

## Phase 1 node families

### Generic 2D drafting nodes

- `LineNode`
- `PolylineNode`
- `ArcNode`
- `CircleNode`
- `RectangleNode`
- `TextNode`
- `HatchNode`
- `DimensionNode`
- `LeaderNode`

### Architectural 2D nodes

- `WallNode`
- `DoorNode`
- `WindowNode`
- `RoomNode`
- `GridAxisNode`
- `OpeningGroupNode`

### Composition nodes

- `BlockDefinitionNode`
- `BlockInstanceNode`
- `GroupNode`

### Layout/view nodes

- `ModelSpaceNode`
- `PaperSpaceNode`
- `ViewportNode`

## BIM-ready future nodes

These do not all need implementation in phase 1, but the model should allow them cleanly:

- `SiteNode`
- `BuildingNode`
- `LevelNode`
- `SlabNode`
- `ColumnNode`
- `RoofNode`
- `ZoneNode`
- `FurnitureNode`

This is the core meaning of `2D-first, BIM-ready`.

## Commands and Patches

The engine should not mutate document state from arbitrary UI calls. Mutations should go through commands and patches.

## Command model

Commands are high-level user or AI actions:

- `CreateNodeCommand`
- `UpdateNodeCommand`
- `DeleteNodeCommand`
- `MoveNodeCommand`
- `SetLayerVisibilityCommand`
- `InsertBlockCommand`
- `ApplyAiPlanCommand`
- `CommitPatchSetCommand`

Commands are easier to reason about, audit, and replay than direct object mutation.

## Patch model

Patches are lower-level document deltas:

- create node
- update fields
- delete node
- reorder root
- update layer
- update derived cache

Recommended rule:

- tools usually emit commands
- backend persists resulting patch sets
- collaboration transmits patch sets

## Validation Pipeline

Every committed change, whether from a user or AI, should pass through the same pipeline.

## Validation stages

### 1. Schema validation

Checks:

- field presence
- type correctness
- ID format
- enum validity

### 2. Structural validation

Checks:

- valid parent references
- no illegal graph shapes
- layer/style references exist
- block instances reference valid block definitions

### 3. Domain validation

Checks:

- walls have valid geometry
- doors/windows attach to valid walls
- room boundaries are closed
- dimensions reference valid anchors
- units and measurements are consistent

### 4. Conflict validation

Checks:

- version base is current or mergeable
- edited nodes are still valid against latest server state
- optimistic client assumptions still hold

### 5. Derived consistency validation

Checks:

- recomputed room graph is still valid
- wall joins and openings remain coherent
- cached bounds and labels can be regenerated

If any stage fails, the system should return structured diagnostics and refuse commit.

## Derived Systems and Queries

Derived values should be computed by dedicated systems, not manually scattered across tools and renderers.

## Key phase 1 derived systems

- wall polygon generator
- opening placement system
- room detection system
- room label placement system
- dimension measurement system
- snap target index builder
- spatial bounds index
- layer visibility resolver
- annotation layout resolver

## Why this matters

Today, wall and room logic already exists in specialized helpers, but the architecture needs to make those helpers first-class systems tied to canonical document state.

## Frontend Store Design

The current single store should be split by responsibility.

## Recommended stores

### `useCadDocumentStore`

Owns:

- current document
- dirty node IDs
- local uncommitted change queue
- active document version

### `useCadHistoryStore`

Owns:

- command stack
- undo stack
- redo stack

### `useCadSelectionStore`

Owns:

- selected node IDs
- hovered node IDs
- active anchors/handles

### `useCadViewportStore`

Owns:

- pan
- zoom
- active view
- model/paper space viewport info

### `useCadToolStore`

Owns:

- active tool
- mode options
- transient interaction settings

### `useCadPresenceStore`

Owns:

- remote cursors
- collaborator states
- soft locks/edit claims

### `useCadUiStore`

Owns:

- panel visibility
- share modal state
- AI preview UI state
- comment panel state

This split allows the app to keep business UI state without polluting the document engine.

## Rendering Architecture

`CadEngine.ts` should be decomposed into a 2D scene renderer plus render modules.

## Proposed renderer structure

```text
render2d/
  scene-renderer.ts
  layers-renderer.ts
  grid-renderer.ts
  node-renderers/
    line-renderer.ts
    wall-renderer.ts
    room-renderer.ts
    text-renderer.ts
    dimension-renderer.ts
  overlays/
    selection-overlay.ts
    hover-overlay.ts
    preview-overlay.ts
    snap-overlay.ts
    cursor-overlay.ts
  registry/
    render-object-registry.ts
    hit-test-index.ts
```

## Rendering rules

- renderers consume canonical nodes plus derived state
- renderers never invent domain truth
- previews are transient and layered separately
- hit testing should use registry/index structures instead of ad hoc scanning where performance matters

## Tools Architecture

Every tool should be isolated, predictable, and testable.

## Tool rules

- one tool, one interaction responsibility
- preview state is transient
- commit goes through command pipeline
- tool never writes renderer-specific state as the source of truth
- geometry rules live in core services
- tool cleanup must be explicit on cancel and unmount

## Example phase 1 tool migration order

1. select/move
2. line/polyline
3. wall
4. door/window
5. text
6. dimension
7. hatch
8. copy/offset/trim/extend

This order minimizes disruption while rebuilding the domain core.

## Collaboration Model

`autocard` already wants collaborative behavior, so the document model must support it explicitly.

## Phase 1 collaboration approach

Recommended starting model:

- client loads document at version `N`
- user edits locally with optimistic commands
- commands become patch sets
- server validates against latest version
- if valid, server commits version `N+1`
- server broadcasts committed patch/event to all clients
- clients reconcile local state

This is simpler than a full CRDT and is adequate if:

- commands are deterministic
- conflicts are limited
- server is the authoritative orderer

## Collaboration entities

- session
- participant
- cursor
- viewport presence
- selected node set
- soft lock/edit claim
- committed patch event

## Conflict policy

Phase 1 should use explicit rules:

- immutable version base per patch request
- server rejects stale conflicting patch sets
- client rebases when possible
- high-risk operations require refresh/retry

Potential future upgrade:

- operational transform or CRDT for specific collaborative tools

Do not start there unless product usage proves it necessary.

## Versioning and Persistence

The backend must move away from opaque drawing payload persistence.

## Persistence requirements

- store canonical document snapshot
- store schema version
- store change events or patch history
- store commit actor and timestamp
- support document upgrade on load
- support rollback to prior version

## Storage strategy

Recommended initial strategy:

- store current canonical document JSON
- store patch/event log per version
- optionally store periodic compact snapshots

This gives good balance between simplicity and auditability.

## Schema Evolution Strategy

Schema changes are guaranteed over time. The architecture must plan for them now.

## Requirements

- every document stores `schemaVersion`
- backend upgrades older documents on read or migration
- frontend only edits supported schema ranges
- AI plan generation uses the active schema contract

## Upgrade model

Recommended approach:

- maintain `upgradeDocument(vX -> vX+1)` functions
- run upgrades on backend load path
- persist upgraded document after successful save

This prevents legacy documents from blocking engine evolution.

## AI Document Plan Architecture

This is a required part of the design, not an optional add-on.

## AI principles

- AI is not a separate editor
- AI is a planner and command producer
- AI must work on structured document context
- AI output must be validated before commit
- user must be able to preview and approve meaningful changes

## AI pipeline overview

```text
User Prompt
  -> Intent Parser
  -> Context Builder
  -> Spatial Plan Generator
  -> CAD Command/Patch Builder
  -> Validation Pipeline
  -> Preview Package
  -> User Approval
  -> Commit
  -> Version + Broadcast
```

## AI pipeline stages

### 1. Intent parser

Turns prompts such as:

- "draw a 2-bedroom house on a 8x12m footprint"
- "add one more bathroom near the master bedroom"
- "convert these lines into architectural walls"

into structured request types:

- generation
- transformation
- annotation
- optimization
- explanation

### 2. Context builder

Collects:

- current document summary
- selected nodes
- units
- existing room graph
- design defaults
- layer/style standards
- user/project constraints

The model should receive structured context, not arbitrary raw editor state.

### 3. Spatial plan generator

Produces a high-level plan such as:

- create outer footprint
- create wall loop
- split interior rooms
- place doors
- place windows
- add labels and dimensions

This plan should be inspectable and explainable.

### 4. CAD command/patch builder

Converts the spatial plan into engine-native commands or patch sets against the shared document model.

### 5. Validation pipeline

Runs the same validations used for human edits.

### 6. Preview package

Returns:

- proposed changes summary
- affected nodes
- visual preview markers
- warnings
- optional natural-language explanation

### 7. Approval and commit

Only after approval should the backend commit and broadcast the patch set.

## AI service boundaries

The AI layer should be split into:

- `prompt orchestration`
- `document summarization`
- `plan generation`
- `patch generation`
- `validation and diagnostics`

This allows future provider changes without rewriting engine semantics.

## AI failure handling

If AI output is invalid:

- do not partially commit
- return diagnostics
- explain what failed
- offer retry or repair path

Examples:

- invalid room loop
- door not attached to a wall
- dimensions inconsistent with units
- overlapping geometry beyond allowed rules

## Security and audit for AI

Every AI-generated commit should record:

- actor type: `user-ai-assisted`
- originating prompt
- plan summary
- validation status
- final approved patch set

This is important for traceability and trust.

## API Design Direction

The backend APIs should evolve from generic drawing CRUD toward document-aware operations.

## Recommended API categories

### Document APIs

- create document
- get document
- get document version
- save snapshot
- apply patch set
- list versions

### Collaboration APIs

- join session
- presence updates
- websocket patch stream
- lock/claim updates

### AI APIs

- create AI plan
- get AI preview
- approve AI plan
- reject AI plan
- retry AI plan

### Import/export APIs

- import DXF
- export DXF
- import future BIM formats
- export PDF/sheet outputs

## Testing Strategy

The new architecture must be testable at multiple layers.

## Frontend tests

- node schema tests
- command reducer tests
- geometry and room detection tests
- snapping tests
- renderer snapshot tests where useful
- tool interaction tests

## Backend tests

- document validation tests
- patch application tests
- versioning tests
- collaboration conflict tests
- AI patch validation tests

## Integration tests

- create/edit/save/reload document
- concurrent edit conflict behavior
- AI preview then approve
- migration of old documents to new schema

The highest priority tests are domain and document tests, not visual tests.

## Migration Plan

This design is intended for staged implementation.

## Phase 0: define the shared contract

- introduce canonical document schema
- define initial node families
- define patch and command formats
- define schema versioning approach

Deliverable:

- shared CAD contract package/spec used by frontend and backend

## Phase 1: build the new frontend document core

- implement document store split
- implement command pipeline
- implement base validators
- implement 2D renderer decomposition

Deliverable:

- new internal engine can render and edit basic typed nodes

## Phase 2: migrate architectural primitives

- migrate walls
- migrate openings
- migrate room detection
- migrate dimensions
- migrate layer/style application

Deliverable:

- architectural 2D editing works on canonical typed nodes

## Phase 3: backend document platform

- add canonical document persistence
- add versioned patch commit flow
- add schema upgrade path

Deliverable:

- backend stores and serves the new document model

## Phase 4: collaboration rewrite on patch stream

- integrate patch broadcast
- support optimistic local commits
- add rebase/reject flow
- add presence and edit claims

Deliverable:

- collaboration works on canonical engine documents

## Phase 5: AI plan pipeline

- build prompt-to-plan flow
- build plan-to-patch flow
- build preview/approval flow
- record audit metadata

Deliverable:

- AI operates as a validated document planner, not an uncontrolled drawing generator

## Phase 6: compatibility bridge and retirement

- load old drawing payloads into new document structure
- progressively retire old `DrawingElement`-driven flows
- remove duplicate architectural plan paths

Deliverable:

- old engine internals can be decommissioned

## Compatibility Strategy with Current AutoCard

The system should not attempt an overnight cutover.

## Bridge layer recommendations

- introduce adapters that translate legacy `DrawingElement` payloads into typed nodes
- keep current pages and shell flows where possible
- gate new engine features behind document capability flags
- allow old documents to load via upgrade/import path

## What should be preserved from current AutoCard

- page shell and routing
- auth and user flows
- drawing list/dashboard flows
- basic collaboration entry points
- AI UX entry points where possible

## What should be replaced

- broad `DrawingElement` as canonical model
- renderer-driven domain logic in `CadEngine.ts`
- oversized monolithic store as engine backbone
- duplicate architectural data pathways

## Risks and Mitigations

## Risk 1: migration complexity

Mitigation:

- move by feature slices
- keep adapters temporary but explicit
- prioritize shared document contract early

## Risk 2: schema churn

Mitigation:

- keep initial schema focused
- version aggressively
- add upgrade functions from the start

## Risk 3: collaboration regressions

Mitigation:

- begin with server-ordered patch streams
- keep deterministic commands
- test stale patch rejection and rebase flows early

## Risk 4: AI generating invalid geometry

Mitigation:

- require plan + validation + preview
- never allow direct AI document writes
- audit all AI-originated commits

## Risk 5: overbuilding for BIM too early

Mitigation:

- phase 1 stays 2D-first
- only make the schema and boundaries BIM-ready
- defer heavy 3D systems until product demand is proven

## Recommended Immediate Next Steps

1. Freeze further deepening of the current `DrawingElement`-centric architecture.
2. Define the canonical `CadDocument`, `CadNode`, `Command`, and `Patch` contracts.
3. Split the frontend store design before adding more CAD features.
4. Decompose `CadEngine.ts` into renderer modules and overlays.
5. Select the first architectural feature slice to migrate end to end.

## Recommended First Feature Slice

The best first slice is:

- typed `WallNode`
- typed `DoorNode`
- typed `RoomNode`
- command pipeline for create/update/move
- wall polygon + room detection derived systems
- 2D renderer modules for those nodes

This slice proves the hardest part of the architecture while still remaining manageable.

## Final Recommendation

`autocard` should not be rebuilt as a brand-new product, but its CAD internals should be rebuilt inside the current product through a staged migration. The new center of gravity must be a shared, versioned, typed CAD document model that powers frontend editing, backend persistence, collaboration, and AI planning uniformly.

Phase 1 should remain focused on a stable 2D architectural CAD engine. The architecture, however, must be intentionally prepared for later BIM/3D growth by using typed nodes, layered responsibilities, derived systems, and a validation-driven mutation pipeline from the start.
