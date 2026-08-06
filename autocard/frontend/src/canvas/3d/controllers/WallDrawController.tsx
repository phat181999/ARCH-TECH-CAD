import { useEffect, useMemo, useRef, useState } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { worldToDrawingXY, makeWallElement, isValidWall } from "../geometry/wallDraw";
import { useToolRaycast } from "../interaction/useToolRaycast";
import { collectSnapCandidates, applySnap, type SnapType } from "../interaction/snap3d";
import { createPointerCoalescer } from "../interaction/pointerCoalescer";
import { useNumericInput } from "../interaction/useNumericInput";
import { WALL_ASSEMBLY_PRESETS, type WallAssemblyPreset } from "../materials/wallAssemblyPresets";
import { useDrawingStore } from "../../../stores/drawingStore";

// Click-click wall drawing in 3D. Raycasts the ground plane, previews the
// segment, and on the second click commits a wall as a DrawingElement
// (archType:"wall") to the active store — so it renders in 2D and 3D and
// persists. Each pair of clicks is its own wall: the second click commits
// and resets, it does NOT carry the end point forward as the next start —
// that auto-chaining read as "the tool won't stop" (clicking to finish a
// wall silently armed another one from that same point). Click a fresh
// start point to draw another wall. Escape/double-click cancel a pending
// (started but not yet finished) segment.
// Clicks snap to endpoints/midpoints of existing elements (Shift = axis lock),
// and typing a number + Enter commits a segment of exactly that many meters.
export function WallDrawController({
  activeTool,
  center,
  wallPreset = WALL_ASSEMBLY_PRESETS[1],
  onProgress,
  onComplete,
}: {
  activeTool: string;
  center: { cx: number; cz: number };
  wallPreset?: WallAssemblyPreset;
  onProgress?: (p: { segmentCount: number; currentLength: number; totalLength: number } | null) => void;
  /** Called once a wall's end point is placed and the segment is committed —
   *  wired to switch back to the Select tool so drawing a second wall
   *  requires deliberately picking the wall tool again, instead of staying
   *  armed and drawing another segment from a fresh click. */
  onComplete?: () => void;
}) {
  const { gl } = useThree();
  const { raycastGround } = useToolRaycast();
  const [startWorld, setStartWorld] = useState<THREE.Vector3 | null>(null);
  const [hoverWorld, setHoverWorld] = useState<THREE.Vector3 | null>(null);
  const [snapType, setSnapType] = useState<SnapType>("none");
  const [segmentCount, setSegmentCount] = useState(0);
  const [totalLength, setTotalLength] = useState(0);
  const shiftRef = useRef(false);
  const formatLength = useDrawingStore((s) => s.formatLength);
  const elements = useDrawingStore((s) => s.elements);

  const snapMarkerRef = useRef<THREE.Mesh>(null);
  // Snap-marker pulse only matters while the wall tool is in use — without
  // the gate this ran every frame for a controller that stays mounted
  // whenever the 3D view is up. (`active` is declared below, but the
  // callback only runs after render, so the closure reads it safely.)
  useFrame(({ clock }) => {
    if (!active || !snapMarkerRef.current) return;
    snapMarkerRef.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 6) * 0.15);
  });

  const active = activeTool === "wall3d";
  const numeric = useNumericInput(active);

  const candidates = useMemo(
    () => (active ? collectSnapCandidates(elements, { cx: center.cx, cz: center.cz }) : { endpoints: [], midpoints: [] }),
    [active, elements, center.cx, center.cz],
  );

  useEffect(() => {
    if (!active) {
      setStartWorld(null);
      setHoverWorld(null);
      setSnapType("none");
      setSegmentCount(0);
      setTotalLength(0);
      return;
    }

    const snap = (pt: THREE.Vector3): THREE.Vector3 => {
      const anchor = startWorld ? { x: startWorld.x, z: startWorld.z } : null;
      const r = applySnap({ x: pt.x, z: pt.z }, candidates, { anchor, axisLock: shiftRef.current, gridSize: 25 });
      setSnapType(r.type);
      return new THREE.Vector3(r.point.x, 0, r.point.z);
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return; // left click only
      const pt = raycastGround(event);
      if (!pt) return;
      const p = snap(pt);
      if (!startWorld) {
        setStartWorld(p.clone());
        return;
      }
      const a = worldToDrawingXY({ x: startWorld.x, z: startWorld.z }, center);
      const b = worldToDrawingXY({ x: p.x, z: p.z }, center);
      if (isValidWall(a, b)) {
        const { activeLayerId, currentStyle, addElement } = useDrawingStore.getState();
        addElement(makeWallElement(a, b, {
          layerId: activeLayerId,
          strokeColor: currentStyle?.strokeColor,
          wallLayers: wallPreset.layers,
        }));
        const segLen = Math.hypot(b.x - a.x, b.y - a.y) / 100;
        setSegmentCount((c) => c + 1);
        setTotalLength((t) => t + segLen);
        setStartWorld(null);
        onComplete?.(); // exit the wall tool — a fresh click on the tool is required to draw another
        return;
      }
      setStartWorld(null); // single segment — commit and stop, don't auto-chain a new one
    };

    // Coalesce pointermove to at most one raycast+snap+setState per animation
    // frame (see pointerCoalescer.ts — raw events fire far above frame rate).
    const moveCoalescer = createPointerCoalescer((ev) => {
      const pt = raycastGround(ev);
      setHoverWorld(pt ? snap(pt) : null);
    });
    const handlePointerMove = (event: PointerEvent) => moveCoalescer.push(event);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setStartWorld(null); setHoverWorld(null); setSegmentCount(0); setTotalLength(0); }
    };
    const handleDblClick = () => { setStartWorld(null); setSegmentCount(0); setTotalLength(0); };
    const onShift = (e: KeyboardEvent) => { shiftRef.current = e.shiftKey; };

    gl.domElement.addEventListener("pointerdown", handlePointerDown);
    gl.domElement.addEventListener("pointermove", handlePointerMove);
    gl.domElement.addEventListener("dblclick", handleDblClick);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keydown", onShift);
    window.addEventListener("keyup", onShift);
    return () => {
      gl.domElement.removeEventListener("pointerdown", handlePointerDown);
      gl.domElement.removeEventListener("pointermove", handlePointerMove);
      gl.domElement.removeEventListener("dblclick", handleDblClick);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keydown", onShift);
      window.removeEventListener("keyup", onShift);
      moveCoalescer.cancel();
    };
  }, [active, startWorld, gl, raycastGround, center, candidates]);

  // Enter with a typed length: commit a wall of exactly N meters in the
  // direction of the current hover preview (100 scene units = 1 m).
  useEffect(() => {
    if (!active || numeric.committed == null || !startWorld || !hoverWorld) return;
    const meters = numeric.consume();
    if (meters == null) return;
    const dir = hoverWorld.clone().sub(startWorld);
    if (dir.lengthSq() < 1e-6) return;
    dir.normalize().multiplyScalar(meters * 100);
    const end = startWorld.clone().add(dir);
    const a = worldToDrawingXY({ x: startWorld.x, z: startWorld.z }, center);
    const b = worldToDrawingXY({ x: end.x, z: end.z }, center);
    if (isValidWall(a, b)) {
      const { activeLayerId, currentStyle, addElement } = useDrawingStore.getState();
      addElement(makeWallElement(a, b, { layerId: activeLayerId, strokeColor: currentStyle?.strokeColor, wallLayers: wallPreset.layers }));
      setSegmentCount((c) => c + 1);
      setTotalLength((t) => t + meters);
      setStartWorld(null);
      onComplete?.(); // same as the click path — one segment, then exit the tool
      return;
    }
    setStartWorld(null); // same as the click path — one segment, then stop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, numeric.committed]);

  useEffect(() => {
    if (!onProgress) return;
    if (!active || !startWorld) { onProgress(null); return; }
    const currentLength = hoverWorld ? startWorld.distanceTo(hoverWorld) / 100 : 0;
    onProgress({ segmentCount, currentLength, totalLength });
  }, [onProgress, active, startWorld, hoverWorld, segmentCount, totalLength]);

  if (!active) return null;

  const previewEnd = hoverWorld;
  const previewLen = startWorld && previewEnd
    ? startWorld.distanceTo(previewEnd) / 100 // 100 scene units = 1m (matches tape measure)
    : 0;

  return (
    <group>
      {startWorld && (
        <mesh position={startWorld}>
          <sphereGeometry args={[2, 16, 16]} />
          <meshBasicMaterial color="#22c55e" depthTest={false} />
        </mesh>
      )}
      {hoverWorld && snapType !== "none" && (
        <mesh ref={snapMarkerRef} position={hoverWorld}>
          <sphereGeometry args={[3, 12, 12]} />
          <meshBasicMaterial
            color={snapType === "endpoint" ? "#22c55e" : snapType === "midpoint" ? "#38bdf8" : snapType === "axis" ? "#f59e0b" : "#94a3b8"}
            depthTest={false}
          />
        </mesh>
      )}
      {startWorld && previewEnd && (
        <>
          <primitive object={(() => {
            const geo = new THREE.BufferGeometry().setFromPoints([startWorld, previewEnd]);
            return new THREE.Line(geo, new THREE.LineBasicMaterial({ color: "#22c55e" }));
          })()} />
          <Html position={[(startWorld.x + previewEnd.x) / 2, 8, (startWorld.z + previewEnd.z) / 2]} center>
            <div className="bg-slate-900/90 text-emerald-400 font-mono text-[9px] font-bold px-2 py-0.5 rounded border border-emerald-500/30 whitespace-nowrap shadow-md select-none">
              🧱 {formatLength(previewLen)}
              {numeric.buffer && <span className="ml-1 text-amber-300">⌨ {numeric.buffer} m</span>}
            </div>
          </Html>
        </>
      )}
    </group>
  );
}
