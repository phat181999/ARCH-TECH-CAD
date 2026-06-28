# Plan: Bidirectional 2D ↔ 3D Interaction + Foundation Drawing + Scene & Weather System

## Goal

Every element drawn in 2D appears immediately in 3D, and every element created or modified in 3D is reflected back in 2D — for all element types: walls, doors, windows, floor surfaces, pipes/MEP, stairs, rooms, **and foundations**. The 3D viewer also gains a full **scene/environment system**: choose neighboring buildings as context, and simulate seasons (spring/summer/autumn/winter) and weather (sunny, overcast, rainy, stormy).

---

## Core Insight — The Store is Already Shared

The Zustand store (`drawingStore`) is the single source of truth. Both the 2D canvas (`CanvasEditor.tsx`) and the 3D viewer (`ThreeViewer.tsx`) subscribe to the same `elements: DrawingElement[]` array. This means **sync is architecturally solved** — no message passing, no event bus needed.

What is missing:

1. **Coverage gaps** — not every element type has a 3D mesh or a 2D drawing tool
2. **Write-back gaps** — some 3D actions (PushPull, wall moves) don't persist back to the store
3. **Visibility gaps** — 2D canvas doesn't visualize 3D-specific properties (height, material)
4. **Tool gaps** — no 3D tool for placing doors/windows that writes a `DrawingElement` back

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Zustand Store                            │
│              elements: DrawingElement[]                         │
│         addElement / updateElement / addElements                │
│                    history (undo/redo)                          │
└────────────────┬────────────────────────┬───────────────────────┘
                 │ read/write             │ read/write
                 ▼                        ▼
   ┌─────────────────────┐    ┌─────────────────────┐
   │     2D Canvas        │    │     3D Viewer        │
   │  CanvasEditor.tsx    │    │  ThreeViewer.tsx     │
   │                      │    │                      │
   │  Wall (line+arch)  ✓ │    │  WallMesh           ✓│
   │  Door (opening)    ✓ │    │  DoorMesh           ✓│
   │  Window            ✓ │    │  WindowMesh         ✓│
   │  Floor Surface   NEW │    │  FloorMesh        NEW│
   │  Pipe / MEP      NEW │    │  PipeMesh         NEW│
   │  Stair           NEW │    │  StairMesh        NEW│
   │  Room Label      NEW │    │  3D Door Placer   NEW│
   │  Height Overlay  NEW │    │  Wall Move in 3D  NEW│
   │  3D Edit Badge   NEW │    │  PushPull → Store FIX│
   └─────────────────────┘    └─────────────────────┘
```

### Coordinate Systems

| Space | Unit | Origin | Notes |
|-------|------|--------|-------|
| 2D canvas | pixels (unitless) | top-left | panOffset + zoom transform applied by canvas ctx |
| 3D scene | Three.js units (100 = 1 m) | plan centroid (cx, cz) | Y = elevation |

**Conversion** (currently in `wallDraw.ts`, to be moved to `coordBridge.ts`):

```
2D (x, y)  →  3D: { x: pt.x - cx,  y: 0,  z: pt.y - cz }
3D (x, z)  →  2D: { x: world.x + cx, y: world.z + cz }
```

---

## Phases

> **Status legend:** ✅ Done · 🔲 Pending

### Phase 1 — Fix Existing Sync Gaps (Week 1) ✅ DONE

#### 1A. Centralize the Coordinate Bridge

Create `canvas/3d/geometry/coordBridge.ts` — the single file every 3D tool imports for coordinate conversion. Move `worldToDrawingXY` from `wallDraw.ts` here and add the inverse.

```ts
// canvas/3d/geometry/coordBridge.ts

/** 2D pixel coords → 3D world position (y=0, ground plane) */
export function drawingToWorld(pt: {x: number; y: number}, cx: number, cz: number) {
  return { x: pt.x - cx, y: 0, z: pt.y - cz };
}

/** 3D world position → 2D pixel coords */
export function worldToDrawingXY(world: {x: number; z: number}, cx: number, cz: number) {
  return { x: world.x + cx, y: world.z + cz };
}

/** Array of 3D ground-plane hits → 2D polygon points */
export function worldPointsToPolygon(pts: {x: number; z: number}[], cx: number, cz: number) {
  return pts.map(p => worldToDrawingXY(p, cx, cz));
}
```

**Files changed:** `coordBridge.ts` (new), `wallDraw.ts` (re-export from coordBridge), all 3D controllers updated to import from coordBridge.

#### 1B. PushPull → Store Write-back

Currently `PushPullDragController` creates a local `ShapeWithDepth` object that lives only in memory. When the user switches back to 2D the extrusion is lost.

**Fix:** On commit (mouse-up after drag), call:
```ts
updateElement(sourceElementId, {
  pushPullDepth: finalDepth,
  editedIn3D: true,
});
```

The `pushPullDepth` property is then read back in `ThreeViewer` to reconstruct the extrusion on next load. The 2D canvas renders a hatch fill with a depth annotation badge.

**Files changed:** `PushPullDragController.tsx`, `drawingStore` types, `WallMesh.tsx` (read pushPullDepth).

#### 1C. Verify Wall Height Override Round-trip

`wallHeightOverride` was implemented last session via `updateElement`. Confirm the full round-trip:

1. Draw wall in 2D → appears in 3D ✓
2. Select wall-height tool in 3D → click wall → set 320 cm → `updateElement(id, { wallHeightOverride: 320 })`
3. Switch back to 2D → wall element has `wallHeightOverride: 320` in store
4. Switch back to 3D → wall renders at 320 cm ✓

---

### Phase 2 — New Element Types (Week 2–3) ✅ DONE

Each element type follows the same pattern:
> **One `DrawingElement` shape in the store → 2D renderer draws it → 3D renderer meshes it**

#### 2A. Floor Surface

**Store shape:**
```ts
{
  type: "polygon",
  archType: "floor",
  points: { x: number; y: number }[],  // closed polygon in 2D px coords
  floorFinish?: "concrete" | "tile" | "wood" | "screed",
  elevation?: number,   // cm above ground, default 0
  layerId: "A-FLOOR",
}
```

**2D rendering** (`ArchitecturalRenderer`): closed polygon with semi-transparent fill. Hatch pattern encodes finish:
- `wood` → diagonal lines at 45°
- `tile` → grid pattern
- `concrete` → stipple dots
- `screed` → horizontal lines

**3D mesh** (`FloorMesh.tsx`): `THREE.ShapeGeometry` built from the polygon points, positioned at `elevation * scale`. Material from `MaterialService` keyed on `floorFinish`.

**2D drawing tool** (CanvasEditor): polygon draw tool (click-click-...-double-click to close). Uses existing polygon tool infrastructure, just sets `archType: "floor"`.

**3D drawing tool** (ThreeViewer): "Floor" button in ThreeToolbar. Raycasts against ground plane (same as WallDrawController). Chain-click to define polygon vertices, double-click or click start point to close. On close, calls `addElement` with the polygon converted via `worldPointsToPolygon`.

#### 2B. Pipe / MEP

**Store shape:**
```ts
{
  type: "line",
  archType: "pipe",
  x1: number; y1: number; x2: number; y2: number,
  pipeDiameter: number,     // mm, e.g. 25, 50, 100, 150
  pipeSystem: "water" | "hvac" | "drain" | "electric" | "gas",
  elevation: number,        // cm above floor
  layerId: "M-PIPE",
}
```

**2D rendering**: dashed line, color-coded by system:
- `water` → blue
- `hvac` → cyan
- `drain` → orange
- `electric` → yellow
- `gas` → red

Diameter shown as small text label when zoom > 1.5.

**3D mesh** (`PipeMesh.tsx`): `CylinderGeometry` oriented along the wall centerline (using quaternion from start→end direction), elevated by `elevation * scale`, radius = `pipeDiameter / 2 * scale`. Color-coded caps on each end.

**3D drawing tool**: "Pipe" button → click two ground points → mini-panel appears asking for diameter and system type → commits `addElement`. Elevation is set via a slider in the panel (default: 250 cm = above ceiling, 10 cm = floor-level).

#### 2C. Stair

**Store shape:**
```ts
{
  type: "rectangle",
  archType: "stair",
  x: number; y: number; width: number; height: number,
  stairRise: number,           // cm per step, default 18
  stairRun: number,            // cm per step, default 27
  totalRise: number,           // cm total floor-to-floor
  flightDirection: "up" | "down",
  rotation?: number,           // degrees, 0 = north
  layerId: "A-STAIR",
}
```

**2D rendering**: hatched rectangle with direction arrow and "UP"/"DN" label.

**3D mesh** (`StairMesh.tsx`): Generates `Math.round(totalRise / stairRise)` steps. Each step is a `BoxGeometry(width, rise, run)` stacked and offset. No custom shader — pure geometry composition.

#### 2D. Room (connect detection → store)

`detectRooms()` already exists. Currently it creates label elements only. **Change**: detected rooms are stored as persistent `DrawingElement` objects:

```ts
{
  type: "polygon",
  archType: "room",
  points: DetectedRoom["polygon"],
  text: "Room",         // editable name
  roomArea: number,     // m², computed
  roomLabel: true,
  layerId: "A-ROOM",
}
```

2D renders as semi-transparent fill + centroid label. 3D renders as `Html` billboard (already implemented). Both read the same element.

---

### Phase 3 — 2D Visualization of 3D Properties (Week 3) 🔲 PENDING

#### 3A. Wall Height Annotation

In `ArchitecturalRenderer` (or a new `PropertyOverlayRenderer`): for any wall element with `wallHeightOverride`, draw a badge at the wall midpoint:

```
─────[H: 320 cm]─────
```

Toggle via a layer visibility checkbox labelled "Show 3D Properties".

#### 3B. PushPull Depth Badge

Elements with `pushPullDepth` get a `⬡ +45cm` label in 2D, indicating they were extruded in 3D. Clicking the badge selects the element and shows the push-pull depth in the properties panel.

#### 3C. "Edited in 3D" Indicator

Any element with `editedIn3D: true` shows a small `3D` superscript badge in the 2D canvas. This lets the user see at a glance which elements carry 3D-specific properties (height override, extrusion depth, material, etc.).

#### 3D. 3D Properties Panel (docked in 2D editor)

A thin panel docked at the bottom of the 2D canvas — not floating — shows the selected element's 3D properties:

| Property | Wall | Door | Floor | Pipe |
|----------|------|------|-------|------|
| Height override | ✓ | — | — | — |
| Floor finish | — | — | ✓ | — |
| Elevation | ✓ | ✓ | ✓ | ✓ |
| Push-pull depth | ✓ | — | — | — |
| Pipe system / diameter | — | — | — | ✓ |
| Material | ✓ | ✓ | ✓ | ✓ |

Editing any value calls `updateElement` → both 2D and 3D update live.

---

### Phase 4 — 3D Editing Writes Back to 2D (Week 4) 🔲 PENDING

#### 4A. Wall Move in 3D

New tool: **"Move Wall"** in ThreeToolbar. Click a wall to select it, drag along its perpendicular axis. On mouse-up:

```ts
updateElement(wallId, {
  x1: newX1, y1: newY1,
  x2: newX2, y2: newY2,
  editedIn3D: true,
});
```

2D canvas reflects the new wall position instantly.

**Constraint**: movement is constrained to the wall's perpendicular direction (sliding, not rotating). Rotation in 3D is Phase 5+ territory.

#### 4B. Door / Window Placement in 3D

New tool: **"Place Door"** and **"Place Window"** buttons in ThreeToolbar. Flow:

1. Activate tool → cursor shows door ghost following mouse along wall surfaces
2. Click on a wall face → door snaps to nearest stud position
3. Confirm panel appears: width, height, sill height
4. On confirm, calls:
```ts
addElement({
  type: "opening",
  archType: "door",
  hostWallId: wallId,
  x: centroid2D.x,
  y: centroid2D.y,
  width: doorWidth,
  height: doorHeight,
  layerId: "A-DOOR",
});
```
5. 2D canvas draws the door swing symbol on the correct wall.

#### 4C. Floor Zone Draw in 3D

New tool: **"Draw Floor"** in ThreeToolbar. User clicks ground plane vertices (same pattern as WallDrawController), double-clicks to close. On close:

```ts
addElement({
  type: "polygon",
  archType: "floor",
  points: worldPointsToPolygon(clickedPoints, cx, cz),
  floorFinish: "concrete",
  elevation: 0,
  layerId: "A-FLOOR",
});
```

Immediately visible in 2D as a hatch zone.

---

## File Change Map

| File | Change | Phase |
|------|--------|-------|
| `canvas/3d/geometry/coordBridge.ts` | **NEW** — shared coordinate conversion | 1 |
| `canvas/3d/geometry/wallDraw.ts` | Re-export from coordBridge | 1 |
| `canvas/3d/controllers/PushPullDragController.tsx` | Write pushPullDepth to store on commit | 1 |
| `types.ts` | Add `pushPullDepth`, `editedIn3D`, `floorFinish`, `pipeDiameter`, `pipeSystem`, `elevation`, `stairRise`, `stairRun`, `totalRise` to DrawingElement | 2 |
| `canvas/3d/components/FloorMesh.tsx` | **NEW** — polygon floor geometry | 2 |
| `canvas/3d/components/PipeMesh.tsx` | **NEW** — cylinder pipe geometry | 2 |
| `canvas/3d/components/StairMesh.tsx` | **NEW** — stepped box geometry | 2 |
| `canvas/3d/components/index.ts` | Export new meshes | 2 |
| `components/ThreeViewer.tsx` | Render FloorMesh, PipeMesh, StairMesh; add floor/pipe/door/move tools | 2, 4 |
| `canvas/3d/components/ThreeViewerUI.tsx` | Add floor, pipe, stair, place-door, move-wall buttons to toolbar | 2, 4 |
| `canvas/3d/controllers/FloorDrawController.tsx` | **NEW** — polygon ground-plane drawing | 4 |
| `canvas/3d/controllers/DoorPlacerController.tsx` | **NEW** — click-wall door placement | 4 |
| `canvas/3d/controllers/WallMoveController.tsx` | **NEW** — perpendicular wall drag | 4 |
| `canvas/CadEngine.ts` / `ArchitecturalRenderer.ts` | Render floor hatch, pipe lines, stair pattern, height badge, editedIn3D badge | 3 |
| `pages/CanvasEditor.tsx` | 3D Properties Panel docked at bottom | 3 |
| `canvas/tools/floorTool.ts` | **NEW** — 2D polygon floor drawing tool | 2 |
| `canvas/tools/pipeTool.ts` | **NEW** — 2D pipe line drawing tool | 2 |

---

## Implementation Order

| Week | Deliverable | Key risk |
|------|------------|---------|
| **1** | `coordBridge.ts` · PushPull store write-back · height overlay in 2D | Low — store already wired |
| **2** | `FloorMesh` + 2D floor tool · `PipeMesh` + 2D pipe tool | Medium — new geometry |
| **3** | `StairMesh` · room elements persisted · 3D properties panel in 2D | Medium — hostWallId snap for doors |
| **4** | Wall move in 3D · 3D door placer · floor draw in 3D | High — drag UX + 3D hit-testing |

---

## Testing Checklist

For each element type, verify the full round-trip:

- [ ] Draw in 2D → switch to 3D → appears correctly in 3D
- [ ] Draw in 3D → switch to 2D → appears correctly in 2D
- [ ] Edit property in 2D panel → 3D updates live
- [ ] Edit geometry in 3D → 2D canvas reflects immediately
- [ ] Undo after 3D edit → reverts in both views
- [ ] Save → reload → element persists with all 3D properties

---

---

## Phase 5 — Foundation Drawing (Nền Móng) in 2D and 3D ✅ DONE

### Why this needs its own phase

Foundations are **below-ground** geometry. The current 3D scene only renders down to `y = -FLOOR_THICKNESS/2 = -0.75 units`. Everything underground is invisible. Foundations also carry structural meaning (pile, spread footing, strip footing, raft slab) that must be preserved as data, not just geometry.

### 5A. New Element Types

Add the following `archType` values to `DrawingElement` in `types.ts`:

```ts
archType:
  | "foundation-strip"   // băng (strip footing along walls)
  | "foundation-spread"  // đơn (isolated pad footing under column)
  | "foundation-raft"    // bè (raft/mat slab covering whole footprint)
  | "foundation-pile"    // cọc (pile cap + pile shaft)
  | "column"             // cột kết cấu (structural column)
  | "grade-beam"         // dầm móng (ground beam linking footings)
```

**Strip footing** (`foundation-strip`) element shape:
```ts
{
  type: "line",
  archType: "foundation-strip",
  x1, y1, x2, y2,
  footingWidth: number,     // cm, e.g. 60
  footingDepth: number,     // cm below ground, e.g. 100
  footingThickness: number, // cm height of footing, e.g. 30
  material: "concrete-m200" | "concrete-m250" | "concrete-m300",
  layerId: "S-FOUND",
}
```

**Spread footing** (`foundation-spread`) element shape:
```ts
{
  type: "rectangle",
  archType: "foundation-spread",
  x, y, width, height,     // plan footprint in 2D px
  footingDepth: number,     // cm below ground
  footingThickness: number, // cm
  columnWidth: number,      // cm (column above)
  columnHeight: number,     // cm (column height above slab)
  material: string,
  layerId: "S-FOUND",
}
```

**Raft slab** (`foundation-raft`) element shape:
```ts
{
  type: "polygon",
  archType: "foundation-raft",
  points: {x, y}[],        // boundary polygon in 2D px
  raftDepth: number,        // cm below ground
  raftThickness: number,    // cm
  ribDepth?: number,        // cm, optional stiffening ribs
  material: string,
  layerId: "S-FOUND",
}
```

**Pile** (`foundation-pile`) element shape:
```ts
{
  type: "circle",
  archType: "foundation-pile",
  x, y,                     // pile center in 2D px
  radius: number,            // cm radius
  pileLength: number,        // cm below ground
  pileType: "bored" | "driven" | "micro",
  capWidth: number,          // cm, pile cap plan size
  capThickness: number,      // cm
  layerId: "S-FOUND",
}
```

### 5B. 2D Rendering (ArchitecturalRenderer)

Foundation elements render on the `S-FOUND` layer in 2D with distinct visual conventions matching Vietnamese structural drawing standards (TCVN 5574):

| Type | 2D Symbol |
|------|-----------|
| Strip footing | Double dashed line wider than wall, hatched with diagonal cross |
| Spread footing | Rectangle with X diagonal, column shown as solid square inside |
| Raft slab | Boundary polygon with dense dot-grid hatch |
| Pile | Circle with cross (✕), pile cap shown as dashed rectangle |
| Grade beam | Dashed center line connecting footings |
| Column | Solid filled square with size label (e.g. 25×25) |

All foundation elements render **beneath** wall elements in 2D layer order. The `S-FOUND` layer is toggleable separately from `A-WALL`.

### 5C. 3D Rendering — Underground Geometry

New component: `FoundationMesh.tsx`

The 3D scene must render **below ground** (y < 0). Foundation geometry is rendered at negative Y positions:

```
y = 0              ← ground surface
y = -footingDepth  ← top of footing
y = -footingDepth - footingThickness  ← bottom of footing
y = -pileLength    ← pile tip
```

**Strip footing 3D**: `BoxGeometry(length, footingThickness, footingWidth)` centered on the wall centerline, offset down by footingDepth. Material: off-white concrete with coarse roughness.

**Spread footing 3D**: `BoxGeometry(footingW, footingThickness, footingH)` at footingDepth. Column rendered above it as `BoxGeometry(columnW, columnHeight, columnW)` rising from y=0 to y=columnHeight.

**Raft slab 3D**: `ExtrudeGeometry` from polygon outline, depth = raftThickness, positioned at y = -raftDepth to y = -raftDepth + raftThickness. Optional ribs as cross-hatch of thin boxes.

**Pile 3D**: `CylinderGeometry(radius, radius, pileLength)` extending straight down from y=0 to y=-pileLength. Pile cap as `BoxGeometry(capWidth, capThickness, capWidth)` sitting at y=0. Pile shown as semi-transparent below ground (shader `opacity: 0.6, transparent: true`) so users can see depth.

**Underground section mode**: A slider in the RightSidebar "Render" tab cuts the ground plane at a specified depth, exposing the underground geometry like a cross-section view.

### 5D. 2D Drawing Tools

**Strip footing tool** (CanvasEditor): activated from the Foundation toolbar group. Works like the wall tool — click two points. A parallel double-line drawn at `footingWidth` renders automatically. A properties panel sets depth, thickness, and material.

**Spread footing tool**: click to place. A dialog prompts for footing size and column dimensions.

**Raft slab tool**: same as floor polygon tool but with `archType: "foundation-raft"`.

**Pile tool**: click to place individual piles. Hold Shift to place a pile group (2×2, 2×3, 3×3 pattern — auto-spaced at 3× pile diameter per TCVN).

### 5E. 3D Drawing Tools (ThreeToolbar)

A new **"Foundation" tool group** in ThreeToolbar (below the current wall/floor group), with:
- Strip footing draw (click two ground points, same as wall3d)
- Spread footing place (click to drop at ground point, properties panel)
- Pile place (click ground point, depth set via slider)

All write back to the store as `DrawingElement` objects with correct archType → visible in 2D immediately.

### 5F. Structural Layer (`S-FOUND`)

Add `S-FOUND` to the default layer list alongside `A-WALL`, `A-DOOR`, etc. The layer has:
- Default color: `#b45309` (amber — structural convention)
- Default linetype: dashed for hidden foundation lines
- Visibility toggle independent of architectural layers
- Shows a "Structural" badge in the layers panel

---

## Phase 6 — Scene & Environment System (Cảnh & Thời Tiết) ✅ DONE

### 6A. Architecture: SceneStore

Add a new Zustand slice `sceneSlice.ts` with state:

```ts
interface SceneState {
  season: "spring" | "summer" | "autumn" | "winter";
  weather: "sunny" | "overcast" | "rainy" | "stormy" | "foggy" | "snowy";
  timeOfDay: number;          // 0–24 hours (float), e.g. 14.5 = 2:30 PM
  neighborhoodContext: "none" | "suburban" | "urban" | "rural" | "highrise";
  neighborCount: number;      // 0–6 neighboring buildings visible
  fogDensity: number;         // 0–1
  showFoundation: boolean;    // cross-section toggle
}
```

This slice is read by `ThreeViewer.tsx` to drive sky, lights, particles, and landscape.

### 6B. New "Scene" Tab in RightSidebar

Add a 5th tab to `RightSidebar` in `ThreeViewerUI.tsx` — the **"Scene" tab** (icon: 🌤). Layout:

```
┌─ SCENE ──────────────────────────────┐
│  Season                               │
│  [🌸 Spring] [☀ Summer] [🍂 Autumn] [❄ Winter]  │
│                                       │
│  Weather                              │
│  [☀ Sunny] [☁ Overcast] [🌧 Rain] [⛈ Storm]    │
│  [🌫 Fog]  [❄ Snow]                   │
│                                       │
│  Time of Day          [14:30] ──●──── │
│  ████████████░░░░░░░░ (sunrise→sunset)│
│                                       │
│  Neighborhood                         │
│  [None] [Suburban] [Urban] [Highrise] │
│  Neighbor buildings: ──●────  3       │
│                                       │
│  Underground section: ──●──── -150cm  │
└───────────────────────────────────────┘
```

### 6C. Sky & Lighting System

Replace the hardcoded `Sky` props with a data-driven system.

**Time of day → sun position**: Compute `sunPosition` from `timeOfDay` using a simplified solar angle formula:
```ts
function sunPosition(hour: number): [number, number, number] {
  const angle = ((hour - 6) / 12) * Math.PI; // rises at 6, sets at 18
  return [Math.cos(angle) * 400, Math.sin(angle) * 200, -100];
}
```

**Season + Weather → Sky parameters**:

| Condition | turbidity | rayleigh | mieCoefficient | Environment preset |
|-----------|-----------|----------|----------------|--------------------|
| Sunny summer | 4 | 0.8 | 0.003 | `"park"` |
| Sunny winter | 6 | 0.5 | 0.004 | `"dawn"` |
| Overcast | 12 | 0.4 | 0.010 | `"studio"` |
| Rainy | 16 | 0.3 | 0.020 | `"studio"` |
| Stormy | 20 | 0.2 | 0.030 | `"night"` |
| Foggy | 18 | 0.6 | 0.025 | `"studio"` |
| Snowy | 8 | 0.3 | 0.005 | `"dawn"` |

Lighting intensity scales with time: `ambientIntensity = 0.3 + 0.7 * Math.sin(...)`, dim at night, full at noon.

### 6D. Season — Ground & Tree Appearance

Season affects ground texture and tree colors. These are computed in the `Landscape` component:

| Season | Ground color | Tree foliage color | Extra |
|--------|--------------|--------------------|-------|
| Spring | `#7ec850` (bright green) | `#a8e063` light green | Cherry blossom pink spheres on some trees |
| Summer | `#5a9e3a` (deep green) | `#2d6a1f` dark green | Grass texture most detailed |
| Autumn | `#8b6914` (dry yellow-brown) | Mixed `#d4780a` / `#c0392b` orange-red | Fallen leaf particles on ground |
| Winter | `#dce8f0` (pale grey-white) | `#4a5568` bare branches (no foliage cone) | Snow cap on roof, snow on tree tops |

Technique: Pass `season` prop to the `Landscape` component. Tree foliage cone material `color` prop changes. Ground grass texture hue-shifted via a uniform in the canvas texture generation.

### 6E. Weather — Visual Effects

**Rain** (`weather === "rainy" | "stormy"`):

`RainSystem.tsx` component — a particle system using `THREE.Points`:
- 3000 rain drop particles (`BufferGeometry` with random XYZ in a 2000×1500×2000 bounding box)
- `PointsMaterial` with vertical line shape (tall, narrow, semi-transparent light blue)
- `useFrame`: each tick, move all Y positions down by `velocity * dt`. Reset to top when particle drops below ground.
- Stormy: double particle count, higher velocity, add lightning flash (`DirectionalLight` intensity pulse every 5–15s)
- Fog: `scene.fog = new THREE.FogExp2('#c4c4c4', 0.0008)`

**Snow** (`weather === "snowy"`):
- Same particle system but wider, slower, drifting horizontally with a sine wave in X
- Snowflake material: white, larger point size (3–5px)
- Accumulation: ground texture shifts to white (via `season: "winter"` + snow override)

**Overcast**: No particles. Sky turbidity raised, `Environment` switched to `"studio"`, directional light intensity dropped to 0.4.

**Stormy**: Rain particles + wind effect on trees (tree trunk mesh slightly oscillates via `useFrame` rotation sine wave amplitude ±3°).

### 6F. Neighborhood Context — Neighboring Buildings

`NeighborBuildings.tsx` component placed inside `Landscape`.

**Approach**: Procedural low-poly neighbor buildings. Each building is defined by:
```ts
interface NeighborBuilding {
  offsetX: number;   // distance from main building center
  offsetZ: number;
  width: number;
  depth: number;
  floors: number;    // 1–8
  roofType: "flat" | "gable" | "hip";
  facadeColor: string;
}
```

Generation: given `neighborCount` (0–6) and `neighborhoodContext`, place buildings at fixed slots around the lot:
- Slots: left lot line, right lot line, across the road, diagonal corners
- Suburban: 1–2 storey, gable roofs, varied colors, 5m setback from roads
- Urban: 3–5 storey, flat roofs, narrow plots, townhouse style
- Highrise: 8+ storey towers behind (far Z offset), glass facade material

Geometry: each neighbor is a `BoxGeometry(width, height, depth)` for the body, plus a `RoofMesh` from the existing component. Facade uses a simple procedural window grid texture (canvas-drawn repeating tile).

**Season integration**: in winter, a white flat cap `BoxGeometry(w+4, 2, d+4)` is placed on top of each neighbor's roof.

### 6G. Fog & Atmosphere

Fog is driven by weather state:

```ts
useEffect(() => {
  const fogMap = {
    sunny: null,
    overcast: new THREE.Fog('#c8d8e8', 2000, 8000),
    rainy: new THREE.Fog('#9aacb8', 1000, 5000),
    stormy: new THREE.FogExp2('#606870', 0.0006),
    foggy: new THREE.FogExp2('#b0bcbc', 0.0012),
    snowy: new THREE.Fog('#dce8f0', 800, 4000),
  };
  scene.fog = fogMap[weather];
}, [weather, scene]);
```

---

## Updated File Change Map

| File | Change | Phase |
|------|--------|-------|
| `types.ts` | Add foundation archTypes, column, grade-beam | 5 |
| `canvas/3d/components/FoundationMesh.tsx` | **NEW** — all foundation 3D geometry | 5 |
| `canvas/3d/components/index.ts` | Export FoundationMesh | 5 |
| `components/ThreeViewer.tsx` | Render FoundationMesh; integrate SceneStore; SceneEffects component | 5, 6 |
| `canvas/3d/components/ThreeViewerUI.tsx` | Add Scene tab; foundation tool buttons | 5, 6 |
| `stores/slices/sceneSlice.ts` | **NEW** — season/weather/time/neighborhood state | 6 |
| `stores/drawingStore.ts` | Add sceneSlice to composed store | 6 |
| `canvas/3d/components/RainSystem.tsx` | **NEW** — rain/snow/storm particle system | 6 |
| `canvas/3d/components/NeighborBuildings.tsx` | **NEW** — procedural context buildings | 6 |
| `canvas/3d/components/Landscape.tsx` (extracted) | Extract Landscape from ThreeViewer; add season prop | 6 |
| `canvas/tools/foundationTool.ts` | **NEW** — 2D strip/spread/raft/pile drawing tools | 5 |
| `canvas/CadEngine.ts` / `ArchitecturalRenderer.ts` | Render foundation symbols on S-FOUND layer | 5 |
| `stores/slices/layerSlice.ts` | Add S-FOUND default layer | 5 |

---

## Updated Implementation Order

| Week | Deliverable | Risk |
|------|------------|------|
| **1** | `coordBridge.ts` · PushPull store write-back · height overlay in 2D | Low |
| **2** | `FloorMesh` + 2D floor tool · `PipeMesh` + 2D pipe tool | Medium |
| **3** | `StairMesh` · room elements persisted · 3D properties panel in 2D | Medium |
| **4** | Wall move in 3D · 3D door placer · floor draw in 3D | High |
| **5** | `S-FOUND` layer · Foundation element types · 2D foundation symbols | Medium |
| **6** | `FoundationMesh.tsx` · underground rendering · 3D foundation tools | Medium |
| **7** | `sceneSlice` · Season system · Weather particles (rain/snow/storm) | Medium |
| **8** | `NeighborBuildings.tsx` · Time-of-day sky · Scene tab in RightSidebar | Medium |

---

## Testing Checklist

For each element type, verify the full round-trip:

- [ ] Draw in 2D → switch to 3D → appears correctly in 3D
- [ ] Draw in 3D → switch to 2D → appears correctly in 2D
- [ ] Edit property in 2D panel → 3D updates live
- [ ] Edit geometry in 3D → 2D canvas reflects immediately
- [ ] Undo after 3D edit → reverts in both views
- [ ] Save → reload → element persists with all 3D properties

Foundation-specific:

- [ ] Strip footing drawn in 2D → appears below ground in 3D at correct depth
- [ ] Pile placed in 3D → appears in 2D as circle with cross symbol
- [ ] Underground section slider reveals footing geometry at correct cut depth
- [ ] `S-FOUND` layer toggle hides/shows all foundation elements in both views

Scene/Weather:

- [ ] Switching season changes tree color and ground texture
- [ ] Winter → snow cap appears on roof and neighbor buildings
- [ ] Rainy → rain particles fall, fog applied, lightning flashes in storm mode
- [ ] Time-of-day slider moves sun position, ambient light dims at night
- [ ] Neighbor buildings appear at correct offsets per neighborhood type
- [ ] Scene state persists when switching between 2D and 3D

---

## Non-Goals (Out of Scope)

- Real-time multiplayer sync (separate feature)
- BIM IFC property sets for MEP (IFC export handles this separately)
- Geotechnical soil analysis / bearing capacity calculations
- Animated water flow in drain pipes
- Curved pipes / duct fittings
- 3D element rotation (only translation in Phase 4)
- Real solar irradiance / shadow studies (architectural sun analysis)
- Procedural city generation beyond 6 neighbor buildings
