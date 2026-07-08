// Box/cylinder primitives: footprint stage (2 clicks, same as rect/circle),
// then a height stage — move the pointer up/down, click or type meters +
// Enter to commit. Height is derived from vertical pointer movement mapped
// through the camera so dragging up grows the preview intuitively.
import { useEffect, useMemo, useRef, useState } from "react";
import { useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { useDrawingStore } from "../../../stores/drawingStore";
import { useToolRaycast } from "../interaction/useToolRaycast";
import { useNumericInput } from "../interaction/useNumericInput";
import { collectSnapCandidates, applySnap } from "../interaction/snap3d";
import { makeRectangleElement, makeCircleElement } from "../geometry/shapeDraw";
import { worldToDrawing, type Center } from "../geometry/coordBridge";

export function PrimitiveDrawController({ activeTool, center }: { activeTool: string; center: Center }) {
  const active = activeTool === "box3d" || activeTool === "cylinder3d";
  const isBox = activeTool === "box3d";
  const { raycastGround } = useToolRaycast();
  const { gl } = useThree();
  const elements = useDrawingStore((s) => s.elements);
  const formatLength = useDrawingStore((s) => s.formatLength);
  const [footprint, setFootprint] = useState<THREE.Vector3[]>([]); // 0–2 points
  const [hover, setHover] = useState<THREE.Vector3 | null>(null);
  const [height, setHeight] = useState(0);
  const heightStage = footprint.length === 2;
  const heightStartY = useRef(0);
  const numeric = useNumericInput(active);

  const candidates = useMemo(
    () => (active ? collectSnapCandidates(elements, center) : { endpoints: [], midpoints: [] }),
    [active, elements, center],
  );

  const commit = (h: number) => {
    if (h < 1) { setFootprint([]); setHeight(0); return; }
    const { activeLayerId, currentStyle, addElement } = useDrawingStore.getState();
    const opts = { layerId: activeLayerId, strokeColor: currentStyle?.strokeColor };
    const a = worldToDrawing({ x: footprint[0].x, z: footprint[0].z }, center);
    const b = worldToDrawing({ x: footprint[1].x, z: footprint[1].z }, center);
    const el = isBox
      ? makeRectangleElement(a, b, opts)
      : makeCircleElement(a, Math.hypot(b.x - a.x, b.y - a.y), opts);
    if (el) addElement({ ...el, pushPullDepth: h, fillColor: "#cbd5e1", editedIn3D: true });
    setFootprint([]); setHeight(0);
  };

  useEffect(() => {
    // Keep the same array identity when already empty — a fresh [] here would
    // change this effect's own `footprint` dependency and loop it forever.
    if (!active) { setFootprint((f) => (f.length ? [] : f)); setHover(null); setHeight(0); return; }
    const snap = (pt: THREE.Vector3): THREE.Vector3 => {
      const r = applySnap({ x: pt.x, z: pt.z }, candidates, { gridSize: 25 });
      return new THREE.Vector3(r.point.x, 0, r.point.z);
    };
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      if (heightStage) { commit(height); return; }
      const pt = raycastGround(e);
      if (!pt) return;
      const p = snap(pt);
      const next = [...footprint, p];
      setFootprint(next);
      if (next.length === 2) heightStartY.current = e.clientY;
    };
    const onMove = (e: PointerEvent) => {
      if (heightStage) {
        // 1 px of upward mouse travel ≈ 1 cm of height.
        setHeight(Math.max(0, heightStartY.current - e.clientY));
        return;
      }
      const pt = raycastGround(e);
      setHover(pt ? snap(pt) : null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setFootprint([]); setHeight(0); }
    };
    gl.domElement.addEventListener("pointerdown", onDown);
    gl.domElement.addEventListener("pointermove", onMove);
    window.addEventListener("keydown", onKey);
    return () => {
      gl.domElement.removeEventListener("pointerdown", onDown);
      gl.domElement.removeEventListener("pointermove", onMove);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, footprint, heightStage, height, candidates, raycastGround, gl]);

  // Typed height in meters commits immediately during the height stage.
  useEffect(() => {
    if (!active || !heightStage || numeric.committed == null) return;
    const meters = numeric.consume();
    if (meters != null) commit(meters * 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, heightStage, numeric.committed]);

  if (!active || footprint.length === 0) return null;

  const a = footprint[0];
  const b = footprint[1] ?? hover;
  if (!b) return null;
  const cx = (a.x + b.x) / 2, cz = (a.z + b.z) / 2;
  const w = Math.abs(b.x - a.x), d = Math.abs(b.z - a.z);
  const r = a.distanceTo(b);
  const h = heightStage ? Math.max(height, 1) : 1;

  return (
    <group>
      {/* cylinder preview is centered on the first click, not the midpoint */}
      <mesh position={isBox ? [cx, h / 2, cz] : [a.x, h / 2, a.z]}>
        {isBox
          ? <boxGeometry args={[Math.max(w, 1), h, Math.max(d, 1)]} />
          : <cylinderGeometry args={[Math.max(r, 1), Math.max(r, 1), h, 32]} />}
        <meshStandardMaterial color="#3b82f6" transparent opacity={0.35} depthWrite={false} />
      </mesh>
      <Html position={[cx, h + 12, cz]} center>
        <div className="bg-slate-900/90 text-blue-300 font-mono text-[9px] font-bold px-2 py-0.5 rounded border border-blue-500/30 whitespace-nowrap select-none">
          {heightStage ? `h = ${formatLength(h / 100)} — click or type m + Enter` : (isBox ? `${formatLength(w / 100)} × ${formatLength(d / 100)}` : `r = ${formatLength(r / 100)}`)}
          {numeric.buffer && <span className="ml-1 text-amber-300">⌨ {numeric.buffer} m</span>}
        </div>
      </Html>
    </group>
  );
}
