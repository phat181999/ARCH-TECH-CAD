# Implementation Plan: SketchUp-style 3D Modeling Toolbar & Interactive Tools

This plan adds a SketchUp-style vertical toolbar to the **3D Preview** with fully working interactive tools: Camera mode switcher (Orbit / Pan / Zoom), interactive Tape Measure with live distance badge, dynamic Push/Pull wall extrusion, and a hover-to-highlight Eraser. It corrects all gaps identified during review of the original draft.

---

## Current State

Before implementing, account for these existing conditions:

* `WALL_HEIGHT = 34` is a module-level constant in `ThreeViewer.tsx`. All references — `DynamicWall`, `CameraController`, and the arch-plan floor/wall positions — must be updated to a reactive `wallHeight` prop.
* `controlsRef` is currently created **inside** `Scene`, making it unreachable from `ThreeViewer`. It must be moved up to `ThreeViewer` and threaded down as a prop.
* `extrudeRoom`, `extrudeDoor`, and `flatElementMesh` are **plain functions**, not React components. They cannot hold `useState` for hover. They must be converted to React function components before eraser hover can be added.
* Only `deleteSelectedElements()` exists in the drawing store — it requires the element to already be in `selectedElementIds`. A dedicated `deleteElement(id: string)` action is needed for the eraser.
* The drawing store's `deleteSelectedElements` and `deleteElement` only touch `elements`. Elements rendered from `currentArchitecturalPlan` (walls, openings, rooms) live in a separate store slice and cannot be deleted by those actions.
* `@react-three/drei` v10 ships `Html` and `Line` — neither is currently imported in `ThreeViewer.tsx`.
* `OrbitControls` has no conditional `enableRotate` / `enablePan` props today. When a click-capture tool (Tape Measure, Eraser) is active the controls must be suppressed or they will swallow pointer events.

---

## Proposed Changes

### 1. Drawing Store

#### [MODIFY] `frontend/src/stores/drawingStore.ts`

Add one new store action:

```typescript
deleteElement: (id: string) => void;
```

**Implementation** — single history entry, mirrors the structure of `updateElement`:
```typescript
deleteElement: (id) =>
  set((state) => {
    const newElements = state.elements.filter((el) => el.id !== id);
    return {
      elements: newElements,
      visibleElementIds: state.visibleElementIds.filter((vid) => vid !== id),
      selectedElementIds: state.selectedElementIds.filter((sid) => sid !== id),
      history: [...state.history.slice(0, state.historyIndex + 1), newElements],
      historyIndex: state.historyIndex + 1,
    };
  }),
```

Add `deleteElement` to the `DrawingStore` interface alongside `deleteSelectedElements`.

---

### 2. ThreeViewer.tsx

All changes in this file. No other file needs modification.

#### 2a. Imports

```typescript
// Add Html and Line to the drei import:
import { Grid, OrbitControls, Html, Line } from "@react-three/drei";
```

#### 2b. Remove module-level constant

Delete:
```typescript
const WALL_HEIGHT = 34;
```

`wallHeight` will be a React state in `ThreeViewer` and threaded as a prop. Every reference to `WALL_HEIGHT` becomes `wallHeight` received via props.

#### 2c. `DynamicWall` — accept `wallHeight` prop + eraser support

Convert signature from `{ segment, color }` to `{ segment, color, wallHeight, eraserActive, onErase }`:

```typescript
function DynamicWall({
  segment, color, wallHeight, eraserActive, onErase
}: {
  segment: WallSegment;
  color: string;
  wallHeight: number;
  eraserActive: boolean;
  onErase?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ camera }) => {
    if (!materialRef.current) return;
    const dist = camera.position.distanceTo(
      new THREE.Vector3(segment.centerX, wallHeight / 2, segment.centerZ)
    );
    let opacity = 1;
    if (dist < 800) opacity = dist < 300 ? 0.15 : 0.15 + 0.85 * ((dist - 300) / 500);
    materialRef.current.transparent = opacity < 1;
    materialRef.current.opacity = opacity;
    materialRef.current.needsUpdate = true;
  });

  return (
    <mesh
      position={[segment.centerX, wallHeight / 2, segment.centerZ]}
      receiveShadow
      castShadow
      onPointerOver={(e) => { e.stopPropagation(); if (eraserActive) setHovered(true); }}
      onPointerOut={() => setHovered(false)}
      onClick={(e) => { e.stopPropagation(); if (eraserActive && onErase) onErase(); }}
    >
      <boxGeometry args={[segment.width, wallHeight, segment.depth]} />
      <meshStandardMaterial
        ref={materialRef}
        color={eraserActive && hovered ? "#ef4444" : color}
      />
    </mesh>
  );
}
```

**Note**: `DynamicWall` renders plan-backed walls. Because those live in `currentArchitecturalPlan`, not `elements`, the eraser on walls will call `onErase` only if a caller passes one. In v1, pass `onErase={undefined}` for plan-backed walls and show a cursor change only — no deletion. Only element-backed walls (archType === "wall" via `buildWallSegmentsFromSemanticWalls`) can be deleted.

#### 2d. Convert `extrudeRoom` to a React component

```typescript
// Before (plain function):
function extrudeRoom(room: DrawingElement, key: string) { ... }

// After (React component):
function RoomMesh({
  room, wallHeight, eraserActive, onErase
}: {
  room: DrawingElement;
  wallHeight: number;
  eraserActive: boolean;
  onErase?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const eraserProps = {
    onPointerOver: (e: any) => { e.stopPropagation(); if (eraserActive) setHovered(true); },
    onPointerOut: () => setHovered(false),
    onClick: (e: any) => { e.stopPropagation(); if (eraserActive && onErase) onErase(); },
  };
  const highlightColor = eraserActive && hovered ? "#ef4444" : undefined;

  if (room.type === "text" && typeof room.x === "number" && typeof room.y === "number") {
    return (
      <mesh position={[room.x, 0.8, room.y]} {...eraserProps}>
        <boxGeometry args={[18, 0.5, 8]} />
        <meshStandardMaterial color={highlightColor || "#cbd5e1"} transparent opacity={highlightColor ? 0.9 : 0.2} />
      </mesh>
    );
  }
  if (!isRectangle(room)) return null;
  return (
    <group>
      <mesh position={[room.x + room.width / 2, 0.3, room.y + room.height / 2]} receiveShadow {...eraserProps}>
        <boxGeometry args={[room.width, 0.2, room.height]} />
        <meshStandardMaterial color={highlightColor || "#dbe4ea"} transparent opacity={highlightColor ? 0.9 : 0.95} />
      </mesh>
      <mesh position={[room.x + room.width / 2, 10, room.y + room.height / 2]} castShadow receiveShadow>
        <boxGeometry args={[room.width, wallHeight * 0.6, room.height]} />
        <meshStandardMaterial color="#eef2f6" transparent opacity={0.2} />
      </mesh>
    </group>
  );
}
```

Update all call sites in `PlanModel` from `extrudeRoom(room, room.id)` to `<RoomMesh key={room.id} room={room} wallHeight={wallHeight} eraserActive={eraserActive} onErase={...} />`.

#### 2e. Convert `extrudeDoor` to a React component

```typescript
function DoorMesh({
  door, wallHeight, eraserActive, onErase
}: {
  door: DrawingElement;
  wallHeight: number;
  eraserActive: boolean;
  onErase?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const eraserProps = {
    onPointerOver: (e: any) => { e.stopPropagation(); if (eraserActive) setHovered(true); },
    onPointerOut: () => setHovered(false),
    onClick: (e: any) => { e.stopPropagation(); if (eraserActive && onErase) onErase(); },
  };
  const color = eraserActive && hovered ? "#ef4444" : "#89c2d9";
  const opacity = eraserActive && hovered ? 0.9 : 0.35;
  const doorH = wallHeight * 0.6;

  if (door.type === "arc" && typeof door.cx === "number" && typeof door.cy === "number" && typeof door.radius === "number") {
    return (
      <mesh position={[door.cx + door.radius / 2, doorH / 2, door.cy - door.radius / 2]} castShadow {...eraserProps}>
        <boxGeometry args={[Math.max(door.radius, 4), doorH, 2]} />
        <meshStandardMaterial color={color} transparent opacity={opacity} />
      </mesh>
    );
  }
  if (!isRectangle(door)) return null;
  return (
    <mesh position={[door.x + door.width / 2, doorH / 2, door.y + WALL_THICKNESS / 2]} castShadow {...eraserProps}>
      <boxGeometry args={[door.width, doorH, Math.max(2, door.height)]} />
      <meshStandardMaterial color={color} transparent opacity={opacity} />
    </mesh>
  );
}
```

#### 2f. Convert `flatElementMesh` to a React component

```typescript
function FlatElementMesh({
  el, blockDefs, eraserActive, onErase
}: {
  el: DrawingElement;
  blockDefs?: any;
  eraserActive: boolean;
  onErase?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const eraserProps = {
    onPointerOver: (e: any) => { e.stopPropagation(); if (eraserActive) setHovered(true); },
    onPointerOut: () => setHovered(false),
    onClick: (e: any) => { e.stopPropagation(); if (eraserActive && onErase) onErase(); },
  };

  if (el.type === "block" && el.blockId && blockDefs) {
    const def = blockDefs[el.blockId];
    if (!def) return null;
    return (
      <group
        position={[el.x || 0, 0, el.y || 0]}
        scale={[el.scale || 1, 1, el.scale || 1]}
        rotation={[0, -(el.rotation || 0) * Math.PI / 180, 0]}
        {...eraserProps}
      >
        {def.elements.map((be: any) => (
          <BlockElementMesh key={be.id} el={be} blockType={el.blockId!} />
        ))}
      </group>
    );
  }

  const color = typeof el.strokeColor === "string" ? el.strokeColor : "#1f2937";
  const fillColor = typeof el.fillColor === "string" && el.fillColor !== "transparent" ? el.fillColor : null;
  const highlightColor = eraserActive && hovered ? "#ef4444" : undefined;

  if (isRectangle(el)) {
    return (
      <mesh position={[el.x + el.width / 2, 0.15, el.y + el.height / 2]} receiveShadow {...eraserProps}>
        <boxGeometry args={[el.width, 0.3, el.height]} />
        <meshStandardMaterial color={highlightColor || fillColor || color} transparent opacity={highlightColor ? 0.9 : (fillColor ? 1 : 0.35)} wireframe={!fillColor && !highlightColor} />
      </mesh>
    );
  }
  if (el.type === "circle" && typeof el.cx === "number" && typeof el.cy === "number" && typeof el.radius === "number") {
    return (
      <mesh position={[el.cx, 0.2, el.cy]} receiveShadow {...eraserProps}>
        <cylinderGeometry args={[el.radius, el.radius, 0.3, 32]} />
        <meshStandardMaterial color={highlightColor || fillColor || color} transparent opacity={highlightColor ? 0.9 : (fillColor ? 1 : 0.35)} wireframe={!fillColor && !highlightColor} />
      </mesh>
    );
  }
  if (el.type === "line" && typeof el.x1 === "number") {
    return (
      <Line
        points={[[el.x1, 0.2, el.y1!], [el.x2!, 0.2, el.y2!]]}
        color={color}
        lineWidth={1}
      />
    );
  }
  return null;
}
```

**Note**: `line`-type elements use `<Line>` from drei (no eraser pointer events — lines are too thin to reliably hit-test in 3D). For v1, eraser on lines is omitted.

#### 2g. `PlanModel` — accept and thread `wallHeight` + `eraserActive` + `deleteElement`

```typescript
function PlanModel({
  elements, plan: architecturalPlan, blockDefs, wallHeight, eraserActive, deleteElement
}: {
  elements: DrawingElement[];
  plan: ArchitecturalPlan | null;
  blockDefs?: any;
  wallHeight: number;
  eraserActive: boolean;
  deleteElement: (id: string) => void;
}) { ... }
```

All `DynamicWall`, `RoomMesh`, `DoorMesh`, `FlatElementMesh` usages inside `PlanModel` must receive `wallHeight`, `eraserActive`, and `onErase={() => deleteElement(el.id)}` (only for element-backed entities). Plan-backed entities (from `architecturalPlan`) pass `onErase={undefined}`.

#### 2h. `CameraController` — accept `wallHeight` prop

Update the distance fade calculation:
```typescript
// Before:
const dist = camera.position.distanceTo(new THREE.Vector3(segment.centerX, WALL_HEIGHT / 2, ...));

// After — pass wallHeight down from Scene:
function CameraController({ ..., wallHeight }: { ...; wallHeight: number }) { ... }
```

#### 2i. `Scene` — move `controlsRef` up, accept new props

`controlsRef` must be created in `ThreeViewer` and passed down as a prop so the camera tool switcher can mutate `mouseButtons` outside the canvas:

```typescript
// ThreeViewer creates the ref:
const controlsRef = useRef<any>(null);

// Scene receives it as a prop instead of creating it:
function Scene({ ..., controlsRef, wallHeight, eraserActive, deleteElement }: {
  ...;
  controlsRef: React.RefObject<any>;
  wallHeight: number;
  eraserActive: boolean;
  deleteElement: (id: string) => void;
}) { ... }
```

`OrbitControls` inside `Scene` receives the active-tool gate:

```typescript
<OrbitControls
  ref={controlsRef}
  enableDamping
  dampingFactor={0.08}
  minDistance={40}
  maxDistance={1800}
  maxPolarAngle={Math.PI / 2.02}
  target={orbitTarget}
  enableRotate={!eraserActive && activeTool !== "measure"}
  enablePan={activeTool !== "measure"}
/>
```

Pass `activeTool` into `Scene` (or just pass the two booleans).

#### 2j. `ThreeViewer` — main state + toolbar + overlay panels

**New state:**
```typescript
const [activeTool, setActiveTool] = useState<
  "select" | "orbit" | "pan" | "zoom" | "measure" | "pushpull" | "eraser"
>("select");
const [wallHeight, setWallHeight] = useState(34);
const [measurePoints, setMeasurePoints] = useState<[THREE.Vector3, THREE.Vector3 | null]>([
  new THREE.Vector3(), null
]);
const [measuringStep, setMeasuringStep] = useState<0 | 1>(0);
const controlsRef = useRef<any>(null);
```

**Camera tool effect** — update `OrbitControls` mouse bindings when camera tool changes:
```typescript
useEffect(() => {
  if (!controlsRef.current) return;
  if (activeTool === "pan") {
    controlsRef.current.mouseButtons = {
      LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE,
    };
  } else if (activeTool === "zoom") {
    controlsRef.current.mouseButtons = {
      LEFT: THREE.MOUSE.DOLLY, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE,
    };
  } else {
    // orbit (default) and all other tools — restore default
    controlsRef.current.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN,
    };
  }
}, [activeTool]);
```

**Tape Measure click handler** (passed into `Scene` as a prop, called from an invisible floor plane mesh):
```typescript
const handleMeasureClick = useCallback((worldPos: THREE.Vector3) => {
  if (measuringStep === 0) {
    setMeasurePoints([worldPos.clone(), null]);
    setMeasuringStep(1);
  } else {
    setMeasurePoints((prev) => [prev[0], worldPos.clone()]);
    setMeasuringStep(0); // ready to start new measurement on next click
  }
}, [measuringStep]);
```

**Toolbar JSX** (HTML overlay, outside `<Canvas>`):
```tsx
const TOOLS = [
  { id: "select",   icon: "↖",  label: "Select" },
  { id: "orbit",    icon: "⟳",  label: "Orbit" },
  { id: "pan",      icon: "✥",  label: "Pan" },
  { id: "zoom",     icon: "⊕",  label: "Zoom" },
  null, // divider
  { id: "measure",  icon: "📐", label: "Tape Measure" },
  { id: "pushpull", icon: "⬆",  label: "Push/Pull" },
  { id: "eraser",   icon: "◻",  label: "Eraser" },
] as const;

// Rendered as absolute left-side panel, outside <Canvas>
<div className="absolute left-4 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-1 p-1.5 bg-white/80 dark:bg-slate-900/80 backdrop-blur rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg">
  {TOOLS.map((t, i) =>
    t === null ? (
      <div key={`div-${i}`} className="w-full h-px bg-slate-200 dark:bg-slate-700 my-0.5" />
    ) : (
      <button
        key={t.id}
        title={t.label}
        onClick={() => setActiveTool(t.id)}
        className={`w-8 h-8 rounded flex items-center justify-center text-sm transition-all ${
          activeTool === t.id
            ? "bg-cyan-500 text-white shadow-[0_0_8px_rgba(34,211,238,0.4)]"
            : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-cyan-400"
        }`}
      >
        {t.icon}
      </button>
    )
  )}
</div>
```

**Push/Pull slider** (bottom-center overlay, shown only when `activeTool === "pushpull"`):
```tsx
{activeTool === "pushpull" && (
  <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-4 py-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur rounded-full border border-slate-200 dark:border-slate-700 shadow-lg">
    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Wall H</span>
    <input
      type="range" min={10} max={120} step={1}
      value={wallHeight}
      onChange={(e) => setWallHeight(parseInt(e.target.value))}
      className="w-36"
    />
    <span className="text-[11px] font-mono text-cyan-400 w-8">{wallHeight}</span>
  </div>
)}
```

#### 2k. Tape Measure in-scene implementation (inside `Scene`)

Add an invisible floor plane mesh active only when `activeTool === "measure"`. Use `<Html>` from drei for the distance badge:

```tsx
// Inside Scene, when measure tool is active:
{activeTool === "measure" && (
  <mesh
    rotation={[-Math.PI / 2, 0, 0]}
    position={[500, 0.1, 350]}
    onClick={(e) => { e.stopPropagation(); onMeasureClick(e.point); }}
  >
    <planeGeometry args={[4000, 4000]} />
    <meshStandardMaterial transparent opacity={0} />
  </mesh>
)}

{/* Dashed measurement line */}
{measurePoints[1] && (
  <>
    <Line
      points={[measurePoints[0].toArray(), measurePoints[1].toArray()]}
      color="#ef4444"
      lineWidth={2}
      dashed
      dashSize={8}
      gapSize={4}
    />
    <Html
      position={[
        (measurePoints[0].x + measurePoints[1].x) / 2,
        4,
        (measurePoints[0].z + measurePoints[1].z) / 2,
      ]}
      center
    >
      <div className="bg-slate-900/90 text-cyan-400 text-[11px] font-mono font-bold px-2 py-1 rounded shadow-lg border border-cyan-500/30 pointer-events-none whitespace-nowrap">
        {(measurePoints[0].distanceTo(measurePoints[1]) / 100).toFixed(2)} m
      </div>
    </Html>
  </>
)}
```

Pass `onMeasureClick`, `measurePoints`, and `activeTool` from `ThreeViewer` into `Scene`.

---

## Prop / Data Flow Summary

```
ThreeViewer
  ├── controlsRef (useRef)          — moved up from Scene
  ├── activeTool (useState)
  ├── wallHeight (useState, default 34)
  ├── measurePoints (useState)
  ├── measuringStep (useState)
  ├── deleteElement (from useDrawingStore)
  │
  ├── <Toolbar /> HTML overlay — reads activeTool, calls setActiveTool
  ├── <PushPullSlider /> HTML overlay — reads wallHeight, calls setWallHeight
  │
  └── <Canvas>
        └── <Scene controlsRef wallHeight activeTool eraserActive measurePoints onMeasureClick deleteElement>
              ├── <CameraController wallHeight />
              ├── <OrbitControls ref={controlsRef} enableRotate={!pointerToolActive} enablePan={!measureActive} />
              └── <PlanModel wallHeight eraserActive deleteElement>
                    ├── <DynamicWall wallHeight eraserActive onErase />
                    ├── <RoomMesh wallHeight eraserActive onErase />
                    ├── <DoorMesh wallHeight eraserActive onErase />
                    └── <FlatElementMesh eraserActive onErase />
```

---

## Eraser Scope (v1)

| Entity | Backed by | Erasable? | Action |
|---|---|---|---|
| block / rect / circle / line (loose) | `elements` | ✅ | `deleteElement(el.id)` |
| door / window (element, `archType`) | `elements` | ✅ | `deleteElement(el.id)` |
| wall (element, `archType === "wall"`) | `elements` | ✅ | `deleteElement(el.id)` |
| arch-plan walls / openings / rooms | `currentArchitecturalPlan` | ❌ v1 | hover red + cursor, no delete, show tooltip |

For plan-backed entities, pass `onErase={undefined}` to the mesh component. The hover highlight still works — only the click action is suppressed.

---

## Verification Plan

### Automated
```bash
cd frontend && npx tsc --noEmit
```
Zero errors (excluding the known `StoreOrderPage.tsx:493` pre-existing error).

### Manual
1. Open editor → click **3D View** in the top toolbar.
2. **Toolbar**: Verify the 7-button vertical toolbar renders on the left side of the 3D viewport with divider.
3. **Pan tool**: Click Pan, left-drag → camera pans, does not orbit. Switch back to Orbit → left-drag orbits.
4. **Zoom tool**: Click Zoom, left-drag → camera dollies in/out.
5. **Push/Pull**: Click Push/Pull → bottom slider appears. Drag it from 34 to 80 → walls visibly grow taller in real time.
6. **Tape Measure**: Click Tape Measure. Click point A on the floor grid → red dot. Click point B → dashed red line and distance badge in meters appear at midpoint.
7. **Tape Measure (orbit guard)**: While Tape Measure is active, left-drag → camera does NOT orbit (controls suppressed).
8. **Eraser (element)**: Draw a rectangle in 2D, switch to 3D. Click Eraser. Hover over the flat rectangle mesh → turns red. Click it → mesh disappears and element is removed from the 2D canvas too.
9. **Eraser (arch-plan wall)**: Hover over an AI-generated wall → turns red (hover works). Click it → nothing deleted (no crash, no deletion of unrelated data).
10. **Undo**: After erasing an element, press Ctrl+Z in 2D canvas → element reappears (single history entry).
