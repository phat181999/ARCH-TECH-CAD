import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Grid, OrbitControls, GizmoHelper, GizmoViewport } from "@react-three/drei";
import * as THREE from "three";
import type { ArchitecturalPlan, DrawingElement } from "../types";
import { useDrawingStore } from "../stores/drawingStore";

import { WallMesh, RoomMesh, RoofMesh, DoorMesh, FlatElementMesh } from "../canvas/3d/components";
import { AutoFrame, CameraController, TapeMeasureController, DrawOnFaceController, DrawnPolygonShape, PushPullDragController } from "../canvas/3d/controllers";
import { classifyPlan, getPlanBounds, heuristicClassifyWalls, isRectangle, roomBoundsFromBoundary } from "../canvas/3d/geometry/planClassification";
import { buildOuterWalls, buildWallSegmentsFromSemanticWalls, wallSegmentsFromPlan, FLOOR_THICKNESS } from "../canvas/3d/geometry/wallGeometry";
import type { DrawingState, ShapeWithDepth, ViewAngle } from "../canvas/3d/types";
import { ThreeToolbar, ViewCube, PushPullPanel, FurnitureQuickPanel } from "../canvas/3d/components/ThreeViewerUI";

function PlanModel({
  elements,
  plan: architecturalPlan,
  blockDefs,
  activeTool,
  onElementClick,
  wallHeight
}: {
  elements: DrawingElement[];
  plan: ArchitecturalPlan | null;
  blockDefs?: any;
  activeTool?: string;
  onElementClick?: (id: string) => void;
  wallHeight: number;
}) {
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
        {walls.map((segment, index) => (
          <WallMesh
            key={`plan-wall-${index}`}
            segment={segment}
            color="#f7f7f6"
            wallHeight={wallHeight}
            activeTool={activeTool}
            onElementClick={onElementClick}
          />
        ))}
        <RoofMesh
          x={centerX - footprintWidth / 2} z={centerZ - footprintHeight / 2}
          width={footprintWidth} depth={footprintHeight}
          wallHeight={wallHeight}
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
          />
        ))}
        <RoofMesh
          x={shell.x} z={shell.y}
          width={shell.width} depth={shell.height}
          wallHeight={wallHeight}
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
          <WallMesh key={segment.id} segment={segment} color="#f7f7f6" wallHeight={wallHeight} activeTool={activeTool} onElementClick={onElementClick} />
        ))}
        {fallbackLoose.map((el) => (
          <FlatElementMesh key={el.id} el={el} blockDefs={blockDefs} activeTool={activeTool} onElementClick={onElementClick} />
        ))}
      </>
    );
  }

  // Scale-aware wall height for DXF imports
  // DXF coords can be 100k–1M units; default wallHeight=34 becomes a hairline
  const dxfBoundsForHeight = getPlanBounds(elements);
  const autoWallHeight = dxfBoundsForHeight
    ? Math.max(
        wallHeight,
        Math.min(
          Math.max(dxfBoundsForHeight.maxX - dxfBoundsForHeight.minX, dxfBoundsForHeight.maxZ - dxfBoundsForHeight.minZ) / 20,
          50000 // cap so it doesn't go insane
        )
      )
    : wallHeight;

  // Heuristic fallback: for pure DXF imports (no archType on any element)
  // treat all lines as walls extruded to scale-aware height
  const hasAnyArchType = elements.some(el => el.archType);
  if (!hasAnyArchType && elements.length > 0) {
    const { walls: hWalls, loose: hLoose } = heuristicClassifyWalls(elements);
    const wallSegs = buildWallSegmentsFromSemanticWalls(hWalls);
    const lb = getPlanBounds(elements);
    return (
      <>
        {lb && (
          <mesh position={[lb.minX + (lb.maxX - lb.minX) / 2, -FLOOR_THICKNESS / 2, lb.minZ + (lb.maxZ - lb.minZ) / 2]} receiveShadow>
            <boxGeometry args={[(lb.maxX - lb.minX) + 24, FLOOR_THICKNESS, (lb.maxZ - lb.minZ) + 24]} />
            <meshStandardMaterial color="#d6d6d4" />
          </mesh>
        )}
        {wallSegs.map((segment) => (
          <WallMesh key={segment.id} segment={segment} color="#f7f7f6" wallHeight={autoWallHeight} activeTool={activeTool} onElementClick={onElementClick} />
        ))}
        {hLoose.map((el) => (
          <FlatElementMesh key={el.id} el={el} blockDefs={blockDefs} activeTool={activeTool} onElementClick={onElementClick} />
        ))}
      </>
    );
  }

  const looseBounds = (() => {
    const b = getPlanBounds(elements);
    if (!b) return null;
    const pad = 60;
    return { x: b.minX - pad, z: b.minZ - pad, w: (b.maxX - b.minX) + pad * 2, d: (b.maxZ - b.minZ) + pad * 2 };
  })();

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

function Scene({
  elements, plan, blockDefs, revisionKey, viewAngle, onViewConsumed,
  activeTool, wallHeight, onElementClick,
  activeDrawingState, setActiveDrawingState, onDrawingClosed,
  shapes, onShapeDepthChange, measurePoints, setMeasurePoints,
}: {
  elements: DrawingElement[];
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
}) {
  const bounds = useMemo(() => getPlanBounds(elements), [elements]);
  const orbitTarget = bounds
    ? [(bounds.minX + bounds.maxX) / 2, 10, (bounds.minZ + bounds.maxZ) / 2] as [number, number, number]
    : [500, 10, 350] as [number, number, number];
  const controlsRef = useRef<any>(null);

  // Scale-aware fog — prevent grey wall for large-coordinate DXF drawings
  const span = bounds
    ? Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ, 200)
    : 800;
  const fogNear = span * 0.5;
  const fogFar = span * 3;

  return (
    <>
      <color attach="background" args={["#e5e7eb"]} />
      <fog attach="fog" args={["#e5e7eb", fogNear, fogFar]} />
      <ambientLight intensity={1.1} />
      <directionalLight position={[180, 240, 120]} intensity={1.5} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
      <directionalLight position={[-120, 140, -80]} intensity={0.65} />
      <Grid position={[0, -1.2, 0]} args={[1200, 1200]} cellSize={20} cellThickness={0.5} cellColor="#cbd5e1" sectionSize={100} sectionThickness={1} sectionColor="#94a3b8" fadeDistance={800} />
      <AutoFrame bounds={bounds} revisionKey={revisionKey} />
      <CameraController bounds={bounds} viewAngle={viewAngle} onViewConsumed={onViewConsumed} controlsRef={controlsRef} />
      <mesh name="ground-plane" rotation={[-Math.PI / 2, 0, 0]} position={[orbitTarget[0], -0.2, orbitTarget[2]]} receiveShadow>
        <planeGeometry args={[4000, 4000]} />
        <meshStandardMaterial color="#dde1e4" />
      </mesh>
      <PlanModel elements={elements} plan={plan} blockDefs={blockDefs} activeTool={activeTool} onElementClick={onElementClick} wallHeight={wallHeight} />
      <DrawOnFaceController activeTool={activeTool} onDrawingClosed={onDrawingClosed} activeDrawingState={activeDrawingState} setActiveDrawingState={setActiveDrawingState} />
      <TapeMeasureController activeTool={activeTool} measurePoints={measurePoints} setMeasurePoints={setMeasurePoints} />
      {shapes.map((s) => <DrawnPolygonShape key={s.id} shape={s} />)}
      <PushPullDragController activeTool={activeTool} shapes={shapes} onDepthChange={onShapeDepthChange} />
      <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
        <GizmoViewport axisColors={["#ef4444", "#22c55e", "#3b82f6"]} labelColor="white" />
      </GizmoHelper>
      <OrbitControls
        ref={controlsRef}
        enableDamping dampingFactor={0.08} minDistance={40} maxDistance={1800}
        maxPolarAngle={Math.PI / 2.02} target={orbitTarget}
        enabled={activeTool !== "line"}
        mouseButtons={(() => {
          if (activeTool === "pan") return { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
          if (activeTool === "zoom") return { LEFT: THREE.MOUSE.DOLLY, MIDDLE: THREE.MOUSE.ROTATE, RIGHT: THREE.MOUSE.PAN };
          return { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
        })()}
      />
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
  const [activeTool, setActiveTool] = useState<string>("select");
  const [wallHeight, setWallHeight] = useState(34);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeDrawingState, setActiveDrawingState] = useState<DrawingState | null>(null);
  const [shapes, setShapes] = useState<ShapeWithDepth[]>([]);
  const [measurePoints, setMeasurePoints] = useState<{ start: THREE.Vector3 | null; end: THREE.Vector3 | null }>({ start: null, end: null });
  const formatLength = useDrawingStore((state) => state.formatLength);

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
        setActiveTool("select");
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

  return (
    <div className={`absolute inset-0 z-10 bg-[#dfe3e8] ${visible ? "block" : "hidden"}`}>
      <div className="absolute left-4 top-4 z-20 rounded border border-white/60 bg-white/75 px-3 py-2 text-[11px] font-medium text-slate-700 shadow-sm backdrop-blur">
        3D Preview
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
      />

      <ViewCube viewAngle={viewAngle} setViewAngle={setViewAngle} />
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

      <Canvas shadows={{ type: THREE.PCFShadowMap }} camera={{ position: [760, 420, 760], fov: 42, near: 0.1, far: canvasFar }}>
        <Scene
          elements={elements}
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
        />
      </Canvas>
    </div>
  );
}
