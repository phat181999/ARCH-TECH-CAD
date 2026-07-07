// Offset tool: click a wall to select it, move the pointer to preview a
// parallel wall at the pointer's perpendicular distance (or type meters +
// Enter), click again to commit.
import { useEffect, useMemo, useState } from "react";
import { useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { DrawingElement } from "../../../types";
import { useDrawingStore } from "../../../stores/drawingStore";
import { useToolRaycast } from "../interaction/useToolRaycast";
import { useNumericInput } from "../interaction/useNumericInput";
import { offsetWall } from "../geometry/shapeDraw";
import { worldToDrawing, drawingToWorld, type Center } from "../geometry/coordBridge";

// Signed perpendicular distance (drawing coords) from wall line a→b to point p.
// Sign matches offsetWall's normal so the preview lands on the pointer's side.
function signedDistance(wall: DrawingElement, p: { x: number; y: number }): number {
  const dx = (wall.x2 ?? 0) - (wall.x1 ?? 0);
  const dy = (wall.y2 ?? 0) - (wall.y1 ?? 0);
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return 0;
  return ((p.y - (wall.y1 ?? 0)) * dx - (p.x - (wall.x1 ?? 0)) * dy) / len;
}

export function OffsetWallController({ activeTool, center, wallElements }: {
  activeTool: string; center: Center; wallElements: DrawingElement[];
}) {
  const active = activeTool === "wall-offset";
  const { raycastGround } = useToolRaycast();
  const { gl } = useThree();
  const formatLength = useDrawingStore((s) => s.formatLength);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [distance, setDistance] = useState(0);
  const numeric = useNumericInput(active && sourceId != null);

  const source = useMemo(
    () => wallElements.find((w) => w.id === sourceId && w.type === "line") ?? null,
    [wallElements, sourceId],
  );
  const preview = useMemo(
    () => (source && Math.abs(distance) > 1 ? offsetWall(source, distance) : null),
    [source, distance],
  );

  const commit = (d: number) => {
    if (!source) return;
    const el = offsetWall(source, d);
    if (el) useDrawingStore.getState().addElement(el);
    setSourceId(null); setDistance(0);
  };

  useEffect(() => {
    if (!active) { setSourceId(null); setDistance(0); return; }
    const pick = (e: PointerEvent): { pt: { x: number; y: number } } | null => {
      const g = raycastGround(e);
      return g ? { pt: worldToDrawing({ x: g.x, z: g.z }, center) } : null;
    };
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const hit = pick(e);
      if (!hit) return;
      if (!sourceId) {
        // Nearest wall whose perpendicular distance is under 40 drawing units.
        let best: { id: string; d: number } | null = null;
        for (const w of wallElements) {
          if (w.type !== "line" || w.x1 == null) continue;
          const d = Math.abs(signedDistance(w, hit.pt));
          if (d < 40 && (!best || d < best.d)) best = { id: w.id, d };
        }
        if (best) setSourceId(best.id);
      } else {
        commit(distance);
      }
    };
    const onMove = (e: PointerEvent) => {
      if (!source) return;
      const hit = pick(e);
      if (hit) setDistance(signedDistance(source, hit.pt));
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setSourceId(null); setDistance(0); }
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
  }, [active, sourceId, source, distance, wallElements, raycastGround, gl, center]);

  // Typed distance (meters): offset to the side the pointer is currently on.
  useEffect(() => {
    if (!active || numeric.committed == null || !source) return;
    const meters = numeric.consume();
    if (meters != null) commit(Math.sign(distance || 1) * meters * 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, numeric.committed, source, distance]);

  if (!active || !preview) return null;
  const a = drawingToWorld({ x: preview.x1!, y: preview.y1! }, center);
  const b = drawingToWorld({ x: preview.x2!, y: preview.y2! }, center);
  return (
    <group>
      <primitive object={(() => {
        const geo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(a.x, 2, a.z), new THREE.Vector3(b.x, 2, b.z),
        ]);
        return new THREE.Line(geo, new THREE.LineBasicMaterial({ color: "#f59e0b" }));
      })()} />
      <Html position={[(a.x + b.x) / 2, 12, (a.z + b.z) / 2]} center>
        <div className="bg-slate-900/90 text-amber-300 font-mono text-[9px] font-bold px-2 py-0.5 rounded border border-amber-500/30 whitespace-nowrap select-none">
          ↔ {formatLength(Math.abs(distance) / 100)}
          {numeric.buffer && <span className="ml-1">⌨ {numeric.buffer} m</span>}
        </div>
      </Html>
    </group>
  );
}
