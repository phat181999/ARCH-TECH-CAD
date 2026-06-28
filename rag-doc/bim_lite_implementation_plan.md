# Architectural Assessment & Adjusted Roadmap: Option 2 (BIM-Lite)
### ARCH-TECH CAD

---

## 🔍 Codebase Scan Results (What Already Exists)

After scanning the codebase, **Option 2 (BIM-lite)** is not a greenfield feature. A significant portion of the core architecture, 3D engines, and schemas are **already implemented**. 

Here is the mapping of your proposed architecture to what is already live in the repository:

### 1. Smart CAD Objects & Schema
- **Status: 95% Complete**
- The system already avoids generic lines and implements semantic objects.
- In `frontend/src/cad/contracts/nodes/architectural.ts` ([architectural.ts](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/frontend/src/cad/contracts/nodes/architectural.ts)), we already have defined types for:
  - `WallNode` (type, start, end, thickness, height, joins, openings)
  - `DoorNode` (type, hostWallId, positionAlongWall, width, height, swing, direction)
  - `WindowNode` (type, hostWallId, positionAlongWall, width, height, sillHeight, windowType)
  - `RoomNode` (type, label, roomType, area, boundaryWallIds)

### 2. Building Graph Structure
- **Status: 80% Complete**
- In `frontend/src/cad/contracts/nodes/bim.ts` ([bim.ts](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/frontend/src/cad/contracts/nodes/bim.ts)), structures for structural and spatial relationships are defined:
  - `SiteNode`, `BuildingNode`, `LevelNode`, `SlabNode`, `RoofNode` (all including `childNodeIds` relationships).
- On the backend, `backend/models/analysis_job.go` ([analysis_job.go](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/backend/models/analysis_job.go)) contains the matching `BIMResult` GORM schema structs (`BIMLevel`, `BIMWall`, `BIMOpening`, `BIMRoom`, `BIMColumn`).

### 3. 3D Generator & Viewer
- **Status: 85% Complete**
- A fully functional React Three Fiber (R3F) 3D viewer already exists in `frontend/src/canvas/3d/components/BimModelRenderer.tsx` ([BimModelRenderer.tsx](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/frontend/src/canvas/3d/components/BimModelRenderer.tsx)).
- **Geometry Engine**: In `frontend/src/canvas/3d/geometry/bimGeometry.ts` ([bimGeometry.ts](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/frontend/src/canvas/3d/geometry/bimGeometry.ts)), the system:
  - Takes 2D wall lines and **extrudes them into 3D boxes** using `InstancedMesh` (for high performance).
  - Performs **subtractive boolean logic** (calculating wall pieces, lintels, and sills around openings) to cut doors/windows out of 3D walls.
  - Dynamically builds room floor meshes using `THREE.ShapeGeometry` tracing the boundaries.
- **Controllers**: Camera orbit, pan, walkthrough, and tape measurement controllers already exist in `frontend/src/canvas/3d/controllers/` ([controllers](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/frontend/src/canvas/3d/controllers/)).

### 4. AI Engine
- **Status: 75% Complete**
- The backend has a dedicated analysis microservice in `backend/services/drawing_analyzer.go` ([drawing_analyzer.go](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/backend/services/drawing_analyzer.go)) that:
  - Serializes raw 2D CAD elements and sends them to Anthropic's Claude API.
  - Prompts Claude to structure these elements, extract walls, doors, windows, and rooms, and return them as a structured `BIMResult` JSON object.

---

## 🛠️ Optimization Strategy

Since the core database models, 3D math engines, and AI schemas are already built, we can **trim the 5-week MVP roadmap to 4 weeks** and redirect focus from writing backend code/3D algorithms to **user interaction, local sync, and AI editing commands**.

The major gap in the current implementation is:
- **No interactive tools for placing smart objects**: The user cannot easily draw a wall, click to host a door, or drag a window in 2D.
- **Sync relies on backend roundtrips**: Currently, 3D generation happens asynchronously after sending the drawing to the backend. We need to add **instant, client-side sync** inside the Zustand store.

---

## 📅 Adjusted MVP Roadmap (4 Weeks)

### 🚀 Week 1 — Interactive Smart Object Drawing Tools
*Goal: Allow users to draw, edit, and manipulate Smart CAD Objects directly on the 2D canvas.*

- **Interactive Wall Tool**: Add a 2D tool that draws semantic `WallNode`s instead of raw lines. Implements snap-to-angle and snapping.
- **Host Opening Tool**: Add placing tools for `DoorNode` and `WindowNode`. Ensure they snap and orient themselves along the closest `WallNode`, auto-registering the opening in the wall's opening list.
- **Property Panel**: Create a panel to modify smart values (e.g., wall height, door width, window sillHeight, room label) in real-time.

---

### ⚡ Week 2 — Instant Client-Side 2D ↔ 3D Sync
*Goal: Immediate 3D rendering updates when 2D objects are dragged or edited (Figma style).*

- **Zustand Store Integration**: Link the `bimGeometry.ts` math builder directly to the frontend's local Zustand store state.
- **Real-time Regeneration**: Trigger the R3F `<BimModelRenderer />` box recalculation immediately when a user moves a wall or edits an opening slider, bypassing the backend.
- **Grip Editing**: Allow dragging wall endpoints in 2D and seeing the 3D extrusion stretch and adjust instantly.

---

### 🤖 Week 3 — AI Natural Language Commands
*Goal: Let users edit and design the drawing using conversational instructions.*

- **AI Prompt Console**: Add an interactive command input box inside the editor (e.g., "Add a 900mm window on the south wall", "Move the bedroom partition wall 1 meter to the left").
- **Backend Command Processor**: Expand `drawing_analyzer.go` or create an AI handler to take the prompt + current building graph, ask Claude to output the mutated JSON graph, and apply the diff back to the client.
- **Immediate 2D/3D update**: Apply the returned graph delta so the canvas and 3D preview render the changes simultaneously.

---

### 🎨 Week 4 — Material Preview, Roofs & Advanced 3D Features
*Goal: Enhance the visual quality and utility of the 3D preview.*

- **AI Material Preview**: Hook up a prompt-to-material shader tool (e.g., "Change outer facade to red brick", "Make floors dark walnut wood").
- **Roof Generator UI**: Give the user a dropdown to select roof types (Flat, Gable, Shed) and generate matching meshes over the building graph.
- **3D Tools**: Add orbit/walkthrough toggle, explode view (separating floor levels), and section cuts.
- **WebGL 2D Rendering Pipeline**: Implement a WebGL-powered 2D rendering layer (e.g. using PixiJS, ThreeJS 2D orthographic renderer, or custom GL line shaders) as an alternative rendering path for the 2D editor. This allows the canvas to render massive CAD files (100k+ lines, arcs, circles from uploaded DXFs) smoothly at 60 FPS by passing geometry vertices directly to GPU buffers instead of utilizing the CPU-bound Canvas2D context.

---

## 🛠️ WebGL Rendering Architecture

```
        ┌────────────────────────────────────────────────────────┐
        │                 Zustand Drawing Store                  │
        └───────────────────────────┬────────────────────────────┘
                                    │
           ┌────────────────────────┴────────────────────────┐
           ▼                                                 ▼
┌────────────────────────────────────┐             ┌───────────────────────────────────┐
│     2D Canvas rendering engine     │             │     3D Model rendering engine     │
├────────────────────────────────────┤             ├───────────────────────────────────┤
│ • Legacy: Canvas2D Context         │             │ • React Three Fiber (R3F)         │
│ • WebGL Mode: PixiJS / Custom GL   │             │ • ThreeJS WebGLRenderer           │
│   (For huge DXFs / 60 FPS performance) │         │   (Extrudes 3D walls & openings)  │
└────────────────────────────────────┘             └───────────────────────────────────┘
```

---

## 📐 Adjusted System Flow

```
User Input (Language/2D Drag)
       │
       ├─────────────────────────────────────────┐
       ▼ (2D Drag)                               ▼ (Conversational prompt)
Local Zustand Store State                 Backend Go + Claude API
       │                                         │
       │ (Instant updates)                       │ (Analyzes Graph & Mutates)
       ▼                                         ▼
2D Canvas (Konva)                        Updated Graph JSON
       │                                         │
       └──────────────────┬──────────────────────┘
                          │ (Both paths trigger)
                          ▼
                  BimGeometry Engine
                          │
                          ▼
                 React Three Fiber
                 (3D Instantly)
```
