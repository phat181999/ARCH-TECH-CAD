import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { Grid, Html, OrbitControls, Sky, ContactShadows, Environment, PerformanceMonitor } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette, SSAO } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import * as THREE from "three";
import type { ArchitecturalPlan, DrawingElement } from "../types";
import { useDrawingStore } from "../stores/drawingStore";
import { useThemeStore } from "../stores/themeStore";

import { WallMesh, InstancedWallsMesh, RoomMesh, RoofMesh, DoorMesh, FlatElementMesh, BimModelRenderer, FloorMesh, PipeMesh, StairMesh, InstancedColumnsMesh, InstancedWindowsMesh } from "../canvas/3d/components";
import { MepFittingMesh } from "../canvas/3d/components/MepFittingMesh";
import { MepFixtureMesh } from "../canvas/3d/components/MepFixtureMesh";
import { DrawingSheetExporter } from "../canvas/3d/components/DrawingSheetExporter";
import { computeMepJoints } from "../canvas/3d/geometry/mepJoints";
import { deriveRidgeParams } from "../canvas/3d/geometry/roofRidge";
import { FoundationMesh } from "../canvas/3d/components/FoundationMesh";
import { RainSystem } from "../canvas/3d/components/RainSystem";
import { NeighborBuildings } from "../canvas/3d/components/NeighborBuildings";
import { ScaleFigureModel } from "../canvas/3d/components/ScaleFigureModel";
import type { BIMResult } from "../api/client";
import { AutoFrame, CameraController, TapeMeasureController, DrawOnFaceController, DrawnPolygonShape, PushPullDragController, WallDrawController, WalkthroughController, FloorDrawController, WallMoveController, DoorPlacerController, TransformGizmoController, ShapeDrawController, PrimitiveDrawController, OffsetWallController, SectionPlaneController, AvatarWalkController, MepDrawController, RidgeLineController, MepFixturePlacerController } from "../canvas/3d/controllers";
import { classifyPlan, getPlanBounds, layerClassify, computeAutoWallHeight, isRectangle, roomBoundsFromBoundary } from "../canvas/3d/geometry/planClassification";
import { buildWallSegmentsFromSemanticWalls, wallSegmentsFromPlan, FLOOR_THICKNESS, WALL_THICKNESS } from "../canvas/3d/geometry/wallGeometry";
import { detectRooms } from "../canvas/3d/geometry/roomDetector";
import type { DrawingState, ShapeWithDepth, ViewAngle, PerfStats } from "../canvas/3d/types";
import { PushPullPanel, ViewerTopBar, RightSidebar, WallHeightPanel, WallPropertiesPanel, PaintPalettePanel, VisitedRoomsPanel, WallAssemblyPanel, FixturePalettePanel, WelcomeCard, WallDrawHintToast } from "../canvas/3d/components/ThreeViewerUI";
import { ToolRail, ToolBadge } from "../canvas/3d/components/ToolRail";
import type { MepFixtureType } from "../canvas/3d/materials/mepFixtures";
import { WALL_ASSEMBLY_PRESETS } from "../canvas/3d/materials/wallAssemblyPresets";
import { MaterialService } from "../canvas/3d/materials/materialService";
import { generateGrassNormalMap, generateLeafTexture } from "../canvas/3d/materials/proceduralTextures";
import type { RoofType } from "../canvas/3d/geometry/RoofGenerator";

import { useAnalysisJob } from "../hooks/useAnalysisJob";
import { elementsToBimResult } from "../canvas/3d/bridge/localBimBridge";
import { downloadIFC } from "../canvas/ifcExporter";

// Post-processing is decorative — if the EffectComposer throws (typically
// `getContextAttributes()` returning null after a lost WebGL context), drop
// the effects for the session instead of letting the error unmount the whole
// 3D viewer.
class PostFXBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err: unknown) { console.warn("[PostFX] post-processing disabled after error:", err); }
  render() { return this.state.failed ? null : this.props.children; }
}

// Cursor per active 3D tool, applied to the canvas host div.
const TOOL_CURSORS: Record<string, string> = {
  select: "default", eraser: "not-allowed", pan: "grab", zoom: "zoom-in",
  wall3d: "crosshair", floor3d: "crosshair", rect3d: "crosshair", circle3d: "crosshair",
  arc3d: "crosshair", box3d: "crosshair", cylinder3d: "crosshair", line: "crosshair",
  measure: "crosshair", "wall-offset": "crosshair", paint3d: "cell",
  "door-place3d": "copy", "window-place3d": "copy", "wall-move": "ew-resize",
};

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
  enablePBRShaders = false,
  materialById = new Map<string, string>(),
  showRoof = false,
  showFloorSlab = false,
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
  enablePBRShaders?: boolean;
  materialById?: Map<string, string>;
  /** Explicit opt-in — roof no longer appears just because a footprint/shell
      is known or walls happen to enclose it. */
  showRoof?: boolean;
  /** Explicit opt-in for the synthetic full-footprint floor slab. Floors
      you actually draw with the floor tool (archType "floor") always render
      regardless of this — that's real user input, not auto-bundling. */
  showFloorSlab?: boolean;
}) {
  // Roof ridge line drawn by the user — reshapes/reorients the generated roof.
  const roofRidge = useDrawingStore((s) => s.roofRidge);
  const ridgeParams = useMemo(
    () => (roofRidge && bounds ? deriveRidgeParams(roofRidge, bounds) : undefined),
    [roofRidge, bounds],
  );

  // ALL hooks must run before any conditional return below. They used to sit
  // between the returns, so the render path switching (e.g. the first wall
  // drawn moves an empty/DXF drawing onto the semantic-walls branch) changed
  // the number of hooks executed — React's "Rendered fewer hooks than
  // expected" crash that killed the 3D viewer on the first wall.
  const fallbackWalls = useMemo(() => elements.filter(el => el.archType === "wall" && (el.type === "line" || el.type === "polyline")), [elements]);
  const fallbackLoose = useMemo(() => elements.filter(el => el.archType !== "wall"), [elements]);

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

  if (architecturalPlan) {
    const footprintWidth = architecturalPlan.footprint.widthMeters * 100;
    const footprintHeight = architecturalPlan.footprint.heightMeters * 100;
    const centerX = bounds ? (bounds.minX + bounds.maxX) / 2 : 500;
    const centerZ = bounds ? (bounds.minZ + bounds.maxZ) / 2 : 350;
    const walls = wallSegmentsFromPlan(architecturalPlan);
    return (
      <>
        {showFloorSlab && (
          <>
            <mesh position={[centerX, -FLOOR_THICKNESS / 2, centerZ]} receiveShadow>
              <boxGeometry args={[footprintWidth + 24, FLOOR_THICKNESS, footprintHeight + 24]} />
              <meshStandardMaterial color="#d6d6d4" />
            </mesh>
            <mesh position={[centerX, 0.05, centerZ]} receiveShadow>
              <boxGeometry args={[footprintWidth, 0.1, footprintHeight]} />
              <meshStandardMaterial color="#f4f4f3" />
            </mesh>
          </>
        )}
        {walls.map((segment, index) => (
          <WallMesh
            key={`plan-wall-${index}`}
            segment={segment}
            color="#f7f7f6"
            wallHeight={wallHeight}
            activeTool={activeTool}
            onElementClick={onElementClick}
            materialName={(segment.id && materialById.get(segment.id)) || facadeMaterial}
            enablePBRShaders={enablePBRShaders}
          />
        ))}
        {showRoof && (
          <group userData={{ exportRoof: true }}>
            <RoofMesh
              x={centerX - footprintWidth / 2} z={centerZ - footprintHeight / 2}
              width={footprintWidth} depth={footprintHeight}
              wallHeight={wallHeight}
              type={roofType}
              pitch={roofPitch}
              materialName={roofMaterial}
              ridge={ridgeParams}
            />
          </group>
        )}
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
    // Drawing a footprint/shell rectangle used to auto-fabricate all 4
    // walls around it via buildOuterWalls even if you'd drawn none — the
    // same auto-bundling problem as the floor slab and roof below. Only
    // render walls you actually drew with the wall tool.
    const walls = plan.walls.length > 0 ? buildWallSegmentsFromSemanticWalls(plan.walls) : [];

    return (
      <>
        {showFloorSlab && (
          <>
            <mesh position={[shell.x + shell.width / 2, -FLOOR_THICKNESS / 2, shell.y + shell.height / 2]} receiveShadow>
              <boxGeometry args={[shell.width + 24, FLOOR_THICKNESS, shell.height + 24]} />
              <meshStandardMaterial color="#d6d6d4" />
            </mesh>
            <mesh position={[shell.x + shell.width / 2, 0.05, shell.y + shell.height / 2]} receiveShadow>
              <boxGeometry args={[shell.width, 0.1, shell.height]} />
              <meshStandardMaterial color="#f4f4f3" />
            </mesh>
          </>
        )}
        {walls.map((segment, index) => (
          <WallMesh
            key={`outer-${index}`}
            segment={segment}
            color="#f7f7f6"
            wallHeight={wallHeight}
            activeTool={activeTool}
            onElementClick={onElementClick}
            materialName={(segment.id && materialById.get(segment.id)) || facadeMaterial}
            enablePBRShaders={enablePBRShaders}
          />
        ))}
        {showRoof && (
          <group userData={{ exportRoof: true }}>
            <RoofMesh
              x={shell.x} z={shell.y}
              width={shell.width} depth={shell.height}
              wallHeight={wallHeight}
              type={roofType}
              pitch={roofPitch}
              materialName={roofMaterial}
              ridge={ridgeParams}
            />
          </group>
        )}
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

  if (fallbackWalls.length > 0) {
    const wallSegs = buildWallSegmentsFromSemanticWalls(fallbackWalls);
    return (
      <>
        {wallSegs.map((segment) => (
          <WallMesh key={segment.id} segment={segment} color="#f7f7f6" wallHeight={wallHeight} activeTool={activeTool} onElementClick={onElementClick} materialName={(segment.id && materialById.get(segment.id)) || facadeMaterial} enablePBRShaders={enablePBRShaders} />
        ))}
        {fallbackLoose.map((el) => (
          <FlatElementMesh key={el.id} el={el} blockDefs={blockDefs} activeTool={activeTool} onElementClick={onElementClick} />
        ))}
      </>
    );
  }

  if (dxfClassified && dxfWallSegs) {
    const { doors: hDoors, windows: hWindows, loose: hLoose } = dxfClassified;
    // Use instanced rendering for large DXF wall counts — 1 draw call instead of N
    const wallsEl = dxfWallSegs.length > 100
      ? <InstancedWallsMesh segments={dxfWallSegs} wallHeight={autoWallHeight} color="#f7f7f6" materialName={facadeMaterial} activeTool={activeTool} onElementClick={onElementClick} />
      : dxfWallSegs.map((segment) => (
          <WallMesh key={segment.id} segment={segment} color="#f7f7f6" wallHeight={autoWallHeight} activeTool={activeTool} onElementClick={onElementClick} materialName={(segment.id && materialById.get(segment.id)) || facadeMaterial} enablePBRShaders={enablePBRShaders} />
        ));
    return (
      <>
        {showFloorSlab && bounds && (
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

/** Procedural grass PBR ground plane with normal map for realistic blade lighting */
function GrassMesh({
  orbitTarget,
  span,
  groundColor = "#7da055",
  isSceneryEnabled = true,
  isDark = true,
}: {
  orbitTarget: [number, number, number];
  span: number;
  groundColor?: string;
  isSceneryEnabled?: boolean;
  isDark?: boolean;
}) {
  const grassTexture = useMemo(() => {
    if (!isSceneryEnabled) return null;
    const size = 512;
    const canvas = document.createElement("canvas");
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = groundColor;
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
  }, [groundColor, isSceneryEnabled]);

  const grassNormal = useMemo(() => {
    if (!isSceneryEnabled) return null;
    return generateGrassNormalMap();
  }, [isSceneryEnabled]);

  const normalScale = useMemo(() => new THREE.Vector2(0.8, 0.8), []);

  return (
    <mesh name="ground-plane" rotation={[-Math.PI / 2, 0, 0]} position={[orbitTarget[0], -1.0, orbitTarget[2]]} receiveShadow>
      <planeGeometry args={[Math.max(4000, span * 1.5), Math.max(4000, span * 1.5)]} />
      {isSceneryEnabled ? (
        <meshStandardMaterial
          map={grassTexture ?? undefined}
          normalMap={grassNormal ?? undefined}
          normalScale={normalScale}
          roughness={0.92}
          metalness={0}
        />
      ) : (
        <meshStandardMaterial color={isDark ? "#1e293b" : "#f1f5f9"} roughness={0.9} metalness={0.1} />
      )}
    </mesh>
  );
}

// Samples real, browser-exposed rendering cost every ~500ms: FPS/frame time
// (CPU-side — main thread + driver overhead) and draw calls/triangles (GPU-side
// submission cost). Browsers don't expose actual CPU/GPU utilization percentages
// to web content, so these are the closest honest proxies. Lives inside <Canvas>
// (needs the R3F frame loop and gl context); reports up via a plain callback so
// the HTML overlay can render outside the WebGL tree.
function PerfStatsProbe({ onStats }: { onStats: (s: PerfStats) => void }) {
  const gl = useThree((s) => s.gl);
  const gpuNameRef = useRef<string | null>(null);
  const frameCount = useRef(0);
  const windowStart = useRef(0);

  useEffect(() => {
    // GPU device name is static for the session — read once. The extension is
    // deprecated but still broadly supported; absence (e.g. some Linux/Firefox
    // configs) just means we show no GPU name rather than a fake one.
    const ctx = gl.getContext();
    const ext = ctx.getExtension("WEBGL_debug_renderer_info");
    gpuNameRef.current = ext ? (ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string) : null;
  }, [gl]);

  useFrame(() => {
    frameCount.current += 1;
    const now = performance.now();
    if (windowStart.current === 0) windowStart.current = now;
    const elapsed = now - windowStart.current;
    if (elapsed >= 500) {
      onStats({
        fps: Math.round((frameCount.current / elapsed) * 1000),
        frameMs: Math.round((elapsed / frameCount.current) * 10) / 10,
        drawCalls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        gpu: gpuNameRef.current,
      });
      frameCount.current = 0;
      windowStart.current = now;
    }
  });

  return null;
}

/**
 * Organic foliage tree — overlapping spheres with a procedural leaf texture.
 * Much more realistic than cones; casts natural-looking dappled shadows.
 */
function LowPolyTree({ x, z, h = 80, foliageColor = "#1f5c1f" }: { x: number; z: number; h?: number; foliageColor?: string }) {
  const leafTex = useMemo(() => generateLeafTexture(foliageColor), [foliageColor]);

  return (
    <group>
      {/* Trunk */}
      <mesh position={[x, h * 0.25, z]} castShadow receiveShadow>
        <cylinderGeometry args={[h * 0.03, h * 0.05, h * 0.5, 8]} />
        <meshStandardMaterial color="#4a2e1b" roughness={0.92} />
      </mesh>
      {/* Crown — 5 overlapping spheres for organic silhouette */}
      <mesh position={[x, h * 0.72, z]} castShadow receiveShadow>
        <sphereGeometry args={[h * 0.22, 12, 10]} />
        <meshStandardMaterial map={leafTex} roughness={0.9} metalness={0} />
      </mesh>
      <mesh position={[x + h * 0.08, h * 0.58, z + h * 0.06]} castShadow receiveShadow>
        <sphereGeometry args={[h * 0.16, 10, 8]} />
        <meshStandardMaterial map={leafTex} roughness={0.9} metalness={0} />
      </mesh>
      <mesh position={[x - h * 0.09, h * 0.56, z - h * 0.04]} castShadow receiveShadow>
        <sphereGeometry args={[h * 0.17, 10, 8]} />
        <meshStandardMaterial map={leafTex} roughness={0.9} metalness={0} />
      </mesh>
      <mesh position={[x + h * 0.02, h * 0.52, z - h * 0.08]} castShadow receiveShadow>
        <sphereGeometry args={[h * 0.15, 10, 8]} />
        <meshStandardMaterial map={leafTex} roughness={0.9} metalness={0} />
      </mesh>
      <mesh position={[x - h * 0.04, h * 0.62, z + h * 0.09]} castShadow receiveShadow>
        <sphereGeometry args={[h * 0.16, 10, 8]} />
        <meshStandardMaterial map={leafTex} roughness={0.9} metalness={0} />
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

/**
 * Landscape: roads around the building perimeter (NOT through it), trees,
 * parked cars, pedestrians on sidewalks, and floating clouds.
 *
 * Roads form a rectangle AROUND the building — offset by `streetR` from
 * the building center so they never intersect the footprint.
 */
function Landscape({ orbitTarget, span, foliageColor = "#1f5c1f" }: { orbitTarget: [number, number, number]; span: number; foliageColor?: string }) {
  const [ox, , oz] = orbitTarget;

  // Road geometry
  const roadW  = Math.max(70, span * 0.13);   // road carriage width
  const swalkW = roadW * 0.22;                 // sidewalk width
  const roadL  = Math.max(1800, span * 2.0);   // road length (extends past corners)
  const streetR = span * 0.62;                 // distance from building center to road center

  // Road centerlines (4 sides of the block)
  const southZ  = oz + streetR;
  const northZ  = oz - streetR;
  const eastX   = ox + streetR;
  const westX   = ox - streetR;

  // 20 trees scattered outside the streets
  const trees: { x: number; z: number; h: number }[] = [];
  for (let i = 0; i < 20; i++) {
    const ang = (i / 20) * Math.PI * 2 + 0.5;
    const r   = span * (0.82 + (i % 4) * 0.09);
    trees.push({ x: ox + Math.cos(ang) * r, z: oz + Math.sin(ang) * r, h: 55 + (i % 5) * 18 });
  }
  // Also line the sidewalks with small trees
  const sidewalkTreeCount = 5;
  for (let i = 0; i < sidewalkTreeCount; i++) {
    const t = (i / (sidewalkTreeCount - 1) - 0.5) * span * 1.1;
    trees.push({ x: ox + t, z: southZ + roadW * 0.62, h: 50 + (i % 3) * 15 });
    trees.push({ x: ox + t, z: northZ - roadW * 0.62, h: 50 + (i % 3) * 15 });
    trees.push({ x: eastX  + roadW * 0.62, z: oz + t, h: 50 + (i % 3) * 15 });
    trees.push({ x: westX  - roadW * 0.62, z: oz + t, h: 50 + (i % 3) * 15 });
  }

  // 4 parked cars — one on each road
  const carColors = ["#c0392b", "#2980b9", "#f39c12", "#27ae60"];
  const cars: { x: number; z: number; color: string; ry: number }[] = [
    { x: ox + span * 0.15, z: southZ - roadW * 0.3, color: carColors[0], ry: 0 },
    { x: ox - span * 0.2,  z: northZ + roadW * 0.3, color: carColors[1], ry: Math.PI },
    { x: eastX - roadW * 0.3, z: oz + span * 0.15,  color: carColors[2], ry: Math.PI / 2 },
    { x: westX + roadW * 0.3, z: oz - span * 0.1,   color: carColors[3], ry: -Math.PI / 2 },
  ];

  // Pedestrians on sidewalks (6 people)
  const people: { x: number; z: number }[] = [
    { x: ox + span * 0.08,  z: southZ + roadW * 0.58 },
    { x: ox - span * 0.12,  z: southZ + roadW * 0.58 },
    { x: ox + span * 0.18,  z: northZ - roadW * 0.58 },
    { x: eastX + roadW * 0.58, z: oz + span * 0.05  },
    { x: eastX + roadW * 0.58, z: oz - span * 0.12  },
    { x: westX - roadW * 0.58, z: oz + span * 0.08  },
  ];

  // Clouds: high above scene (y = span × 1.4–2.0) with small radius so they look realistic
  const clouds: { x: number; y: number; z: number; s: number }[] = [
    { x: ox + span * 0.5,  y: span * 1.5,  z: oz - span * 0.3, s: 30 },
    { x: ox - span * 0.45, y: span * 1.65, z: oz + span * 0.2, s: 25 },
    { x: ox + span * 0.1,  y: span * 1.40, z: oz + span * 0.5, s: 35 },
    { x: ox - span * 0.2,  y: span * 1.75, z: oz - span * 0.5, s: 28 },
    { x: ox + span * 0.6,  y: span * 1.55, z: oz + span * 0.4, s: 22 },
    { x: ox - span * 0.55, y: span * 1.45, z: oz - span * 0.1, s: 32 },
  ];

  // polygonOffset prevents z-fighting where road planes overlap at corners
  const asp  = { color: "#4a4a4a", roughness: 0.95, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 } as const;
  const swlk = { color: "#b0b0b0", roughness: 0.90, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 } as const;
  // All road planes use the same rotation: -90° around X, with width along X and length along Z
  const flatRot = [-Math.PI / 2, 0, 0] as [number, number, number];

  return (
    <>
      {/* ── South road (east-west) ── */}
      <mesh position={[ox, -0.08, southZ]} rotation={flatRot} receiveShadow>
        <planeGeometry args={[roadL, roadW]} /><meshStandardMaterial {...asp} />
      </mesh>
      <mesh position={[ox, -0.06, southZ + roadW * 0.58]} rotation={flatRot} receiveShadow>
        <planeGeometry args={[roadL, swalkW]} /><meshStandardMaterial {...swlk} />
      </mesh>

      {/* ── North road ── */}
      <mesh position={[ox, -0.08, northZ]} rotation={flatRot} receiveShadow>
        <planeGeometry args={[roadL, roadW]} /><meshStandardMaterial {...asp} />
      </mesh>
      <mesh position={[ox, -0.06, northZ - roadW * 0.58]} rotation={flatRot} receiveShadow>
        <planeGeometry args={[roadL, swalkW]} /><meshStandardMaterial {...swlk} />
      </mesh>

      {/* ── East road (north-south): swap args so roadL runs along Z ── */}
      <mesh position={[eastX, -0.08, oz]} rotation={flatRot} receiveShadow>
        <planeGeometry args={[roadW, roadL]} /><meshStandardMaterial {...asp} />
      </mesh>
      <mesh position={[eastX + roadW * 0.58, -0.06, oz]} rotation={flatRot} receiveShadow>
        <planeGeometry args={[swalkW, roadL]} /><meshStandardMaterial {...swlk} />
      </mesh>

      {/* ── West road ── */}
      <mesh position={[westX, -0.08, oz]} rotation={flatRot} receiveShadow>
        <planeGeometry args={[roadW, roadL]} /><meshStandardMaterial {...asp} />
      </mesh>
      <mesh position={[westX - roadW * 0.58, -0.06, oz]} rotation={flatRot} receiveShadow>
        <planeGeometry args={[swalkW, roadL]} /><meshStandardMaterial {...swlk} />
      </mesh>

      {/* ── Corner junction squares (higher polygonOffset to sit on top) ── */}
      {([
        [eastX, southZ], [eastX, northZ], [westX, southZ], [westX, northZ],
      ] as [number, number][]).map(([jx, jz], i) => (
        <mesh key={`junc-${i}`} position={[jx, -0.08, jz]} rotation={flatRot} receiveShadow>
          <planeGeometry args={[roadW, roadW]} />
          <meshStandardMaterial color="#4a4a4a" roughness={0.95} metalness={0} polygonOffset polygonOffsetFactor={-6} polygonOffsetUnits={-6} />
        </mesh>
      ))}

      {/* Trees */}
      {trees.map((p, i) => <LowPolyTree key={`tree-${i}`} x={p.x} z={p.z} h={p.h} foliageColor={foliageColor} />)}

      {/* Parked cars */}
      {cars.map((c, i) => <SimpleCar key={`car-${i}`} x={c.x} z={c.z} color={c.color} ry={c.ry} />)}

      {/* People on sidewalks */}
      {people.map((p, i) => <Mannequin key={`person-${i}`} x={p.x} z={p.z} />)}

      {/* Clouds */}
      {clouds.map((cl, i) => <SimpleCloud key={`cloud-${i}`} x={cl.x} y={cl.y} z={cl.z} s={cl.s} />)}
    </>
  );
}

/** Human scale mannequin — low-poly business-suit figure for scale
    reference: flat-shaded faceted geometry, white collared shirt, tie,
    charcoal jacket + trousers, dark hair and shoes. Matches the requested
    "low-poly office worker" reference look via color-blocked garments and
    facet-friendly primitive geometry (icosahedra, low-segment capsules,
    flat panels) — not a literal sculpted face, which isn't achievable with
    procedural primitives, but the same faceted silhouette and styling. */
function Mannequin({ x, z }: { x: number; z: number }) {
  const skin  = <meshStandardMaterial color="#d9a679" roughness={0.85} flatShading />;
  const hair  = <meshStandardMaterial color="#2e2418" roughness={0.9} flatShading />;
  const suit  = <meshStandardMaterial color="#2e3340" roughness={0.8} flatShading />;
  const shirt = <meshStandardMaterial color="#f2f2ef" roughness={0.8} flatShading />;
  const tie   = <meshStandardMaterial color="#1c1f26" roughness={0.7} flatShading />;
  const shoe  = <meshStandardMaterial color="#141414" roughness={0.6} flatShading />;

  return (
    <group>
      {/* Hair */}
      <mesh position={[x, 1.7, z - 0.02]} castShadow>
        <icosahedronGeometry args={[0.13, 0]} />{hair}
      </mesh>
      {/* Head */}
      <mesh position={[x, 1.62, z]} castShadow>
        <icosahedronGeometry args={[0.15, 1]} />{skin}
      </mesh>
      {/* Neck */}
      <mesh position={[x, 1.48, z]} castShadow>
        <cylinderGeometry args={[0.06, 0.07, 0.08, 6]} />{skin}
      </mesh>
      {/* Shirt collar peeking above the jacket */}
      <mesh position={[x - 0.05, 1.42, z + 0.09]} rotation={[0.3, 0, 0.5]} castShadow>
        <boxGeometry args={[0.07, 0.1, 0.02]} />{shirt}
      </mesh>
      <mesh position={[x + 0.05, 1.42, z + 0.09]} rotation={[0.3, 0, -0.5]} castShadow>
        <boxGeometry args={[0.07, 0.1, 0.02]} />{shirt}
      </mesh>
      {/* Tie */}
      <mesh position={[x, 1.28, z + 0.12]} castShadow>
        <boxGeometry args={[0.045, 0.28, 0.015]} />{tie}
      </mesh>
      {/* Jacket torso */}
      <mesh position={[x, 1.13, z]} castShadow>
        <capsuleGeometry args={[0.2, 0.4, 2, 8]} />{suit}
      </mesh>
      {/* Lapels */}
      <mesh position={[x - 0.1, 1.32, z + 0.1]} rotation={[0.2, 0, 0.4]} castShadow>
        <boxGeometry args={[0.1, 0.2, 0.015]} />{suit}
      </mesh>
      <mesh position={[x + 0.1, 1.32, z + 0.1]} rotation={[0.2, 0, -0.4]} castShadow>
        <boxGeometry args={[0.1, 0.2, 0.015]} />{suit}
      </mesh>
      {/* Arms (jacket sleeves) + hands — resting close to the body */}
      <mesh position={[x - 0.27, 1.06, z]} rotation={[0, 0, Math.PI / 26]} castShadow>
        <capsuleGeometry args={[0.06, 0.42, 2, 8]} />{suit}
      </mesh>
      <mesh position={[x + 0.27, 1.06, z]} rotation={[0, 0, -Math.PI / 26]} castShadow>
        <capsuleGeometry args={[0.06, 0.42, 2, 8]} />{suit}
      </mesh>
      <mesh position={[x - 0.31, 0.78, z]} castShadow>
        <icosahedronGeometry args={[0.055, 0]} />{skin}
      </mesh>
      <mesh position={[x + 0.31, 0.78, z]} castShadow>
        <icosahedronGeometry args={[0.055, 0]} />{skin}
      </mesh>
      {/* Trousers */}
      <mesh position={[x - 0.1, 0.38, z]} castShadow>
        <capsuleGeometry args={[0.085, 0.52, 2, 8]} />{suit}
      </mesh>
      <mesh position={[x + 0.1, 0.38, z]} castShadow>
        <capsuleGeometry args={[0.085, 0.52, 2, 8]} />{suit}
      </mesh>
      {/* Shoes */}
      <mesh position={[x - 0.1, 0.045, z + 0.04]} castShadow>
        <boxGeometry args={[0.09, 0.06, 0.19]} />{shoe}
      </mesh>
      <mesh position={[x + 0.1, 0.045, z + 0.04]} castShadow>
        <boxGeometry args={[0.09, 0.06, 0.19]} />{shoe}
      </mesh>
    </group>
  );
}

function RoomLabels({ elements, cx, cz }: { elements: DrawingElement[]; cx: number; cz: number }) {
  const labels = elements.filter(el => (el as any).roomLabel === true || el.archType === "room");
  return (
    <>
      {labels.map(el => {
        const x = (el.x ?? 0) - cx;
        const z = (el.y ?? 0) - cz;
        const name = el.text || (el as any).roomName || "Room";
        const area = (el as any).roomArea as number | undefined;
        return (
          <Html key={el.id} position={[x, 30, z]} center distanceFactor={200} zIndexRange={[10, 20]}>
            <div style={{ background:"rgba(15,23,42,0.82)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:8, padding:"4px 10px", color:"#e2e8f0", fontSize:13, fontFamily:"sans-serif", fontWeight:600, pointerEvents:"none", whiteSpace:"nowrap", backdropFilter:"blur(6px)", userSelect:"none" }}>
              {name}
              {area != null && <span style={{ color:"#94a3b8", fontWeight:400, fontSize:11, marginLeft:6 }}>{area.toFixed(1)} m²</span>}
            </div>
          </Html>
        );
      })}
    </>
  );
}

function Scene({
  elements, doorWinEls, plan, blockDefs, revisionKey, viewAngle, onViewConsumed,
  activeTool, wallHeight, onElementClick,
  activeDrawingState, setActiveDrawingState, onDrawingClosed,
  shapes, onShapeDepthChange, measurePoints, setMeasurePoints,
  bimResult, showBim, layerOverride,
  explodedView, section, roofType, roofPitch, facadeMaterial, roofMaterial,
  quality, onExitWalk, onRoomChange, wallPreset, fixtureType, onWallProgress,
  skyParams, weather, season, neighborhoodContext, neighborCount,
  undergroundSectionDepth, seasonGroundColor, seasonFoliageColor,
  allWallElements, enablePBRShaders, timeOfDay, showScaleFigure,
  showRoof, showFloorSlab,
}: {
  elements: DrawingElement[];
  doorWinEls: DrawingElement[];
  allWallElements: DrawingElement[];
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
  section: import("../stores/slices/sceneSlice").SectionState;
  roofType: RoofType;
  roofPitch: number;
  facadeMaterial: string;
  roofMaterial: string;
  quality: "low" | "medium" | "high";
  onExitWalk: () => void;
  onRoomChange: (roomName: string | null) => void;
  wallPreset: import("../canvas/3d/materials/wallAssemblyPresets").WallAssemblyPreset;
  fixtureType: MepFixtureType;
  onWallProgress?: (p: { segmentCount: number; currentLength: number; totalLength: number } | null) => void;
  skyParams: { sunPosition: [number, number, number]; turbidity: number; rayleigh: number; mieCoefficient: number; mieDirectionalG: number };
  weather: import("../stores/slices/sceneSlice").Weather;
  season: import("../stores/slices/sceneSlice").Season;
  neighborhoodContext: import("../stores/slices/sceneSlice").NeighborhoodContext;
  neighborCount: number;
  undergroundSectionDepth: number;
  seasonGroundColor: string;
  seasonFoliageColor: string;
  enablePBRShaders: boolean;
  timeOfDay: number;
  showScaleFigure: boolean;
  showRoof: boolean;
  showFloorSlab: boolean;
}) {
  const { gl } = useThree();
  const isDark = useThemeStore((state) => state.isDark);
  const bounds = useMemo(() => getPlanBounds(elements, blockDefs), [elements, blockDefs]);

  // Floating origin: imported DXF drawings can sit hundreds of thousands of units
  // from (0,0). Rendering geometry at those raw coordinates collapses float32
  // precision and pushes the model outside the depth/fog range, so it shows as an
  // empty grey scene even though the data is valid. We translate the rendered
  // geometry by -center so it draws around the origin (like tool-drawn plans),
  // and feed the camera/fog a matching origin-centered bounds.
  const cx = bounds ? (bounds.minX + bounds.maxX) / 2 : 0;
  const cz = bounds ? (bounds.minZ + bounds.maxZ) / 2 : 0;

  // Per-element material overrides written by the paint tool.
  const materialById = useMemo(() => {
    const m = new Map<string, string>();
    for (const el of elements) if (typeof el.material === "string") m.set(el.id, el.material);
    return m;
  }, [elements]);

  // MEP fittings at run bends/ends (elbow spheres, junction boxes, valves…).
  const mepPipes = useMemo(() => elements.filter((el) => el.archType === "pipe"), [elements]);
  const mepJoints = useMemo(() => computeMepJoints(mepPipes), [mepPipes]);

  // Manage local clipping planes for the section cuts feature
  useEffect(() => {
    gl.localClippingEnabled = section.enabled;
    if (section.enabled) {
      const normal = section.axis === "x" ? new THREE.Vector3(1, 0, 0)
        : section.axis === "y" ? new THREE.Vector3(0, -1, 0)
        : new THREE.Vector3(0, 0, 1);
      const constant = section.axis === "x" ? -(cx + section.offset)
        : section.axis === "y" ? section.offset
        : -(cz + section.offset);
      gl.clippingPlanes = [new THREE.Plane(normal, constant)];
    } else {
      gl.clippingPlanes = [];
    }
    return () => { gl.clippingPlanes = []; };
  }, [section, cx, cz, gl]);

  const localBounds = useMemo(() => bounds ? {
    minX: bounds.minX - cx, maxX: bounds.maxX - cx,
    minZ: bounds.minZ - cz, maxZ: bounds.maxZ - cz,
  } : null, [bounds, cx, cz]);

  // Stable identity for the controllers' `center` prop. Passing a fresh
  // `{{ cx, cz }}` literal per render put a new object in every controller's
  // useEffect deps, re-running them each frame — React's "maximum update
  // depth exceeded" loop that ended up crashing the EffectComposer.
  const center = useMemo(() => ({ cx, cz }), [cx, cz]);

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

  // ── Dynamic sun/moon lighting based on time of day ──
  const isDay = timeOfDay >= 6 && timeOfDay <= 18;
  const sunLightParams = useMemo(() => {
    if (!isDay) {
      // Night — cool moonlight
      return { color: new THREE.Color("#93a5d6"), intensity: 0.15 };
    }
    const t = (timeOfDay - 6) / 12; // 0..1 across the day
    const sin = Math.sin(t * Math.PI);  // peaks at noon
    const warmth = 1 - sin; // 1 at sunrise/sunset, 0 at noon
    const color = new THREE.Color("#ffffff").lerp(new THREE.Color("#ffb076"), warmth * 0.7);
    const intensity = 0.6 + sin * 1.6; // 0.6 at horizon, 2.2 at noon
    return { color, intensity };
  }, [timeOfDay, isDay]);

  const hemiParams = useMemo(() => {
    if (!isDay) return { sky: "#1d2547", ground: "#11152a", intensity: 0.18 };
    const sin = Math.sin(((timeOfDay - 6) / 12) * Math.PI);
    return { sky: "#b8d4f0", ground: "#c8b89a", intensity: 0.35 + sin * 0.4 };
  }, [timeOfDay, isDay]);

  // ── Photorealistic environment preset based on time + context ──
  const envPreset = useMemo((): "sunset" | "dawn" | "night" | "city" | "park" => {
    if (timeOfDay < 6 || timeOfDay > 19) return "night";
    if (timeOfDay < 9) return "dawn";
    if (timeOfDay > 16) return "sunset";
    if (neighborhoodContext === "urban" || neighborhoodContext === "highrise") return "city";
    return "park";
  }, [timeOfDay, neighborhoodContext]);

  return (
    <>
      {neighborhoodContext === "none" ? (
        <color attach="background" args={[isDark ? "#1a1e26" : "#f8f9fa"]} />
      ) : (
        <group userData={{ exportHide: true }}>
          <Sky
            distance={450000}
            sunPosition={skyParams.sunPosition}
            turbidity={skyParams.turbidity}
            rayleigh={skyParams.rayleigh}
            mieCoefficient={skyParams.mieCoefficient}
            mieDirectionalG={skyParams.mieDirectionalG}
          />
        </group>
      )}
      {/* HDRI environment — photorealistic ambient reflections + optional background */}
      {quality !== "low" && <Environment preset={envPreset} background={neighborhoodContext !== "none"} />}
      {/* Weather particle system — rain, snow, fog, lightning */}
      {neighborhoodContext !== "none" && <RainSystem weather={weather} quality={quality} />}
      {neighborhoodContext !== "none" && (
        <fog attach="fog" args={[isDark ? "#1a1e26" : "#c8dff5", fogNear, fogFar]} />
      )}

      {/* Hemisphere ambient — dynamically tinted for day/night */}
      <hemisphereLight args={[hemiParams.sky, hemiParams.ground, hemiParams.intensity]} />
      {/* Main sun/moon — position and colour follow the sky.
          Shadow frustum used to be a fixed ±1500 regardless of scene size —
          for a small drawing (one wall, a small house) that wastes nearly
          all of the 4096×4096 shadow map on empty space outside the model,
          so the few texels actually covering it produce hard, blocky,
          jagged ("sharp-featured") shadow edges no matter how you orbit —
          the frustum never adapts, so it never gets sharper. Fit it to the
          scene's own span instead, with a floor so tiny scenes don't
          over-tighten and margin past the footprint for larger ones. */}
      <directionalLight
        position={skyParams.sunPosition}
        color={sunLightParams.color}
        intensity={sunLightParams.intensity}
        castShadow
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
        shadow-bias={-0.0003}
        shadow-normalBias={0.8}
        shadow-camera-near={1}
        shadow-camera-far={4000}
        shadow-camera-left={-Math.max(400, span * 0.75)}
        shadow-camera-right={Math.max(400, span * 0.75)}
        shadow-camera-top={Math.max(400, span * 0.75)}
        shadow-camera-bottom={-Math.max(400, span * 0.75)}
      />
      {/* Soft fill light from opposite side — dims at night */}
      <directionalLight position={[-120, 120, 80]} intensity={isDay ? 0.35 : 0.05} />

      {/* Vertical stack of large ground-level planes, spaced ≥0.5 units apart so
          they clear the depth-buffer's quantization step at typical orbit
          distances: slab top 0 > contact shadows -0.5 > ground -1.0 > grid -2.0.
          Gaps of 0.05-0.2 here previously z-fought as wide flickering bands;
          this spacing (not the camera's near plane, which has to stay small —
          see the Canvas camera prop below) is what actually fixes it. */}
      <group userData={{ exportHide: true }}>
        <Grid position={[0, -2.0, 0]} args={[gridSize, gridSize]} cellSize={gridCellSize} cellThickness={0.5} cellColor="#cbd5e1" sectionSize={gridSectionSize} sectionThickness={1} sectionColor="#94a3b8" fadeDistance={Math.max(800, span * 0.8)} />
      </group>
      <AutoFrame bounds={localBounds} revisionKey={revisionKey} />
      <CameraController bounds={localBounds} viewAngle={viewAngle} onViewConsumed={onViewConsumed} controlsRef={controlsRef} />
      {/* Ground plane — procedural grass PBR texture, or clean floor in drafting mode */}
      <group userData={{ exportHide: true }}>
        <GrassMesh orbitTarget={orbitTarget} span={span} groundColor={seasonGroundColor} isSceneryEnabled={neighborhoodContext !== "none"} isDark={isDark} />
      </group>
      {/* Contact shadows — soft blurred shadows directly under the building.
          At "low" quality the EffectComposer (and its SSAO pass) isn't mounted at
          all, so these are the only ambient-occlusion cue the scene gets — darken
          and tighten them to compensate instead of paying for a post-process pass. */}
      <group userData={{ exportHide: true }}>
        <ContactShadows position={[orbitTarget[0], -0.5, orbitTarget[2]]} width={Math.max(600, span * 1.2)} height={Math.max(600, span * 1.2)} far={400} blur={quality === "low" ? 1.8 : 2.5} opacity={quality === "low" ? 0.65 : 0.45} />
      </group>
      {/* Miniature landscape — trees, road, clouds, cars */}
      {elements.length > 0 && neighborhoodContext !== "none" && (
        <group userData={{ exportHide: true }}>
          <Landscape orbitTarget={orbitTarget} span={span} foliageColor={seasonFoliageColor} />
        </group>
      )}
      {/* Procedural context buildings — capped at lower quality tiers since each
          building builds its own window-grid canvas texture and geometry */}
      {elements.length > 0 && (
        <group userData={{ exportHide: true }}>
          <NeighborBuildings
            context={neighborhoodContext}
            count={quality === "high" ? neighborCount : quality === "medium" ? Math.min(neighborCount, 3) : Math.min(neighborCount, 1)}
            season={season}
          />
        </group>
      )}
      {/* Human scale mannequin — for spatial reference */}
      {elements.length > 0 && showScaleFigure && (
        <group userData={{ exportHide: true }}>
          {/* This context renders directly in the scene's raw wall-height
              scale (no meter→scene-unit wrapper), so size the figure
              relative to wallHeight itself rather than a guessed constant —
              an average person is roughly half an average wall. */}
          <ScaleFigureModel
            x={orbitTarget[0] + span * 0.55}
            z={orbitTarget[2] + span * 0.25}
            targetHeight={wallHeight * 0.5}
          />
        </group>
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
          enablePBRShaders={enablePBRShaders}
          materialById={materialById}
          showRoof={showRoof}
          showFloorSlab={showFloorSlab}
        />
        {bimResult && showBim && (
          <BimModelRenderer
            result={bimResult}
            explodeOffset={explodedView ? 2500 : 0}
            facadeMaterial={facadeMaterial}
            roofMaterial={roofMaterial}
            roofType={roofType}
            roofPitch={roofPitch}
            showRoof={showRoof}
            showFloorSlab={showFloorSlab}
          />
        )}
        {/* Foundation elements — strip, spread, raft, pile, grade-beam */}
        <FoundationMesh
          elements={elements}
          cx={cx}
          cz={cz}
          undergroundSectionDepth={undergroundSectionDepth}
        />
        {/* Floor surfaces — archType:"floor" polygon elements */}
        {elements
          .filter((el) => el.archType === "floor" && el.points && el.points.length >= 3)
          .map((el) => <FloorMesh key={el.id} el={el} cx={cx} cz={cz} activeTool={activeTool} onElementClick={onElementClick} />)}

        {/* Pipes / MEP — archType:"pipe" line elements */}
        {elements
          .filter((el) => el.archType === "pipe" && el.x1 != null && el.x2 != null)
          .map((el) => <PipeMesh key={el.id} el={el} cx={cx} cz={cz} activeTool={activeTool} onElementClick={onElementClick} />)}
        {/* MEP fittings — elbows/junction boxes at bends, valves/cleanouts/diffusers at open ends */}
        {mepJoints.map((j, i) => <MepFittingMesh key={i} joint={j} cx={cx} cz={cz} />)}

        {/* Wall-mounted MEP fixtures — archType:"mepFixture" */}
        {elements
          .filter((el) => el.archType === "mepFixture")
          .map((el) => <MepFixtureMesh key={el.id} el={el} cx={cx} cz={cz} />)}

        {/* Stairs — archType:"stair" rectangle elements */}
        {elements
          .filter((el) => el.archType === "stair" && el.x != null && el.width != null)
          .map((el) => <StairMesh key={el.id} el={el} cx={cx} cz={cz} activeTool={activeTool} onElementClick={onElementClick} />)}

        {/* Columns — single instanced draw call */}
        <InstancedColumnsMesh elements={elements} cx={cx} cz={cz} wallHeight={wallHeight} />

        {/* Windows — two instanced draw calls (glass + frame) */}
        <InstancedWindowsMesh elements={elements} cx={cx} cz={cz} timeOfDay={timeOfDay} />
      </group>
      <DrawOnFaceController activeTool={activeTool} onDrawingClosed={onDrawingClosed} activeDrawingState={activeDrawingState} setActiveDrawingState={setActiveDrawingState} />
      <TapeMeasureController activeTool={activeTool} measurePoints={measurePoints} setMeasurePoints={setMeasurePoints} />
      {shapes.map((s) => <DrawnPolygonShape key={s.id} shape={s} />)}
      <PushPullDragController
        activeTool={activeTool}
        shapes={shapes}
        onDepthChange={onShapeDepthChange}
        onCommit={(id, depth) => {
          useDrawingStore.getState().updateElement(id, { pushPullDepth: depth, editedIn3D: true } as Partial<import("../types").DrawingElement>);
        }}
      />
      <WallDrawController activeTool={activeTool} center={center} wallPreset={wallPreset} onProgress={onWallProgress} />
      <FloorDrawController activeTool={activeTool} center={center} />
      <ShapeDrawController activeTool={activeTool} center={center} />
      <PrimitiveDrawController activeTool={activeTool} center={center} />
      <MepDrawController activeTool={activeTool} center={center} />
      <MepFixturePlacerController
        activeTool={activeTool}
        center={center}
        wallElements={allWallElements}
        fixtureType={fixtureType}
      />
      <WallMoveController
        activeTool={activeTool}
        center={center}
        wallElements={allWallElements}
      />
      <OffsetWallController
        activeTool={activeTool}
        center={center}
        wallElements={allWallElements}
      />
      <DoorPlacerController
        activeTool={activeTool}
        center={center}
        wallElements={allWallElements}
      />
      <RoomLabels elements={elements} cx={cx} cz={cz} />
      <SectionPlaneController span={span} orbitTarget={orbitTarget} />
      <RidgeLineController activeTool={activeTool} center={center} />
      <TransformGizmoController activeTool={activeTool} center={center} />
      <AvatarWalkController activeTool={activeTool} center={center} elements={elements} onRoomChange={onRoomChange} />
      <WalkthroughController activeTool={activeTool} onExit={onExitWalk} />
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping dampingFactor={0.12} minDistance={10} maxDistance={orbitMaxDist}
        zoomSpeed={1.5} panSpeed={1.2} rotateSpeed={0.8}
        screenSpacePanning
        enablePan
        maxPolarAngle={Math.PI / 2.12} target={orbitTarget}
        enabled={activeTool !== "line" && activeTool !== "wall3d" && activeTool !== "walk" && activeTool !== "wall-move" && activeTool !== "door-place3d" && activeTool !== "window-place3d" && activeTool !== "rect3d" && activeTool !== "circle3d" && activeTool !== "arc3d" && activeTool !== "box3d" && activeTool !== "cylinder3d" && activeTool !== "roof-ridge" && !activeTool.startsWith("mep-")}
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

export default function ThreeViewer({ elements, plan, visible, blockDefs, revisionKey, onImportDxf }: {
  elements: DrawingElement[];
  plan: ArchitecturalPlan | null;
  blockDefs: any;
  visible: boolean;
  revisionKey?: string;
  onImportDxf?: () => void;
}) {
  const [viewAngle, setViewAngle] = useState<ViewAngle>(null);
  const [activeTool, setActiveTool] = useState<string>("select");
  // In-memory only (not persisted): lets "Skip" on the WelcomeCard hide it for
  // the rest of this mount, while still resetting to false — and thus showing
  // the card again — on reload, since the scene is still empty at that point.
  const [welcomeSkipped, setWelcomeSkipped] = useState(false);
  const [wallHeight, setWallHeight] = useState(34);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeDrawingState, setActiveDrawingState] = useState<DrawingState | null>(null);
  const [shapes, setShapes] = useState<ShapeWithDepth[]>([]);
  const [measurePoints, setMeasurePoints] = useState<{ start: THREE.Vector3 | null; end: THREE.Vector3 | null }>({ start: null, end: null });
  const formatLength = useDrawingStore((state) => state.formatLength);
  const currentDrawingId = useDrawingStore((state) => state.currentDrawingId);
  const dxfLayerOverride = useDrawingStore((state) => state.dxfLayerOverride);

  // Scene / weather state
  const season       = useDrawingStore((s) => s.season);
  const weather      = useDrawingStore((s) => s.weather);
  const timeOfDay    = useDrawingStore((s) => s.timeOfDay);
  const neighborhoodContext  = useDrawingStore((s) => s.neighborhoodContext);
  const neighborCount        = useDrawingStore((s) => s.neighborCount);
  const undergroundSectionDepth = useDrawingStore((s) => s.undergroundSectionDepth);
  const enableSSAO      = useDrawingStore((s) => s.enableSSAO);
  const enablePBRShaders = useDrawingStore((s) => s.enablePBRShaders);
  const setSeason       = useDrawingStore((s) => s.setSeason);
  const setWeather      = useDrawingStore((s) => s.setWeather);
  const setTimeOfDay    = useDrawingStore((s) => s.setTimeOfDay);
  const setNeighborhoodContext = useDrawingStore((s) => s.setNeighborhoodContext);
  const setNeighborCount       = useDrawingStore((s) => s.setNeighborCount);
  const setUndergroundSectionDepth = useDrawingStore((s) => s.setUndergroundSectionDepth);
  const setEnableSSAO       = useDrawingStore((s) => s.setEnableSSAO);
  const setEnablePBRShaders = useDrawingStore((s) => s.setEnablePBRShaders);
  const useTextures         = useDrawingStore((s) => s.useTextures);
  const setUseTextures      = useDrawingStore((s) => s.setUseTextures);
  const { status: analyzeStatus, result: bimResult, error: analyzeError, start: startAnalysis } = useAnalysisJob(currentDrawingId);
  const [showBim, setShowBim] = useState(false);

  // Styling and Roof States
  const [explodedView, setExplodedView] = useState(false);
  const section = useDrawingStore((s) => s.section);
  const setSection = useDrawingStore((s) => s.setSection);
  const [roofType, setRoofType] = useState<RoofType>("gable");
  const [roofPitch, setRoofPitch] = useState(30);
  const [facadeMaterial, setFacadeMaterial] = useState("plaster");
  const [roofMaterial, setRoofMaterial] = useState("roof_tile");
  const [quality, setQuality] = useState<"low" | "medium" | "high">("low");
  const [showScaleFigure, setShowScaleFigure] = useState(true);
  // Roof and the synthetic full-footprint floor slab are opt-in — they used
  // to auto-attach the instant a footprint/shell was known or walls
  // enclosed it, so drawing one wall could conjure a whole roof. Real
  // floors drawn with the floor tool always render regardless of this.
  const [showRoof, setShowRoof] = useState(false);
  const [showFloorSlab, setShowFloorSlab] = useState(false);
  const [perfStats, setPerfStats] = useState<PerfStats | null>(null);
  const [wallProgress, setWallProgress] = useState<{ segmentCount: number; currentLength: number; totalLength: number } | null>(null);
  const [heapMB, setHeapMB] = useState<number | null>(null);

  // JS heap size (Chrome/Chromium only, via the non-standard performance.memory
  // API) — sampled independently of the R3F frame loop since it's a browser
  // metric, not a rendering one.
  useEffect(() => {
    const mem = (performance as any).memory;
    if (!mem) return;
    const id = setInterval(() => {
      setHeapMB(Math.round(mem.usedJSHeapSize / 1048576));
    }, 1000);
    return () => clearInterval(id);
  }, []);
  const [exportTrigger, setExportTrigger] = useState<"" | "gltf" | "plan-png" | "front-png" | "side-png">("");
  const handleToggleTextures = (v: boolean) => {
    MaterialService.setUseTextures(v);
    setUseTextures(v);
  };
  // Auto-downgrade quality when PerformanceMonitor signals sustained low FPS.
  // Deliberately one-directional — an earlier auto-upgrade-on-good-FPS path
  // was removed because it fired during the first idle seconds (an empty/
  // light scene reads as "fast"), stepped quality back up, and then real
  // geometry/shadows/PBR loaded on top of that higher tier and overloaded
  // weaker laptop GPUs. Quality now only ever steps down automatically;
  // stepping back up is a deliberate user choice from the Render panel.
  //
  // Cooldown avoids rapid back-to-back downgrades from a single sustained
  // low-FPS stretch re-triggering PerformanceMonitor before the previous
  // drop had a chance to relieve the load.
  const lastQualityChangeRef = useRef(0);
  const QUALITY_CHANGE_COOLDOWN_MS = 4000;
  const handlePerformanceDecline = () => {
    const now = performance.now();
    if (now - lastQualityChangeRef.current < QUALITY_CHANGE_COOLDOWN_MS) return;
    lastQualityChangeRef.current = now;
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

  const canvasBounds = useMemo(() => getPlanBounds(elements, blockDefs), [elements, blockDefs]);

  // Stable identities for Scene props — inline literals here would re-run
  // every controller effect that lists them as a dependency on each render.
  const allWallElements = useMemo(
    () => elements.filter(el => el.archType === "wall" || (el.type === "line" && el.x1 !== undefined)),
    [elements],
  );
  const sheetBounds = useMemo(() => canvasBounds ? {
    minX: canvasBounds.minX - (canvasBounds.minX + canvasBounds.maxX) / 2,
    maxX: canvasBounds.maxX - (canvasBounds.minX + canvasBounds.maxX) / 2,
    minZ: canvasBounds.minZ - (canvasBounds.minZ + canvasBounds.maxZ) / 2,
    maxZ: canvasBounds.maxZ - (canvasBounds.minZ + canvasBounds.maxZ) / 2,
  } : null, [canvasBounds]);
  const canvasFar = canvasBounds
    ? Math.max(4000, Math.max(
        canvasBounds.maxX - canvasBounds.minX,
        canvasBounds.maxZ - canvasBounds.minZ
      ) * 4)
    : 4000;

  // Two-stage Escape: first Esc cancels the in-progress gesture (drawing
  // state, measure points, selection) but keeps the tool; a second Esc with
  // nothing in progress returns to select. Controllers keep their own Escape
  // cleanup for tool-local state like chain points — that is the gesture layer.
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const hadGesture = activeDrawingState !== null || measurePoints.start !== null
        || useDrawingStore.getState().selectedElementIds.length > 0;
      setActiveDrawingState(null);
      setMeasurePoints({ start: null, end: null });
      useDrawingStore.getState().setSelectedElementIds([]);
      if (!hadGesture) setActiveTool("select");
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDrawingState, measurePoints.start]);

  // Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y redo while the 3D view is up.
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key.toLowerCase() === "z") {
        e.preventDefault();
        const { undo, redo } = useDrawingStore.getState();
        if (e.shiftKey) redo(); else undo();
      } else if (e.key.toLowerCase() === "y") {
        e.preventDefault();
        useDrawingStore.getState().redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible]);

  // Shift tracking for multi-select in 3D select mode.
  const shiftRef = useRef(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { shiftRef.current = e.shiftKey; };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onKey); };
  }, []);

  const deleteElement = (id: string) => {
    useDrawingStore.setState((state) => {
      const newElements = state.elements.filter((el) => el.id !== id);
      return { elements: newElements, history: [...state.history.slice(0, state.historyIndex + 1), newElements], historyIndex: state.historyIndex + 1 };
    });
  };

  const addElements = useDrawingStore(s => s.addElements);
  const updateElement = useDrawingStore(s => s.updateElement);
  const selectedElementIds = useDrawingStore(s => s.selectedElementIds);
  const [wallHeightEditor, setWallHeightEditor] = useState<{ wallId: string; height: number } | null>(null);
  const [paintMaterial, setPaintMaterial] = useState("brick");
  const [wallPreset, setWallPreset] = useState(WALL_ASSEMBLY_PRESETS[1]); // "Gạch 200mm" matches today's visual thickness
  const [fixtureType, setFixtureType] = useState<MepFixtureType>("switch");

  // Avatar walkthrough: visited-room tracking + "entered room" toast.
  const [visitedRooms, setVisitedRooms] = useState<Set<string>>(new Set());
  const [roomToast, setRoomToast] = useState<string | null>(null);
  const roomToastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const handleRoomChange = useCallback((roomName: string | null) => {
    if (!roomName) return;
    setVisitedRooms((prev) => new Set(prev).add(roomName));
    setRoomToast(`Đã bước vào ${roomName}`);
    clearTimeout(roomToastTimer.current);
    roomToastTimer.current = setTimeout(() => setRoomToast(null), 1800);
  }, []);

  const handleDetectRooms = useCallback(() => {
    const detected = detectRooms(elements);
    if (detected.length === 0) return;

    const existing = new Set(
      elements.filter((e) => e.archType === "room" && (e as any).detectedRoom === true).map((e) => e.id),
    );

    const newRooms: DrawingElement[] = detected
      .filter((r) => !existing.has(`room-${r.id}`))
      .map((r) => ({
        id:           `room-${r.id}`,
        type:         "polygon",
        archType:     "room" as const,
        layerId:      "A-ROOM",
        points:       r.polygon,
        closed:       true,
        text:         "Room",
        roomArea:     r.area,
        roomLabel:    true,
        detectedRoom: true,
        strokeColor:  "#6366f1",
        fillColor:    "rgba(99,102,241,0.08)",
      } as DrawingElement));

    if (newRooms.length > 0) addElements(newRooms);
  }, [elements, addElements]);

  const handleElementClick = useCallback((id: string) => {
    if (activeTool === "paint3d") {
      updateElement(id, { material: paintMaterial });
      return;
    }
    if (activeTool === "select") {
      const { selectedElementIds, setSelectedElementIds } = useDrawingStore.getState();
      if (shiftRef.current) {
        setSelectedElementIds(
          selectedElementIds.includes(id)
            ? selectedElementIds.filter((s) => s !== id)
            : [...selectedElementIds, id],
        );
      } else {
        setSelectedElementIds([id]);
      }
      return;
    }
    if (activeTool === "eraser") { deleteElement(id); return; }
    if (activeTool === "wall-height") {
      const el = elements.find(e => e.id === id);
      setWallHeightEditor({ wallId: id, height: (el as any)?.wallHeightOverride ?? wallHeight });
    }
  }, [activeTool, elements, wallHeight, updateElement, paintMaterial]);

  const handleWallHeightApply = useCallback((wallId: string, height: number) => {
    updateElement(wallId, { wallHeightOverride: height } as any);
    setWallHeightEditor(null);
  }, [updateElement]);

  // "click a wall, move it, edit its height/width" — move+rotate is already
  // covered by TransformGizmoController's gizmo whenever the select tool has
  // exactly one thing selected; this derives the data for the numeric panel
  // that appears alongside it for the properties a gizmo drag can't set
  // precisely. Only wall-like elements (archType:"wall", or legacy line
  // elements with endpoints and no archType) qualify — other element types
  // don't have height/thickness/length in this sense.
  const selectedWallElement = useMemo(() => {
    if (activeTool !== "select" || selectedElementIds.length !== 1) return null;
    const el = elements.find((e) => e.id === selectedElementIds[0]);
    if (!el) return null;
    const isWallLike = el.archType === "wall" || (el.type === "line" && el.x1 !== undefined && !el.archType);
    if (!isWallLike || el.x1 == null || el.y1 == null || el.x2 == null || el.y2 == null) return null;
    return el;
  }, [activeTool, selectedElementIds, elements]);

  const wallPropsForPanel = useMemo(() => {
    if (!selectedWallElement) return null;
    const el = selectedWallElement;
    // Height: raw heightOverride/wallHeight units are "10 units = 1m" (see
    // WallMesh + the sidebar's own `(wallHeight/10)*100 cm` label) — ×10 for cm.
    const heightRaw = (el as any).wallHeightOverride ?? wallHeight;
    const heightCm = heightRaw * 10;
    // Thickness: raw units on the X/Z plane are "100 units = 1m" i.e. 1:1 with
    // cm already — no extra conversion, matching WALL_THICKNESS's own scale.
    const thicknessCm = typeof (el as any).wallThicknessOverride === "number"
      ? (el as any).wallThicknessOverride
      : el.wallLayers?.length
        ? el.wallLayers.reduce((s, l) => s + l.thicknessMm / 10, 0)
        : typeof el.wallThickness === "number" ? Math.max(4, el.wallThickness * 0.18) : WALL_THICKNESS;
    const lengthCm = Math.hypot((el.x2! - el.x1!), (el.y2! - el.y1!));
    return { id: el.id, heightCm, thicknessCm, lengthCm };
  }, [selectedWallElement, wallHeight]);

  const handleWallPropHeightChange = useCallback((cm: number) => {
    if (!wallPropsForPanel) return;
    updateElement(wallPropsForPanel.id, { wallHeightOverride: cm / 10 } as any);
  }, [wallPropsForPanel, updateElement]);

  const handleWallPropThicknessChange = useCallback((cm: number) => {
    if (!wallPropsForPanel) return;
    // A typed thickness supersedes any multi-layer assembly (see
    // buildWallSegmentsFromSemanticWalls) — there's no single sensible way to
    // redistribute a user-typed total across an arbitrary number of layers.
    updateElement(wallPropsForPanel.id, { wallThicknessOverride: cm } as any);
  }, [wallPropsForPanel, updateElement]);

  const handleWallPropLengthChange = useCallback((cm: number) => {
    if (!wallPropsForPanel || !selectedWallElement) return;
    const el = selectedWallElement;
    const dx = el.x2! - el.x1!;
    const dy = el.y2! - el.y1!;
    const curLen = Math.hypot(dx, dy);
    if (curLen < 1e-6) return;
    const ux = dx / curLen, uy = dy / curLen;
    updateElement(wallPropsForPanel.id, { x2: el.x1! + ux * cm, y2: el.y1! + uy * cm });
  }, [wallPropsForPanel, selectedWallElement, updateElement]);

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

  // Sky parameters driven by season + weather
  const skyParams = useMemo(() => {
    const angle = ((timeOfDay - 6) / 12) * Math.PI;
    const sunX  = Math.cos(angle) * 400;
    const sunY  = Math.max(Math.sin(angle) * 200, -50);
    const sunZ  = -100;

    type SkyPreset = { turbidity: number; rayleigh: number; mieCoefficient: number; mieDirectionalG: number };
    const presets: Record<string, SkyPreset> = {
      sunny:    { turbidity: 4,  rayleigh: 0.8, mieCoefficient: 0.003, mieDirectionalG: 0.85 },
      overcast: { turbidity: 12, rayleigh: 0.4, mieCoefficient: 0.010, mieDirectionalG: 0.7  },
      rainy:    { turbidity: 16, rayleigh: 0.3, mieCoefficient: 0.020, mieDirectionalG: 0.6  },
      stormy:   { turbidity: 20, rayleigh: 0.2, mieCoefficient: 0.030, mieDirectionalG: 0.5  },
      foggy:    { turbidity: 18, rayleigh: 0.6, mieCoefficient: 0.025, mieDirectionalG: 0.65 },
      snowy:    { turbidity: 8,  rayleigh: 0.3, mieCoefficient: 0.005, mieDirectionalG: 0.8  },
    };
    const p = presets[weather] ?? presets.sunny;

    // Winter reduces sun angle slightly
    const seasonOffset = season === "winter" ? -0.08 : season === "summer" ? 0.05 : 0;

    return {
      sunPosition: [sunX, sunY + seasonOffset * 200, sunZ] as [number, number, number],
      ...p,
    };
  }, [weather, timeOfDay, season]);

  // Ground/grass color driven by season
  const seasonGroundColor = useMemo((): string => {
    switch (season) {
      case "spring": return "#7ec850";
      case "summer": return "#5a9e3a";
      case "autumn": return "#8b6914";
      case "winter": return "#dce8f0";
    }
  }, [season]);

  const seasonFoliageColor = useMemo((): string => {
    switch (season) {
      case "spring": return "#a8e063";
      case "summer": return "#2d6a1f";
      case "autumn": return "#d4780a";
      case "winter": return "#4a5568";
    }
  }, [season]);

  // Convert screen pixels → drawing coordinates using 2D canvas transform.
  // Reads pan/zoom via getState() instead of subscribing: this value is only
  // needed at the moment a region-select drag completes, not reactively —
  // subscribing here would re-render (and re-run sceneElements/getPlanBounds
  // memos in) the whole 3D viewer, including the <Canvas> subtree, on every
  // 2D pan/zoom tick even though the 3D scene never reads pan/zoom.
  const screenToDrawing = (sx: number, sy: number) => {
    const { panOffset, zoom } = useDrawingStore.getState();
    return {
      x: (sx - panOffset.x) / zoom,
      y: (sy - panOffset.y) / zoom,
    };
  };

  const handleRegionSelect = (rect: { x: number; y: number; w: number; h: number }) => {
    const tl = screenToDrawing(rect.x, rect.y);
    const br = screenToDrawing(rect.x + rect.w, rect.y + rect.h);
    setFloorPlanRegion({ minX: Math.min(tl.x, br.x), minZ: Math.min(tl.y, br.y), maxX: Math.max(tl.x, br.x), maxZ: Math.max(tl.y, br.y) });
    setActiveTool("select");
  };

  return (
    <div className={`absolute inset-0 z-10 bg-[#1a1e26] ${visible ? "flex flex-col" : "hidden"}`}>
      {/* ── Top status bar ── */}
      <ViewerTopBar
        wallHeight={wallHeight}
        quality={quality}
        showBim={showBim}
        hasBim={!!bimResult}
        onToggleBim={() => setShowBim((v) => !v)}
        floorPlanActive={floorPlanRegion !== null}
        perfStats={perfStats}
        heapMB={heapMB}
      />

      {/* ── Canvas area (fills remaining height, padded for top bar and right sidebar) ── */}
      <div className="absolute inset-0 top-9 right-56" style={{ cursor: TOOL_CURSORS[activeTool] ?? "default" }}>
        {notice && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-30 bg-slate-900/95 border border-slate-700/60 px-4 py-2 rounded-lg shadow-2xl text-[10px] font-bold text-blue-400 tracking-wider backdrop-blur select-none pointer-events-none">
            {notice}
          </div>
        )}

        {/* Avatar walkthrough: "entered room" toast */}
        {roomToast && (
          <div className="absolute top-14 left-1/2 transform -translate-x-1/2 z-30 bg-rose-900/90 border border-rose-500/40 px-4 py-2 rounded-lg shadow-2xl text-[11px] font-bold text-rose-100 tracking-wide backdrop-blur select-none pointer-events-none">
            🚶 {roomToast}
          </div>
        )}
        {(activeTool === "walk-avatar" || visitedRooms.size > 0) && (
          <VisitedRoomsPanel rooms={[...visitedRooms]} onClear={() => setVisitedRooms(new Set())} />
        )}

        <ToolRail
          activeTool={activeTool}
          setActiveTool={setActiveTool}
          onLineClick={handleLineClick}
          onShow2DNotice={show2DNotice}
          onShowInteractionNotice={showInteractionNotice}
          hasRegion={floorPlanRegion !== null}
          onResetRegion={() => setFloorPlanRegion(null)}
          onAnalyze={currentDrawingId ? startAnalysis : undefined}
          analyzeStatus={analyzeStatus}
          onDetectRooms={handleDetectRooms}
        />
        <ToolBadge activeTool={activeTool} />

        {elements.length === 0 && !welcomeSkipped && (
          <WelcomeCard
            // Card visibility was `elements.length === 0`-driven, so picking
            // "Vẽ tường đầu tiên" only switched the active tool — the card
            // stayed on screen (still centered over the canvas, still
            // capturing clicks) until a wall actually existed, which you
            // can't do without clicking through the card first. Dismiss it
            // the moment either action is chosen, same as Skip already did.
            onDrawWall={() => { setActiveTool("wall3d"); setWelcomeSkipped(true); }}
            onImportDxf={onImportDxf ? () => { setWelcomeSkipped(true); onImportDxf(); } : undefined}
            onSkip={() => setWelcomeSkipped(true)}
          />
        )}

        {activeTool === "wall3d" && <WallDrawHintToast />}

        {activeTool === "floor-pick" && (
          <RegionSelector onSelect={handleRegionSelect} onCancel={() => setActiveTool("select")} />
        )}

        {activeTool === "pushpull" && (
          <PushPullPanel
            shapes={shapes}
            wallHeight={wallHeight}
            setWallHeight={setWallHeight}
            onDepthChange={updateShapeDepth}
            formatLength={formatLength}
          />
        )}

        {wallHeightEditor && (
          <WallHeightPanel
            wallId={wallHeightEditor.wallId}
            currentHeight={wallHeightEditor.height}
            onApply={handleWallHeightApply}
            onCancel={() => setWallHeightEditor(null)}
          />
        )}

        {!wallHeightEditor && wallPropsForPanel && (
          <WallPropertiesPanel
            wallId={wallPropsForPanel.id}
            height={wallPropsForPanel.heightCm}
            thickness={wallPropsForPanel.thicknessCm}
            length={wallPropsForPanel.lengthCm}
            onChangeHeight={handleWallPropHeightChange}
            onChangeThickness={handleWallPropThicknessChange}
            onChangeLength={handleWallPropLengthChange}
          />
        )}

        {activeTool === "paint3d" && (
          <PaintPalettePanel selected={paintMaterial} onSelect={setPaintMaterial} />
        )}

        {activeTool === "wall3d" && (
          <WallAssemblyPanel
            presets={WALL_ASSEMBLY_PRESETS}
            selectedId={wallPreset.id}
            onSelect={(id) => setWallPreset(WALL_ASSEMBLY_PRESETS.find((p) => p.id === id) ?? WALL_ASSEMBLY_PRESETS[1])}
          />
        )}

        {activeTool === "mep-fixture" && (
          <FixturePalettePanel selected={fixtureType} onSelect={(id) => setFixtureType(id as MepFixtureType)} />
        )}

        <Canvas
          shadows={{ type: THREE.PCFSoftShadowMap }}
          gl={{
            localClippingEnabled: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.15,
          }}
          // near=1: OrbitControls allows minDistance={10} from the orbit target,
          // so the camera can end up closer than 10 units to a nearby wall corner
          // when zoomed in tight — a near plane of 10 clipped those walls away
          // entirely ("corner view the 3D has gone"). Reverted to 1; the wider
          // gaps between stacked ground planes (see Grid below) do the actual
          // anti-z-fighting work, so this doesn't need to also carry that job.
          camera={{ position: [760, 420, 760], fov: 42, near: 1, far: canvasFar }}
        >
          {/* Auto-downgrade quality on sustained low FPS. drei fires onDecline
              when MORE than iterations×threshold samples (each ≥250ms) fall
              below the lower FPS bound (40 at 60Hz) — so 3-of-5 low samples
              downgrade in ~1.25s, instead of the previous 10-of-10 over 2.5s,
              while still tolerating a lone GC/compile hitch.
              No onIncline: auto-upgrading quality back up used to fire during
              the first idle seconds (empty/light scene reads as "fast"), then
              immediately overload weaker GPUs the instant real geometry
              loaded — quality would climb right back to High and crash the
              session. Quality now only ever steps DOWN automatically; going
              back up is a deliberate user choice from the Render panel. */}
          <PerformanceMonitor
            onDecline={handlePerformanceDecline}
            iterations={5}
            flipflops={8}
            threshold={0.5}
          />
          {/* GLTF export trigger */}
          <ExportManager trigger={exportTrigger === "gltf" ? "gltf" : ""} onDone={() => setExportTrigger("")} />
          {/* 2D sheet (mặt bằng / mặt đứng) PNG export trigger */}
          <DrawingSheetExporter
            trigger={exportTrigger === "gltf" ? "" : exportTrigger}
            onDone={() => setExportTrigger("")}
            bounds={sheetBounds}
            wallHeight={wallHeight}
          />
          <PerfStatsProbe onStats={setPerfStats} />
          <Scene
            elements={planElements}
            doorWinEls={doorWinEls}
            allWallElements={allWallElements}
            plan={plan}
            blockDefs={blockDefs}
            revisionKey={revisionKey}
            viewAngle={viewAngle}
            onViewConsumed={() => setViewAngle(null)}
            activeTool={activeTool}
            wallHeight={wallHeight}
            onElementClick={handleElementClick}
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
            section={section}
            roofType={roofType}
            roofPitch={roofPitch}
            facadeMaterial={facadeMaterial}
            roofMaterial={roofMaterial}
            quality={quality}
            onWallProgress={setWallProgress}
            onExitWalk={() => setActiveTool("select")}
            skyParams={skyParams}
            weather={weather}
            season={season}
            neighborhoodContext={neighborhoodContext}
            neighborCount={neighborCount}
            undergroundSectionDepth={undergroundSectionDepth}
            seasonGroundColor={seasonGroundColor}
            seasonFoliageColor={seasonFoliageColor}
            enablePBRShaders={enablePBRShaders}
            timeOfDay={timeOfDay}
            onRoomChange={handleRoomChange}
            wallPreset={wallPreset}
            fixtureType={fixtureType}
            showScaleFigure={showScaleFigure}
            showRoof={showRoof}
            showFloorSlab={showFloorSlab}
          />
          {/* Post-processing — only on medium/high quality */}
          {quality !== "low" && (
            <PostFXBoundary>
            <EffectComposer enableNormalPass={enableSSAO} multisampling={4}>
              {enableSSAO ? (
                <SSAO
                  blendFunction={BlendFunction.MULTIPLY}
                  samples={quality === "high" ? 32 : 16}
                  rings={quality === "high" ? 5 : 4}
                  radius={quality === "high" ? 0.5 : 0.4}
                  intensity={quality === "high" ? 30 : 25}
                  luminanceInfluence={0.6}
                  distanceThreshold={1.0}
                  distanceFalloff={0.0}
                  rangeThreshold={0.5}
                  rangeFalloff={0.1}
                  bias={0.5}
                />
              ) : <></>}
              <Bloom
                luminanceThreshold={0.6}
                luminanceSmoothing={0.9}
                intensity={quality === "high" ? 0.4 : 0.2}
                mipmapBlur
              />
              <Vignette eskil={false} offset={0.4} darkness={quality === "high" ? 0.55 : 0.35} />
            </EffectComposer>
            </PostFXBoundary>
          )}
        </Canvas>
      </div>{/* end canvas area */}

      {/* ── Unified right sidebar ── */}
      <RightSidebar
        viewAngle={viewAngle}
        setViewAngle={setViewAngle}
        explodedView={explodedView}
        setExplodedView={setExplodedView}
        section={section}
        setSection={setSection}
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
        wallProgress={wallProgress}
        formatLength={formatLength}
        onExportGLTF={() => setExportTrigger("gltf")}
        onExport2D={(view) => setExportTrigger(view)}
        onExportIFC={() => downloadIFC(elements, `arch-tech-${Date.now()}.ifc`)}
        onInsertFurniture={handleInsertFurniture}
        season={season}
        setSeason={setSeason}
        weather={weather}
        setWeather={setWeather}
        timeOfDay={timeOfDay}
        setTimeOfDay={setTimeOfDay}
        neighborhoodContext={neighborhoodContext}
        setNeighborhoodContext={setNeighborhoodContext}
        neighborCount={neighborCount}
        setNeighborCount={setNeighborCount}
        undergroundSectionDepth={undergroundSectionDepth}
        setUndergroundSectionDepth={setUndergroundSectionDepth}
        enableSSAO={enableSSAO}
        setEnableSSAO={setEnableSSAO}
        enablePBRShaders={enablePBRShaders}
        setEnablePBRShaders={setEnablePBRShaders}
        showScaleFigure={showScaleFigure}
        setShowScaleFigure={setShowScaleFigure}
        showRoof={showRoof}
        setShowRoof={setShowRoof}
        showFloorSlab={showFloorSlab}
        setShowFloorSlab={setShowFloorSlab}
      />
    </div>
  );
}
