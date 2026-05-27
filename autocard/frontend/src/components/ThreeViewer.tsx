import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { Grid, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { ArchitecturalPlan, DrawingElement } from "../types";

type HousePlan = {
  shell: DrawingElement | null;
  rooms: DrawingElement[];
  doors: DrawingElement[];
  windows: DrawingElement[];
  walls: DrawingElement[];
  loose: DrawingElement[];
};

type WallSegment = {
  centerX: number;
  centerZ: number;
  width: number;
  depth: number;
};

type Bounds = {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
};

const WALL_HEIGHT = 34;
const WALL_THICKNESS = 6;
const FLOOR_THICKNESS = 1.5;

function isRectangle(el: DrawingElement): el is DrawingElement & { x: number; y: number; width: number; height: number } {
  return el.type === "rectangle" && typeof el.x === "number" && typeof el.y === "number" && typeof el.width === "number" && typeof el.height === "number";
}

function labelOf(el: DrawingElement): string {
  return typeof el.label === "string" ? el.label.toLowerCase() : "";
}

function classifyPlan(elements: DrawingElement[]): HousePlan {
  const shell = elements.find((el) => isRectangle(el) && (el.archType === "meta" || labelOf(el).startsWith("house"))) ?? null;

  return elements.reduce<HousePlan>((acc, el) => {
    const label = labelOf(el);
    if (shell && el.id === shell.id) {
      return acc;
    }
    if (el.archType === "wall" && el.type === "line") {
      acc.walls.push(el);
      return acc;
    }
    if (el.archType === "door") {
      acc.doors.push(el);
      return acc;
    }
    if (el.archType === "window") {
      acc.windows.push(el);
      return acc;
    }
    if ((el.archType === "room" && (el.type === "text" || el.type === "hatch")) || (isRectangle(el) && (label.includes("bedroom") || label.includes("room") || label.includes("kitchen") || label.includes("bath")))) {
      acc.rooms.push(el);
      return acc;
    }
    acc.loose.push(el);
    return acc;
  }, { shell, rooms: [], doors: [], windows: [], walls: [], loose: [] });
}

function getPlanBounds(elements: DrawingElement[]): Bounds | null {
  let minX = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxZ = -Infinity;

  for (const el of elements) {
    if (isRectangle(el)) {
      minX = Math.min(minX, el.x);
      minZ = Math.min(minZ, el.y);
      maxX = Math.max(maxX, el.x + el.width);
      maxZ = Math.max(maxZ, el.y + el.height);
      continue;
    }

    if (el.type === "circle" && typeof el.cx === "number" && typeof el.cy === "number" && typeof el.radius === "number") {
      minX = Math.min(minX, el.cx - el.radius);
      minZ = Math.min(minZ, el.cy - el.radius);
      maxX = Math.max(maxX, el.cx + el.radius);
      maxZ = Math.max(maxZ, el.cy + el.radius);
      continue;
    }

    if (el.type === "line" && typeof el.x1 === "number" && typeof el.y1 === "number" && typeof el.x2 === "number" && typeof el.y2 === "number") {
      minX = Math.min(minX, el.x1, el.x2);
      minZ = Math.min(minZ, el.y1, el.y2);
      maxX = Math.max(maxX, el.x1, el.x2);
      maxZ = Math.max(maxZ, el.y1, el.y2);
    }
  }

  if (!Number.isFinite(minX)) {
    return null;
  }

  return { minX, minZ, maxX, maxZ };
}

function buildOuterWalls(shell: DrawingElement & { x: number; y: number; width: number; height: number }, doors: DrawingElement[]): WallSegment[] {
  const left = shell.x;
  const right = shell.x + shell.width;
  const top = shell.y;
  const bottom = shell.y + shell.height;

  const bottomDoors = doors
    .filter((door) => isRectangle(door))
    .filter((door) => Math.abs((door.y ?? 0) - bottom) <= WALL_THICKNESS * 2)
    .sort((a, b) => (a.x ?? 0) - (b.x ?? 0));

  const segments: WallSegment[] = [
    {
      centerX: left,
      centerZ: top + shell.height / 2,
      width: WALL_THICKNESS,
      depth: shell.height,
    },
    {
      centerX: right,
      centerZ: top + shell.height / 2,
      width: WALL_THICKNESS,
      depth: shell.height,
    },
    {
      centerX: left + shell.width / 2,
      centerZ: top,
      width: shell.width,
      depth: WALL_THICKNESS,
    },
  ];

  let cursor = left;
  for (const door of bottomDoors) {
    const doorX = door.x ?? cursor;
    const doorWidth = door.width ?? 0;
    const leftWidth = Math.max(0, doorX-cursor);
    if (leftWidth > 0) {
      segments.push({
        centerX: cursor + leftWidth / 2,
        centerZ: bottom,
        width: leftWidth,
        depth: WALL_THICKNESS,
      });
    }
    cursor = doorX + doorWidth;
  }

  const trailingWidth = Math.max(0, right-cursor);
  if (trailingWidth > 0) {
    segments.push({
      centerX: cursor + trailingWidth / 2,
      centerZ: bottom,
      width: trailingWidth,
      depth: WALL_THICKNESS,
    });
  }

  return segments;
}

function buildWallSegmentsFromSemanticWalls(walls: DrawingElement[]): WallSegment[] {
  return walls
    .filter((wall) => typeof wall.x1 === "number" && typeof wall.y1 === "number" && typeof wall.x2 === "number" && typeof wall.y2 === "number")
    .map((wall) => {
      const dx = (wall.x2 ?? 0) - (wall.x1 ?? 0);
      const dy = (wall.y2 ?? 0) - (wall.y1 ?? 0);
      const length = Math.hypot(dx, dy);
      const thickness = typeof wall.wallThickness === "number" ? Math.max(4, wall.wallThickness * 0.18) : WALL_THICKNESS;

      if (Math.abs(dx) >= Math.abs(dy)) {
        return {
          centerX: ((wall.x1 ?? 0) + (wall.x2 ?? 0)) / 2,
          centerZ: ((wall.y1 ?? 0) + (wall.y2 ?? 0)) / 2,
          width: Math.max(length, 1),
          depth: thickness,
        };
      }

      return {
        centerX: ((wall.x1 ?? 0) + (wall.x2 ?? 0)) / 2,
        centerZ: ((wall.y1 ?? 0) + (wall.y2 ?? 0)) / 2,
        width: thickness,
        depth: Math.max(length, 1),
      };
    });
}

function DynamicWall({ segment, color }: { segment: WallSegment, color: string }) {
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  
  useFrame(({ camera }) => {
    if (!materialRef.current) return;
    const dist = camera.position.distanceTo(new THREE.Vector3(segment.centerX, WALL_HEIGHT / 2, segment.centerZ));
    
    // Fade out walls when camera is close
    let opacity = 1;
    if (dist < 800) {
       if (dist < 300) {
         opacity = 0.15;
       } else {
         opacity = 0.15 + 0.85 * ((dist - 300) / 500); 
       }
    }
    
    materialRef.current.transparent = opacity < 1;
    materialRef.current.opacity = opacity;
    materialRef.current.needsUpdate = true;
  });

  return (
    <mesh position={[segment.centerX, WALL_HEIGHT / 2, segment.centerZ]} receiveShadow castShadow>
      <boxGeometry args={[segment.width, WALL_HEIGHT, segment.depth]} />
      <meshStandardMaterial ref={materialRef} color={color} />
    </mesh>
  );
}

function extrudeRoom(room: DrawingElement, key: string) {
  if (room.type === "text" && typeof room.x === "number" && typeof room.y === "number") {
    return (
      <mesh key={key} position={[room.x, 0.8, room.y]}>
        <boxGeometry args={[18, 0.5, 8]} />
        <meshStandardMaterial color="#cbd5e1" transparent opacity={0.2} />
      </mesh>
    );
  }

  if (!isRectangle(room)) {
      return null;
  }

  return (
    <group key={key}>
      <mesh position={[room.x + room.width / 2, 0.3, room.y + room.height / 2]} receiveShadow>
        <boxGeometry args={[room.width, 0.2, room.height]} />
        <meshStandardMaterial color="#dbe4ea" transparent opacity={0.95} />
      </mesh>
      <mesh position={[room.x + room.width / 2, 10, room.y + room.height / 2]} castShadow receiveShadow>
        <boxGeometry args={[room.width, 20, room.height]} />
        <meshStandardMaterial color="#eef2f6" transparent opacity={0.2} />
      </mesh>
    </group>
  );
}

function extrudeDoor(door: DrawingElement, key: string) {
  if (door.type === "arc" && typeof door.cx === "number" && typeof door.cy === "number" && typeof door.radius === "number") {
    return (
      <mesh key={key} position={[door.cx + door.radius / 2, 10, door.cy - door.radius / 2]} castShadow>
        <boxGeometry args={[Math.max(door.radius, 4), 20, 2]} />
        <meshStandardMaterial color="#89c2d9" transparent opacity={0.35} />
      </mesh>
    );
  }

  if (!isRectangle(door)) {
    return null;
  }

  return (
    <mesh key={key} position={[door.x + door.width / 2, 10, door.y + WALL_THICKNESS / 2]} castShadow>
      <boxGeometry args={[door.width, 20, Math.max(2, door.height)]} />
      <meshStandardMaterial color="#89c2d9" transparent opacity={0.35} />
    </mesh>
  );
}

function BlockElementMesh({ el, blockType }: { el: DrawingElement, blockType: string }) {
  const color = typeof el.strokeColor === "string" ? el.strokeColor : "#1f2937";
  const fillColor = typeof el.fillColor === "string" && el.fillColor !== "transparent" ? el.fillColor : null;
  
  // Differentiate heights based on item type to give a more realistic 3D feel
  const height = blockType === "door" ? 20 : (blockType === "window" ? 10 : (blockType === "car" ? 18 : 8));
  const yOffset = height / 2;

  if (isRectangle(el)) {
    return (
      <mesh position={[el.x + el.width / 2, yOffset, el.y + el.height / 2]} receiveShadow castShadow>
        <boxGeometry args={[el.width, height, el.height]} />
        <meshStandardMaterial color={fillColor || color} transparent opacity={fillColor ? 0.95 : 0.65} wireframe={!fillColor} />
      </mesh>
    );
  }
  
  if (el.type === "circle" && typeof el.cx === "number" && typeof el.cy === "number" && typeof el.radius === "number") {
    return (
      <mesh position={[el.cx, yOffset, el.cy]} receiveShadow castShadow>
        <cylinderGeometry args={[el.radius, el.radius, height, 32]} />
        <meshStandardMaterial color={fillColor || color} transparent opacity={fillColor ? 0.95 : 0.65} wireframe={!fillColor} />
      </mesh>
    );
  }

  return null;
}

function flatElementMesh(el: DrawingElement, blockDefs?: any) {
  if (el.type === "block" && el.blockId && blockDefs) {
    const def = blockDefs[el.blockId];
    if (!def) return null;
    return (
      <group key={el.id} position={[el.x || 0, 0, el.y || 0]} scale={[el.scale || 1, 1, el.scale || 1]} rotation={[0, -(el.rotation || 0) * Math.PI / 180, 0]}>
        {def.elements.map((be: any) => (
           <BlockElementMesh key={be.id} el={be} blockType={el.blockId!} />
        ))}
      </group>
    );
  }

  const color = typeof el.strokeColor === "string" ? el.strokeColor : "#1f2937";
  const fillColor = typeof el.fillColor === "string" && el.fillColor !== "transparent" ? el.fillColor : null;

  if (isRectangle(el)) {
    return (
      <mesh key={el.id} position={[el.x + el.width / 2, 0.15, el.y + el.height / 2]} receiveShadow>
        <boxGeometry args={[el.width, 0.3, el.height]} />
        <meshStandardMaterial color={fillColor || color} transparent opacity={fillColor ? 1 : 0.35} wireframe={!fillColor} />
      </mesh>
    );
  }

  if (el.type === "circle" && typeof el.cx === "number" && typeof el.cy === "number" && typeof el.radius === "number") {
    return (
      <mesh key={el.id} position={[el.cx, 0.2, el.cy]} receiveShadow>
        <cylinderGeometry args={[el.radius, el.radius, 0.3, 32]} />
        <meshStandardMaterial color={fillColor || color} transparent opacity={fillColor ? 1 : 0.35} wireframe={!fillColor} />
      </mesh>
    );
  }

  if (el.type === "line" && typeof el.x1 === "number" && typeof el.y1 === "number" && typeof el.x2 === "number" && typeof el.y2 === "number") {
    const points = [new THREE.Vector3(el.x1, 0.2, el.y1), new THREE.Vector3(el.x2, 0.2, el.y2)];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color });
    return <primitive key={el.id} object={new THREE.Line(geometry, material)} />;
  }

  return null;
}

function roomBoundsFromBoundary(room: ArchitecturalPlan["rooms"][number]) {
  if (!room.boundary.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  room.boundary.forEach((p) => {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  });
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function wallSegmentsFromPlan(plan: ArchitecturalPlan): WallSegment[] {
  return (plan.walls || []).map((wall) => {
    const dx = wall.x2 - wall.x1;
    const dy = wall.y2 - wall.y1;
    const length = Math.hypot(dx, dy);
    const thickness = Math.max(4, wall.thickness * 0.18);
    return Math.abs(dx) >= Math.abs(dy)
      ? { centerX: (wall.x1 + wall.x2) / 2, centerZ: (wall.y1 + wall.y2) / 2, width: Math.max(length, 1), depth: thickness }
      : { centerX: (wall.x1 + wall.x2) / 2, centerZ: (wall.y1 + wall.y2) / 2, width: thickness, depth: Math.max(length, 1) };
  });
}

function PlanModel({ elements, plan: architecturalPlan, blockDefs }: { elements: DrawingElement[]; plan: ArchitecturalPlan | null; blockDefs?: any }) {
  if (architecturalPlan) {
    const footprintWidth = architecturalPlan.footprint.widthMeters * 100;
    const footprintHeight = architecturalPlan.footprint.heightMeters * 100;
    const semanticBounds = getPlanBounds(elements);
    const centerX = semanticBounds ? (semanticBounds.minX + semanticBounds.maxX) / 2 : 500;
    const centerZ = semanticBounds ? (semanticBounds.minZ + semanticBounds.maxZ) / 2 : 350;
    const walls = wallSegmentsFromPlan(architecturalPlan);
    return (
      <>
        <mesh position={[centerX, -FLOOR_THICKNESS / 2, centerZ]} receiveShadow>
          <boxGeometry args={[footprintWidth + 24, FLOOR_THICKNESS, footprintHeight + 24]} />
          <meshStandardMaterial color="#d6d6d4" />
        </mesh>
        <mesh position={[centerX, 0.05, centerZ]} receiveShadow>
          <boxGeometry args={[footprintWidth, 0.1, footprintHeight]} />
          <meshStandardMaterial color="#f4f4f3" />
        </mesh>
        {walls.map((segment, index) => <DynamicWall key={`plan-wall-${index}`} segment={segment} color="#f7f7f6" />)}
        {(architecturalPlan.rooms || []).map((room) => {
          const bounds = roomBoundsFromBoundary(room);
          if (!bounds) return null;
          return extrudeRoom({ id: room.id, type: "rectangle", layerId: "A-ROOM", x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }, room.id);
        })}
        {(architecturalPlan.openings || []).filter((opening) => opening.type === "door").map((opening) => (
          <mesh key={opening.id} position={[opening.x + opening.width / 2, 10, opening.y - opening.width / 2]} castShadow>
            <boxGeometry args={[Math.max(opening.width, 4), 20, 2]} />
            <meshStandardMaterial color="#89c2d9" transparent opacity={0.35} />
          </mesh>
        ))}
        {elements.filter(e => e.type === "block").map(el => flatElementMesh(el, blockDefs))}
      </>
    );
  }

  const plan = useMemo(() => classifyPlan(elements), [elements]);

  if (plan.shell && isRectangle(plan.shell)) {
    const shell = plan.shell;
    const walls = plan.walls.length > 0 ? buildWallSegmentsFromSemanticWalls(plan.walls) : buildOuterWalls(shell, plan.doors);

    return (
      <>
        <mesh position={[shell.x + shell.width / 2, -FLOOR_THICKNESS / 2, shell.y + shell.height / 2]} receiveShadow>
          <boxGeometry args={[shell.width + 24, FLOOR_THICKNESS, shell.height + 24]} />
          <meshStandardMaterial color="#d6d6d4" />
        </mesh>
        <mesh position={[shell.x + shell.width / 2, 0.05, shell.y + shell.height / 2]} receiveShadow>
          <boxGeometry args={[shell.width, 0.1, shell.height]} />
          <meshStandardMaterial color="#f4f4f3" />
        </mesh>
        {walls.map((segment, index) => <DynamicWall key={`outer-${index}`} segment={segment} color="#f7f7f6" />)}
        {plan.rooms.map((room) => extrudeRoom(room, room.id))}
        {plan.doors.map((door) => extrudeDoor(door, door.id))}
        {plan.windows.map((windowEl) => flatElementMesh(windowEl, blockDefs))}
        {plan.loose.map((el) => flatElementMesh(el, blockDefs))}
      </>
    );
  }

  return <>{elements.map((el) => flatElementMesh(el, blockDefs))}</>;
}

function AutoFrame({ bounds, revisionKey }: { bounds: Bounds | null; revisionKey?: string }) {
  const { camera } = useThree();
  const lastRevision = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!bounds) return;
    if (revisionKey !== undefined && revisionKey === lastRevision.current) return;
    lastRevision.current = revisionKey;

    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerZ = (bounds.minZ + bounds.maxZ) / 2;
    const width = bounds.maxX - bounds.minX;
    const depth = bounds.maxZ - bounds.minZ;
    const span = Math.max(width, depth, 200);

    camera.position.set(centerX + span * 0.9, span * 0.6, centerZ + span * 0.9);
    camera.lookAt(centerX, 10, centerZ);
    camera.updateProjectionMatrix();
  }, [bounds, revisionKey, camera]);

  return null;
}

type ViewAngle = "perspective" | "top" | "front" | "back" | "left" | "right" | null;

interface CameraControllerProps {
  bounds: Bounds | null;
  viewAngle: ViewAngle;
  onViewConsumed: () => void;
  controlsRef: React.RefObject<any>;
}

function CameraController({ bounds, viewAngle, onViewConsumed, controlsRef }: CameraControllerProps) {
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

    if (viewAngle === "top") {
      targetPos.current = new THREE.Vector3(cx, D, cz + 0.1); // Small offset to prevent flip
    } else if (viewAngle === "front") {
      targetPos.current = new THREE.Vector3(cx, 10, cz + D);
    } else if (viewAngle === "back") {
      targetPos.current = new THREE.Vector3(cx, 10, cz - D);
    } else if (viewAngle === "left") {
      targetPos.current = new THREE.Vector3(cx - D, 10, cz);
    } else if (viewAngle === "right") {
      targetPos.current = new THREE.Vector3(cx + D, 10, cz);
    } else {
      targetPos.current = new THREE.Vector3(cx + span * 0.9, span * 0.6, cz + span * 0.9);
    }
  }, [viewAngle, bounds]);

  useFrame(() => {
    if (!targetPos.current || consumed.current) return;
    const pos = camera.position;
    pos.lerp(targetPos.current, 0.1);
    
    if (controlsRef.current) {
      controlsRef.current.target.lerp(targetLook.current, 0.1);
      controlsRef.current.update();
    }

    if (pos.distanceTo(targetPos.current) < 2) {
      pos.copy(targetPos.current);
      if (controlsRef.current) {
        controlsRef.current.target.copy(targetLook.current);
        controlsRef.current.update();
      }
      consumed.current = true;
      onViewConsumed();
    }
    camera.lookAt(targetLook.current);
    camera.updateProjectionMatrix();
  });

  // Interrupt animation on mouse drag/wheel
  useEffect(() => {
    const handleInteraction = () => {
      if (!consumed.current) {
        consumed.current = true;
        onViewConsumed();
      }
    };
    window.addEventListener("pointerdown", handleInteraction);
    window.addEventListener("wheel", handleInteraction);
    return () => {
      window.removeEventListener("pointerdown", handleInteraction);
      window.removeEventListener("wheel", handleInteraction);
    };
  }, [onViewConsumed]);

  return null;
}

function Scene({ elements, plan, blockDefs, revisionKey, viewAngle, onViewConsumed }: {
  elements: DrawingElement[];
  plan: ArchitecturalPlan | null;
  blockDefs: any;
  revisionKey?: string;
  viewAngle: ViewAngle;
  onViewConsumed: () => void;
}) {
  const bounds = useMemo(() => getPlanBounds(elements), [elements]);
  const orbitTarget = bounds
    ? [((bounds.minX + bounds.maxX) / 2), 10, ((bounds.minZ + bounds.maxZ) / 2)] as [number, number, number]
    : [500, 10, 350] as [number, number, number];

  const controlsRef = useRef<any>(null);

  return (
    <>
      <color attach="background" args={["#e5e7eb"]} />
      <fog attach="fog" args={["#e5e7eb", 250, 900]} />
      <ambientLight intensity={1.1} />
      <directionalLight position={[180, 240, 120]} intensity={1.5} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
      <directionalLight position={[-120, 140, -80]} intensity={0.65} />
      <Grid
        position={[0, -1.2, 0]}
        args={[1200, 1200]}
        cellSize={20}
        cellThickness={0.5}
        cellColor="#cbd5e1"
        sectionSize={100}
        sectionThickness={1}
        sectionColor="#94a3b8"
        fadeDistance={800}
      />
      <AutoFrame bounds={bounds} revisionKey={revisionKey} />
      <CameraController bounds={bounds} viewAngle={viewAngle} onViewConsumed={onViewConsumed} controlsRef={controlsRef} />
      <PlanModel elements={elements} plan={plan} blockDefs={blockDefs} />
      <OrbitControls ref={controlsRef} enableDamping dampingFactor={0.08} minDistance={40} maxDistance={1800} maxPolarAngle={Math.PI / 2.02} target={orbitTarget} />
    </>
  );
}

export default function ThreeViewer({ elements, plan, visible, blockDefs, revisionKey }: {
  elements: DrawingElement[];
  plan: ArchitecturalPlan | null;
  blockDefs: any;
  visible: boolean;
  revisionKey?: string;
}) {
  const [viewAngle, setViewAngle] = useState<ViewAngle>(null);

  if (!visible) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-10 bg-[#dfe3e8]">
      <div className="absolute left-4 top-4 z-20 rounded border border-white/60 bg-white/75 px-3 py-2 text-[11px] font-medium text-slate-700 shadow-sm backdrop-blur">
        3D Preview
      </div>

      {/* Compass / View Cube Widget */}
      <div className="absolute right-4 top-4 z-20 flex flex-col items-center p-3 bg-white/75 dark:bg-[#151B23]/75 backdrop-blur-md rounded-xl border border-white/60 dark:border-[#1E293B] shadow-lg space-y-2 select-none">
        <span className="text-[9px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest">View Cube</span>
        
        <div className="relative w-24 h-24 flex items-center justify-center">
          {/* North / Front button */}
          <button
            onClick={() => setViewAngle("front")}
            className={`absolute top-0 w-7 h-7 rounded flex items-center justify-center text-[10px] font-extrabold border transition-all ${
              viewAngle === "front"
                ? "bg-cyan-500 border-cyan-400 text-white shadow-lg shadow-cyan-500/30"
                : "bg-white/80 dark:bg-[#0B0E14]/80 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-cyan-500/40 hover:text-cyan-400"
            }`}
            title="Front View"
          >
            F
          </button>

          {/* West / Left button */}
          <button
            onClick={() => setViewAngle("left")}
            className={`absolute left-0 w-7 h-7 rounded flex items-center justify-center text-[10px] font-extrabold border transition-all ${
              viewAngle === "left"
                ? "bg-cyan-500 border-cyan-400 text-white shadow-lg shadow-cyan-500/30"
                : "bg-white/80 dark:bg-[#0B0E14]/80 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-cyan-500/40 hover:text-cyan-400"
            }`}
            title="Left View"
          >
            L
          </button>

          {/* Center TOP button */}
          <button
            onClick={() => setViewAngle("top")}
            className={`w-9 h-9 rounded-full flex items-center justify-center text-[9px] font-black border transition-all ${
              viewAngle === "top"
                ? "bg-cyan-500 border-cyan-400 text-white shadow-lg shadow-cyan-500/30"
                : "bg-white/90 dark:bg-[#0B0E14]/90 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-cyan-500/40 hover:text-cyan-400"
            }`}
            title="Top (Plan) View"
          >
            TOP
          </button>

          {/* East / Right button */}
          <button
            onClick={() => setViewAngle("right")}
            className={`absolute right-0 w-7 h-7 rounded flex items-center justify-center text-[10px] font-extrabold border transition-all ${
              viewAngle === "right"
                ? "bg-cyan-500 border-cyan-400 text-white shadow-lg shadow-cyan-500/30"
                : "bg-white/80 dark:bg-[#0B0E14]/80 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-cyan-500/40 hover:text-cyan-400"
            }`}
            title="Right View"
          >
            R
          </button>

          {/* South / Back button */}
          <button
            onClick={() => setViewAngle("back")}
            className={`absolute bottom-0 w-7 h-7 rounded flex items-center justify-center text-[10px] font-extrabold border transition-all ${
              viewAngle === "back"
                ? "bg-cyan-500 border-cyan-400 text-white shadow-lg shadow-cyan-500/30"
                : "bg-white/80 dark:bg-[#0B0E14]/80 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-cyan-500/40 hover:text-cyan-400"
            }`}
            title="Back View"
          >
            B
          </button>
        </div>

        {/* 3D ISO Button */}
        <button
          onClick={() => setViewAngle("perspective")}
          className={`w-full py-1 rounded text-[9px] font-bold border transition-colors ${
            viewAngle === "perspective"
              ? "bg-cyan-500 border-cyan-400 text-white"
              : "bg-white/80 dark:bg-[#0B0E14]/80 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-cyan-500/40 hover:text-cyan-400"
          }`}
          title="Default 3D ISO View"
        >
          3D ISO
        </button>
      </div>

      <Canvas shadows camera={{ position: [760, 420, 760], fov: 42, near: 0.1, far: 4000 }}>
        <Scene
          elements={elements}
          plan={plan}
          blockDefs={blockDefs}
          revisionKey={revisionKey}
          viewAngle={viewAngle}
          onViewConsumed={() => setViewAngle(null)}
        />
      </Canvas>
    </div>
  );
}
