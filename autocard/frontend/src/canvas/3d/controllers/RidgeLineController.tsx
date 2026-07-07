// Two clicks on the ground plane define the roof ridge line (đường nóc mái).
// The line is stored in drawing coords (sceneSlice.roofRidge) so PlanModel can
// derive roof orientation/shape from it. The committed ridge renders as an
// orange line above the walls whenever it exists; drawing again replaces it.
import { useEffect, useState } from "react";
import { Html } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useDrawingStore } from "../../../stores/drawingStore";
import { useToolRaycast } from "../interaction/useToolRaycast";
import { worldToDrawing, drawingToWorld, type Center } from "../geometry/coordBridge";

const RIDGE_Y = 285; // just above the default wall height so it reads as "on the roof"

export function RidgeLineController({ activeTool, center }: { activeTool: string; center: Center }) {
  const active = activeTool === "roof-ridge";
  const { raycastGround } = useToolRaycast();
  const { gl } = useThree();
  const roofRidge = useDrawingStore((s) => s.roofRidge);
  const setRoofRidge = useDrawingStore((s) => s.setRoofRidge);
  const [pending, setPending] = useState<THREE.Vector3 | null>(null);
  const [hover, setHover] = useState<THREE.Vector3 | null>(null);

  useEffect(() => {
    if (!active) { setPending(null); setHover(null); return; }
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const pt = raycastGround(e);
      if (!pt) return;
      if (!pending) { setPending(pt.clone()); return; }
      const a = worldToDrawing({ x: pending.x, z: pending.z }, center);
      const b = worldToDrawing({ x: pt.x, z: pt.z }, center);
      setRoofRidge({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
      setPending(null);
    };
    const onMove = (e: PointerEvent) => setHover(raycastGround(e));
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPending(null); };
    gl.domElement.addEventListener("pointerdown", onDown);
    gl.domElement.addEventListener("pointermove", onMove);
    window.addEventListener("keydown", onKey);
    return () => {
      gl.domElement.removeEventListener("pointerdown", onDown);
      gl.domElement.removeEventListener("pointermove", onMove);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, pending, raycastGround, gl, center]);

  // Committed ridge visual — shown whenever a ridge exists (any tool).
  const committed = roofRidge
    ? [drawingToWorld({ x: roofRidge.x1, y: roofRidge.y1 }, center), drawingToWorld({ x: roofRidge.x2, y: roofRidge.y2 }, center)]
    : null;

  return (
    <group>
      {committed && (
        <primitive object={(() => {
          const geo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(committed[0].x, RIDGE_Y, committed[0].z),
            new THREE.Vector3(committed[1].x, RIDGE_Y, committed[1].z),
          ]);
          return new THREE.Line(geo, new THREE.LineBasicMaterial({ color: "#f2a65a" }));
        })()} />
      )}
      {active && pending && hover && (
        <>
          <primitive object={(() => {
            const geo = new THREE.BufferGeometry().setFromPoints([
              new THREE.Vector3(pending.x, RIDGE_Y, pending.z),
              new THREE.Vector3(hover.x, RIDGE_Y, hover.z),
            ]);
            return new THREE.Line(geo, new THREE.LineBasicMaterial({ color: "#f2a65a" }));
          })()} />
          <Html position={[(pending.x + hover.x) / 2, RIDGE_Y + 14, (pending.z + hover.z) / 2]} center>
            <div className="bg-slate-900/90 text-amber-300 font-mono text-[9px] font-bold px-2 py-0.5 rounded border border-amber-500/30 whitespace-nowrap select-none">
              Đường nóc mái — click điểm cuối
            </div>
          </Html>
        </>
      )}
      {active && !pending && hover && (
        <Html position={[hover.x, RIDGE_Y + 14, hover.z]} center>
          <div className="bg-slate-900/90 text-amber-300 font-mono text-[9px] font-bold px-2 py-0.5 rounded border border-amber-500/30 whitespace-nowrap select-none">
            Click điểm đầu đường nóc
          </div>
        </Html>
      )}
    </group>
  );
}
