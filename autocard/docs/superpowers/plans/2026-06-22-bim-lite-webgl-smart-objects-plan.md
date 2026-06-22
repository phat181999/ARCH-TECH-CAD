# BIM-Lite Architecture: Smart Objects + Instant 3D + WebGL 2D + AI Commands
### ARCH-TECH CAD — Implementation Plan
### Date: 2026-06-22

---

## Vision

```
2D First → 3D Instantly → AI Assisted
```

Users work like AutoCAD (Draw Wall, Draw Door, Draw Window) but with:
- **[2D]** / **[3D Preview]** toggle — one click to see the building rise
- **Smart Objects** — every element is a semantic BIM node, not a dumb line
- **Real-time sync** — drag a wall in 2D, 3D updates instantly (Figma-style)
- **AI Commands** — "Add one bedroom", "Move wall 500mm left"

---

## 🔍 Codebase Scan Results (What Already Exists)

After scanning the codebase, **BIM-lite is not greenfield**. A significant portion of the core architecture, 3D engines, and schemas are **already implemented**.

### 1. Smart CAD Objects & Schema — 95% Complete
- `WallNode` (type, start, end, thickness, height, joins, openings)
- `DoorNode` (type, hostWallId, positionAlongWall, width, height, swing, direction)
- `WindowNode` (type, hostWallId, positionAlongWall, width, height, sillHeight, windowType)
- `RoomNode` (type, label, roomType, area, boundaryWallIds)
- Defined in `frontend/src/cad/contracts/nodes/architectural.ts`

### 2. Building Graph Structure — 80% Complete
- `SiteNode`, `BuildingNode`, `LevelNode`, `SlabNode`, `RoofNode` with `childNodeIds`
- Defined in `frontend/src/cad/contracts/nodes/bim.ts`
- Backend mirror in `backend/models/analysis_job.go` (BIMResult GORM structs)

### 3. 3D Generator & Viewer — 85% Complete
- `BimModelRenderer.tsx` — fully functional R3F viewer
- `bimGeometry.ts` — extrusion engine (wall boxes, opening cuts, room floors)
- Controllers: orbit, pan, walkthrough, tape measure, wall draw, push-pull, draw-on-face

### 4. AI Engine — 75% Complete
- `drawing_analyzer.go` — Claude API integration for 2D → BIM JSON
- Job worker pool with Redis queue + stuck-job reaper
- Analysis endpoints wired with auth

### 5. DXF Pipeline — 100% Complete
- Smart import wizard, layer classification, INSERT extraction, unit detection

---

## 🛠️ What's Missing (The Gap)

| Gap | Impact |
|-----|--------|
| **No interactive 2D placement tools** | Users can't draw walls/doors/windows semantically in 2D |
| **Sync is backend-dependent** | 3D generation requires API roundtrip, not instant |
| **No WebGL 2D renderer** | Large DXFs (100k+ elements) choke Canvas2D |
| **No AI edit commands** | Can't issue natural language edits to the building graph |

---

## 📅 MVP Roadmap (4 Weeks)

### 🚀 Week 1 — Interactive Smart Object Drawing Tools
*Goal: Draw, edit, and manipulate Smart CAD Objects on the 2D canvas.*

- **Wall Placement Tool**: 2D tool drawing semantic `WallNode`s with snap-to-angle
- **Opening Placement Tool**: Door/Window tools that snap to nearest `WallNode`, auto-host
- **Smart Property Panel**: Real-time editing of wall height, thickness, door width, sill height

### ⚡ Week 2 — Instant Client-Side 2D ↔ 3D Sync
*Goal: Immediate 3D updates when 2D objects are edited (Figma-style).*

- **Zustand → bimGeometry direct link**: No backend roundtrip for 3D preview
- **Real-time R3F regeneration**: Wall move → instant 3D extrusion update
- **Grip editing**: Drag wall endpoints in 2D, see 3D stretch live

### 🤖 Week 3 — AI Natural Language Commands
*Goal: Edit the drawing with conversational instructions.*

- **AI Command Console**: Input box for "Add window on south wall", "Move partition 1m left"
- **Backend `/api/ai/edit`**: Prompt + building graph → Claude → mutated graph delta
- **Immediate 2D/3D update**: Apply AI delta to both canvases simultaneously

### 🎨 Week 4 — Material Preview, Roofs & WebGL 2D
*Goal: Visual polish + performance.*

- **AI Material Preview**: "Change facade to red brick" → instant material swap
- **Roof Generator**: Flat/Gable/Hip/Shed selection → mesh generation
- **Section Cuts & Explode View**: Construction-oriented 3D tools
- **WebGL 2D Rendering**: GPU-accelerated 2D canvas for massive DXF files (60 FPS)

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
│ • WebGL Mode: Custom GL / PixiJS   │             │ • ThreeJS WebGLRenderer           │
│   (For huge DXFs / 60 FPS)         │             │   (Extrudes 3D walls & openings)  │
└────────────────────────────────────┘             └───────────────────────────────────┘
```

---

## 📐 System Flow

```
User Input (Language/2D Drag)
       │
       ├─────────────────────────────────────────┐
       ▼ (2D Drag)                               ▼ (Conversational prompt)
Local Zustand Store State                 Backend Go + Claude API
       │                                         │
       │ (Instant updates)                       │ (Analyzes Graph & Mutates)
       ▼                                         ▼
2D Canvas (Canvas2D / WebGL)             Updated Graph JSON
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

---

## Core Architecture Layers

### Layer 1: Smart CAD Objects
```json
{
  "id": "wall_001",
  "type": "wall",
  "start": [100, 100],
  "end": [5000, 100],
  "thickness": 200,
  "height": 3600
}
```

### Layer 2: Building Graph
```
Building
 ├── Floor 1
 │    ├── Walls
 │    ├── Doors
 │    └── Windows
 ├── Floor 2
 └── Roof
```

### Layer 3: 3D Generator
```
Building Graph → Geometry Engine → ThreeJS Mesh → GLB
```

Wall → Offset → Polygon → Extrude → Mesh
Door → Boolean Cut → Door Opening → Insert Asset
Window → Cut Hole → Insert Window Asset

---

## Killer Features

### #1: Real-time Sync (Figma-style)
```
Wall moved → Graph updated → Mesh regenerated → 3D refreshed
```

### #2: AI Design Assistant
```
"Add one bedroom" → Analyze Floor → Find Empty Area → Generate Walls → Update 2D + 3D
```

### #3: AI Material Preview
```
"Change facade to wood" → Facade Surfaces → Wood Material → Realtime Preview
```

### #4: One-Click Exterior
```
AI reads Elevation + Section + Window/Door Details → Generates Concept Exterior
```

---

## Dependencies on Prior Plans

| Prerequisite | Status |
|-------------|--------|
| AI 2D→3D Conversion (10 tasks) | ✅ Complete |
| 3D DXF Multisheet (7 phases) | ✅ Complete |
| DXF Smart Import Wizard (9 tasks) | ✅ Complete |
| 3D Architectural Tools — Phase 1 (Bridge) | ❌ Needs implementation |
