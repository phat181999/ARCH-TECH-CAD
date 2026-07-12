// Places wall-mounted MEP fixtures: hover shows a ghost snapped to the
// nearest wall (within 60 units) at the fixture's default mounting height,
// rotated flush with the wall; clicking far from any wall places it free at
// the click point. Click commits an archType:"mepFixture" element.
import { useEffect, useState } from "react";
import { useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type { DrawingElement } from "../../../types";
import { useDrawingStore } from "../../../stores/drawingStore";
import { useToolRaycast } from "../interaction/useToolRaycast";
import { snapFixtureToWall } from "../geometry/fixtureSnap";
import { getMepFixtures, type MepFixtureType } from "../materials/mepFixtures";
import { worldToDrawing, drawingToWorld, type Center } from "../geometry/coordBridge";

const WALL_SNAP_DIST = 60;   // drawing units
const FACE_OFFSET = 12;      // half wall thickness (9) + small gap
let fixtureSeq = 0;

export function MepFixturePlacerController({ activeTool, center, wallElements, fixtureType }: {
  activeTool: string;
  center: Center;
  wallElements: DrawingElement[];
  fixtureType: MepFixtureType;
}) {
  const active = activeTool === "mep-fixture";
  const { raycastGround } = useToolRaycast();
  const { gl } = useThree();
  const [ghost, setGhost] = useState<{ x: number; y: number; angleDeg: number; onWall: boolean } | null>(null);
  const def = getMepFixtures()[fixtureType];

  useEffect(() => {
    if (!active || !def) { setGhost(null); return; }
    const locate = (e: PointerEvent) => {
      const pt = raycastGround(e);
      if (!pt) return null;
      const d = worldToDrawing({ x: pt.x, z: pt.z }, center);
      const snap = snapFixtureToWall(d, wallElements, WALL_SNAP_DIST, FACE_OFFSET);
      return snap
        ? { x: snap.x, y: snap.y, angleDeg: snap.angleDeg, onWall: true }
        : { x: d.x, y: d.y, angleDeg: 0, onWall: false };
    };
    const onMove = (e: PointerEvent) => setGhost(locate(e));
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const g = locate(e);
      if (!g) return;
      const { activeLayerId, addElement } = useDrawingStore.getState();
      addElement({
        id: `fixture-${++fixtureSeq}-${Math.random().toString(36).slice(2, 7)}`,
        type: "rectangle", archType: "mepFixture", layerId: activeLayerId,
        x: g.x - 9, y: g.y - 4, width: 18, height: 8,
        rotation: g.angleDeg,
        elevation: def.heightCm,
        fixtureType,
        strokeColor: "#ca8a04",
      } as DrawingElement);
    };
    gl.domElement.addEventListener("pointermove", onMove);
    gl.domElement.addEventListener("pointerdown", onDown);
    return () => {
      gl.domElement.removeEventListener("pointermove", onMove);
      gl.domElement.removeEventListener("pointerdown", onDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, wallElements, fixtureType, raycastGround, gl, center]);

  if (!active || !ghost || !def) return null;
  const w = drawingToWorld({ x: ghost.x, y: ghost.y }, center);
  return (
    <group>
      <mesh position={[w.x, def.heightCm, w.z]} rotation={[0, -(ghost.angleDeg * Math.PI) / 180, 0]}>
        <boxGeometry args={[26, 30, 10]} />
        <meshBasicMaterial color={ghost.onWall ? "#22c55e" : "#f59e0b"} wireframe />
      </mesh>
      <Html position={[w.x, def.heightCm + 26, w.z]} center>
        <div className="bg-slate-900/90 text-slate-200 font-mono text-[9px] font-bold px-2 py-0.5 rounded border border-white/10 whitespace-nowrap select-none">
          {def.label} · +{def.heightCm}cm {ghost.onWall ? "· áp tường" : "· tự do"}
        </div>
      </Html>
    </group>
  );
}
