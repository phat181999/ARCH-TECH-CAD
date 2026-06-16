import { useEffect, useRef, useMemo, memo } from "react";
import * as THREE from "three";
import type { BIMResult } from "../../../api/client";
import {
  unitScaleFor, levelBaseMap, buildWallBoxes, buildColumnBoxes,
  buildSlabBoxes, buildOpeningPanels, type BoxDesc, type OpeningPanel,
} from "../geometry/bimGeometry";

// Renders a list of axis/rotated boxes as a single InstancedMesh.
function InstancedBoxes({ boxes, color, transparent, opacity }: {
  boxes: BoxDesc[]; color: string; transparent?: boolean; opacity?: number;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh || boxes.length === 0) return;
    const dummy = new THREE.Object3D();
    boxes.forEach((b, i) => {
      dummy.position.set(b.cx, b.cy, b.cz);
      dummy.rotation.set(0, b.ry, 0);
      dummy.scale.set(b.sx, b.sy, b.sz);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [boxes]);

  if (boxes.length === 0) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, boxes.length]} castShadow receiveShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={color} transparent={transparent} opacity={opacity ?? 1} />
    </instancedMesh>
  );
}

function OpeningPanels({ panels }: { panels: OpeningPanel[] }) {
  if (panels.length === 0) return null;
  return (
    <>
      {panels.map((p) => (
        <mesh key={p.id} position={[p.cx, p.cy, p.cz]} rotation={[0, p.ry, 0]} castShadow>
          <boxGeometry args={[p.sx, p.sy, p.sz]} />
          <meshStandardMaterial
            color={p.type === "door" ? "#8B6350" : "#87CEEB"}
            transparent
            opacity={p.type === "window" ? 0.35 : 0.9}
          />
        </mesh>
      ))}
    </>
  );
}

function RoomFloors({ result, scale, levelBase }: {
  result: BIMResult; scale: number; levelBase: Map<string, number>;
}) {
  const meshes = useMemo(() => {
    return result.rooms
      .filter((r) => r.boundary.length >= 3)
      .map((room) => {
        const shape = new THREE.Shape(room.boundary.map((p) => new THREE.Vector2(p.x * scale, p.y * scale)));
        const geo = new THREE.ShapeGeometry(shape);
        const y = (levelBase.get(room.level_id) ?? 0) + 2;
        return { id: room.id, geo, y };
      });
  }, [result.rooms, scale, levelBase]);

  return (
    <>
      {meshes.map((m) => (
        <mesh key={m.id} geometry={m.geo} rotation={[-Math.PI / 2, 0, 0]} position={[0, m.y, 0]}>
          <meshStandardMaterial color="#f5f0e8" transparent opacity={0.45} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </>
  );
}

export const BimModelRenderer = memo(function BimModelRenderer({ result }: { result: BIMResult }) {
  const scale = useMemo(() => unitScaleFor(result.units), [result.units]);
  const levelBase = useMemo(() => levelBaseMap(result.levels, scale), [result.levels, scale]);
  const wallBoxes = useMemo(() => buildWallBoxes(result, scale, levelBase), [result, scale, levelBase]);
  const columnBoxes = useMemo(() => buildColumnBoxes(result.columns, scale, levelBase), [result.columns, scale, levelBase]);
  const slabBoxes = useMemo(() => buildSlabBoxes(result, scale, levelBase), [result, scale, levelBase]);
  const panels = useMemo(() => buildOpeningPanels(result, scale, levelBase), [result, scale, levelBase]);

  return (
    <group name="bim-model">
      <InstancedBoxes boxes={slabBoxes} color="#cfc9c0" />
      <InstancedBoxes boxes={wallBoxes} color="#e8e0d8" />
      <InstancedBoxes boxes={columnBoxes} color="#b8b0a4" />
      <OpeningPanels panels={panels} />
      <RoomFloors result={result} scale={scale} levelBase={levelBase} />
    </group>
  );
});
