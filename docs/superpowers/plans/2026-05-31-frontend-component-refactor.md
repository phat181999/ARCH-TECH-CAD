# Frontend Component Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split every file over 400 lines into single-responsibility modules — parent components, child components, interfaces, constants, and helpers each in their own file.

**Architecture:** Feature-folder layout per major component (e.g. `canvas/3d/`, `components/CadSidebar/`, `pages/CanvasEditor/`). Each folder owns its types, helpers, child components, and hooks. Parent files become thin orchestrators only.

**Tech Stack:** React 19, TypeScript, Zustand, Three.js / React-Three-Fiber, Tailwind CSS, Vite.

---

## Target File Map

| Before | After (new files) | Lines saved |
|---|---|---|
| `components/ThreeViewer.tsx` (2180) | 13 files under `canvas/3d/` | ~1900 |
| `pages/CanvasEditor.tsx` (2452) | 6 extraction files + thin parent | ~1200 |
| `canvas/CadEngine.ts` (1276) | 6 renderer files + orchestrator | ~1000 |
| `components/CadSidebar.tsx` (846) | 6 section files + thin parent | ~550 |
| `stores/drawingStore.ts` (1204) | 8 slice files + composed store | ~900 |

**Verify after every task:** `cd autocard/frontend && npx tsc --noEmit`

---

## PHASE 1 — ThreeViewer split into `canvas/3d/`

### Task 1: 3D types + geometry helpers

**Files:**
- Create: `src/canvas/3d/types.ts`
- Create: `src/canvas/3d/geometry/planClassification.ts`
- Create: `src/canvas/3d/geometry/wallGeometry.ts`

- [ ] **Step 1: Create `src/canvas/3d/types.ts`**

```typescript
// src/canvas/3d/types.ts
import type * as THREE from "three";

export type ViewAngle = "perspective" | "top" | "front" | "back" | "left" | "right" | null;

export interface WallSegment {
  id?: string;
  centerX: number;
  centerZ: number;
  width: number;
  depth: number;
}

export interface Bounds {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}

export interface DrawingState {
  plane: THREE.Plane;
  basisMatrix: THREE.Matrix4;
  normal: THREE.Vector3;
  u: THREE.Vector3;
  v: THREE.Vector3;
  origin: THREE.Vector3;
  points2D: THREE.Vector2[];
  points3D: THREE.Vector3[];
}

export interface ClosedShapeState {
  points2D: THREE.Vector2[];
  basisMatrix: THREE.Matrix4;
  normal: THREE.Vector3;
  origin: THREE.Vector3;
}

export type ShapeWithDepth = ClosedShapeState & { depth: number; id: string };

export interface HousePlan {
  shell: import("../../types").DrawingElement | null;
  rooms: import("../../types").DrawingElement[];
  doors: import("../../types").DrawingElement[];
  windows: import("../../types").DrawingElement[];
  walls: import("../../types").DrawingElement[];
  loose: import("../../types").DrawingElement[];
}
```

- [ ] **Step 2: Create `src/canvas/3d/geometry/planClassification.ts`**

Copy exactly from ThreeViewer.tsx — the four functions `isRectangle`, `labelOf`, `classifyPlan`, `getPlanBounds`:

```typescript
// src/canvas/3d/geometry/planClassification.ts
import type { DrawingElement, ArchitecturalPlan } from "../../../types";
import type { Bounds, HousePlan } from "../types";

export function isRectangle(
  el: DrawingElement,
): el is DrawingElement & { x: number; y: number; width: number; height: number } {
  return (
    el.type === "rectangle" &&
    typeof el.x === "number" &&
    typeof el.y === "number" &&
    typeof el.width === "number" &&
    typeof el.height === "number"
  );
}

export function labelOf(el: DrawingElement): string {
  return typeof el.label === "string" ? el.label.toLowerCase() : "";
}

export function classifyPlan(elements: DrawingElement[]): HousePlan {
  const shell =
    elements.find(
      (el) => isRectangle(el) && (el.archType === "meta" || labelOf(el).startsWith("house")),
    ) ?? null;

  return elements.reduce<HousePlan>(
    (acc, el) => {
      if (shell && el.id === shell.id) return acc;
      if (el.archType === "wall" && (el.type === "line" || el.type === "polyline")) {
        acc.walls.push(el);
        return acc;
      }
      if (el.archType === "door") { acc.doors.push(el); return acc; }
      if (el.archType === "window") { acc.windows.push(el); return acc; }
      const label = labelOf(el);
      if (
        (el.archType === "room" && (el.type === "text" || el.type === "hatch")) ||
        (isRectangle(el) &&
          (label.includes("bedroom") || label.includes("room") ||
           label.includes("kitchen") || label.includes("bath")))
      ) {
        acc.rooms.push(el);
        return acc;
      }
      acc.loose.push(el);
      return acc;
    },
    { shell, rooms: [], doors: [], windows: [], walls: [], loose: [] },
  );
}

export function getPlanBounds(elements: DrawingElement[]): Bounds | null {
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (const el of elements) {
    if (isRectangle(el)) {
      minX = Math.min(minX, el.x); minZ = Math.min(minZ, el.y);
      maxX = Math.max(maxX, el.x + el.width); maxZ = Math.max(maxZ, el.y + el.height);
      continue;
    }
    if (el.type === "circle" && typeof el.cx === "number" && typeof el.cy === "number" && typeof el.radius === "number") {
      minX = Math.min(minX, el.cx - el.radius); minZ = Math.min(minZ, el.cy - el.radius);
      maxX = Math.max(maxX, el.cx + el.radius); maxZ = Math.max(maxZ, el.cy + el.radius);
      continue;
    }
    if (el.type === "line" && typeof el.x1 === "number" && typeof el.y1 === "number" &&
        typeof el.x2 === "number" && typeof el.y2 === "number") {
      minX = Math.min(minX, el.x1, el.x2); minZ = Math.min(minZ, el.y1, el.y2);
      maxX = Math.max(maxX, el.x1, el.x2); maxZ = Math.max(maxZ, el.y1, el.y2);
    }
  }
  if (!Number.isFinite(minX)) return null;
  return { minX, minZ, maxX, maxZ };
}

export function roomBoundsFromBoundary(
  room: ArchitecturalPlan["rooms"][number],
): { x: number; y: number; width: number; height: number } | null {
  if (!room.boundary.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  room.boundary.forEach((p) => {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  });
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
```

- [ ] **Step 3: Create `src/canvas/3d/geometry/wallGeometry.ts`**

```typescript
// src/canvas/3d/geometry/wallGeometry.ts
import type { DrawingElement, ArchitecturalPlan } from "../../../types";
import type { WallSegment } from "../types";
import { isRectangle } from "./planClassification";

export const WALL_THICKNESS = 6;
export const FLOOR_THICKNESS = 1.5;

export function buildOuterWalls(
  shell: DrawingElement & { x: number; y: number; width: number; height: number },
  doors: DrawingElement[],
): WallSegment[] {
  const left = shell.x, right = shell.x + shell.width;
  const top = shell.y, bottom = shell.y + shell.height;
  const bottomDoors = doors
    .filter(isRectangle)
    .filter((d) => Math.abs((d.y ?? 0) - bottom) <= WALL_THICKNESS * 2)
    .sort((a, b) => (a.x ?? 0) - (b.x ?? 0));
  const segments: WallSegment[] = [
    { id: `${shell.id}-w-left`, centerX: left, centerZ: top + shell.height / 2, width: WALL_THICKNESS, depth: shell.height },
    { id: `${shell.id}-w-right`, centerX: right, centerZ: top + shell.height / 2, width: WALL_THICKNESS, depth: shell.height },
    { id: `${shell.id}-w-top`, centerX: left + shell.width / 2, centerZ: top, width: shell.width, depth: WALL_THICKNESS },
  ];
  let cursor = left;
  for (const door of bottomDoors) {
    const doorX = door.x ?? cursor, doorWidth = door.width ?? 0;
    const leftWidth = Math.max(0, doorX - cursor);
    if (leftWidth > 0) {
      segments.push({ id: `${shell.id}-w-bottom-left-${cursor}`, centerX: cursor + leftWidth / 2, centerZ: bottom, width: leftWidth, depth: WALL_THICKNESS });
    }
    cursor = doorX + doorWidth;
  }
  const trailingWidth = Math.max(0, right - cursor);
  if (trailingWidth > 0) {
    segments.push({ id: `${shell.id}-w-bottom-right`, centerX: cursor + trailingWidth / 2, centerZ: bottom, width: trailingWidth, depth: WALL_THICKNESS });
  }
  return segments;
}

export function buildWallSegmentsFromSemanticWalls(walls: DrawingElement[]): WallSegment[] {
  const segments: WallSegment[] = [];
  for (const wall of walls) {
    const thickness = typeof wall.wallThickness === "number" ? Math.max(4, wall.wallThickness * 0.18) : WALL_THICKNESS;
    if (wall.type === "line" && typeof wall.x1 === "number" && typeof wall.y1 === "number" && typeof wall.x2 === "number" && typeof wall.y2 === "number") {
      const dx = (wall.x2 ?? 0) - (wall.x1 ?? 0), dy = (wall.y2 ?? 0) - (wall.y1 ?? 0);
      const length = Math.hypot(dx, dy);
      const cx = ((wall.x1 ?? 0) + (wall.x2 ?? 0)) / 2, cz = ((wall.y1 ?? 0) + (wall.y2 ?? 0)) / 2;
      segments.push(Math.abs(dx) >= Math.abs(dy)
        ? { id: wall.id, centerX: cx, centerZ: cz, width: Math.max(length, 1), depth: thickness }
        : { id: wall.id, centerX: cx, centerZ: cz, width: thickness, depth: Math.max(length, 1) });
      continue;
    }
    if (wall.type === "polyline" && Array.isArray(wall.points) && wall.points.length >= 2) {
      const pts = wall.points as { x: number; y: number }[];
      for (let i = 0; i < pts.length - 1; i++) {
        const p1 = pts[i], p2 = pts[i + 1];
        const dx = p2.x - p1.x, dy = p2.y - p1.y, len = Math.hypot(dx, dy);
        if (len < 1) continue;
        const cx = (p1.x + p2.x) / 2, cz = (p1.y + p2.y) / 2;
        segments.push(Math.abs(dx) >= Math.abs(dy)
          ? { id: `${wall.id}-seg-${i}`, centerX: cx, centerZ: cz, width: Math.max(len, 1), depth: thickness }
          : { id: `${wall.id}-seg-${i}`, centerX: cx, centerZ: cz, width: thickness, depth: Math.max(len, 1) });
      }
    }
  }
  return segments;
}

export function wallSegmentsFromPlan(plan: ArchitecturalPlan): WallSegment[] {
  return (plan.walls || []).map((wall) => {
    const dx = wall.x2 - wall.x1, dy = wall.y2 - wall.y1;
    const length = Math.hypot(dx, dy), thickness = Math.max(4, wall.thickness * 0.18);
    return Math.abs(dx) >= Math.abs(dy)
      ? { id: wall.id, centerX: (wall.x1 + wall.x2) / 2, centerZ: (wall.y1 + wall.y2) / 2, width: Math.max(length, 1), depth: thickness }
      : { id: wall.id, centerX: (wall.x1 + wall.x2) / 2, centerZ: (wall.y1 + wall.y2) / 2, width: thickness, depth: Math.max(length, 1) };
  });
}
```

- [ ] **Step 4: Type-check**

```bash
cd autocard/frontend && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add autocard/frontend/src/canvas/3d/
git commit -m "refactor: extract 3D types, plan classification, and wall geometry helpers"
```

---

### Task 2: Mesh sub-components — walls, rooms, roof

**Files:**
- Create: `src/canvas/3d/components/WallMesh.tsx`
- Create: `src/canvas/3d/components/RoomMesh.tsx`
- Create: `src/canvas/3d/components/RoofMesh.tsx`
- Create: `src/canvas/3d/components/DoorMesh.tsx`

- [ ] **Step 1: Create `src/canvas/3d/components/WallMesh.tsx`**

Move `DynamicWall` from ThreeViewer.tsx verbatim:

```tsx
// src/canvas/3d/components/WallMesh.tsx
import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Edges } from "@react-three/drei";
import * as THREE from "three";
import type { WallSegment } from "../types";

interface WallMeshProps {
  segment: WallSegment;
  color: string;
  wallHeight: number;
  activeTool?: string;
  onElementClick?: (id: string) => void;
}

export function WallMesh({ segment, color, wallHeight, activeTool, onElementClick }: WallMeshProps) {
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const [hovered, setHovered] = useState(false);

  useFrame(({ camera }) => {
    if (!materialRef.current) return;
    const dist = camera.position.distanceTo(new THREE.Vector3(segment.centerX, wallHeight / 2, segment.centerZ));
    let opacity = 1;
    if (dist < 800) {
      opacity = dist < 300 ? 0.15 : 0.15 + 0.85 * ((dist - 300) / 500);
    }
    materialRef.current.transparent = opacity < 1 || (hovered && activeTool === "eraser");
    materialRef.current.opacity = hovered && activeTool === "eraser" ? 0.9 : opacity;
    materialRef.current.needsUpdate = true;
  });

  return (
    <mesh
      position={[segment.centerX, wallHeight / 2, segment.centerZ]}
      receiveShadow
      castShadow
      onPointerOver={(e) => { if (activeTool === "eraser") { e.stopPropagation(); setHovered(true); } }}
      onPointerOut={() => setHovered(false)}
      onClick={(e) => { if (activeTool === "eraser" && segment.id) { e.stopPropagation(); onElementClick?.(segment.id); } }}
    >
      <boxGeometry args={[segment.width, wallHeight, segment.depth]} />
      <meshStandardMaterial ref={materialRef} color={hovered && activeTool === "eraser" ? "#ef4444" : color} />
      <Edges color="#3a4a5a" threshold={12} />
    </mesh>
  );
}
```

- [ ] **Step 2: Create `src/canvas/3d/components/RoomMesh.tsx`**

```tsx
// src/canvas/3d/components/RoomMesh.tsx
import { useState } from "react";
import { Edges } from "@react-three/drei";
import type { DrawingElement } from "../../../types";
import { isRectangle } from "../geometry/planClassification";

interface RoomMeshProps {
  room: DrawingElement;
  activeTool?: string;
  onElementClick?: (id: string) => void;
}

export function RoomMesh({ room, activeTool, onElementClick }: RoomMeshProps) {
  const [hovered, setHovered] = useState(false);
  const over = (e: any) => { if (activeTool === "eraser") { e.stopPropagation(); setHovered(true); } };
  const out = () => setHovered(false);
  const click = (e: any) => { if (activeTool === "eraser") { e.stopPropagation(); onElementClick?.(room.id); } };

  if (room.type === "text" && typeof room.x === "number" && typeof room.y === "number") {
    return (
      <mesh position={[room.x, 0.8, room.y]}>
        <boxGeometry args={[18, 0.5, 8]} />
        <meshStandardMaterial color="#cbd5e1" transparent opacity={0.2} />
      </mesh>
    );
  }
  if (!isRectangle(room)) return null;
  const c = hovered && activeTool === "eraser" ? "#ef4444" : "#dbe4ea";
  return (
    <group>
      <mesh position={[room.x + room.width / 2, 0.3, room.y + room.height / 2]} receiveShadow onPointerOver={over} onPointerOut={out} onClick={click}>
        <boxGeometry args={[room.width, 0.2, room.height]} />
        <meshStandardMaterial color={c} transparent opacity={0.95} />
        <Edges color="#5a7a9a" threshold={12} />
      </mesh>
      <mesh position={[room.x + room.width / 2, 10, room.y + room.height / 2]} castShadow receiveShadow onPointerOver={over} onPointerOut={out} onClick={click}>
        <boxGeometry args={[room.width, 20, room.height]} />
        <meshStandardMaterial color={hovered && activeTool === "eraser" ? "#ef4444" : "#eef2f6"} transparent opacity={0.2} />
      </mesh>
    </group>
  );
}
```

- [ ] **Step 3: Create `src/canvas/3d/components/RoofMesh.tsx`**

```tsx
// src/canvas/3d/components/RoofMesh.tsx
import { useMemo } from "react";
import { Edges } from "@react-three/drei";
import * as THREE from "three";

interface RoofMeshProps { x: number; z: number; width: number; depth: number; wallHeight: number; }

export function RoofMesh({ x, z, width, depth, wallHeight }: RoofMeshProps) {
  const ridgeH = Math.max(wallHeight * 0.55, 20);
  const isWide = width >= depth;
  const geometry = useMemo(() => {
    const wh = wallHeight, rh = ridgeH;
    const A = [x, wh, z], B = [x + width, wh, z], C = [x + width, wh, z + depth], D = [x, wh, z + depth];
    let E: number[], F: number[], verts: number[];
    if (isWide) {
      E = [x, wh + rh, z + depth / 2]; F = [x + width, wh + rh, z + depth / 2];
      verts = [...A, ...B, ...F, ...A, ...F, ...E, ...D, ...E, ...F, ...D, ...F, ...C, ...A, ...E, ...D, ...B, ...C, ...F];
    } else {
      E = [x + width / 2, wh + rh, z]; F = [x + width / 2, wh + rh, z + depth];
      verts = [...A, ...D, ...F, ...A, ...F, ...E, ...B, ...F, ...C, ...B, ...E, ...F, ...A, ...B, ...E, ...D, ...F, ...C];
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(verts), 3));
    geo.computeVertexNormals();
    return geo;
  }, [x, z, width, depth, wallHeight, ridgeH, isWide]);
  return (
    <mesh geometry={geometry} castShadow>
      <meshStandardMaterial color="#7a98b0" side={THREE.DoubleSide} />
      <Edges color="#3a4a5a" threshold={10} />
    </mesh>
  );
}
```

- [ ] **Step 4: Create `src/canvas/3d/components/DoorMesh.tsx`**

```tsx
// src/canvas/3d/components/DoorMesh.tsx
import { useState } from "react";
import type { DrawingElement } from "../../../types";
import { isRectangle } from "../geometry/planClassification";
import { WALL_THICKNESS } from "../geometry/wallGeometry";

interface DoorMeshProps { door: DrawingElement; activeTool?: string; onElementClick?: (id: string) => void; }

export function DoorMesh({ door, activeTool, onElementClick }: DoorMeshProps) {
  const [hovered, setHovered] = useState(false);
  const over = (e: any) => { if (activeTool === "eraser") { e.stopPropagation(); setHovered(true); } };
  const out = () => setHovered(false);
  const click = (e: any) => { if (activeTool === "eraser") { e.stopPropagation(); onElementClick?.(door.id); } };
  const c = hovered && activeTool === "eraser" ? "#ef4444" : "#89c2d9";
  if (door.type === "arc" && typeof door.cx === "number" && typeof door.cy === "number" && typeof door.radius === "number") {
    return (
      <mesh position={[door.cx + door.radius / 2, 10, door.cy - door.radius / 2]} castShadow onPointerOver={over} onPointerOut={out} onClick={click}>
        <boxGeometry args={[Math.max(door.radius, 4), 20, 2]} />
        <meshStandardMaterial color={c} transparent opacity={0.35} />
      </mesh>
    );
  }
  if (!isRectangle(door)) return null;
  return (
    <mesh position={[door.x + door.width / 2, 10, door.y + WALL_THICKNESS / 2]} castShadow onPointerOver={over} onPointerOut={out} onClick={click}>
      <boxGeometry args={[door.width, 20, Math.max(2, door.height)]} />
      <meshStandardMaterial color={c} transparent opacity={0.35} />
    </mesh>
  );
}
```

- [ ] **Step 5: Create barrel `src/canvas/3d/components/index.ts`**

```typescript
// src/canvas/3d/components/index.ts
export { WallMesh } from "./WallMesh";
export { RoomMesh } from "./RoomMesh";
export { RoofMesh } from "./RoofMesh";
export { DoorMesh } from "./DoorMesh";
```

- [ ] **Step 6: Type-check**

```bash
cd autocard/frontend && npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add autocard/frontend/src/canvas/3d/components/
git commit -m "refactor: extract 3D mesh sub-components (Wall, Room, Roof, Door)"
```

---

### Task 3: Element mesh components

**Files:**
- Create: `src/canvas/3d/components/BlockElementMesh.tsx`
- Create: `src/canvas/3d/components/FlatElementMesh.tsx`
- Create: `src/canvas/3d/components/LineMeshes.tsx`

- [ ] **Step 1: Create `src/canvas/3d/components/BlockElementMesh.tsx`**

```tsx
// src/canvas/3d/components/BlockElementMesh.tsx
import { Edges } from "@react-three/drei";
import type { DrawingElement } from "../../../types";
import { isRectangle } from "../geometry/planClassification";

interface Props { el: DrawingElement; blockType: string; hovered?: boolean; activeTool?: string; }

export function BlockElementMesh({ el, blockType, hovered, activeTool }: Props) {
  const color = typeof el.strokeColor === "string" ? el.strokeColor : "#1f2937";
  const fillColor = typeof el.fillColor === "string" && el.fillColor !== "transparent" ? el.fillColor : null;
  const displayColor = hovered && activeTool === "eraser" ? "#ef4444" : (fillColor || color);
  const isStructural = blockType === "door" || blockType === "window" || blockType === "car";
  const boxHeight = blockType === "door" ? 20 : blockType === "window" ? 10 : blockType === "car" ? 18 : 3;
  const discHeight = 0.8;

  if (isRectangle(el)) {
    return (
      <mesh position={[el.x + el.width / 2, boxHeight / 2, el.y + el.height / 2]} receiveShadow castShadow>
        <boxGeometry args={[el.width, boxHeight, el.height]} />
        <meshStandardMaterial color={displayColor} transparent opacity={fillColor ? 0.95 : 0.65} wireframe={!fillColor && !isStructural} />
        <Edges color="#3a4a5a" threshold={12} />
      </mesh>
    );
  }
  if (el.type === "circle" && typeof el.cx === "number" && typeof el.cy === "number" && typeof el.radius === "number") {
    return (
      <mesh position={[el.cx, discHeight / 2, el.cy]} receiveShadow castShadow>
        <cylinderGeometry args={[el.radius, el.radius, discHeight, 48]} />
        <meshStandardMaterial color={displayColor} transparent opacity={fillColor ? 0.92 : 0.6} />
        <Edges color="#2a3a4a" threshold={12} />
      </mesh>
    );
  }
  return null;
}
```

- [ ] **Step 2: Create `src/canvas/3d/components/LineMeshes.tsx`**

Extract `LineMesh3D`, `PolylineMesh3D`, `ArcMesh3D`, `RectOutline3D`, `CircleOutline3D` verbatim from ThreeViewer.tsx:

```tsx
// src/canvas/3d/components/LineMeshes.tsx
import { useMemo } from "react";
import * as THREE from "three";
import type { DrawingElement } from "../../../types";

type EventProps = {
  hovered: boolean;
  activeTool?: string;
  onPointerOver: (e: any) => void;
  onPointerOut: () => void;
  onClick: (e: any) => void;
};

export function LineMesh3D({ el, color, ...evts }: { el: DrawingElement; color: string } & EventProps) {
  const lineObj = useMemo(() => {
    if (typeof el.x1 !== "number" || typeof el.y1 !== "number" || typeof el.x2 !== "number" || typeof el.y2 !== "number") return null;
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(el.x1, 0.2, el.y1), new THREE.Vector3(el.x2, 0.2, el.y2)]);
    const mat = new THREE.LineBasicMaterial({ color: evts.hovered && evts.activeTool === "eraser" ? "#ef4444" : color });
    return new THREE.Line(geo, mat);
  }, [el.x1, el.y1, el.x2, el.y2, color, evts.hovered, evts.activeTool]);
  if (!lineObj) return null;
  return <group onPointerOver={evts.onPointerOver} onPointerOut={evts.onPointerOut} onClick={evts.onClick}><primitive object={lineObj} /></group>;
}

export function PolylineMesh3D({ el, color, ...evts }: { el: DrawingElement; color: string } & EventProps) {
  const lineObj = useMemo(() => {
    if (!Array.isArray(el.points) || el.points.length < 2) return null;
    const pts = (el.points as { x: number; y: number }[]).map(p => new THREE.Vector3(p.x, 0.2, p.y));
    if (el.closed) pts.push(pts[0].clone());
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: evts.hovered && evts.activeTool === "eraser" ? "#ef4444" : color });
    return new THREE.Line(geo, mat);
  }, [el.points, el.closed, color, evts.hovered, evts.activeTool]);
  if (!lineObj) return null;
  return <group onPointerOver={evts.onPointerOver} onPointerOut={evts.onPointerOut} onClick={evts.onClick}><primitive object={lineObj} /></group>;
}

export function ArcMesh3D({ el, color, ...evts }: { el: DrawingElement; color: string } & EventProps) {
  const lineObj = useMemo(() => {
    if (typeof el.cx !== "number" || typeof el.cy !== "number" || typeof el.radius !== "number") return null;
    const sa = ((el.startAngle ?? 0) * Math.PI) / 180;
    const ea = ((el.endAngle ?? 360) * Math.PI) / 180;
    const steps = 48;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= steps; i++) {
      const a = sa + (ea - sa) * (i / steps);
      pts.push(new THREE.Vector3(el.cx + el.radius * Math.cos(a), 0.2, el.cy + el.radius * Math.sin(a)));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: evts.hovered && evts.activeTool === "eraser" ? "#ef4444" : color });
    return new THREE.Line(geo, mat);
  }, [el.cx, el.cy, el.radius, el.startAngle, el.endAngle, color, evts.hovered, evts.activeTool]);
  if (!lineObj) return null;
  return <group onPointerOver={evts.onPointerOver} onPointerOut={evts.onPointerOut} onClick={evts.onClick}><primitive object={lineObj} /></group>;
}

export function RectOutline3D({ el, color, ...evts }: { el: DrawingElement; color: string } & EventProps) {
  const lineObj = useMemo(() => {
    if (typeof el.x !== "number" || typeof el.y !== "number" || typeof el.width !== "number" || typeof el.height !== "number") return null;
    const { x, y, width: w, height: h } = el as any;
    const pts = [
      new THREE.Vector3(x, 0.2, y), new THREE.Vector3(x + w, 0.2, y),
      new THREE.Vector3(x + w, 0.2, y + h), new THREE.Vector3(x, 0.2, y + h),
      new THREE.Vector3(x, 0.2, y),
    ];
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: evts.hovered && evts.activeTool === "eraser" ? "#ef4444" : color });
    return new THREE.Line(geo, mat);
  }, [el.x, el.y, (el as any).width, (el as any).height, color, evts.hovered, evts.activeTool]);
  if (!lineObj) return null;
  return <group onPointerOver={evts.onPointerOver} onPointerOut={evts.onPointerOut} onClick={evts.onClick}><primitive object={lineObj} /></group>;
}

export function CircleOutline3D({ el, color, ...evts }: { el: DrawingElement; color: string } & EventProps) {
  const lineObj = useMemo(() => {
    if (typeof el.cx !== "number" || typeof el.cy !== "number" || typeof el.radius !== "number") return null;
    const steps = 64;
    const pts = Array.from({ length: steps + 1 }, (_, i) => {
      const a = (i / steps) * Math.PI * 2;
      return new THREE.Vector3(el.cx! + el.radius! * Math.cos(a), 0.2, el.cy! + el.radius! * Math.sin(a));
    });
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: evts.hovered && evts.activeTool === "eraser" ? "#ef4444" : color });
    return new THREE.Line(geo, mat);
  }, [el.cx, el.cy, el.radius, color, evts.hovered, evts.activeTool]);
  if (!lineObj) return null;
  return <group onPointerOver={evts.onPointerOver} onPointerOut={evts.onPointerOut} onClick={evts.onClick}><primitive object={lineObj} /></group>;
}
```

- [ ] **Step 3: Create `src/canvas/3d/components/FlatElementMesh.tsx`**

Move `FlatElementMesh` from ThreeViewer.tsx, importing from local files:

```tsx
// src/canvas/3d/components/FlatElementMesh.tsx
import { useState } from "react";
import type { DrawingElement } from "../../../types";
import { isRectangle } from "../geometry/planClassification";
import { BlockElementMesh } from "./BlockElementMesh";
import { LineMesh3D, PolylineMesh3D, ArcMesh3D, RectOutline3D, CircleOutline3D } from "./LineMeshes";

interface Props {
  el: DrawingElement;
  blockDefs?: Record<string, any>;
  activeTool?: string;
  onElementClick?: (id: string) => void;
}

export function FlatElementMesh({ el, blockDefs, activeTool, onElementClick }: Props) {
  const [hovered, setHovered] = useState(false);
  const over = (e: any) => { if (activeTool === "eraser") { e.stopPropagation(); setHovered(true); } };
  const out = () => setHovered(false);
  const click = (e: any) => { if (activeTool === "eraser") { e.stopPropagation(); onElementClick?.(el.id); } };

  if (el.type === "block" && el.blockId && blockDefs) {
    const def = blockDefs[el.blockId];
    if (!def) return null;
    return (
      <group
        position={[el.x || 0, 0, el.y || 0]}
        scale={[el.scale || 1, 1, el.scale || 1]}
        rotation={[0, -(el.rotation || 0) * Math.PI / 180, 0]}
        onPointerOver={over} onPointerOut={out} onClick={click}
      >
        {def.elements.map((be: DrawingElement) => (
          <BlockElementMesh key={be.id} el={be} blockType={el.blockId!} hovered={hovered} activeTool={activeTool} />
        ))}
      </group>
    );
  }

  const color = typeof el.strokeColor === "string" ? el.strokeColor : "#1f2937";
  const fillColor = typeof el.fillColor === "string" && el.fillColor !== "transparent" ? el.fillColor : null;
  const evtProps = { hovered, activeTool, onPointerOver: over, onPointerOut: out, onClick: click };

  if (el.type === "line") return <LineMesh3D el={el} color={hovered && activeTool === "eraser" ? "#ef4444" : color} {...evtProps} />;
  if (el.type === "polyline" || el.type === "spline") return <PolylineMesh3D el={el} color={hovered && activeTool === "eraser" ? "#ef4444" : color} {...evtProps} />;
  if (el.type === "arc") return <ArcMesh3D el={el} color={hovered && activeTool === "eraser" ? "#ef4444" : color} {...evtProps} />;

  if (isRectangle(el) && !fillColor) return <RectOutline3D el={el} color={hovered && activeTool === "eraser" ? "#ef4444" : color} {...evtProps} />;
  if (isRectangle(el) && fillColor) {
    return (
      <mesh position={[el.x + el.width / 2, 0.15, el.y + el.height / 2]} receiveShadow onPointerOver={over} onPointerOut={out} onClick={click}>
        <boxGeometry args={[el.width, 0.3, el.height]} />
        <meshStandardMaterial color={hovered && activeTool === "eraser" ? "#ef4444" : fillColor} />
      </mesh>
    );
  }
  if (el.type === "circle" && !fillColor) return <CircleOutline3D el={el} color={hovered && activeTool === "eraser" ? "#ef4444" : color} {...evtProps} />;
  if (el.type === "circle" && fillColor && typeof el.cx === "number" && typeof el.cy === "number" && typeof el.radius === "number") {
    return (
      <mesh position={[el.cx, 0.2, el.cy]} receiveShadow onPointerOver={over} onPointerOut={out} onClick={click}>
        <cylinderGeometry args={[el.radius, el.radius, 0.3, 32]} />
        <meshStandardMaterial color={hovered && activeTool === "eraser" ? "#ef4444" : fillColor} />
      </mesh>
    );
  }
  return null;
}
```

- [ ] **Step 4: Update barrel export**

```typescript
// append to src/canvas/3d/components/index.ts
export { BlockElementMesh } from "./BlockElementMesh";
export { FlatElementMesh } from "./FlatElementMesh";
export { LineMesh3D, PolylineMesh3D, ArcMesh3D, RectOutline3D, CircleOutline3D } from "./LineMeshes";
```

- [ ] **Step 5: Type-check + commit**

```bash
cd autocard/frontend && npx tsc --noEmit
git add autocard/frontend/src/canvas/3d/components/
git commit -m "refactor: extract 3D element mesh components (Block, Flat, Lines)"
```

---

### Task 4: 3D controllers

**Files:**
- Create: `src/canvas/3d/controllers/CameraControllers.tsx`
- Create: `src/canvas/3d/controllers/TapeMeasureController.tsx`
- Create: `src/canvas/3d/controllers/DrawOnFaceController.tsx`
- Create: `src/canvas/3d/controllers/PushPullController.tsx`
- Create: `src/canvas/3d/controllers/index.ts`

- [ ] **Step 1: Create `src/canvas/3d/controllers/CameraControllers.tsx`**

Move `AutoFrame` and `CameraController` from ThreeViewer.tsx verbatim, updating the import:

```tsx
// src/canvas/3d/controllers/CameraControllers.tsx
import { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Bounds, ViewAngle } from "../types";

// AutoFrame — snaps camera to element bounds on first load or revision change
export function AutoFrame({ bounds, revisionKey }: { bounds: Bounds | null; revisionKey?: string }) {
  const { camera } = useThree();
  const lastRevision = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!bounds) return;
    if (revisionKey !== undefined && revisionKey === lastRevision.current) return;
    lastRevision.current = revisionKey;
    const centerX = (bounds.minX + bounds.maxX) / 2, centerZ = (bounds.minZ + bounds.maxZ) / 2;
    const span = Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ, 200);
    camera.position.set(centerX + span * 0.9, span * 0.6, centerZ + span * 0.9);
    camera.lookAt(centerX, 10, centerZ);
    camera.updateProjectionMatrix();
  }, [bounds, revisionKey, camera]);
  return null;
}

// CameraController — smooth animated view angle transitions
interface CameraControllerProps {
  bounds: Bounds | null;
  viewAngle: ViewAngle;
  onViewConsumed: () => void;
  controlsRef: React.RefObject<any>;
}

export function CameraController({ bounds, viewAngle, onViewConsumed, controlsRef }: CameraControllerProps) {
  const { camera } = useThree();
  const targetPos = useRef<THREE.Vector3 | null>(null);
  const targetLook = useRef<THREE.Vector3>(new THREE.Vector3(500, 10, 350));
  const consumed = useRef(false);

  useEffect(() => {
    if (!viewAngle) return;
    consumed.current = false;
    const cx = bounds ? (bounds.minX + bounds.maxX) / 2 : 500;
    const cz = bounds ? (bounds.minZ + bounds.maxZ) / 2 : 350;
    const span = bounds ? Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ, 200) : 800;
    targetLook.current.set(cx, 10, cz);
    const D = span * 1.3;
    const views: Record<NonNullable<ViewAngle>, THREE.Vector3> = {
      top: new THREE.Vector3(cx, D, cz + 0.1),
      front: new THREE.Vector3(cx, 10, cz + D),
      back: new THREE.Vector3(cx, 10, cz - D),
      left: new THREE.Vector3(cx - D, 10, cz),
      right: new THREE.Vector3(cx + D, 10, cz),
      perspective: new THREE.Vector3(cx + span * 0.9, span * 0.6, cz + span * 0.9),
    };
    targetPos.current = views[viewAngle];
  }, [viewAngle, bounds]);

  useFrame(() => {
    if (!targetPos.current || consumed.current) return;
    camera.position.lerp(targetPos.current, 0.1);
    if (controlsRef.current) {
      controlsRef.current.target.lerp(targetLook.current, 0.1);
      controlsRef.current.update();
    }
    if (camera.position.distanceTo(targetPos.current) < 2) {
      camera.position.copy(targetPos.current);
      if (controlsRef.current) { controlsRef.current.target.copy(targetLook.current); controlsRef.current.update(); }
      consumed.current = true;
      onViewConsumed();
    }
    camera.lookAt(targetLook.current);
    camera.updateProjectionMatrix();
  });

  useEffect(() => {
    const handle = () => { if (!consumed.current) { consumed.current = true; onViewConsumed(); } };
    window.addEventListener("pointerdown", handle);
    window.addEventListener("wheel", handle);
    return () => { window.removeEventListener("pointerdown", handle); window.removeEventListener("wheel", handle); };
  }, [onViewConsumed]);

  return null;
}
```

- [ ] **Step 2: Move `TapeMeasureController` + `MeasurementLine` to `src/canvas/3d/controllers/TapeMeasureController.tsx`** — copy verbatim from ThreeViewer.tsx, update import to use `useDrawingStore` from `"../../../stores/drawingStore"`.

- [ ] **Step 3: Move `DrawOnFaceController` + `DrawnPolygonShape` to `src/canvas/3d/controllers/DrawOnFaceController.tsx`** — copy verbatim from ThreeViewer.tsx, import types from `"../types"`.

- [ ] **Step 4: Move `PushPullDragController` to `src/canvas/3d/controllers/PushPullController.tsx`** — copy verbatim from ThreeViewer.tsx, import `ShapeWithDepth` from `"../types"`.

- [ ] **Step 5: Create `src/canvas/3d/controllers/index.ts`**

```typescript
export { AutoFrame, CameraController } from "./CameraControllers";
export { TapeMeasureController, MeasurementLine } from "./TapeMeasureController";
export { DrawOnFaceController, DrawnPolygonShape } from "./DrawOnFaceController";
export { PushPullDragController } from "./PushPullController";
```

- [ ] **Step 6: Type-check + commit**

```bash
cd autocard/frontend && npx tsc --noEmit
git add autocard/frontend/src/canvas/3d/controllers/
git commit -m "refactor: extract 3D controllers (camera, measure, draw-on-face, push-pull)"
```

---

### Task 5: Slim down ThreeViewer.tsx

**Files:**
- Modify: `src/components/ThreeViewer.tsx`

Replace all inline function/component bodies with imports from `canvas/3d/`. The remaining ThreeViewer.tsx should only contain:
- `PlanModel` (the arch plan scene builder — references extracted components)
- `Scene` (R3F scene root — GizmoHelper, lights, ground, OrbitControls)
- `ThreeViewer` (default export — Canvas + lazy UI overlays + toolbar)
- All local state in `ThreeViewer` for tool selection, wall height, shapes, viewAngle

- [ ] **Step 1: Replace imports at top of ThreeViewer.tsx**

```tsx
// Replace the old function definitions with these imports:
import { WallMesh, RoomMesh, RoofMesh, DoorMesh, FlatElementMesh } from "../canvas/3d/components";
import { AutoFrame, CameraController, TapeMeasureController, MeasurementLine, DrawOnFaceController, DrawnPolygonShape, PushPullDragController } from "../canvas/3d/controllers";
import { classifyPlan, getPlanBounds, isRectangle, roomBoundsFromBoundary } from "../canvas/3d/geometry/planClassification";
import { buildOuterWalls, buildWallSegmentsFromSemanticWalls, wallSegmentsFromPlan, WALL_THICKNESS, FLOOR_THICKNESS } from "../canvas/3d/geometry/wallGeometry";
import type { WallSegment, Bounds, DrawingState, ClosedShapeState, ShapeWithDepth, ViewAngle, HousePlan } from "../canvas/3d/types";
```

- [ ] **Step 2: Delete all function/component bodies now covered by imports**

Delete from ThreeViewer.tsx: `DynamicWall`, `RoomMesh`, `DoorMesh`, `RoofMesh`, `BlockElementMesh`, `LineMesh3D`, `PolylineMesh3D`, `ArcMesh3D`, `RectOutline3D`, `CircleOutline3D`, `FlatElementMesh`, `AutoFrame`, `CameraController`, `MeasurementLine`, `TapeMeasureController`, `DrawOnFaceController`, `DrawnPolygonShape`, `PushPullDragController`, and all geometry helpers + type definitions.

Rename `DynamicWall` usage in PlanModel to `WallMesh`.

- [ ] **Step 3: Type-check**

```bash
cd autocard/frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add autocard/frontend/src/components/ThreeViewer.tsx
git commit -m "refactor: slim ThreeViewer to ~300 lines — all sub-components imported from canvas/3d/"
```

---

## PHASE 2 — CadSidebar split

### Task 6: CadSidebar section components

**Files:**
- Create: `src/components/CadSidebar/types.ts`
- Create: `src/components/CadSidebar/ToolsSections.tsx`
- Create: `src/components/CadSidebar/LayersSection.tsx`
- Create: `src/components/CadSidebar/PropertiesSection.tsx`
- Create: `src/components/CadSidebar/AiSection.tsx`
- Create: `src/components/CadSidebar/BlocksSection/`
- Create: `src/components/CadSidebar/BlocksSection/useBlockLibrary.ts`
- Create: `src/components/CadSidebar/BlocksSection/DefaultBlocks.tsx`
- Create: `src/components/CadSidebar/BlocksSection/RemoteBlocks.tsx`
- Create: `src/components/CadSidebar/BlocksSection/index.tsx`
- Modify: `src/components/CadSidebar.tsx` → thin orchestrator

- [ ] **Step 1: Create `src/components/CadSidebar/types.ts`**

```typescript
// src/components/CadSidebar/types.ts
export type BlockSource = "default" | "mine" | "org";

export interface SidebarSection {
  architecture: boolean;
  draw: boolean;
  modify: boolean;
  annotate: boolean;
  blocks: boolean;
  layers: boolean;
  properties: boolean;
  ai: boolean;
}
```

- [ ] **Step 2: Create `src/components/CadSidebar/ToolsSections.tsx`**

Move the JSX blocks for Architecture, Draw, Modify, and Annotate sections out of CadSidebar.tsx:

```tsx
// src/components/CadSidebar/ToolsSections.tsx
import { ToolBtn } from "../ui/ToolBtn";

interface ToolProps { tool: string; setTool: (t: string) => void; }
interface ModifyProps extends ToolProps { onMirrorH?: () => void; onMirrorV?: () => void; onRotate90?: () => void; }

export function ArchitectureSection({ tool, setTool }: ToolProps) {
  return (
    <div className="grid grid-cols-2 gap-1.5 px-2 py-1">
      <ToolBtn label="Wall" icon="▤" active={tool === "wall"} onClick={() => setTool("wall")} shortcut="W" dragToolId="wall" compact />
      <ToolBtn label="Door" icon="🚪" active={tool === "door"} onClick={() => setTool("door")} shortcut="DO" dragToolId="door" compact />
      <ToolBtn label="Window" icon="🪟" active={tool === "window"} onClick={() => setTool("window")} shortcut="WI" dragToolId="window" compact />
      <ToolBtn label="Room" icon="🏷" active={tool === "room-label"} onClick={() => setTool("room-label")} shortcut="RL" dragToolId="room-label" compact />
      <ToolBtn label="Stair" icon="🪜" active={tool === "stair"} onClick={() => setTool("stair")} shortcut="ST" dragToolId="stair" compact />
    </div>
  );
}

export function DrawSection({ tool, setTool }: ToolProps) {
  return (
    <div className="grid grid-cols-2 gap-1.5 px-2 py-1">
      <ToolBtn label="Select" icon="↖" active={tool === "select"} onClick={() => setTool("select")} shortcut="V" compact />
      <ToolBtn label="Line" icon="╱" active={tool === "line"} onClick={() => setTool("line")} shortcut="L" dragToolId="line" compact />
      <ToolBtn label="P-Line" icon="⌐" active={tool === "polyline"} onClick={() => setTool("polyline")} shortcut="PL" dragToolId="polyline" compact />
      <ToolBtn label="Rect" icon="▭" active={tool === "rectangle"} onClick={() => setTool("rectangle")} shortcut="REC" dragToolId="rectangle" compact />
      <ToolBtn label="Circle" icon="○" active={tool === "circle"} onClick={() => setTool("circle")} shortcut="C" dragToolId="circle" compact />
      <ToolBtn label="Arc" icon="⌒" active={tool === "arc"} onClick={() => setTool("arc")} shortcut="A" dragToolId="arc" compact />
      <ToolBtn label="Polygon" icon="⬡" active={tool === "polygon"} onClick={() => setTool("polygon")} dragToolId="polygon" compact />
      <ToolBtn label="Ellipse" icon="⬭" active={tool === "ellipse"} onClick={() => setTool("ellipse")} dragToolId="ellipse" compact />
      <ToolBtn label="Spline" icon="∿" active={tool === "spline"} onClick={() => setTool("spline")} compact />
      <ToolBtn label="Hatch" icon="▓" active={tool === "hatch"} onClick={() => setTool("hatch")} shortcut="H" dragToolId="hatch" compact />
    </div>
  );
}

export function ModifySection({ tool, setTool, onMirrorH, onMirrorV, onRotate90 }: ModifyProps) {
  return (
    <div className="px-2 py-1 space-y-1.5">
      <div className="grid grid-cols-2 gap-1.5">
        <ToolBtn label="Move" icon="✥" active={tool === "move"} onClick={() => setTool("move")} shortcut="M" compact />
        <ToolBtn label="Copy" icon="⧉" active={tool === "copy"} onClick={() => setTool("copy")} shortcut="CO" compact />
        <ToolBtn label="Rotate" icon="↻" active={tool === "rotate"} onClick={() => setTool("rotate")} shortcut="RO" compact />
        <ToolBtn label="Scale" icon="⤢" active={tool === "scale"} onClick={() => setTool("scale")} shortcut="SC" compact />
      </div>
      <div className="flex gap-1 px-1">
        <button onClick={onMirrorH} className="flex-1 text-[10px] font-bold py-1.5 rounded border border-slate-200 dark:border-[#1E293B] text-slate-500 dark:text-gray-400 hover:bg-cyan-500/10 hover:text-cyan-400 hover:border-cyan-500/30 transition-colors">⇔ Mir H</button>
        <button onClick={onMirrorV} className="flex-1 text-[10px] font-bold py-1.5 rounded border border-slate-200 dark:border-[#1E293B] text-slate-500 dark:text-gray-400 hover:bg-cyan-500/10 hover:text-cyan-400 hover:border-cyan-500/30 transition-colors">⇕ Mir V</button>
      </div>
      <div className="px-1">
        <button onClick={onRotate90} className="w-full text-[10px] font-bold py-1.5 rounded border border-slate-200 dark:border-[#1E293B] text-slate-500 dark:text-gray-400 hover:bg-cyan-500/10 hover:text-cyan-400 hover:border-cyan-500/30 transition-colors">↷ Rot 90</button>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <ToolBtn label="Offset" icon="⊟" active={tool === "offset"} onClick={() => setTool("offset")} shortcut="O" compact />
        <ToolBtn label="Trim" icon="✂" active={tool === "trim"} onClick={() => setTool("trim")} shortcut="TR" compact />
        <ToolBtn label="Extend" icon="↔" active={tool === "extend"} onClick={() => setTool("extend")} shortcut="EX" compact />
        <ToolBtn label="Stretch" icon="⤡" active={tool === "stretch"} onClick={() => setTool("stretch")} compact />
        <ToolBtn label="Fillet" icon="⌔" active={tool === "fillet"} onClick={() => setTool("fillet")} shortcut="F" compact />
        <ToolBtn label="Chamfer" icon="⊿" active={tool === "chamfer"} onClick={() => setTool("chamfer")} shortcut="CHA" compact />
      </div>
    </div>
  );
}

export function AnnotateSection({ tool, setTool }: ToolProps) {
  return (
    <div className="grid grid-cols-2 gap-1.5 px-2 py-1">
      <ToolBtn label="Text" icon="T" active={tool === "text"} onClick={() => setTool("text")} shortcut="T" dragToolId="text" compact />
      <ToolBtn label="M-Text" icon="¶" active={tool === "mtext"} onClick={() => setTool("mtext")} compact />
      <ToolBtn label="Dim" icon="📏" active={tool === "dimension"} onClick={() => setTool("dimension")} shortcut="D" dragToolId="dimension" compact />
      <ToolBtn label="Linear" icon="⊢" active={tool === "dim-linear"} onClick={() => setTool("dim-linear")} compact />
      <ToolBtn label="Angular" icon="∠" active={tool === "dim-angular"} onClick={() => setTool("dim-angular")} compact />
      <ToolBtn label="Leader" icon="➤" active={tool === "leader"} onClick={() => setTool("leader")} dragToolId="leader" compact />
      <ToolBtn label="Mark No." icon="#" active={tool === "mark"} onClick={() => setTool("mark")} compact />
    </div>
  );
}
```

- [ ] **Step 3: Create `src/components/CadSidebar/LayersSection.tsx`**

Move the entire Layers JSX block verbatim from CadSidebar.tsx:

```tsx
// src/components/CadSidebar/LayersSection.tsx
import { useState } from "react";
import { Eye, EyeOff, Lock, Unlock } from "lucide-react";

interface Layer { id: string; name: string; visible: boolean; locked: boolean; style?: { strokeColor?: string }; }

interface LayersSectionProps {
  layers: Layer[];
  activeLayerId: string;
  setActiveLayer: (id: string) => void;
  addLayer: () => void;
  toggleLayerVisibility: (id: string) => void;
  toggleLayerLock: (id: string) => void;
  deleteLayer: (id: string) => void;
  renameLayer: (id: string, name: string) => void;
  duplicateLayer?: (id: string) => void;
}

export function LayersSection({ layers, activeLayerId, setActiveLayer, addLayer, toggleLayerVisibility, toggleLayerLock, deleteLayer, renameLayer, duplicateLayer }: LayersSectionProps) {
  const [layerEditId, setLayerEditId] = useState<string | null>(null);
  // … full JSX body copied verbatim from CadSidebar.tsx Layers section
  return (/* full layers JSX */null as any);
}
```

> **Note for implementer:** Copy the complete Layers section JSX from `CadSidebar.tsx` lines 335–440 verbatim into this component body. Do not paraphrase.

- [ ] **Step 4: Create `src/components/CadSidebar/PropertiesSection.tsx`**

```tsx
// src/components/CadSidebar/PropertiesSection.tsx
interface PropertiesSectionProps { selectedElement?: any; activeLayer?: { name?: string }; }

export function PropertiesSection({ selectedElement, activeLayer }: PropertiesSectionProps) {
  // Copy verbatim the Properties section JSX from CadSidebar.tsx lines 450–482
  return (/* full properties JSX */null as any);
}
```

- [ ] **Step 5: Create `src/components/CadSidebar/AiSection.tsx`**

```tsx
// src/components/CadSidebar/AiSection.tsx
import { useState } from "react";
import { generateDrawingFromPrompt } from "../../services/aiDrawingService";
import { useDrawingStore } from "../../stores/drawingStore";

interface AiSectionProps {
  addElements?: (els: any[]) => void;
  authToken?: string;
}

export function AiSection({ addElements, authToken }: AiSectionProps) {
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState<{ type: "success" | "error" | "info"; msg: string } | null>(null);
  const setCurrentArchitecturalPlan = useDrawingStore((s) => s.setCurrentArchitecturalPlan);

  const handleGenerate = async () => {
    if (!aiInput.trim()) return;
    setAiLoading(true);
    setAiStatus({ type: "info", msg: "Generating..." });
    const result = await generateDrawingFromPrompt(aiInput.trim(), authToken);
    setAiLoading(false);
    if (result.error) {
      setAiStatus({ type: "error", msg: result.error });
    } else if (result.elements.length === 0) {
      setAiStatus({ type: "error", msg: "AI returned no elements. Try a clearer prompt." });
    } else {
      if (result.plan) setCurrentArchitecturalPlan(result.plan);
      addElements?.(result.elements);
      setAiStatus({ type: "success", msg: `✅ Added ${result.elements.length} element(s) to canvas.` });
    }
    setTimeout(() => setAiStatus(null), 5000);
  };

  // Copy verbatim AI section JSX from CadSidebar.tsx lines 486–550
  return (/* full AI JSX */ null as any);
}
```

- [ ] **Step 6: Create `src/components/CadSidebar/BlocksSection/useBlockLibrary.ts`**

```typescript
// src/components/CadSidebar/BlocksSection/useBlockLibrary.ts
import { useState, useEffect } from "react";
import { listMyBlocks, listOrgBlocks, type OrgBlockRecord } from "../../../services/blockStoreService";
import type { BlockSource } from "../types";

export function useBlockLibrary(source: BlockSource, token?: string, orgId?: string | null) {
  const [myBlocks, setMyBlocks] = useState<OrgBlockRecord[]>([]);
  const [orgBlocks, setOrgBlocks] = useState<OrgBlockRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (source === "mine" && token) {
      setLoading(true); setError(null);
      listMyBlocks(token).then(setMyBlocks).catch((e) => setError(e.message)).finally(() => setLoading(false));
    }
    if (source === "org" && token && orgId) {
      setLoading(true); setError(null);
      listOrgBlocks(token, orgId).then(setOrgBlocks).catch((e) => setError(e.message)).finally(() => setLoading(false));
    }
  }, [source, token, orgId]);

  return { myBlocks, orgBlocks, loading, error };
}
```

- [ ] **Step 7: Create `src/components/CadSidebar/BlocksSection/index.tsx`**

Move the complete Blocks section JSX from CadSidebar.tsx into this component, using `useBlockLibrary`:

```tsx
// src/components/CadSidebar/BlocksSection/index.tsx
import { useState } from "react";
import { BLOCK_CATALOG, CATEGORY_META, type BlockCategory } from "../../../data/blockLibrary";
import { BlockPreview } from "../../ui/BlockPreview";
import { ToolBtn } from "../../ui/ToolBtn";
import { useDrawingStore } from "../../../stores/drawingStore";
import { useBlockLibrary } from "./useBlockLibrary";
import type { BlockSource } from "../types";
import type { OrgBlockRecord } from "../../../services/blockStoreService";

interface BlocksSectionProps {
  tool: string;
  setTool: (t: string) => void;
  zoom: number;
  panOffset: { x: number; y: number };
  insertBlock: (id: string, x: number, y: number) => void;
  authToken?: string;
  orgId?: string | null;
  onOpenBlockStore?: () => void;
}

export function BlocksSection({ tool, setTool, zoom, panOffset, insertBlock, authToken, orgId, onOpenBlockStore }: BlocksSectionProps) {
  const [blockCategory, setBlockCategory] = useState<BlockCategory>("structural");
  const [blockSource, setBlockSource] = useState<BlockSource>("default");
  const { myBlocks, orgBlocks, loading, error } = useBlockLibrary(blockSource, authToken, orgId);

  const handleRemoteInsert = (record: OrgBlockRecord) => {
    const store = useDrawingStore.getState();
    if (!store.blockDefs[record.id]) {
      useDrawingStore.setState((s: any) => ({
        blockDefs: { ...s.blockDefs, [record.id]: { id: record.id, name: record.name, elements: record.block_def.elements, insertionPoint: record.block_def.insertionPoint ?? { x: 0, y: 0 } } },
      }));
    }
    const px = (window.innerWidth / 2 - panOffset.x) / zoom;
    const py = (window.innerHeight / 2 - panOffset.y) / zoom;
    store.insertBlock(record.id, px, py);
  };

  // Copy the full Blocks section JSX from CadSidebar.tsx lines 252–393 verbatim, replacing
  // inlined fetch logic with the hook's { myBlocks, orgBlocks, loading, error }
  return (/* full blocks JSX */ null as any);
}
```

- [ ] **Step 8: Update CadSidebar.tsx to be thin orchestrator**

Replace all the section bodies with the extracted components. CadSidebar.tsx should only:
1. Define `CadSidebarProps` interface
2. Import and use the section components
3. Manage `collapsedSections` state and `toggleSection`

```tsx
// src/components/CadSidebar.tsx (after refactor, ~150 lines)
import { useState } from "react";
import { SectionHeader } from "./ui/SectionHeader";
import { Divider } from "./ui/Divider";
import { ArchitectureSection, DrawSection, ModifySection, AnnotateSection } from "./CadSidebar/ToolsSections";
import { LayersSection } from "./CadSidebar/LayersSection";
import { PropertiesSection } from "./CadSidebar/PropertiesSection";
import { AiSection } from "./CadSidebar/AiSection";
import { BlocksSection } from "./CadSidebar/BlocksSection";
// ... keep CadSidebarProps interface unchanged ...
export default function CadSidebar(props: CadSidebarProps) {
  const [collapsedSections, setCollapsedSections] = useState({ architecture: false, draw: false, modify: false, annotate: true, blocks: true, layers: false, properties: true, ai: true });
  const toggle = (s: string) => setCollapsedSections((p) => ({ ...p, [s]: !p[s as keyof typeof p] }));
  return (
    <aside className="w-[220px] bg-slate-50 dark:bg-[#0D1117] border-r border-slate-200 dark:border-[#1E293B] flex flex-col h-full overflow-y-auto text-slate-700 dark:text-gray-300 transition-colors duration-300 select-none">
      <SectionHeader label="Architecture" color="bg-rose-500" isCollapsible isCollapsed={collapsedSections.architecture} onToggle={() => toggle("architecture")} />
      {!collapsedSections.architecture && <ArchitectureSection tool={props.tool} setTool={props.setTool} />}
      <Divider />
      <SectionHeader label="Draw" color="bg-blue-500" isCollapsible isCollapsed={collapsedSections.draw} onToggle={() => toggle("draw")} />
      {!collapsedSections.draw && <DrawSection tool={props.tool} setTool={props.setTool} />}
      <Divider />
      <SectionHeader label="Modify" color="bg-yellow-500" isCollapsible isCollapsed={collapsedSections.modify} onToggle={() => toggle("modify")} />
      {!collapsedSections.modify && <ModifySection tool={props.tool} setTool={props.setTool} onMirrorH={props.onMirrorH} onMirrorV={props.onMirrorV} onRotate90={props.onRotate90} />}
      <Divider />
      <SectionHeader label="Annotate" color="bg-green-500" isCollapsible isCollapsed={collapsedSections.annotate} onToggle={() => toggle("annotate")} />
      {!collapsedSections.annotate && <AnnotateSection tool={props.tool} setTool={props.setTool} />}
      <Divider />
      <SectionHeader label="Blocks" color="bg-purple-500" isCollapsible isCollapsed={collapsedSections.blocks} onToggle={() => toggle("blocks")} />
      {!collapsedSections.blocks && <BlocksSection tool={props.tool} setTool={props.setTool} zoom={props.zoom} panOffset={props.panOffset} insertBlock={props.insertBlock} authToken={props.authToken} orgId={props.orgId} onOpenBlockStore={props.onOpenBlockStore} />}
      <Divider />
      <SectionHeader label="Layers" color="bg-amber-700" isCollapsible isCollapsed={collapsedSections.layers} onToggle={() => toggle("layers")} />
      {!collapsedSections.layers && <LayersSection layers={props.layers} activeLayerId={props.activeLayerId} setActiveLayer={props.setActiveLayer} addLayer={props.addLayer} toggleLayerVisibility={props.toggleLayerVisibility} toggleLayerLock={props.toggleLayerLock} deleteLayer={props.deleteLayer} renameLayer={props.renameLayer} duplicateLayer={props.duplicateLayer} />}
      <Divider />
      <SectionHeader label="Properties" color="bg-red-500" isCollapsible isCollapsed={collapsedSections.properties} onToggle={() => toggle("properties")} />
      {!collapsedSections.properties && <PropertiesSection selectedElement={props.selectedElement} activeLayer={props.layers.find((l) => l.id === props.activeLayerId)} />}
      <Divider />
      <SectionHeader label="AI Assistant" color="bg-cyan-500" isCollapsible isCollapsed={collapsedSections.ai} onToggle={() => toggle("ai")} />
      {!collapsedSections.ai && <AiSection addElements={props.addElements} authToken={props.authToken} />}
    </aside>
  );
}
```

- [ ] **Step 9: Type-check + commit**

```bash
cd autocard/frontend && npx tsc --noEmit
git add autocard/frontend/src/components/CadSidebar/ autocard/frontend/src/components/CadSidebar.tsx
git commit -m "refactor: split CadSidebar into 8 focused section components"
```

---

## PHASE 3 — CanvasEditor utility extraction

### Task 7: Pure geometry & canvas utilities

**Files:**
- Create: `src/canvas/geometry.ts`
- Create: `src/pages/CanvasEditor/utils/elementTransforms.ts`
- Create: `src/pages/CanvasEditor/utils/hitDetection.ts`
- Create: `src/pages/CanvasEditor/utils/idGen.ts`

- [ ] **Step 1: Create `src/pages/CanvasEditor/utils/idGen.ts`**

```typescript
// src/pages/CanvasEditor/utils/idGen.ts
let _counter = 0;
export function genId(): string {
  return `el-${Date.now()}-${(_counter++).toString(36)}`;
}
```

- [ ] **Step 2: Create `src/pages/CanvasEditor/utils/hitDetection.ts`**

Extract `pointToSegmentDist`, `getShapeAtPoint`, `elementInBox`, `elementFullyInBox`, `checkGripHit` from CanvasEditor.tsx:

```typescript
// src/pages/CanvasEditor/utils/hitDetection.ts
import type { DrawingElement, Point } from "../../../types";

export function pointToSegmentDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1, dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

export function elementInBox(el: DrawingElement, minX: number, minY: number, maxX: number, maxY: number): boolean {
  // Copy verbatim from CanvasEditor.tsx
  return false; // implementer: copy body
}

export function elementFullyInBox(el: DrawingElement, minX: number, minY: number, maxX: number, maxY: number): boolean {
  // Copy verbatim from CanvasEditor.tsx
  return false; // implementer: copy body
}

export function getShapeAtPoint(elements: DrawingElement[], x: number, y: number, zoom: number): DrawingElement | null {
  // Copy verbatim from CanvasEditor.tsx
  return null; // implementer: copy body
}
```

> **Note for implementer:** Copy the complete function bodies verbatim from `CanvasEditor.tsx`. These functions involve complex switch statements for all element types — do not paraphrase.

- [ ] **Step 3: Create `src/pages/CanvasEditor/utils/elementTransforms.ts`**

Extract `rotatePt`, `scalePtFn`, `getSelectionCentroid`, `applyElementRotation`, `applyElementScale`, `offsetElement`:

```typescript
// src/pages/CanvasEditor/utils/elementTransforms.ts
import type { DrawingElement, Point } from "../../../types";

export function rotatePt(pt: Point, pivot: Point, angleDeg: number): Point {
  const r = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(r), sin = Math.sin(r);
  const dx = pt.x - pivot.x, dy = pt.y - pivot.y;
  return { x: pivot.x + dx * cos - dy * sin, y: pivot.y + dx * sin + dy * cos };
}

export function scalePtFn(pt: Point, pivot: Point, factor: number): Point {
  return { x: pivot.x + (pt.x - pivot.x) * factor, y: pivot.y + (pt.y - pivot.y) * factor };
}

export function getSelectionCentroid(elements: DrawingElement[], ids: string[]): Point {
  // Copy verbatim from CanvasEditor.tsx
  return { x: 0, y: 0 };
}

export function applyElementRotation(el: DrawingElement, pivot: Point, angle: number): DrawingElement {
  // Copy verbatim from CanvasEditor.tsx (the full switch statement)
  return el;
}

export function applyElementScale(el: DrawingElement, pivot: Point, factor: number): DrawingElement {
  // Copy verbatim from CanvasEditor.tsx
  return el;
}

export function offsetElement(el: DrawingElement, dx: number, dy: number): DrawingElement {
  // Copy verbatim from CanvasEditor.tsx
  return el;
}
```

- [ ] **Step 4: Update imports in CanvasEditor.tsx**

Replace inline function bodies with imports:

```typescript
import { genId } from "./utils/idGen";
import { pointToSegmentDist, elementInBox, elementFullyInBox, getShapeAtPoint } from "./utils/hitDetection";
import { rotatePt, scalePtFn, getSelectionCentroid, applyElementRotation, applyElementScale, offsetElement } from "./utils/elementTransforms";
```

Delete the corresponding function bodies from CanvasEditor.tsx.

- [ ] **Step 5: Type-check + commit**

```bash
cd autocard/frontend && npx tsc --noEmit
git add autocard/frontend/src/pages/CanvasEditor/utils/
git commit -m "refactor: extract CanvasEditor geometry utilities to utils/"
```

---

### Task 8: CanvasEditor hooks

**Files:**
- Create: `src/pages/CanvasEditor/hooks/useCanvasState.ts`
- Create: `src/pages/CanvasEditor/hooks/useEditSession.ts`
- Create: `src/pages/CanvasEditor/hooks/usePermissions.ts`

- [ ] **Step 1: Create `src/pages/CanvasEditor/hooks/useCanvasState.ts`**

Move all drawing-interaction useState/useRef from CanvasEditor.tsx:

```typescript
// src/pages/CanvasEditor/hooks/useCanvasState.ts
import { useState, useRef } from "react";
import type { Point, DrawingElement, SnapResult } from "../../../types";

export function useCanvasState() {
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [dragPoint, setDragPoint] = useState<Point | null>(null);
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
  const [copyBuffer, setCopyBuffer] = useState<DrawingElement[]>([]);
  const [currentPolylineId, setCurrentPolylineId] = useState<string | null>(null);
  const [snapPoint, setSnapPoint] = useState<SnapResult | null>(null);
  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);
  const [operationPivot, setOperationPivot] = useState<Point | null>(null);
  const [typedValue, setTypedValue] = useState<string>("");
  const [textInputState, setTextInputState] = useState<{ x: number; y: number; layerId: string } | null>(null);
  const [textInputValue, setTextInputValue] = useState("");
  const [filletFirstId, setFilletFirstId] = useState<string | null>(null);
  const [chamferFirstId, setChamferFirstId] = useState<string | null>(null);
  const [stretchState, setStretchState] = useState<any>(null);
  const [dimAngularState, setDimAngularState] = useState<any>(null);
  const [boxSelectState, setBoxSelectState] = useState<{ start: Point; current: Point } | null>(null);

  // Refs for values needed in event listeners without stale closure issues
  const startPointRef = useRef<Point | null>(null);
  const activeGripRef = useRef<{ elementId: string; gripIndex: number } | null>(null);
  const isDrawingRef = useRef(false);

  return {
    isDrawing, setIsDrawing, isDrawingRef,
    startPoint, setStartPoint, startPointRef,
    dragPoint, setDragPoint,
    selectedElementIds, setSelectedElementIds,
    copyBuffer, setCopyBuffer,
    currentPolylineId, setCurrentPolylineId,
    snapPoint, setSnapPoint,
    hoveredElementId, setHoveredElementId,
    operationPivot, setOperationPivot,
    typedValue, setTypedValue,
    textInputState, setTextInputState,
    textInputValue, setTextInputValue,
    filletFirstId, setFilletFirstId,
    chamferFirstId, setChamferFirstId,
    stretchState, setStretchState,
    dimAngularState, setDimAngularState,
    boxSelectState, setBoxSelectState,
    activeGripRef,
  };
}
```

- [ ] **Step 2: Create `src/pages/CanvasEditor/hooks/useEditSession.ts`**

Extract the RAG edit batching logic:

```typescript
// src/pages/CanvasEditor/hooks/useEditSession.ts
import { useRef, useCallback } from "react";

export function useEditSession(drawingId: string | null, token: string | null) {
  const editSessionIdRef = useRef<string | null>(null);
  const pendingActionsRef = useRef<object[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const queueEditAction = useCallback((action: object) => {
    if (!drawingId || !token) return;
    pendingActionsRef.current.push(action);
    clearTimeout(flushTimerRef.current);
    flushTimerRef.current = setTimeout(async () => {
      const actions = pendingActionsRef.current.splice(0);
      if (actions.length === 0) return;
      try {
        const body: Record<string, unknown> = { actions };
        if (editSessionIdRef.current) body.session_id = editSessionIdRef.current;
        const res = await fetch(`/api/rag/projects/${drawingId}/edits`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const data = await res.json();
          editSessionIdRef.current = data.session_id ?? editSessionIdRef.current;
        }
      } catch { /* network errors are silent — edits are best-effort */ }
    }, 2000);
  }, [drawingId, token]);

  return { queueEditAction };
}
```

- [ ] **Step 3: Create `src/pages/CanvasEditor/hooks/usePermissions.ts`**

```typescript
// src/pages/CanvasEditor/hooks/usePermissions.ts
import { useCallback } from "react";
import { useDrawingStore } from "../../../stores/drawingStore";
import { BLOCK_CATALOG } from "../../../data/blockLibrary";
import type { DrawingElement } from "../../../types";

interface UsePermissionsProps {
  currentDrawing: any;
  userId?: string;
}

export function usePermissions({ currentDrawing, userId }: UsePermissionsProps) {
  const {
    insertBlock: storeInsertBlock,
    addLayer: storeAddLayer,
    toggleLayerLock: storeToggleLock,
    deleteLayer: storeDeleteLayer,
  } = useDrawingStore();

  const isOwner = currentDrawing?.owner_id === userId;
  const userPermission = currentDrawing?.permissions?.find((p: any) => p.user_id === userId);
  const userRole: "owner" | "editor" | "viewer" = isOwner ? "owner" : (userPermission?.role || "viewer");
  const isReadOnly = userRole === "viewer";

  const insertBlock = useCallback((blockId: string, x: number, y: number) => {
    if (isReadOnly) return;
    const current = useDrawingStore.getState();
    if (!current.blockDefs[blockId]) {
      const catalogEntry = BLOCK_CATALOG.find((b) => b.id === blockId);
      if (catalogEntry) {
        useDrawingStore.setState((s: any) => ({
          blockDefs: { ...s.blockDefs, [blockId]: { id: blockId, name: catalogEntry.label, elements: catalogEntry.def.elements as DrawingElement[], insertionPoint: catalogEntry.def.insertionPoint } },
        }));
      }
    }
    storeInsertBlock(blockId, x, y);
  }, [isReadOnly, storeInsertBlock]);

  const addLayer = useCallback(() => { if (!isReadOnly) storeAddLayer(); }, [isReadOnly, storeAddLayer]);
  const toggleLayerLock = useCallback((id: string) => { if (!isReadOnly) storeToggleLock(id); }, [isReadOnly, storeToggleLock]);
  const deleteLayer = useCallback((id: string) => { if (!isReadOnly) storeDeleteLayer(id); }, [isReadOnly, storeDeleteLayer]);

  return { isOwner, isReadOnly, userRole, insertBlock, addLayer, toggleLayerLock, deleteLayer };
}
```

- [ ] **Step 4: Update CanvasEditor.tsx to use these hooks**

Replace the 40+ useState declarations and inline logic with hook calls:

```typescript
const cs = useCanvasState();  // canvas interaction state
const { queueEditAction } = useEditSession(drawingId, token);
const perms = usePermissions({ currentDrawing, userId: user?.id });
```

Reference all state via `cs.isDrawing`, `cs.selectedElementIds`, etc. Reference permissions via `perms.insertBlock`, `perms.isReadOnly`, etc.

- [ ] **Step 5: Type-check + commit**

```bash
cd autocard/frontend && npx tsc --noEmit
git add autocard/frontend/src/pages/CanvasEditor/hooks/
git commit -m "refactor: extract CanvasEditor state, permission, and edit-session hooks"
```

---

## PHASE 4 — CadEngine renderer split

### Task 9: CadEngine renderer classes

**Files:**
- Create: `src/canvas/renderers/GridRenderer.ts`
- Create: `src/canvas/renderers/StyleManager.ts`
- Create: `src/canvas/renderers/ElementRenderer.ts`
- Create: `src/canvas/renderers/ArchitecturalRenderer.ts`
- Create: `src/canvas/renderers/PreviewRenderer.ts`
- Create: `src/canvas/renderers/CollabRenderer.ts`
- Modify: `src/canvas/CadEngine.ts` → orchestrator only

- [ ] **Step 1: Create `src/canvas/renderers/StyleManager.ts`**

```typescript
// src/canvas/renderers/StyleManager.ts
import type { Layer } from "../../types";

export class StyleManager {
  applyLayerStyle(ctx: CanvasRenderingContext2D, layerId: string, layerMap: Record<string, Layer>, isDarkMode: boolean): void {
    // Copy verbatim from CadEngine.ts applyLayerStyle method body
  }

  resolveColor(color: string | undefined, fallback: string, isDarkMode: boolean): string {
    if (!color) return fallback;
    // Copy dark mode inversion logic verbatim from CadEngine.ts
    return color;
  }
}
```

- [ ] **Step 2: Create `src/canvas/renderers/GridRenderer.ts`**

```typescript
// src/canvas/renderers/GridRenderer.ts
import type { Point } from "../../types";

export class GridRenderer {
  draw(ctx: CanvasRenderingContext2D, width: number, height: number, panOffset: Point, zoom: number, gridVisible: boolean): void {
    // Copy verbatim from CadEngine.ts drawGrid method body
  }
}
```

- [ ] **Step 3: Create `src/canvas/renderers/ArchitecturalRenderer.ts`**

```typescript
// src/canvas/renderers/ArchitecturalRenderer.ts
import type { ArchitecturalPlan, Layer } from "../../types";
// Copy drawArchitecturalPlan and drawOpenings verbatim
export class ArchitecturalRenderer {
  drawPlan(ctx: CanvasRenderingContext2D, plan: ArchitecturalPlan, layerMap: Record<string, Layer>, isDarkMode: boolean, manualWalls: any[]): void { /* ... */ }
  drawOpenings(ctx: CanvasRenderingContext2D, openings: any[], walls: any[], isDarkMode: boolean): void { /* ... */ }
}
```

- [ ] **Step 4: Create `src/canvas/renderers/ElementRenderer.ts`**

```typescript
// src/canvas/renderers/ElementRenderer.ts
import type { DrawingElement, Layer } from "../../types";
// Copy drawElement, drawBlock, drawHatch, drawDimension, drawLeader verbatim
export class ElementRenderer {
  drawElement(ctx: CanvasRenderingContext2D, el: DrawingElement, isSelected: boolean, layerMap: Record<string, Layer>, blockDefs: Record<string, any>, isDarkMode: boolean, isHovered: boolean): void { /* ... */ }
  drawGrips(ctx: CanvasRenderingContext2D, el: DrawingElement, zoom: number, isDarkMode: boolean): void { /* ... */ }
}
```

- [ ] **Step 5: Create `src/canvas/renderers/PreviewRenderer.ts`**

```typescript
// src/canvas/renderers/PreviewRenderer.ts
// Copy drawPreview and all preview helper functions verbatim
export class PreviewRenderer {
  drawPreview(ctx: CanvasRenderingContext2D, params: any): void { /* ... */ }
}
```

- [ ] **Step 6: Create `src/canvas/renderers/CollabRenderer.ts`**

```typescript
// src/canvas/renderers/CollabRenderer.ts
export class CollabRenderer {
  drawCursors(ctx: CanvasRenderingContext2D, cursors: Record<string, any>, users: any[], zoom: number, panOffset: any): void {
    // Copy drawCursors verbatim from CadEngine.ts
  }
}
```

- [ ] **Step 7: Slim CadEngine.ts to orchestrator**

```typescript
// src/canvas/CadEngine.ts (~150 lines after refactor)
import { GridRenderer } from "./renderers/GridRenderer";
import { StyleManager } from "./renderers/StyleManager";
import { ElementRenderer } from "./renderers/ElementRenderer";
import { ArchitecturalRenderer } from "./renderers/ArchitecturalRenderer";
import { PreviewRenderer } from "./renderers/PreviewRenderer";
import { CollabRenderer } from "./renderers/CollabRenderer";
import { WallEngine } from "../core/wallEngine";
import { computeGrips } from "./grips";
import type { RenderContext } from "./CadEngine";

export { RenderContext };

export class CadEngine {
  private grid = new GridRenderer();
  private style = new StyleManager();
  private elements = new ElementRenderer();
  private arch = new ArchitecturalRenderer();
  private preview = new PreviewRenderer();
  private collab = new CollabRenderer();

  public render(params: RenderContext): void {
    const { ctx, width, height, panOffset, zoom, gridVisible, elements, selectedElementIds, layers, tool, isDrawing, startPoint, dragPoint, currentPolylineId, snapPoint, hoveredElementId, collabCursors, collabUsers, blockDefs, architecturalPlan, isDarkMode, operationPivot, typedValue } = params;

    // Device pixel ratio setup
    const dpr = window.devicePixelRatio || 1;
    ctx.canvas.width = width * dpr;
    ctx.canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    ctx.save();
    ctx.translate(panOffset.x, panOffset.y);
    ctx.scale(zoom, zoom);

    this.grid.draw(ctx, width, height, panOffset, zoom, gridVisible);

    const visibleLayerIds = layers.filter((l) => l.visible).map((l) => l.id);
    const layerMap: Record<string, any> = {};
    layers.forEach((l) => { layerMap[l.id] = l; });

    const visibleElements = architecturalPlan ? elements.filter((el) => !el.archType) : elements;
    const manualWalls = visibleElements.filter((el) => el.type === "wall" && visibleLayerIds.includes(el.layerId) && el.start && el.end) as any[];

    if (architecturalPlan) this.arch.drawPlan(ctx, architecturalPlan, layerMap, !!isDarkMode, manualWalls);

    if (manualWalls.length > 0) {
      const polys = WallEngine.computePolygons(manualWalls);
      this.style.applyLayerStyle(ctx, "A-WALL", layerMap, !!isDarkMode);
      ctx.fillStyle = isDarkMode ? "#e2e8f0" : "#1e293b";
      polys.forEach((poly) => { ctx.beginPath(); ctx.moveTo(poly.points[0].x, poly.points[0].y); for (let i = 1; i < poly.points.length; i++) ctx.lineTo(poly.points[i].x, poly.points[i].y); ctx.closePath(); ctx.fill(); ctx.stroke(); });
    }

    visibleElements.forEach((el) => {
      if (!visibleLayerIds.includes(el.layerId)) return;
      if (el.type === "wall" || el.type === "opening") return;
      this.elements.drawElement(ctx, el, selectedElementIds.includes(el.id), layerMap, blockDefs, !!isDarkMode, el.id === hoveredElementId);
    });

    selectedElementIds.forEach((id) => {
      const el = elements.find((e) => e.id === id);
      if (el) computeGrips(el).forEach((grip) => this.elements.drawGrips(ctx, el, zoom, !!isDarkMode));
    });

    this.preview.drawPreview(ctx, { tool, isDrawing, startPoint, dragPoint, currentPolylineId, elements, layerMap, isDarkMode: !!isDarkMode, selectedElementIds, blockDefs, operationPivot, typedValue });

    ctx.restore();
    this.collab.drawCursors(ctx, collabCursors, collabUsers, zoom, panOffset);
  }
}
```

- [ ] **Step 8: Type-check + commit**

```bash
cd autocard/frontend && npx tsc --noEmit
git add autocard/frontend/src/canvas/renderers/ autocard/frontend/src/canvas/CadEngine.ts
git commit -m "refactor: split CadEngine into 5 focused renderer classes"
```

---

## PHASE 5 — drawingStore slice split

### Task 10: Zustand slice pattern

**Files:**
- Create: `src/stores/slices/canvasSlice.ts`
- Create: `src/stores/slices/elementSlice.ts`
- Create: `src/stores/slices/layerSlice.ts`
- Create: `src/stores/slices/blockSlice.ts`
- Create: `src/stores/slices/drawingSlice.ts`
- Create: `src/stores/slices/architectureSlice.ts`
- Create: `src/stores/slices/measurementSlice.ts`
- Create: `src/stores/slices/collaborationSlice.ts`
- Modify: `src/stores/drawingStore.ts` → composed store

- [ ] **Step 1: Create `src/stores/slices/canvasSlice.ts`**

```typescript
// src/stores/slices/canvasSlice.ts
import type { ToolType, Point, Style, SnapModes } from "../../types";

export interface CanvasState {
  tool: ToolType;
  panOffset: Point;
  zoom: number;
  gridVisible: boolean;
  snapEnabled: boolean;
  osnapEnabled: boolean;
  orthoEnabled: boolean;
  polarAngle: number;
  snapModes: SnapModes;
  snapThreshold: number;
  currentStyle: Style;
  unit: "mm" | "cm" | "m" | "ft" | "in";
  drawingScale: number;
}

export const createCanvasSlice = (set: any, get: any): CanvasState & {
  setTool(t: ToolType): void;
  setZoom(z: number): void;
  setPanOffset(p: Point): void;
  setGridVisible(v: boolean): void;
  setSnapEnabled(v: boolean): void;
  setOsnapEnabled(v: boolean): void;
  setOrthoEnabled(v: boolean): void;
  setPolarAngle(a: number): void;
  setUnit(u: CanvasState["unit"]): void;
  setCurrentStyle(s: Partial<Style>): void;
  formatLength(m: number): string;
  formatArea(m2: number): string;
} => ({
  tool: "select",
  panOffset: { x: 0, y: 0 },
  zoom: 1,
  gridVisible: true,
  snapEnabled: true,
  osnapEnabled: true,
  orthoEnabled: false,
  polarAngle: 45,
  snapModes: { endpoint: true, midpoint: true, center: true, intersection: true, perpendicular: false, tangent: false, nearest: false, grid: true },
  snapThreshold: 12,
  currentStyle: { strokeColor: "#1f2937", strokeWidth: 2, fillColor: "transparent", fontSize: 14, fontFamily: "monospace", textAlign: "left", fontWeight: "normal" },
  unit: "m",
  drawingScale: 100,

  setTool: (tool) => set({ tool }),
  setZoom: (zoom) => set({ zoom: Math.max(0.05, Math.min(zoom, 50)) }),
  setPanOffset: (panOffset) => set({ panOffset }),
  setGridVisible: (gridVisible) => set({ gridVisible }),
  setSnapEnabled: (snapEnabled) => set({ snapEnabled }),
  setOsnapEnabled: (osnapEnabled) => set({ osnapEnabled }),
  setOrthoEnabled: (orthoEnabled) => set({ orthoEnabled }),
  setPolarAngle: (polarAngle) => set({ polarAngle }),
  setUnit: (unit) => set({ unit }),
  setCurrentStyle: (style) => set((s: any) => ({ currentStyle: { ...s.currentStyle, ...style } })),
  formatLength: (m) => {
    const { unit, drawingScale } = get();
    const px = m * drawingScale;
    switch (unit) {
      case "mm": return `${(px * 10).toFixed(0)} mm`;
      case "cm": return `${px.toFixed(1)} cm`;
      case "ft": return `${(px / 30.48).toFixed(2)} ft`;
      case "in": return `${(px / 2.54).toFixed(1)} in`;
      default: return `${(px / 100).toFixed(2)} m`;
    }
  },
  formatArea: (m2) => {
    const { unit, drawingScale } = get();
    const px2 = m2 * drawingScale * drawingScale;
    switch (unit) {
      case "ft": return `${(px2 / 929.03).toFixed(2)} ft²`;
      default: return `${(px2 / 10000).toFixed(2)} m²`;
    }
  },
});
```

- [ ] **Step 2: Create remaining slices**

Create `elementSlice.ts`, `layerSlice.ts`, `blockSlice.ts`, `drawingSlice.ts`, `architectureSlice.ts`, `measurementSlice.ts`, `collaborationSlice.ts` — each following the same pattern: define a state interface, export a `create*Slice` factory function. Move the corresponding state fields and action implementations verbatim from `drawingStore.ts`.

> **Note for implementer:** For each slice, find the relevant actions in the `DrawingStore` interface and their implementations in `create()`. Group them:
> - `elementSlice`: `elements`, `history`, `historyIndex`, `addElement`, `updateElement`, `deleteElement`, `deleteSelectedElements`, `undo`, `redo`
> - `layerSlice`: `layers`, `activeLayerId`, `addLayer`, `setActiveLayer`, `toggleLayerVisibility`, `toggleLayerLock`, `deleteLayer`, `renameLayer`, `duplicateLayer`
> - `blockSlice`: `blockDefs`, `defineBlock`, `insertBlock`, `explodeBlock`, `deleteBlockDef`
> - `drawingSlice`: `drawings`, `currentDrawing`, `currentDrawingId`, `currentVersion`, `loading`, `error`, `fetchDrawings`, `createDrawing`, `loadDrawing`, `saveDrawing`, `deleteDrawing`, `importDrawingState`, `mergeDrawingState`, `resetEditor`, `clearCanvas`
> - `architectureSlice`: `currentArchitecturalPlan`, `setCurrentArchitecturalPlan`, `moveArchitecturalElement`, `updateArchitecturalEntity`
> - `measurementSlice`: `measurements`, `constraints`, `measurementMode`, all measurement actions
> - `collaborationSlice`: `versions`, `comments`, `permissions`, `showShareDialog`, all collab/permission actions

- [ ] **Step 3: Compose slices in `src/stores/drawingStore.ts`**

```typescript
// src/stores/drawingStore.ts (~100 lines after refactor)
import { create } from "zustand";
import { createCanvasSlice } from "./slices/canvasSlice";
import { createElementSlice } from "./slices/elementSlice";
import { createLayerSlice } from "./slices/layerSlice";
import { createBlockSlice } from "./slices/blockSlice";
import { createDrawingSlice } from "./slices/drawingSlice";
import { createArchitectureSlice } from "./slices/architectureSlice";
import { createMeasurementSlice } from "./slices/measurementSlice";
import { createCollaborationSlice } from "./slices/collaborationSlice";

export const useDrawingStore = create<DrawingStore>()((set, get) => ({
  ...createCanvasSlice(set, get),
  ...createElementSlice(set, get),
  ...createLayerSlice(set, get),
  ...createBlockSlice(set, get),
  ...createDrawingSlice(set, get),
  ...createArchitectureSlice(set, get),
  ...createMeasurementSlice(set, get),
  ...createCollaborationSlice(set, get),

  // Composite helpers that span multiple slices
  loadPreferences: (prefs) => {
    if (prefs.unit) set({ unit: prefs.unit });
    if (prefs.drawingScale) set({ drawingScale: prefs.drawingScale });
    if (prefs.snapEnabled !== undefined) set({ snapEnabled: prefs.snapEnabled });
    if (prefs.gridVisible !== undefined) set({ gridVisible: prefs.gridVisible });
  },
  updateViewportBounds: (bounds) => set({ viewportBounds: bounds }),
}));
```

- [ ] **Step 4: Type-check + commit**

```bash
cd autocard/frontend && npx tsc --noEmit
git add autocard/frontend/src/stores/
git commit -m "refactor: split drawingStore into 8 Zustand slices"
```

---

## Final verification

- [ ] **Full type-check**

```bash
cd autocard/frontend && npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Dev server smoke test**

```bash
cd autocard/frontend && npm run dev
```
Open `http://localhost:51530` — verify: canvas loads, blocks drag-and-drop, 3D viewer works, sidebar renders all sections.

- [ ] **Final commit**

```bash
git add -A
git commit -m "refactor: complete frontend component split — all files under 400 lines"
```

---

## Result: target file sizes

| File | Before | After |
|---|---|---|
| `ThreeViewer.tsx` | 2180 | ~250 |
| `CanvasEditor.tsx` | 2452 | ~900 |
| `CadSidebar.tsx` | 846 | ~150 |
| `CadEngine.ts` | 1276 | ~150 |
| `drawingStore.ts` | 1204 | ~100 |
| Each new file | — | 50–200 |
