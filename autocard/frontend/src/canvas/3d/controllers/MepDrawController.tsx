// Free-space MEP line drawing: click-click to chain a run at the current
// system's default elevation; the scroll wheel adjusts elevation live (no
// other input maps to a third dimension while drawing on the ground plane).
// Commits archType:"pipe" elements — identical shape to what the 2D Pipe/Wire
// tool already produces, so PipeMesh, clashDetector, and quantityEngine all
// pick these up with no changes.
import { useEffect, useMemo, useRef, useState } from "react";
import { Html } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useDrawingStore } from "../../../stores/drawingStore";
import { useToolRaycast } from "../interaction/useToolRaycast";
import { useNumericInput } from "../interaction/useNumericInput";
import { collectSnapCandidates, applySnap, type SnapType } from "../interaction/snap3d";
import { worldToDrawing, type Center } from "../geometry/coordBridge";

// Mirrors PipeMesh.tsx's SYSTEM_COLORS so the drawn preview and the committed
// 3D pipe match exactly.
const MEP_SYSTEMS: Record<string, { color: string; elevationCm: number; diameterMm: number; label: string }> = {
  water:    { color: "#0284c7", elevationCm: 30,  diameterMm: 25,  label: "Cấp nước" },
  drain:    { color: "#ea580c", elevationCm: -20, diameterMm: 110, label: "Thoát nước" },
  electric: { color: "#ca8a04", elevationCm: 280, diameterMm: 20,  label: "Điện" },
  hvac:     { color: "#06b6d4", elevationCm: 300, diameterMm: 150, label: "Điều hòa" },
  gas:      { color: "#dc2626", elevationCm: 30,  diameterMm: 20,  label: "Gas" },
};
const ELEV_MIN = -100, ELEV_MAX = 400, ELEV_STEP = 10;

export function MepDrawController({ activeTool, center }: { activeTool: string; center: Center }) {
  const system = activeTool.startsWith("mep-") ? activeTool.slice(4) : null;
  const active = system != null && system in MEP_SYSTEMS;
  const { raycastGround } = useToolRaycast();
  const { gl } = useThree();
  const elements = useDrawingStore((s) => s.elements);
  const formatLength = useDrawingStore((s) => s.formatLength);
  const [start, setStart] = useState<THREE.Vector3 | null>(null);
  const [hover, setHover] = useState<THREE.Vector3 | null>(null);
  const [, setSnapType] = useState<SnapType>("none");
  const [elevationCm, setElevationCm] = useState(0);
  const shiftRef = useRef(false);
  const numeric = useNumericInput(active && start != null);

  const def = system ? MEP_SYSTEMS[system] : null;

  useEffect(() => {
    if (system && MEP_SYSTEMS[system]) setElevationCm(MEP_SYSTEMS[system].elevationCm);
  }, [system]);

  const candidates = useMemo(
    () => (active ? collectSnapCandidates(elements, center) : { endpoints: [], midpoints: [] }),
    [active, elements, center],
  );

  const commit = (end: THREE.Vector3) => {
    if (!start || !system) return;
    const a = worldToDrawing({ x: start.x, z: start.z }, center);
    const b = worldToDrawing({ x: end.x, z: end.z }, center);
    if (Math.hypot(b.x - a.x, b.y - a.y) < 1) return;
    const { activeLayerId, addElement } = useDrawingStore.getState();
    addElement({
      id: `mep3d-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: "line", archType: "pipe", layerId: activeLayerId,
      pipeSystem: system, pipeDiameter: def!.diameterMm, elevation: elevationCm,
      x1: a.x, y1: a.y, x2: b.x, y2: b.y,
    } as import("../../../types").DrawingElement);
  };

  useEffect(() => {
    if (!active) { setStart(null); setHover(null); return; }
    const snap = (pt: THREE.Vector3): THREE.Vector3 => {
      const anchor = start ? { x: start.x, z: start.z } : null;
      const r = applySnap({ x: pt.x, z: pt.z }, candidates, { anchor, axisLock: shiftRef.current });
      setSnapType(r.type);
      return new THREE.Vector3(r.point.x, 0, r.point.z);
    };
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const pt = raycastGround(e);
      if (!pt) return;
      const p = snap(pt);
      if (!start) setStart(p);
      else { commit(p); setStart(p); }
    };
    const onMove = (e: PointerEvent) => { const pt = raycastGround(e); setHover(pt ? snap(pt) : null); };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setElevationCm((v) => Math.max(ELEV_MIN, Math.min(ELEV_MAX, v + (e.deltaY < 0 ? ELEV_STEP : -ELEV_STEP))));
    };
    const onKey = (e: KeyboardEvent) => {
      shiftRef.current = e.shiftKey;
      if (e.key === "Escape") setStart(null);
    };
    const onDbl = () => setStart(null);
    gl.domElement.addEventListener("pointerdown", onDown);
    gl.domElement.addEventListener("pointermove", onMove);
    gl.domElement.addEventListener("wheel", onWheel, { passive: false });
    gl.domElement.addEventListener("dblclick", onDbl);
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      gl.domElement.removeEventListener("pointerdown", onDown);
      gl.domElement.removeEventListener("pointermove", onMove);
      gl.domElement.removeEventListener("wheel", onWheel);
      gl.domElement.removeEventListener("dblclick", onDbl);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, start, candidates, raycastGround, gl]);

  // Typed length (meters) commits the run exactly, same convention as the wall tool.
  useEffect(() => {
    if (!active || numeric.committed == null || !start || !hover) return;
    const meters = numeric.consume();
    if (meters == null) return;
    const dir = hover.clone().sub(start);
    if (dir.lengthSq() < 1e-6) return;
    dir.normalize().multiplyScalar(meters * 100);
    const end = start.clone().add(dir);
    commit(end);
    setStart(end);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, numeric.committed]);

  if (!active || !def) return null;
  return (
    <group>
      {start && hover && (
        <>
          <primitive object={(() => {
            const geo = new THREE.BufferGeometry().setFromPoints([start, hover]);
            return new THREE.Line(geo, new THREE.LineDashedMaterial({ color: def.color, dashSize: elevationCm < 0 ? 6 : 1e6, gapSize: 4 }));
          })()} />
          <Html position={[(start.x + hover.x) / 2, 10, (start.z + hover.z) / 2]} center>
            <div className="bg-slate-900/90 font-mono text-[9px] font-bold px-2 py-0.5 rounded border whitespace-nowrap select-none" style={{ color: def.color, borderColor: def.color + "55" }}>
              {formatLength(start.distanceTo(hover) / 100)}
              {numeric.buffer && <span className="ml-1 text-amber-300">⌨ {numeric.buffer} m</span>}
            </div>
          </Html>
        </>
      )}
      {hover && (
        <Html position={[hover.x, 26, hover.z]} center>
          <div className="bg-slate-900/90 text-slate-200 font-mono text-[9px] font-bold px-2 py-0.5 rounded border border-white/10 whitespace-nowrap select-none">
            {def.label} · cao độ {elevationCm >= 0 ? "+" : ""}{elevationCm}cm (lăn chuột)
          </div>
        </Html>
      )}
    </group>
  );
}
