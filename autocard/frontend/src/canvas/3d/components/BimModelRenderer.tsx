import { useEffect, useRef, memo } from "react";
import * as THREE from "three";
import type { BIMResult, BIMWall, BIMOpening } from "../../../api/client";

function BimWalls({ walls }: { walls: BIMWall[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh || walls.length === 0) return;
    const dummy = new THREE.Object3D();
    walls.forEach((w, i) => {
      const dx = w.x2 - w.x1;
      const dz = w.y2 - w.y1;
      const len = Math.hypot(dx, dz) || 1;
      const cx = (w.x1 + w.x2) / 2;
      const cz = (w.y1 + w.y2) / 2;
      const h = w.height || 3000;
      const t = w.thickness || 200;
      dummy.position.set(cx, h / 2, cz);
      dummy.scale.set(len, h, t);
      dummy.rotation.set(0, -Math.atan2(dz, dx), 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [walls]);

  if (walls.length === 0) return null;

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, walls.length]} castShadow receiveShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#e8e0d8" />
    </instancedMesh>
  );
}

function BimOpenings({ openings }: { openings: BIMOpening[] }) {
  if (openings.length === 0) return null;
  return (
    <>
      {openings.map((o) => {
        const isDoor = o.type === "door";
        const h = o.height || (isDoor ? 2100 : 1200);
        const sill = o.sill || 0;
        return (
          <mesh key={o.id} position={[o.x, sill + h / 2, o.y]} castShadow>
            <boxGeometry args={[o.width || 900, h, 50]} />
            <meshStandardMaterial
              color={isDoor ? "#8B6350" : "#87CEEB"}
              transparent
              opacity={isDoor ? 0.85 : 0.4}
            />
          </mesh>
        );
      })}
    </>
  );
}

function BimRooms({ rooms }: { rooms: BIMResult["rooms"] }) {
  if (rooms.length === 0) return null;
  return (
    <>
      {rooms.map((room) => {
        if (room.boundary.length < 3) return null;
        const shape = new THREE.Shape(
          room.boundary.map((p) => new THREE.Vector2(p.x, p.y))
        );
        const geo = new THREE.ShapeGeometry(shape);
        return (
          <mesh key={room.id} geometry={geo} rotation={[-Math.PI / 2, 0, 0]} position={[0, 2, 0]}>
            <meshStandardMaterial color="#f5f0e8" transparent opacity={0.45} side={THREE.DoubleSide} />
          </mesh>
        );
      })}
    </>
  );
}

export const BimModelRenderer = memo(function BimModelRenderer({ result }: { result: BIMResult }) {
  return (
    <group name="bim-model">
      <BimWalls walls={result.walls} />
      <BimOpenings openings={result.openings} />
      <BimRooms rooms={result.rooms} />
    </group>
  );
});
