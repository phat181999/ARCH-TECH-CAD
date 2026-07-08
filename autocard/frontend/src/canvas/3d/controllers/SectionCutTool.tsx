// Two clicks on a ViewRenderer's plan-view ground plane define a section cut
// line (drawing coords). Only ever mounted inside the plan ViewRenderer
// instance, only while "add section cut" mode is active. Same 2-click UX and
// raycasting mechanism as RidgeLineController (interactive 3D viewer).
import { useEffect, useState } from "react";
import { Html } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useToolRaycast } from "../interaction/useToolRaycast";
import { worldToDrawing, type Center } from "../geometry/coordBridge";

export function SectionCutTool({ center, onCommit }: {
  center: Center;
  onCommit: (line: { x1: number; y1: number; x2: number; y2: number }) => void;
}) {
  const { raycastGround } = useToolRaycast();
  const { gl } = useThree();
  const [pending, setPending] = useState<THREE.Vector3 | null>(null);
  const [hover, setHover] = useState<THREE.Vector3 | null>(null);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const pt = raycastGround(e);
      if (!pt) return;
      if (!pending) { setPending(pt.clone()); return; }
      const a = worldToDrawing({ x: pending.x, z: pending.z }, center);
      const b = worldToDrawing({ x: pt.x, z: pt.z }, center);
      if (Math.hypot(b.x - a.x, b.y - a.y) < 1) { setPending(null); return; }
      onCommit({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
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
  }, [pending, raycastGround, gl, center, onCommit]);

  return (
    <group>
      {pending && hover && (
        <>
          <primitive object={(() => {
            const geo = new THREE.BufferGeometry().setFromPoints([pending, hover]);
            return new THREE.Line(geo, new THREE.LineBasicMaterial({ color: "#38bdf8" }));
          })()} />
          <Html position={[(pending.x + hover.x) / 2, 20, (pending.z + hover.z) / 2]} center>
            <div className="bg-slate-900/90 text-sky-300 font-mono text-[9px] font-bold px-2 py-0.5 rounded border border-sky-500/30 whitespace-nowrap select-none">
              Click điểm cuối mặt cắt
            </div>
          </Html>
        </>
      )}
      {pending == null && (
        <Html position={[0, 20, 0]} center>
          <div className="bg-slate-900/90 text-sky-300 font-mono text-[9px] font-bold px-2 py-0.5 rounded border border-sky-500/30 whitespace-nowrap select-none">
            Click điểm đầu mặt cắt
          </div>
        </Html>
      )}
    </group>
  );
}
