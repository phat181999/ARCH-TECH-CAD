// Ground-plane shape drawing: rectangle (2 clicks), circle (center + radius
// click), arc (3 clicks). Snapping and numeric entry (rect: side length along
// the drag direction is not meaningful → numeric applies to circle radius).
import { useEffect, useMemo, useRef, useState } from "react";
import { useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { useDrawingStore } from "../../../stores/drawingStore";
import { useToolRaycast } from "../interaction/useToolRaycast";
import { useNumericInput } from "../interaction/useNumericInput";
import { collectSnapCandidates, applySnap, type SnapType } from "../interaction/snap3d";
import { makeRectangleElement, makeCircleElement, makeArcElement } from "../geometry/shapeDraw";
import { worldToDrawing, type Center } from "../geometry/coordBridge";

const SHAPE_TOOLS = ["rect3d", "circle3d", "arc3d"] as const;
type ShapeTool = (typeof SHAPE_TOOLS)[number];

export function ShapeDrawController({ activeTool, center }: { activeTool: string; center: Center }) {
  const active = (SHAPE_TOOLS as readonly string[]).includes(activeTool);
  const tool = activeTool as ShapeTool;
  const { raycastGround } = useToolRaycast();
  const { gl } = useThree();
  const elements = useDrawingStore((s) => s.elements);
  const formatLength = useDrawingStore((s) => s.formatLength);
  const [clicks, setClicks] = useState<THREE.Vector3[]>([]);
  const [hover, setHover] = useState<THREE.Vector3 | null>(null);
  const [snapType, setSnapType] = useState<SnapType>("none");
  const shiftRef = useRef(false);
  const numeric = useNumericInput(active && tool === "circle3d");

  const candidates = useMemo(
    () => (active ? collectSnapCandidates(elements, center) : { endpoints: [], midpoints: [] }),
    [active, elements, center],
  );

  const commit = (pts: THREE.Vector3[]) => {
    const { activeLayerId, currentStyle, addElement } = useDrawingStore.getState();
    const opts = { layerId: activeLayerId, strokeColor: currentStyle?.strokeColor };
    const d = pts.map((p) => worldToDrawing({ x: p.x, z: p.z }, center));
    const el =
      tool === "rect3d" ? makeRectangleElement(d[0], d[1], opts)
      : tool === "circle3d" ? makeCircleElement(d[0], Math.hypot(d[1].x - d[0].x, d[1].y - d[0].y), opts)
      : makeArcElement(d[0], d[1], d[2], opts);
    if (el) addElement(el);
    setClicks([]);
  };

  useEffect(() => {
    if (!active) { setClicks([]); setHover(null); return; }
    const snap = (pt: THREE.Vector3): THREE.Vector3 => {
      const anchor = clicks.length > 0 ? { x: clicks[0].x, z: clicks[0].z } : null;
      const r = applySnap({ x: pt.x, z: pt.z }, candidates, { anchor, axisLock: shiftRef.current, gridSize: 25 });
      setSnapType(r.type);
      return new THREE.Vector3(r.point.x, 0, r.point.z);
    };
    const need = tool === "arc3d" ? 3 : 2;
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const pt = raycastGround(e);
      if (!pt) return;
      const p = snap(pt);
      const next = [...clicks, p];
      if (next.length >= need) commit(next);
      else setClicks(next);
    };
    const onMove = (e: PointerEvent) => {
      const pt = raycastGround(e);
      setHover(pt ? snap(pt) : null);
    };
    const onKey = (e: KeyboardEvent) => {
      shiftRef.current = e.shiftKey;
      if (e.key === "Escape") setClicks([]);
    };
    gl.domElement.addEventListener("pointerdown", onDown);
    gl.domElement.addEventListener("pointermove", onMove);
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      gl.domElement.removeEventListener("pointerdown", onDown);
      gl.domElement.removeEventListener("pointermove", onMove);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, tool, clicks, candidates, raycastGround, gl]);

  // Circle: typed radius (meters) + Enter commits with exact radius.
  useEffect(() => {
    if (!active || tool !== "circle3d" || numeric.committed == null || clicks.length !== 1) return;
    const meters = numeric.consume();
    if (meters == null) return;
    const c = clicks[0];
    commit([c, c.clone().add(new THREE.Vector3(meters * 100, 0, 0))]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, tool, numeric.committed, clicks]);

  if (!active) return null;

  // Preview
  const previewPts = hover ? [...clicks, hover] : clicks;
  return (
    <group>
      {previewPts.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[2.5, 12, 12]} />
          <meshBasicMaterial
            color={i === previewPts.length - 1 && snapType !== "none"
              ? snapType === "endpoint" ? "#22c55e" : snapType === "midpoint" ? "#38bdf8" : snapType === "axis" ? "#f59e0b" : "#94a3b8"
              : "#3b82f6"}
            depthTest={false}
          />
        </mesh>
      ))}
      {tool === "rect3d" && clicks.length === 1 && hover && (
        <primitive object={(() => {
          const pts = [
            clicks[0],
            new THREE.Vector3(hover.x, 0, clicks[0].z),
            hover,
            new THREE.Vector3(clicks[0].x, 0, hover.z),
            clicks[0],
          ].map((p) => new THREE.Vector3(p.x, 0.3, p.z));
          const geo = new THREE.BufferGeometry().setFromPoints(pts);
          return new THREE.Line(geo, new THREE.LineBasicMaterial({ color: "#3b82f6" }));
        })()} />
      )}
      {tool === "circle3d" && clicks.length === 1 && hover && (
        <mesh position={[clicks[0].x, 0.3, clicks[0].z]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[Math.max(clicks[0].distanceTo(hover) - 0.8, 0.1), clicks[0].distanceTo(hover), 48]} />
          <meshBasicMaterial color="#3b82f6" transparent opacity={0.8} side={THREE.DoubleSide} />
        </mesh>
      )}
      {clicks.length > 0 && hover && (
        <Html position={[hover.x, 10, hover.z]} center>
          <div className="bg-slate-900/90 text-blue-300 font-mono text-[9px] font-bold px-2 py-0.5 rounded border border-blue-500/30 whitespace-nowrap select-none">
            {tool === "circle3d" ? `r = ${formatLength(clicks[0].distanceTo(hover) / 100)}` : formatLength(clicks[clicks.length - 1].distanceTo(hover) / 100)}
            {numeric.buffer && <span className="ml-1 text-amber-300">⌨ {numeric.buffer} m</span>}
          </div>
        </Html>
      )}
    </group>
  );
}
