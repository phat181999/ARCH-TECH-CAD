import { useEffect, useState, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { worldPointsToPolygon } from "../geometry/coordBridge";
import { useToolRaycast } from "../interaction/useToolRaycast";
import { collectSnapCandidates, applySnap, type SnapType } from "../interaction/snap3d";
import { useDrawingStore } from "../../../stores/drawingStore";
import type { DrawingElement } from "../../../types";

// Sequence counter for unique floor element IDs
let floorSeq = 0;

// Dot radius for committed vertex markers (Three.js units)
const VERTEX_DOT_RADIUS = 2.5;
// Sphere segments — low poly is fine for markers
const VERTEX_DOT_SEGMENTS = 8;
// Y position of hint label above the ground plane
const HINT_LABEL_Y = 8;

export function FloorDrawController({
  activeTool,
  center,
}: {
  activeTool: string;
  center: { cx: number; cz: number };
}) {
  const { gl } = useThree();
  const { raycastGround } = useToolRaycast();
  const [vertices, setVertices] = useState<THREE.Vector3[]>([]);
  const [hover, setHover]       = useState<THREE.Vector3 | null>(null);
  const [snapType, setSnapType] = useState<SnapType>("none");
  const elements = useDrawingStore((s) => s.elements);

  const active = activeTool === "floor3d";

  const candidates = useMemo(
    () => (active ? collectSnapCandidates(elements, { cx: center.cx, cz: center.cz }) : { endpoints: [], midpoints: [] }),
    [active, elements, center.cx, center.cz],
  );

  function commitFloor(verts: THREE.Vector3[]): void {
    if (verts.length < 3) return;
    const pts = worldPointsToPolygon(verts.map((v) => ({ x: v.x, z: v.z })), center);
    const { addElement } = useDrawingStore.getState();
    addElement({
      id:       `floor3d-${++floorSeq}`,
      type:     "polygon",
      archType: "floor",
      layerId:  "A-FLOOR",
      points:   pts,
      closed:   true,
      strokeColor: "#64748b",
      fillColor:   "rgba(148,163,184,0.18)",
      floorFinish: "concrete",
      elevation:   0,
    } as DrawingElement);
  }

  useEffect(() => {
    if (!active) {
      // Keep the same array identity when already empty — a fresh [] here
      // would change this effect's own `vertices` dependency and loop it.
      setVertices((v) => (v.length ? [] : v));
      setHover(null);
      setSnapType("none");
      return;
    }

    const snap = (pt: THREE.Vector3): THREE.Vector3 => {
      const last = vertices.length > 0 ? vertices[vertices.length - 1] : null;
      const anchor = last ? { x: last.x, z: last.z } : null;
      const r = applySnap({ x: pt.x, z: pt.z }, candidates, { anchor, gridSize: 25 });
      setSnapType(r.type);
      return new THREE.Vector3(r.point.x, 0, r.point.z);
    };

    const onMove  = (e: PointerEvent) => {
      const pt = raycastGround(e);
      setHover(pt ? snap(pt) : null);
    };
    const onClick = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const pt = raycastGround(e);
      if (!pt) return;
      setVertices((prev) => [...prev, snap(pt).clone()]);
    };
    const onDbl = () => {
      setVertices((prev) => { commitFloor(prev); return []; });
      setHover(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setVertices([]); setHover(null); }
      if (e.key === "Enter") {
        setVertices((prev) => { commitFloor(prev); return []; });
      }
    };

    gl.domElement.addEventListener("pointerdown", onClick);
    gl.domElement.addEventListener("pointermove", onMove);
    gl.domElement.addEventListener("dblclick",    onDbl);
    window.addEventListener("keydown", onKey);
    return () => {
      gl.domElement.removeEventListener("pointerdown", onClick);
      gl.domElement.removeEventListener("pointermove", onMove);
      gl.domElement.removeEventListener("dblclick",    onDbl);
      window.removeEventListener("keydown", onKey);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, vertices, gl, raycastGround, center, candidates]);

  if (!active) return null;

  const allPts = hover ? [...vertices, hover] : vertices;

  return (
    <group>
      {/* Vertex dots */}
      {vertices.map((v, i) => (
        <mesh key={i} position={v}>
          <sphereGeometry args={[VERTEX_DOT_RADIUS, VERTEX_DOT_SEGMENTS, VERTEX_DOT_SEGMENTS]} />
          <meshBasicMaterial color="#f97316" depthTest={false} />
        </mesh>
      ))}
      {/* Snap marker at the hover point */}
      {hover && snapType !== "none" && (
        <mesh position={hover}>
          <sphereGeometry args={[3, 12, 12]} />
          <meshBasicMaterial
            color={snapType === "endpoint" ? "#22c55e" : snapType === "midpoint" ? "#38bdf8" : snapType === "axis" ? "#f59e0b" : "#94a3b8"}
            depthTest={false}
          />
        </mesh>
      )}
      {/* Preview edges */}
      {allPts.length >= 2 && (() => {
        const geo = new THREE.BufferGeometry().setFromPoints([...allPts, allPts[0]]);
        return <primitive object={new THREE.Line(geo, new THREE.LineBasicMaterial({ color: "#f97316" }))} />;
      })()}
      {/* Hint label */}
      {hover && (
        <Html position={[hover.x, HINT_LABEL_Y, hover.z]} center>
          <div className="bg-slate-900/90 text-orange-400 font-mono text-[9px] font-bold px-2 py-0.5 rounded border border-orange-500/30 whitespace-nowrap shadow-md select-none">
            {vertices.length === 0 ? "Click to start floor" : `${vertices.length} pts — DblClick or Enter to close`}
          </div>
        </Html>
      )}
    </group>
  );
}
