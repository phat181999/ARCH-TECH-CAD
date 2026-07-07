// "Walk into rooms" tool: click the ground to send the avatar there at human
// walking speed; reports the room it's currently standing in via onRoomChange
// so the UI can show a toast and track visited rooms. Position/rotation are
// driven imperatively each frame (group ref, not React state) to avoid a
// re-render at 60fps.
import { useEffect, useMemo, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { DrawingElement } from "../../../types";
import { useToolRaycast } from "../interaction/useToolRaycast";
import { detectRooms } from "../geometry/roomDetector";
import { pointInRoom } from "../geometry/roomLookup";
import { worldToDrawing, type Center } from "../geometry/coordBridge";
import { AvatarMesh } from "../components/AvatarMesh";

const WALK_SPEED = 140; // scene units / s ≈ 1.4 m/s

export function AvatarWalkController({ activeTool, center, elements, onRoomChange }: {
  activeTool: string;
  center: Center;
  elements: DrawingElement[];
  onRoomChange: (roomName: string | null) => void;
}) {
  const active = activeTool === "walk-avatar";
  const { raycastGround } = useToolRaycast();
  const { gl } = useThree();
  const groupRef = useRef<THREE.Group>(null!);
  const posRef = useRef(new THREE.Vector3(0, 0, 0));
  const targetRef = useRef<THREE.Vector3 | null>(null);
  const walkingRef = useRef(false);
  const currentRoomId = useRef<string | null>(null);

  const rooms = useMemo(
    () => detectRooms(elements).map((r) => ({ id: r.id, polygon: r.polygon })),
    [elements],
  );

  useEffect(() => {
    if (!active) return;
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const p = raycastGround(e);
      if (p) targetRef.current = p.clone();
    };
    gl.domElement.addEventListener("pointerdown", onDown);
    return () => gl.domElement.removeEventListener("pointerdown", onDown);
  }, [active, raycastGround, gl]);

  useFrame((_, dt) => {
    const group = groupRef.current;
    if (!group) return;
    const target = targetRef.current;
    walkingRef.current = target != null;
    if (target) {
      const dir = target.clone().sub(posRef.current);
      const dist = dir.length();
      const step = Math.min(dist, WALK_SPEED * dt);
      if (dist > 1e-3) {
        dir.normalize();
        posRef.current.addScaledVector(dir, step);
        group.rotation.y = Math.atan2(dir.x, dir.z);
      }
      if (dist <= step + 1e-3) targetRef.current = null;
      group.position.set(posRef.current.x, 0, posRef.current.z);
    }

    const drawingPt = worldToDrawing({ x: posRef.current.x, z: posRef.current.z }, center);
    const room = pointInRoom(drawingPt, rooms);
    if ((room?.id ?? null) !== currentRoomId.current) {
      currentRoomId.current = room?.id ?? null;
      onRoomChange(room ? `Phòng ${room.id}` : null);
    }
  });

  return (
    <group ref={groupRef}>
      {/* AvatarMesh is authored at meter scale (like the reference Mannequin);
          the scene runs at 100 units = 1 m, so scale up to stand 1.7 m tall. */}
      <group scale={100}>
        <AvatarMesh walkingRef={walkingRef} />
      </group>
    </group>
  );
}
