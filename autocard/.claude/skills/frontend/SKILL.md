---
name: frontend
description: Work on the AutoCard React/TypeScript frontend — CAD canvas, drawing tools, block library, stores, AI assistant, and 3D viewer. Use when adding features, fixing bugs, or reviewing changes in autocard/frontend/.
allowed-tools: Bash(npm *) Bash(npx *) Bash(find *) Bash(grep *) Read Write Edit Glob
---

# AutoCard Frontend Skill

## Stack at a glance

| What | Technology |
|---|---|
| Framework | React 19, TypeScript (strict) |
| Build tool | Vite 5 — dev server on **port 51530** |
| Styling | Tailwind CSS 4 (utility-first, dark mode via `dark:` prefix) |
| State | Zustand 5 (multiple stores — never couple stores to each other) |
| 3D | Three.js 0.184 + React Three Fiber + Drei |
| HTTP | Fetch via `src/api/client.ts` — wraps JWT auth automatically |
| Data fetching | TanStack Query 5 |
| Icons | Lucide React |

## 1. Start the dev server

```bash
cd autocard/frontend
npm install        # first time only
npm run dev        # starts on http://localhost:51530
```

Backend must be running on port 8080 — all `/api/*` requests are proxied there via `vite.config.js`.

## 2. Type-check without running

```bash
cd autocard/frontend
npx tsc --noEmit
```

The one known pre-existing error is in `src/pages/StoreOrderPage.tsx:493` — ignore it. Any new errors you introduce are yours to fix.

## 3. Source tree — what lives where

```
src/
├── main.tsx                   Entry point — mounts App in StrictMode
├── App.tsx                    Root router + QueryClientProvider + auth gate
├── types.ts                   ALL shared TypeScript types (DrawingElement, Layer, Style, etc.)
├── env.d.ts                   Vite env variable types
│
├── api/
│   └── client.ts              Fetch wrapper — reads JWT from authStore, throws on non-2xx
│
├── pages/                     One file per route
│   ├── CanvasEditor.tsx        Main drawing editor page (most complex)
│   ├── DrawingDashboard.tsx    List/create drawings
│   ├── LoginPage.tsx / RegisterPage.tsx / VerifyEmailPage.tsx / ForgotPasswordPage.tsx
│   ├── SettingsPage.tsx
│   ├── TeamPage.tsx
│   └── StoreOrderPage.tsx
│
├── components/
│   ├── DrawToolbar.tsx         Left toolbar — line, wall, circle, etc.
│   ├── StyleToolbar.tsx        Color, line width, line type, pattern
│   ├── SnapToolbar.tsx         Snap mode toggles
│   ├── AnnotateToolbar.tsx     Dimension, leader, text, hatch tools
│   ├── ModifyToolbar.tsx       Move, copy, rotate, scale, trim
│   ├── CommandLine.tsx         AutoCAD-style command input
│   ├── CadSidebar.tsx          Right sidebar container
│   ├── BlockLibrary.tsx        Drag-and-drop block palette
│   ├── ThreeViewer.tsx         3D view panel (React Three Fiber)
│   ├── BIMPanel.tsx            BIM properties panel
│   ├── PaperSpace.tsx          Print/sheet layout
│   ├── MeasurementTool.tsx     Distance/angle/area measurement overlay
│   ├── VersionHistory.tsx      Version history panel
│   ├── CloudStorage.tsx        Save/load to cloud
│   ├── TextFormatBar.tsx       Font/size/bold/italic controls for text elements
│   └── layout/
│       ├── AppShell.tsx        Page chrome (top nav + sidebar)
│       ├── Sidebar.tsx         Left navigation sidebar
│       └── TopNav.tsx
│
├── panels/                    Right-panel components shown inside CadSidebar
│   ├── LayersPanel.tsx         Layer visibility, lock, add/remove
│   ├── PropertiesPanel.tsx     Selected element style/geometry properties
│   └── AIAssistantPanel.tsx    Chat interface → calls aiDrawingService
│
├── tools/                     CAD tool implementations (one class per tool)
│   ├── BaseTool.ts             Abstract base — mouse events, keyboard, preview
│   ├── LineTool.ts
│   ├── RectangleTool.ts
│   ├── CircleTool.ts
│   ├── HatchTool.ts            Polygon hatch with 13 patterns
│   ├── TextTool.ts
│   ├── DimensionTool.ts        Offset dimension with filled arrows
│   ├── LeaderTool.ts
│   ├── NumberingTool.ts
│   ├── MoveTool.ts
│   └── CopyTool.ts
│
├── stores/                    Zustand stores — import with useXxxStore()
│   ├── drawingStore.ts         PRIMARY store: elements, layers, tools, snap, history
│   ├── authStore.ts            User session + JWT token
│   ├── collaborationStore.ts   WebSocket cursors + presence
│   ├── commandStore.ts         Command palette state
│   └── themeStore.ts           Dark/light mode
│
├── canvas/
│   ├── CadEngine.ts            Canvas renderer — draw all element types + hatch + dim
│   ├── snap.ts                 Snap point calculation (endpoint, midpoint, center, grid)
│   ├── dxf.ts                  DXF import/export stubs
│   └── drop.ts                 File drag-and-drop handler
│
├── services/
│   └── aiDrawingService.ts     Calls POST /api/ai/generate, streams JSON response
│
├── core/                      Legacy geometry (still in use)
│   ├── wallEngine.ts           Wall polygon computation with miter joins
│   ├── roomEngine.ts           Room detection from wall networks
│   └── entities.ts             WallEntity, RoomEntity types
│
├── data/
│   └── blockLibrary.ts        ALL block definitions (BLOCK_CATALOG, CATEGORY_META)
│
└── cad/                       New modular CAD system (Phase 0+1 complete)
    ├── contracts/              TypeScript interfaces & schemas
    │   ├── document.ts
    │   ├── nodes/              Node type definitions
    │   ├── layers.ts
    │   ├── events.ts
    │   ├── commands.ts
    │   ├── ai.ts
    │   └── ...
    ├── core/                   Pure logic (no React, no Three.js)
    │   ├── commands/           Command pattern + reducers
    │   ├── events/             Event bus
    │   ├── geometry/           Math utilities
    │   └── systems/            Wall + room systems
    └── store/                  Zustand CAD stores (new system)
        ├── useCadDocumentStore.ts
        ├── useCadHistoryStore.ts
        ├── useCadSelectionStore.ts
        └── ...
```

## 4. Architecture rules — read before touching code

### Old system vs new system

The codebase has **two parallel CAD systems**:

| | Old system | New system |
|---|---|---|
| Types | `src/types.ts` → `DrawingElement` | `src/cad/contracts/` |
| Stores | `src/stores/drawingStore.ts` | `src/cad/store/` |
| Rendering | `src/canvas/CadEngine.ts` | TBD (not yet wired) |
| Usage | Active — all current drawing | Phase 0+1 complete, not yet the primary path |

**Do not mix them.** If a feature lives in the old system, keep it there. If building net-new CAD architecture, use `src/cad/`.

### Layer rules

- `src/cad/core/` — pure logic only. No React imports, no Three.js, no DOM.
- `src/cad/store/` — Zustand stores only. No business logic inside setters.
- `src/canvas/CadEngine.ts` — rendering only. No state mutations.
- `src/tools/` — tool interaction only. Call `store.addElement()`, never render.
- `src/stores/drawingStore.ts` — state + API persistence only.

### DrawingElement fields (types.ts)

Always add new optional fields to `DrawingElement` with `?:`. Never remove existing fields — stored drawings depend on them. Key fields:

```typescript
type, layerId, id                      // required on every element
x1,y1,x2,y2                           // line / dimension endpoints
cx,cy,radius                           // circle / arc
x,y,width,height                       // rectangle / text position
points: Point[]                        // polyline / hatch / leader
pattern                                // hatch pattern name (string)
offset                                 // dimension line offset (number, default 30)
blockId, scale, rotation               // block instance
strokeColor, fillColor, strokeWidth, lineType  // visual style
```

## 5. Common tasks

### Add a new CAD tool

1. Create `src/tools/MyTool.ts` extending `BaseTool`.
2. Implement `onMouseDown`, `onMouseUp`, `drawPreview`, `onKeyDown`.
3. Call `this.store.addElement({...})` when complete.
4. Add the tool name to `ToolType` in `src/types.ts`.
5. Add a button to the relevant toolbar component (`DrawToolbar`, `AnnotateToolbar`, etc.).
6. Register in `CanvasEditor.tsx` where tools are instantiated.
7. Add preview rendering in `CadEngine.drawPreview()` for the new tool type.

### Add a block symbol

Open `src/data/blockLibrary.ts`. Add to the relevant category const array:

```typescript
{
  id: "my-symbol",
  label: "My Symbol",
  icon: "🔧",
  category: "structural",  // or elevation, annotation, etc.
  def: {
    id: "my-symbol", name: "My Symbol", insertionPoint: { x: 0, y: 0 },
    elements: [
      // Sub-elements: type "line"|"rectangle"|"circle"|"arc"|"polyline"|"text"
      // Coordinates are relative to insertionPoint (0,0 = center)
      { id: "e1", type: "rectangle", x: -20, y: -20, width: 40, height: 40,
        strokeWidth: 2, strokeColor: S, fillColor: F },
    ],
  },
},
```

Add a new category: extend `BlockCategory` union, add array, add to `BLOCK_CATALOG`, add to `CATEGORY_META`.

### Add a hatch pattern

In `CadEngine.ts → drawHatch()`, add a new `case "my-pattern":` block inside the `switch(pattern)` statement. The clip region is already set — just draw lines/dots/shapes. Available patterns: `diagonal45`, `diagonal135`, `cross`, `grid`, `brick`, `concrete`, `insulation`, `tile`, `wood`, `steel`, `glass`, `earth`, `gravel`, `sand`.

### Add a new page/route

1. Create `src/pages/MyPage.tsx`.
2. Register the route in `src/App.tsx`.
3. Add a link in `src/components/layout/Sidebar.tsx` if it needs nav entry.

### Update the drawing store

Open `src/stores/drawingStore.ts`. The store interface is `DrawingStore`. Add new state fields and setters following the Zustand pattern. If the field needs persistence to the backend, call `drawings.save(...)` from `src/api/client.ts` after mutating.

### Call the backend API

```typescript
import { drawings, auth } from "../api/client";

// Authenticated GET
const data = await drawings.list();

// Authenticated POST
const drawing = await drawings.create({ name: "Untitled" });
```

For new endpoints not yet in `client.ts`, add a typed function following the existing pattern — it automatically injects the JWT from `authStore`.

### Add a layer

Layers are defined in `drawingStore.ts` → `ARCH_LAYER_STYLES`. Add the style there; layers are created automatically when an element references a `layerId` that doesn't exist yet.

## 6. CadEngine rendering pipeline

```
CadEngine.render()
  ├── drawGrid()                        background grid
  ├── drawArchitecturalPlan()           AI-generated plan (walls/rooms/openings/dims)
  ├── Wall polygons via WallEngine      manual walls with miter joins
  ├── drawOpenings()                    doors/windows punch through walls
  ├── forEach element → drawElement()
  │     ├── rectangle, circle, line, arc, ellipse, polyline
  │     ├── text
  │     ├── leader       → drawLeader()
  │     ├── hatch        → drawHatch()    13 patterns
  │     ├── block        → drawBlock()    from BLOCK_CATALOG
  │     └── dimension    → drawDimension() offset + filled arrows
  ├── drawPreview()                     live preview while drawing
  ├── drawSnapIndicator()               snap point visual
  └── drawCursors()                     collaborator cursors
```

**Dark mode**: `isDarkMode` is passed through. Pure-black strokes (`#111827`, `#000000`, `#0F172A`) are auto-inverted to `#F8FAFC` on dark backgrounds.

## 7. AI drawing service

`src/services/aiDrawingService.ts` calls `POST /api/ai/generate` with a prompt string. The backend streams a JSON response that resolves to an `ArchitecturalPlan`. The plan is stored in `drawingStore.currentArchitecturalPlan` and rendered by `drawArchitecturalPlan()` in CadEngine.

If the AI result needs to be editable, convert the `ArchitecturalPlan` into individual `DrawingElement` objects and call `store.addElement()` for each.

## 8. Environment variables

File: `autocard/frontend/.env`

```
VITE_API_URL=http://localhost:8080
VITE_WS_HOST=localhost
VITE_WS_PORT=8080
```

Access in code: `import.meta.env.VITE_API_URL`

## 9. Things to avoid

- **Do not call backend API directly from tools** — use the store or service layer.
- **Do not import `Three.js` outside `ThreeViewer.tsx` and `src/cad/`** — the 2D canvas system is pure Canvas2D.
- **Do not add fields to `Style` interface without also handling them in `applyStyle()` in `CadEngine.ts`**.
- **Do not hardcode layer IDs as strings** outside `drawingStore.ts` where `ARCH_LAYER_STYLES` is defined.
- **Do not mutate Zustand state directly** — always use the store's setter functions.
- **Do not skip `layerId` on new elements** — all elements must reference a layer.
