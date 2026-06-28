import { useEffect, useState, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { worldPointsToPolygon } from "../geometry/coordBridge";
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
  const { camera, gl } = useThree();
  const [vertices, setVertices] = useState<THREE.Vector3[]>([]);
  const [hover, setHover]       = useState<THREE.Vector3 | null>(null);

  const active = activeTool === "floor3d";

  const groundPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);

  function toGround(event: PointerEvent): THREE.Vector3 | null {
    const rect = gl.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width)  *  2 - 1,
      -((event.clientY - rect.top)  / rect.height) * 2 + 1,
    );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(mouse, camera);
    const hit = new THREE.Vector3();
    return ray.ray.intersectPlane(groundPlane, hit) ? hit : null;
  }

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
      setVertices([]);
      setHover(null);
      return;
    }

    const onMove  = (e: PointerEvent) => setHover(toGround(e));
    const onClick = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const pt = toGround(e);
      if (!pt) return;
      setVertices((prev) => [...prev, pt.clone()]);
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
  }, [active, vertices, camera, gl, groundPlane, center]);

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
