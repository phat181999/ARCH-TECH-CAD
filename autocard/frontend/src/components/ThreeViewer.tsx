import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Grid, OrbitControls, GizmoHelper, GizmoViewport, Sky, ContactShadows, Environment, PerformanceMonitor } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import type { ArchitecturalPlan, DrawingElement } from "../types";
import { useDrawingStore } from "../stores/drawingStore";

import { WallMesh, InstancedWallsMesh, RoomMesh, RoofMesh, DoorMesh, FlatElementMesh, BimModelRenderer } from "../canvas/3d/components";
import type { BIMResult } from "../api/client";
import { AutoFrame, CameraController, TapeMeasureController, DrawOnFaceController, DrawnPolygonShape, PushPullDragController, WallDrawController } from "../canvas/3d/controllers";
import { classifyPlan, getPlanBounds, layerClassify, computeAutoWallHeight, isRectangle, roomBoundsFromBoundary } from "../canvas/3d/geometry/planClassification";
import { buildOuterWalls, buildWallSegmentsFromSemanticWalls, wallSegmentsFromPlan, FLOOR_THICKNESS } from "../canvas/3d/geometry/wallGeometry";
import type { DrawingState, ShapeWithDepth, ViewAngle } from "../canvas/3d/types";
import { ThreeToolbar, ViewCube, PushPullPanel, FurnitureQuickPanel, BimStylingPanel } from "../canvas/3d/components/ThreeViewerUI";
import { MaterialService } from "../canvas/3d/materials/materialService";
import type { RoofType } from "../canvas/3d/geometry/RoofGenerator";

import { useAnalysisJob } from "../hooks/useAnalysisJob";
import { elementsToBimResult } from "../canvas/3d/bridge/localBimBridge";
import { downloadIFC } from "../canvas/ifcExporter";

function PlanModel({
  elements,
  plan: architecturalPlan,
  blockDefs,
  activeTool,
  onElementClick,
  wallHeight,
  bounds,
  layerOverride,
  facadeMaterial = "plaster",
  roofType = "gable",
  roofPitch = 30,
  roofMaterial = "roof_tile",
}: {
  elements: DrawingElement[];
  plan: ArchitecturalPlan | null;
  blockDefs?: any;
  activeTool?: string;
  onElementClick?: (id: string) => void;
  wallHeight: number;
  bounds: ReturnType<typeof getPlanBounds>;
  layerOverride?: import("../canvas/3d/geometry/planClassification").LayerOverride;
  facadeMaterial?: string;
  roofType?: RoofType;
  roofPitch?: number;
  roofMaterial?: string;
}) {
  if (architecturalPlan) {
    const footprintWidth = architecturalPlan.footprint.widthMeters * 100;
    const footprintHeight = architecturalPlan.footprint.heightMeters * 100;
    const centerX = bounds ? (bounds.minX + bounds.maxX) / 2 : 500;
    const centerZ = bounds ? (bounds.minZ + bounds.maxZ) / 2 : 350;
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
        {walls.map((segment, index) => (
          <WallMesh
            key={`plan-wall-${index}`}
            segment={segment}
            color="#f7f7f6"
            wallHeight={wallHeight}
            activeTool={activeTool}
            onElementClick={onElementClick}
            materialName={facadeMaterial}
          />
        ))}
        <RoofMesh
          x={centerX - footprintWidth / 2} z={centerZ - footprintHeight / 2}
          width={footprintWidth} depth={footprintHeight}
          wallHeight={wallHeight}
          type={roofType}
          pitch={roofPitch}
          materialName={roofMaterial}
        />
        {(architecturalPlan.rooms || []).map((room) => {
          const bounds = roomBoundsFromBoundary(room);
          if (!bounds) return null;
          return (
            <RoomMesh
              key={room.id}
              room={{ id: room.id, type: "rectangle", layerId: "A-ROOM", x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }}
              activeTool={activeTool}
              onElementClick={onElementClick}
            />
          );
        })}
        {(architecturalPlan.openings || []).filter((opening) => opening.type === "door").map((opening) => (
          <DoorMesh
            key={opening.id}
            door={{ id: opening.id, type: "rectangle", layerId: "A-DOOR", x: opening.x, y: opening.y, width: opening.width, height: opening.width }}
            activeTool={activeTool}
            onElementClick={onElementClick}
          />
        ))}
        {elements.filter(e => e.type === "block").map(el => (
          <FlatElementMesh
            key={el.id}
            el={el}
            blockDefs={blockDefs}
            activeTool={activeTool}
            onElementClick={onElementClick}
          />
        ))}
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
        {walls.map((segment, index) => (
          <WallMesh
            key={`outer-${index}`}
            segment={segment}
            color="#f7f7f6"
            wallHeight={wallHeight}
            activeTool={activeTool}
            onElementClick={onElementClick}
            materialName={facadeMaterial}
          />
        ))}
        <RoofMesh
          x={shell.x} z={shell.y}
          width={shell.width} depth={shell.height}
          wallHeight={wallHeight}
          type={roofType}
          pitch={roofPitch}
          materialName={roofMaterial}
        />
        {plan.rooms.map((room) => (
          <RoomMesh key={room.id} room={room} activeTool={activeTool} onElementClick={onElementClick} />
        ))}
        {plan.doors.map((door) => (
          <DoorMesh key={door.id} door={door} activeTool={activeTool} onElementClick={onElementClick} />
        ))}
        {plan.windows.map((windowEl) => (
          <FlatElementMesh key={windowEl.id} el={windowEl} blockDefs={blockDefs} activeTool={activeTool} onElementClick={onElementClick} />
        ))}
        {plan.loose.map((el) => (
          <FlatElementMesh key={el.id} el={el} blockDefs={blockDefs} activeTool={activeTool} onElementClick={onElementClick} />
        ))}
      </>
    );
  }

  const fallbackWalls = useMemo(() => elements.filter(el => el.archType === "wall" && (el.type === "line" || el.type === "polyline")), [elements]);
  const fallbackLoose = useMemo(() => elements.filter(el => el.archType !== "wall"), [elements]);

  if (fallbackWalls.length > 0) {
    const wallSegs = buildWallSegmentsFromSemanticWalls(fallbackWalls);
    return (
      <>
        {wallSegs.map((segment) => (
          <WallMesh key={segment.id} segment={segment} color="#f7f7f6" wallHeight={wallHeight} activeTool={activeTool} onElementClick={onElementClick} materialName={facadeMaterial} />
        ))}
        {fallbackLoose.map((el) => (
          <FlatElementMesh key={el.id} el={el} blockDefs={blockDefs} activeTool={activeTool} onElementClick={onElementClick} />
        ))}
      </>
    );
  }

  // Wall height based on median line length — far more accurate than span/20
  const autoWallHeight = useMemo(() => computeAutoWallHeight(elements, wallHeight), [elements, wallHeight]);

  // Memoized: only re-scan when elements array reference changes
  const hasAnyArchType = useMemo(() => elements.some(el => el.archType), [elements]);

  // Memoize DXF classification so it doesn't rerun on every render
  const dxfClassified = useMemo(
    () => {
      if (hasAnyArchType || elements.length === 0) return null;
      const result = layerClassify(elements, layerOverride);
      console.group("%c[3D Viewer] 🏗️ DXF Layer Classification", "color:#a78bfa;font-weight:bold");
      console.log("Total elements:", elements.length);
      console.log("Walls:", result.walls.length, "→ will be extruded");
      console.log("Doors:", result.doors.length);
      console.log("Windows:", result.windows.length);
      console.log("Loose (flat):", result.loose.length);
      console.log("Auto wall height:", autoWallHeight.toFixed(1));
      if (result.walls.length === 0) {
        console.warn("⚠️ No wall elements found! Check layer mapping in Import Wizard.");
      }
      // Show unique layers and their classification for debugging
      const layerMap = new Map<string, { count: number; types: Set<string> }>();
      for (const el of elements) {
        const lId = el.layerId || "0";
        const entry = layerMap.get(lId) || { count: 0, types: new Set<string>() };
        entry.count++;
        const ov = layerOverride?.[lId];
        entry.types.add(ov ?? "(auto)");
        layerMap.set(lId, entry);
      }
      console.table(Object.fromEntries([...layerMap.entries()].map(([k, v]) => [k, { count: v.count, override: [...v.types].join(",") }])));
      console.groupEnd();
      return result;
    },
    [hasAnyArchType, elements, layerOverride, autoWallHeight]
  );
  const dxfWallSegs = useMemo(

    () => dxfClassified ? buildWallSegmentsFromSemanticWalls(dxfClassified.walls) : null,
    [dxfClassified]
  );

  if (dxfClassified && dxfWallSegs) {
    const { doors: hDoors, windows: hWindows, loose: hLoose } = dxfClassified;
    // Use instanced rendering for large DXF wall counts — 1 draw call instead of N
    const wallsEl = dxfWallSegs.length > 100
      ? <InstancedWallsMesh segments={dxfWallSegs} wallHeight={autoWallHeight} color="#f7f7f6" materialName={facadeMaterial} />
      : dxfWallSegs.map((segment) => (
          <WallMesh key={segment.id} segment={segment} color="#f7f7f6" wallHeight={autoWallHeight} activeTool={activeTool} onElementClick={onElementClick} materialName={facadeMaterial} />
        ));
    return (
      <>
        {bounds && (
          <mesh position={[bounds.minX + (bounds.maxX - bounds.minX) / 2, -FLOOR_THICKNESS / 2, bounds.minZ + (bounds.maxZ - bounds.minZ) / 2]} receiveShadow>
            <boxGeometry args={[(bounds.maxX - bounds.minX) + 24, FLOOR_THICKNESS, (bounds.maxZ - bounds.minZ) + 24]} />
            <meshStandardMaterial color="#d6d6d4" />
          </mesh>
        )}
        {wallsEl}
        {hDoors.map((el) => (
          <DoorMesh key={el.id} door={el} activeTool={activeTool} onElementClick={onElementClick} />
        ))}
        {hWindows.map((el) => (
          <FlatElementMesh key={el.id} el={el} blockDefs={blockDefs} activeTool={activeTool} onElementClick={onElementClick} />
        ))}
        {hLoose.map((el) => (
          <FlatElementMesh key={el.id} el={el} blockDefs={blockDefs} activeTool={activeTool} onElementClick={onElementClick} />
        ))}
      </>
    );
  }

  const looseBounds = bounds
    ? { x: bounds.minX - 60, z: bounds.minZ - 60, w: (bounds.maxX - bounds.minX) + 120, d: (bounds.maxZ - bounds.minZ) + 120 }
    : null;

  return (
    <>
      {looseBounds && (
        <mesh position={[looseBounds.x + looseBounds.w / 2, -FLOOR_THICKNESS / 2, looseBounds.z + looseBounds.d / 2]} receiveShadow>
          <boxGeometry args={[looseBounds.w, FLOOR_THICKNESS, looseBounds.d]} />
          <meshStandardMaterial color="#e8eaec" />
        </mesh>
      )}
      {elements.map((el) => (
        <FlatElementMesh key={el.id} el={el} blockDefs={blockDefs} activeTool={activeTool} onElementClick={onElementClick} />
      ))}
    </>
  );
}

/** GLTF export: watches trigger state and downloads scene as .gltf */
function ExportManager({ trigger, onDone }: { trigger: string; onDone: () => void }) {
  const { scene } = useThree();
  useEffect(() => {
    if (trigger !== "gltf") return;
    import("three/examples/jsm/exporters/GLTFExporter.js").then(({ GLTFExporter }) => {
      const exporter = new GLTFExporter();
      // Export only the model group (skip ground/grid helpers)
      const targets: THREE.Object3D[] = [];
      scene.traverse((obj) => {
        if (obj.name && obj.name !== "ground-plane" && obj instanceof THREE.Mesh) {
          targets.push(obj);
        }
      });
      exporter.parse(
        targets.length > 0 ? targets : scene,
        (result) => {
          const blob = new Blob([JSON.stringify(result)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a"); a.href = url;
          a.download = `arch-tech-${Date.now()}.gltf`;
          a.click(); URL.revokeObjectURL(url);
          onDone();
        },
        (err) => { console.error("GLTF export error:", err); onDone(); },
        { binary: false }
      );
    });
  }, [trigger, scene, onDone]);
  return null;
}

/** Procedural grass PBR ground plane */
function GrassMesh({ orbitTarget, span }: { orbitTarget: [number, number, number]; span: number }) {
  const grassTexture = useMemo(() => {
    const size = 512;
    const canvas = document.createElement("canvas");
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#7da055";
    ctx.fillRect(0, 0, size, size);
    // Grass blade strokes
    for (let i = 0; i < 6000; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const h = 3 + Math.random() * 10;
      const r = 60 + Math.floor(Math.random() * 40);
      const g = 100 + Math.floor(Math.random() * 55);
      const b = 28 + Math.floor(Math.random() * 30);
      ctx.fillStyle = `rgba(${r},${g},${b},${0.45 + Math.random() * 0.4})`;
      ctx.fillRect(x, y, 1 + Math.random() * 1.5, h);
    }
    // Darker patches
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * size; const y = Math.random() * size;
      ctx.fillStyle = `rgba(50,80,20,${0.15 + Math.random() * 0.2})`;
      ctx.beginPath();
      ctx.ellipse(x, y, 6 + Math.random() * 10, 4 + Math.random() * 6, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(40, 40);
    return tex;
  }, []);

  return (
    <mesh name="ground-plane" rotation={[-Math.PI / 2, 0, 0]} position={[orbitTarget[0], -0.2, orbitTarget[2]]} receiveShadow>
      <planeGeometry args={[Math.max(4000, span * 1.5), Math.max(4000, span * 1.5)]} />
      <meshStandardMaterial map={grassTexture} roughness={0.88} metalness={0} />
    </mesh>
  );
}

/** Low-poly tree: 3-tier cone foliage + cylinder trunk */
function LowPolyTree({ x, z, h = 80 }: { x: number; z: number; h?: number }) {
  return (
    <group>
      <mesh position={[x, h * 0.2, z]} castShadow>
        <cylinderGeometry args={[h * 0.045, h * 0.065, h * 0.4, 6]} />
        <meshStandardMaterial color="#5c3a1e" roughness={0.9} />
      </mesh>
      <mesh position={[x, h * 0.58, z]} castShadow>
        <coneGeometry args={[h * 0.30, h * 0.50, 7]} />
        <meshStandardMaterial color="#1f5c1f" roughness={0.85} />
      </mesh>
      <mesh position={[x, h * 0.78, z]} castShadow>
        <coneGeometry args={[h * 0.22, h * 0.38, 7]} />
        <meshStandardMaterial color="#276b27" roughness={0.85} />
      </mesh>
      <mesh position={[x, h * 0.96, z]} castShadow>
        <coneGeometry args={[h * 0.14, h * 0.28, 7]} />
        <meshStandardMaterial color="#348534" roughness={0.85} />
      </mesh>
    </group>
  );
}

/** Puffy cloud: cluster of overlapping spheres */
function SimpleCloud({ x, y, z, s = 60 }: { x: number; y: number; z: number; s?: number }) {
  const CloudSphere = ({ r, px = 0, py = 0, pz = 0 }: { r: number; px?: number; py?: number; pz?: number }) => (
    <mesh position={[px, py, pz]}>
      <sphereGeometry args={[r, 8, 8]} />
      <meshStandardMaterial color="#f8f8ff" roughness={1} metalness={0} />
    </mesh>
  );
  return (
    <group position={[x, y, z]}>
      <CloudSphere r={s} />
      <CloudSphere r={s * 0.78} px={s * 0.85} py={s * 0.05} />
      <CloudSphere r={s * 0.72} px={-s * 0.75} />
      <CloudSphere r={s * 0.58} px={s * 0.2} py={s * 0.5} />
      <CloudSphere r={s * 0.52} px={-s * 0.3} py={s * 0.35} />
    </group>
  );
}

/** Simple low-poly car */
function SimpleCar({ x, z, color = "#c0392b", ry = 0 }: { x: number; z: number; color?: string; ry?: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, ry, 0]}>
      <mesh position={[0, 18, 0]} castShadow>
        <boxGeometry args={[80, 25, 38]} />
        <meshStandardMaterial color={color} metalness={0.45} roughness={0.35} />
      </mesh>
      <mesh position={[0, 35, 2]} castShadow>
        <boxGeometry args={[44, 20, 34]} />
        <meshStandardMaterial color={color} metalness={0.45} roughness={0.35} />
      </mesh>
      {([-26, 26] as number[]).flatMap(wx =>
        ([-16, 16] as number[]).map(wz => (
          <mesh key={`${wx}${wz}`} position={[wx, 9, wz]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[9, 9, 7, 10]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
          </mesh>
        ))
      )}
    </group>
  );
}

/** Road cross: two asphalt planes + sidewalks + trees + cars + clouds */
function Landscape({ orbitTarget, span }: { orbitTarget: [number, number, number]; span: number }) {
  const roadW = Math.max(80, span * 0.14);
  const roadL = Math.max(2000, span * 2.2);
  const [ox, , oz] = orbitTarget;

  // Scatter trees, clouds and cars around the building in a deterministic pattern
  const treePositions: { x: number; z: number; h: number }[] = [];
  const carPositions: { x: number; z: number; color: string; ry: number }[] = [];
  const cloudPositions: { x: number; y: number; z: number; s: number }[] = [];

  // 16 trees in a ring at ~1.4× span
  for (let i = 0; i < 16; i++) {
    const ang = (i / 16) * Math.PI * 2 + 0.3;
    const r = span * (0.7 + ((i * 7 + 3) % 5) * 0.08);
    treePositions.push({ x: ox + Math.cos(ang) * r, z: oz + Math.sin(ang) * r, h: 60 + (i % 4) * 20 });
  }
  // 4 cars parked on road edges
  const carColors = ["#c0392b", "#2980b9", "#f39c12", "#27ae60"];
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const r = span * 0.55 + roadW * 0.3;
    carPositions.push({ x: ox + Math.cos(ang) * r, z: oz + Math.sin(ang) * r, color: carColors[i], ry: ang + Math.PI / 2 });
  }
  // 6 clouds at varying heights
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    const r = span * (0.4 + (i % 3) * 0.15);
    cloudPositions.push({ x: ox + Math.cos(ang) * r, y: span * 0.5 + (i % 3) * 80, z: oz + Math.sin(ang) * r, s: 40 + (i % 4) * 15 });
  }

  return (
    <>
      {/* Road: horizontal */}
      <mesh position={[ox, -0.08, oz]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[roadL, roadW]} />
        <meshStandardMaterial color="#4a4a4a" roughness={0.95} metalness={0} />
      </mesh>
      {/* Road: vertical */}
      <mesh position={[ox, -0.08, oz]} rotation={[-Math.PI / 2, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[roadL, roadW]} />
        <meshStandardMaterial color="#4a4a4a" roughness={0.95} metalness={0} />
      </mesh>
      {/* Sidewalk strips beside road */}
      <mesh position={[ox, -0.07, oz + roadW * 0.6]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[roadL, roadW * 0.25]} />
        <meshStandardMaterial color="#888888" roughness={0.9} />
      </mesh>
      <mesh position={[ox, -0.07, oz - roadW * 0.6]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[roadL, roadW * 0.25]} />
        <meshStandardMaterial color="#888888" roughness={0.9} />
      </mesh>

      {/* Trees */}
      {treePositions.map((p, i) => <LowPolyTree key={`tree-${i}`} x={p.x} z={p.z} h={p.h} />)}

      {/* Cars */}
      {carPositions.map((c, i) => <SimpleCar key={`car-${i}`} x={c.x} z={c.z} color={c.color} ry={c.ry} />)}

      {/* Clouds */}
      {cloudPositions.map((cl, i) => <SimpleCloud key={`cloud-${i}`} x={cl.x} y={cl.y} z={cl.z} s={cl.s} />)}
    </>
  );
}

/** Human scale mannequin — 1.7m tall figure for scale reference */
function Mannequin({ x, z }: { x: number; z: number }) {
  const mat = <meshStandardMaterial color="#e8c4a0" roughness={0.7} metalness={0} />;
  return (
    <group>
      {/* Torso */}
      <mesh position={[x, 0.95, z]} castShadow>
        <cylinderGeometry args={[0.22, 0.20, 0.85, 8]} />{mat}
      </mesh>
      {/* Head */}
      <mesh position={[x, 1.62, z]} castShadow>
        <sphereGeometry args={[0.17, 8, 8]} />{mat}
      </mesh>
      {/* Left leg */}
      <mesh position={[x - 0.12, 0.33, z]} castShadow>
        <cylinderGeometry args={[0.085, 0.075, 0.66, 6]} />{mat}
      </mesh>
      {/* Right leg */}
      <mesh position={[x + 0.12, 0.33, z]} castShadow>
        <cylinderGeometry args={[0.085, 0.075, 0.66, 6]} />{mat}
      </mesh>
      {/* Left arm */}
      <mesh position={[x - 0.34, 0.92, z]} rotation={[0, 0, Math.PI / 5]} castShadow>
        <cylinderGeometry args={[0.065, 0.055, 0.58, 6]} />{mat}
      </mesh>
      {/* Right arm */}
      <mesh position={[x + 0.34, 0.92, z]} rotation={[0, 0, -Math.PI / 5]} castShadow>
        <cylinderGeometry args={[0.065, 0.055, 0.58, 6]} />{mat}
      </mesh>
      {/* Height label */}
      <mesh position={[x, 2.0, z]}>
        <boxGeometry args={[0.001, 0.001, 0.001]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </group>
  );
}

function Scene({
  elements, doorWinEls, plan, blockDefs, revisionKey, viewAngle, onViewConsumed,
  activeTool, wallHeight, onElementClick,
  activeDrawingState, setActiveDrawingState, onDrawingClosed,
  shapes, onShapeDepthChange, measurePoints, setMeasurePoints,
  bimResult, showBim, layerOverride,
  explodedView, sectionCut, roofType, roofPitch, facadeMaterial, roofMaterial,
  quality,
}: {
  elements: DrawingElement[];
  doorWinEls: DrawingElement[];
  plan: ArchitecturalPlan | null;
  blockDefs: any;
  revisionKey?: string;
  viewAngle: ViewAngle;
  onViewConsumed: () => void;
  activeTool: string;
  wallHeight: number;
  onElementClick: (id: string) => void;
  activeDrawingState: DrawingState | null;
  setActiveDrawingState: React.Dispatch<React.SetStateAction<DrawingState | null>>;
  onDrawingClosed: (points2D: THREE.Vector2[], basisMatrix: THREE.Matrix4, normal: THREE.Vector3, origin: THREE.Vector3) => void;
  shapes: ShapeWithDepth[];
  onShapeDepthChange: (id: string, depth: number) => void;
  measurePoints: { start: THREE.Vector3 | null; end: THREE.Vector3 | null };
  setMeasurePoints: React.Dispatch<React.SetStateAction<{ start: THREE.Vector3 | null; end: THREE.Vector3 | null }>>;
  bimResult?: BIMResult | null;
  showBim?: boolean;
  layerOverride?: import("../canvas/3d/geometry/planClassification").LayerOverride;
  explodedView: boolean;
  sectionCut: boolean;
  roofType: RoofType;
  roofPitch: number;
  facadeMaterial: string;
  roofMaterial: string;
  quality: "low" | "medium" | "high";
}) {
  const { gl } = useThree();
  const bounds = useMemo(() => getPlanBounds(elements), [elements]);

  // Floating origin: imported DXF drawings can sit hundreds of thousands of units
  // from (0,0). Rendering geometry at those raw coordinates collapses float32
  // precision and pushes the model outside the depth/fog range, so it shows as an
  // empty grey scene even though the data is valid. We translate the rendered
  // geometry by -center so it draws around the origin (like tool-drawn plans),
  // and feed the camera/fog a matching origin-centered bounds.
  const cx = bounds ? (bounds.minX + bounds.maxX) / 2 : 0;
  const cz = bounds ? (bounds.minZ + bounds.maxZ) / 2 : 0;

  // Manage local clipping planes for the section cuts feature
  useEffect(() => {
    gl.localClippingEnabled = sectionCut;
    if (sectionCut) {
      const plane = new THREE.Plane(new THREE.Vector3(1, 0, 0), -cx);
      gl.clippingPlanes = [plane];
    } else {
      gl.clippingPlanes = [];
    }
    return () => {
      gl.clippingPlanes = [];
    };
  }, [sectionCut, cx, gl]);

  const localBounds = useMemo(() => bounds ? {
    minX: bounds.minX - cx, maxX: bounds.maxX - cx,
    minZ: bounds.minZ - cz, maxZ: bounds.maxZ - cz,
  } : null, [bounds, cx, cz]);

  const orbitTarget = localBounds
    ? [(localBounds.minX + localBounds.maxX) / 2, 10, (localBounds.minZ + localBounds.maxZ) / 2] as [number, number, number]
    : [500, 10, 350] as [number, number, number];
  const controlsRef = useRef<any>(null);

  // Scale-aware fog — prevent grey wall for large-coordinate DXF drawings
  const span = localBounds
    ? Math.max(localBounds.maxX - localBounds.minX, localBounds.maxZ - localBounds.minZ, 200)
    : 800;
  const fogNear = span * 0.5;
  const fogFar = span * 4;
  const orbitMaxDist = Math.max(1800, span * 2.5);
  const gridSize = Math.max(1200, span * 1.2);
  const gridCellSize = Math.max(20, Math.pow(10, Math.floor(Math.log10(span / 20))));
  const gridSectionSize = gridCellSize * 5;

  return (
    <>
      {/* Realistic sky — rayleigh scattering + sun disk */}
      <Sky distance={450000} sunPosition={[200, 80, -100]} inclination={0.49} azimuth={0.25} turbidity={8} rayleigh={1.2} mieCoefficient={0.005} mieDirectionalG={0.85} />
      {/* HDRI environment — ambient reflections on glass and steel */}
      {quality !== "low" && <Environment preset="sunset" background={false} />}
      <fog attach="fog" args={["#c8dff5", fogNear, fogFar]} />

      {/* Hemisphere: sky blue from above, warm ground bounce from below */}
      <hemisphereLight args={["#b8d4f0", "#c8b89a", 0.7]} />
      {/* Main sun — soft PCF shadows */}
      <directionalLight
        position={[200, 300, -100]}
        intensity={2.2}
        castShadow
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
        shadow-bias={-0.0003}
        shadow-camera-near={1}
        shadow-camera-far={4000}
        shadow-camera-left={-1500}
        shadow-camera-right={1500}
        shadow-camera-top={1500}
        shadow-camera-bottom={-1500}
      />
      {/* Soft fill light from opposite side */}
      <directionalLight position={[-120, 120, 80]} intensity={0.35} />

      <Grid position={[0, -1.2, 0]} args={[gridSize, gridSize]} cellSize={gridCellSize} cellThickness={0.5} cellColor="#cbd5e1" sectionSize={gridSectionSize} sectionThickness={1} sectionColor="#94a3b8" fadeDistance={Math.max(800, span * 0.8)} />
      <AutoFrame bounds={localBounds} revisionKey={revisionKey} />
      <CameraController bounds={localBounds} viewAngle={viewAngle} onViewConsumed={onViewConsumed} controlsRef={controlsRef} />
      {/* Ground plane — procedural grass PBR texture */}
      <GrassMesh orbitTarget={orbitTarget} span={span} />
      {/* Contact shadows — soft blurred shadows directly under the building */}
      <ContactShadows position={[orbitTarget[0], -0.15, orbitTarget[2]]} width={Math.max(600, span * 1.2)} height={Math.max(600, span * 1.2)} far={400} blur={2.5} opacity={0.45} />
      {/* Miniature landscape — trees, road, clouds, cars */}
      {elements.length > 0 && <Landscape orbitTarget={orbitTarget} span={span} />}
      {/* Human scale mannequin — for spatial reference */}
      {elements.length > 0 && (
        <Mannequin x={orbitTarget[0] + span * 0.55} z={orbitTarget[2] + span * 0.25} />
      )}
      {/* Geometry is drawn at raw coordinates but shifted to the local origin. */}
      <group position={[-cx, 0, -cz]}>
        {/* Doors & windows from raw elements — rendered alongside BIM walls when showBim active */}
        {doorWinEls.map(el =>
          el.archType === "door"
            ? <DoorMesh key={el.id} door={el} activeTool={activeTool} onElementClick={onElementClick} />
            : <FlatElementMesh key={el.id} el={el} blockDefs={blockDefs} activeTool={activeTool} onElementClick={onElementClick} />
        )}
        <PlanModel
          elements={elements}
          plan={plan}
          blockDefs={blockDefs}
          activeTool={activeTool}
          onElementClick={onElementClick}
          wallHeight={wallHeight}
          bounds={bounds}
          layerOverride={layerOverride}
          facadeMaterial={facadeMaterial}
          roofType={roofType}
          roofPitch={roofPitch}
          roofMaterial={roofMaterial}
        />
        {bimResult && showBim && (
          <BimModelRenderer
            result={bimResult}
            explodeOffset={explodedView ? 2500 : 0}
            facadeMaterial={facadeMaterial}
            roofMaterial={roofMaterial}
            roofType={roofType}
            roofPitch={roofPitch}
          />
        )}
      </group>
      <DrawOnFaceController activeTool={activeTool} onDrawingClosed={onDrawingClosed} activeDrawingState={activeDrawingState} setActiveDrawingState={setActiveDrawingState} />
      <TapeMeasureController activeTool={activeTool} measurePoints={measurePoints} setMeasurePoints={setMeasurePoints} />
      {shapes.map((s) => <DrawnPolygonShape key={s.id} shape={s} />)}
      <PushPullDragController activeTool={activeTool} shapes={shapes} onDepthChange={onShapeDepthChange} />
      <WallDrawController activeTool={activeTool} center={{ cx, cz }} />
      <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
        <GizmoViewport axisColors={["#ef4444", "#22c55e", "#3b82f6"]} labelColor="white" />
      </GizmoHelper>
      <OrbitControls
        ref={controlsRef}
        enableDamping dampingFactor={0.12} minDistance={10} maxDistance={orbitMaxDist}
        zoomSpeed={1.5} panSpeed={1.2} rotateSpeed={0.8}
        screenSpacePanning
        enablePan
        maxPolarAngle={Math.PI / 2.12} target={orbitTarget}
        enabled={activeTool !== "line" && activeTool !== "wall3d"}
        mouseButtons={(() => {
          // CAD-style: Left=Rotate, Middle=Pan, Right=Pan, Scroll=Zoom
          if (activeTool === "pan") return { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE };
          if (activeTool === "zoom") return { LEFT: THREE.MOUSE.DOLLY, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.PAN };
          return { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.PAN };
        })()}
        touches={{
          ONE: THREE.TOUCH.ROTATE,
          TWO: THREE.TOUCH.DOLLY_PAN,
        }}
      />
    </>
  );
}

function RegionSelector({ onSelect, onCancel }: {
  onSelect: (rect: { x: number; y: number; w: number; h: number }) => void;
  onCancel: () => void;
}) {
  const [drag, setDrag] = useState<{ startX: number; startY: number; curX: number; curY: number } | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setDrag({ startX: e.clientX, startY: e.clientY, curX: e.clientX, curY: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!drag) return;
    setDrag((d) => d ? { ...d, curX: e.clientX, curY: e.clientY } : null);
  };

  const handleMouseUp = () => {
    if (!drag) return;
    const x = Math.min(drag.startX, drag.curX);
    const y = Math.min(drag.startY, drag.curY);
    const w = Math.abs(drag.curX - drag.startX);
    const h = Math.abs(drag.curY - drag.startY);
    if (w < 10 || h < 10) { onCancel(); return; }
    onSelect({ x, y, w, h });
  };

  const rect = drag ? {
    left: Math.min(drag.startX, drag.curX),
    top: Math.min(drag.startY, drag.curY),
    width: Math.abs(drag.curX - drag.startX),
    height: Math.abs(drag.curY - drag.startY),
  } : null;

  return (
    <div
      className="absolute inset-0 z-40 cursor-crosshair"
      style={{ background: "rgba(30,64,175,0.08)" }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-blue-700/90 text-white text-[11px] font-semibold px-4 py-1.5 rounded-full shadow-lg pointer-events-none">
        Drag to select the floor plan region — Esc to cancel
      </div>
      {rect && (
        <div
          className="absolute border-2 border-blue-400 bg-blue-400/10 pointer-events-none"
          style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
        />
      )}
    </div>
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
  const [activeTool, setActiveTool] = useState<string>("select");
  const [wallHeight, setWallHeight] = useState(34);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeDrawingState, setActiveDrawingState] = useState<DrawingState | null>(null);
  const [shapes, setShapes] = useState<ShapeWithDepth[]>([]);
  const [measurePoints, setMeasurePoints] = useState<{ start: THREE.Vector3 | null; end: THREE.Vector3 | null }>({ start: null, end: null });
  const formatLength = useDrawingStore((state) => state.formatLength);
  const panOffset = useDrawingStore((state) => state.panOffset);
  const zoom = useDrawingStore((state) => state.zoom);
  const currentDrawingId = useDrawingStore((state) => state.currentDrawingId);
  const dxfLayerOverride = useDrawingStore((state) => state.dxfLayerOverride);
  const { status: analyzeStatus, result: bimResult, error: analyzeError, start: startAnalysis } = useAnalysisJob(currentDrawingId);
  const [showBim, setShowBim] = useState(false);

  // Styling and Roof States
  const [explodedView, setExplodedView] = useState(false);
  const [sectionCut, setSectionCut] = useState(false);
  const [roofType, setRoofType] = useState<RoofType>("gable");
  const [roofPitch, setRoofPitch] = useState(30);
  const [facadeMaterial, setFacadeMaterial] = useState("plaster");
  const [roofMaterial, setRoofMaterial] = useState("roof_tile");
  const [useTextures, setUseTextures] = useState(false);
  const [quality, setQuality] = useState<"low" | "medium" | "high">("high");
  const [exportTrigger, setExportTrigger] = useState<"" | "gltf">("");
  const handleToggleTextures = (v: boolean) => {
    MaterialService.setUseTextures(v);
    setUseTextures(v);
  };
  // Auto-downgrade quality when PerformanceMonitor signals low FPS
  const handlePerformanceDecline = () => {
    setQuality(q => q === "high" ? "medium" : "low");
  };

  const localBimResult = useMemo(() => {
    return elementsToBimResult(elements);
  }, [elements]);

  const effectiveBimResult = bimResult || localBimResult;

  const hasLocalWalls = localBimResult.walls.length > 0;
  useEffect(() => {
    if (bimResult || hasLocalWalls) {
      setShowBim(true);
    }
  }, [bimResult, hasLocalWalls]);

  const planElements = useMemo(() => {
    if (showBim && effectiveBimResult && effectiveBimResult.walls.length > 0) {
      // Exclude walls (BimModelRenderer handles them), keep everything else including doors/windows
      // doorWinEls below renders doors/windows separately via DoorMesh for proper 3D geometry
      return elements.filter(
        (el) =>
          el.type !== "wall" &&
          el.archType !== "wall" &&
          el.type !== "opening" &&
          el.archType !== "door" &&
          el.archType !== "window"
      );
    }
    return elements;
  }, [elements, showBim, effectiveBimResult]);

  // Door & window elements rendered separately with proper 3D mesh when BIM walls are active
  const doorWinEls = useMemo(() => {
    if (showBim && effectiveBimResult && effectiveBimResult.walls.length > 0) {
      return elements.filter(el => el.archType === "door" || el.archType === "window");
    }
    return [] as DrawingElement[];
  }, [elements, showBim, effectiveBimResult]);

  // Surface analysis failures instead of silently showing nothing.
  useEffect(() => {
    if (analyzeStatus === "error") {
      setNotice(`3D analysis failed: ${analyzeError ?? "unknown error"}`);
      const t = setTimeout(() => setNotice(null), 8000);
      return () => clearTimeout(t);
    }
    if (analyzeStatus === "done" && bimResult && bimResult.walls.length === 0) {
      setNotice("Analysis finished but found no walls to build. Try the layer mapping in the import wizard, or check the drawing's layers.");
      const t = setTimeout(() => setNotice(null), 8000);
      return () => clearTimeout(t);
    }
  }, [analyzeStatus, analyzeError, bimResult]);
  const [floorPlanRegion, setFloorPlanRegion] = useState<{ minX: number; minZ: number; maxX: number; maxZ: number } | null>(null);

  const canvasBounds = useMemo(() => getPlanBounds(elements), [elements]);
  const canvasFar = canvasBounds
    ? Math.max(4000, Math.max(
        canvasBounds.maxX - canvasBounds.minX,
        canvasBounds.maxZ - canvasBounds.minZ
      ) * 4)
    : 4000;

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveDrawingState(null);
        setMeasurePoints({ start: null, end: null });
        if (activeTool === "floor-pick") setActiveTool("select");
        else setActiveTool("select");
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  const deleteElement = (id: string) => {
    useDrawingStore.setState((state) => {
      const newElements = state.elements.filter((el) => el.id !== id);
      return { elements: newElements, history: [...state.history.slice(0, state.historyIndex + 1), newElements], historyIndex: state.historyIndex + 1 };
    });
  };

  const show2DNotice = (toolName: string) => {
    setNotice(`${toolName} is a 2D Drawing Tool. Switch back to 2D Mode to use it.`);
    setTimeout(() => setNotice(null), 3000);
  };

  const showInteractionNotice = (toolName: string) => {
    setNotice(`${toolName} can be performed in 2D layout. Return to 2D editing for full operations.`);
    setTimeout(() => setNotice(null), 3000);
  };

  const handleLineClick = () => {
    if (activeTool === "line") { setActiveDrawingState(null); setActiveTool("select"); }
    else { setActiveTool("line"); setActiveDrawingState(null); }
  };

  const handleInsertFurniture = (blockId: string) => {
    const els = useDrawingStore.getState().elements;
    let cx = 0, cy = 0;
    if (els.length > 0) {
      let sumX = 0, sumY = 0, count = 0;
      for (const el of els) {
        if (el.x1 !== undefined) { sumX += el.x1; sumY += (el.y1 ?? 0); count++; }
        if (el.x2 !== undefined) { sumX += el.x2; sumY += (el.y2 ?? 0); count++; }
        if (el.x !== undefined && el.x1 === undefined) { sumX += el.x; sumY += (el.y ?? 0); count++; }
      }
      if (count > 0) { cx = sumX / count; cy = sumY / count; }
    }
    useDrawingStore.getState().insertBlock(blockId, cx, cy);
  };

  const handleDrawingClosed = (points2D: THREE.Vector2[], basisMatrix: THREE.Matrix4, normal: THREE.Vector3, origin: THREE.Vector3) => {
    const id = Math.random().toString(36).slice(2);
    setShapes((prev) => [...prev, { points2D, basisMatrix, normal, origin, depth: 0, id }]);
    setActiveTool("pushpull");
  };

  const updateShapeDepth = (id: string, depth: number) => {
    setShapes((prev) => prev.map((s) => (s.id === id ? { ...s, depth } : s)));
  };

  // Filter elements to those inside the user-selected floor plan region
  const sceneElements = useMemo(() => {
    if (!floorPlanRegion) return elements;
    return elements.filter((el) => {
      const pts: { x: number; y: number }[] = [];
      if (el.type === "line") { pts.push({ x: el.x1 ?? 0, y: el.y1 ?? 0 }, { x: el.x2 ?? 0, y: el.y2 ?? 0 }); }
      else if ((el.type === "circle" || el.type === "arc") && el.cx != null) { pts.push({ x: el.cx as number, y: el.cy as number }); }
      else if (el.type === "rectangle" && el.x != null) { pts.push({ x: el.x as number, y: el.y as number }); }
      else if (Array.isArray(el.points) && el.points.length > 0) { pts.push(el.points[0]); }
      else if (el.x != null) { pts.push({ x: el.x as number, y: el.y as number }); }
      return pts.some((p) =>
        p.x >= floorPlanRegion.minX && p.x <= floorPlanRegion.maxX &&
        p.y >= floorPlanRegion.minZ && p.y <= floorPlanRegion.maxZ
      );
    });
  }, [elements, floorPlanRegion]);

  // Convert screen pixels → drawing coordinates using 2D canvas transform
  const screenToDrawing = (sx: number, sy: number) => ({
    x: (sx - panOffset.x) / zoom,
    y: (sy - panOffset.y) / zoom,
  });

  const handleRegionSelect = (rect: { x: number; y: number; w: number; h: number }) => {
    const tl = screenToDrawing(rect.x, rect.y);
    const br = screenToDrawing(rect.x + rect.w, rect.y + rect.h);
    setFloorPlanRegion({ minX: Math.min(tl.x, br.x), minZ: Math.min(tl.y, br.y), maxX: Math.max(tl.x, br.x), maxZ: Math.max(tl.y, br.y) });
    setActiveTool("select");
  };

  return (
    <div className={`absolute inset-0 z-10 bg-[#dfe3e8] ${visible ? "block" : "hidden"}`}>
      <div className="absolute left-4 top-4 z-20 rounded border border-white/60 bg-white/75 px-3 py-2 text-[11px] font-medium text-slate-700 shadow-sm backdrop-blur">
        3D Preview
        {floorPlanRegion && (
          <span className="ml-2 text-blue-600 font-semibold">· Floor Plan</span>
        )}
      </div>

      {notice && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-30 bg-slate-900/95 border border-slate-700/60 px-4 py-2 rounded-lg shadow-2xl text-[10px] font-bold text-blue-400 tracking-wider backdrop-blur select-none">
          {notice}
        </div>
      )}

      <ThreeToolbar
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        onLineClick={handleLineClick}
        onShow2DNotice={show2DNotice}
        onShowInteractionNotice={showInteractionNotice}
        hasRegion={floorPlanRegion !== null}
        onResetRegion={() => setFloorPlanRegion(null)}
        onAnalyze={currentDrawingId ? startAnalysis : undefined}
        analyzeStatus={analyzeStatus}
      />

      {bimResult && (
        <button
          onClick={() => setShowBim((v) => !v)}
          className="absolute top-4 right-16 z-20 text-xs px-3 py-1.5 rounded-lg bg-slate-900/95 border border-slate-700/60 text-slate-300 hover:text-white hover:bg-violet-700 transition-colors select-none backdrop-blur"
        >
          {showBim ? "Show DXF" : "Show BIM"}
        </button>
      )}

      {activeTool === "floor-pick" && (
        <RegionSelector onSelect={handleRegionSelect} onCancel={() => setActiveTool("select")} />
      )}

      <ViewCube viewAngle={viewAngle} setViewAngle={setViewAngle} />
      <BimStylingPanel
        explodedView={explodedView}
        setExplodedView={setExplodedView}
        sectionCut={sectionCut}
        setSectionCut={setSectionCut}
        roofType={roofType}
        setRoofType={setRoofType}
        roofPitch={roofPitch}
        setRoofPitch={setRoofPitch}
        facadeMaterial={facadeMaterial}
        setFacadeMaterial={setFacadeMaterial}
        roofMaterial={roofMaterial}
        setRoofMaterial={setRoofMaterial}
        useTextures={useTextures}
        setUseTextures={handleToggleTextures}
        quality={quality}
        setQuality={setQuality}
        onExportGLTF={() => setExportTrigger("gltf")}
        onExportIFC={() => downloadIFC(elements, `arch-tech-${Date.now()}.ifc`)}
      />
      <FurnitureQuickPanel onInsert={handleInsertFurniture} />

      {activeTool === "pushpull" && (
        <PushPullPanel
          shapes={shapes}
          wallHeight={wallHeight}
          setWallHeight={setWallHeight}
          onDepthChange={updateShapeDepth}
          formatLength={formatLength}
        />
      )}

      <Canvas
        shadows={{ type: THREE.PCFSoftShadowMap }}
        gl={{
          localClippingEnabled: true,
          logarithmicDepthBuffer: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.15,
        }}
        camera={{ position: [760, 420, 760], fov: 42, near: 1, far: canvasFar }}
      >
        {/* Auto-downgrade quality when FPS drops below 30 */}
        <PerformanceMonitor
          onDecline={handlePerformanceDecline}
          flipflops={3}
          threshold={0.9}
        />
        {/* GLTF export trigger */}
        <ExportManager trigger={exportTrigger} onDone={() => setExportTrigger("")} />
        <Scene
          elements={planElements}
          doorWinEls={doorWinEls}
          plan={plan}
          blockDefs={blockDefs}
          revisionKey={revisionKey}
          viewAngle={viewAngle}
          onViewConsumed={() => setViewAngle(null)}
          activeTool={activeTool}
          wallHeight={wallHeight}
          onElementClick={deleteElement}
          activeDrawingState={activeDrawingState}
          setActiveDrawingState={setActiveDrawingState}
          onDrawingClosed={handleDrawingClosed}
          shapes={shapes}
          onShapeDepthChange={updateShapeDepth}
          measurePoints={measurePoints}
          setMeasurePoints={setMeasurePoints}
          bimResult={effectiveBimResult}
          showBim={showBim}
          layerOverride={dxfLayerOverride ?? undefined}
          explodedView={explodedView}
          sectionCut={sectionCut}
          roofType={roofType}
          roofPitch={roofPitch}
          facadeMaterial={facadeMaterial}
          roofMaterial={roofMaterial}
          quality={quality}
        />
        {/* Post-processing — only on medium/high quality */}
        {quality !== "low" && (
          <EffectComposer enableNormalPass={false}>
            <Bloom
              luminanceThreshold={0.85}
              luminanceSmoothing={0.9}
              intensity={quality === "high" ? 0.4 : 0.2}
              mipmapBlur
            />
            <Vignette eskil={false} offset={0.4} darkness={quality === "high" ? 0.55 : 0.35} />
          </EffectComposer>
        )}
      </Canvas>
    </div>
  );
}
