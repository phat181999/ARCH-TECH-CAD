import { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Bounds, ViewAngle } from "../types";

export function AutoFrame({ bounds, revisionKey }: { bounds: Bounds | null; revisionKey?: string }) {
  const { camera } = useThree();
  const lastRevision = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!bounds) return;
    if (revisionKey !== undefined && revisionKey === lastRevision.current) return;
    lastRevision.current = revisionKey;

    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerZ = (bounds.minZ + bounds.maxZ) / 2;
    const width = bounds.maxX - bounds.minX;
    const depth = bounds.maxZ - bounds.minZ;
    const span = Math.max(width, depth, 200);

    camera.position.set(centerX + span * 0.9, span * 0.6, centerZ + span * 0.9);
    camera.lookAt(centerX, 10, centerZ);
    camera.updateProjectionMatrix();
  }, [bounds, revisionKey, camera]);

  return null;
}

interface CameraControllerProps {
  bounds: Bounds | null;
  viewAngle: ViewAngle;
  onViewConsumed: () => void;
  controlsRef: React.RefObject<any>;
}

export function CameraController({ bounds, viewAngle, onViewConsumed, controlsRef }: CameraControllerProps) {
  const { camera } = useThree();
  const targetPos = useRef<THREE.Vector3 | null>(null);
  const targetLook = useRef<THREE.Vector3>(new THREE.Vector3(500, 10, 350));
  const consumed = useRef(false);

  useEffect(() => {
    if (!viewAngle) return;
    consumed.current = false;

    const cx = bounds ? (bounds.minX + bounds.maxX) / 2 : 500;
    const cz = bounds ? (bounds.minZ + bounds.maxZ) / 2 : 350;
    const span = bounds ? Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ, 200) : 800;

    targetLook.current.set(cx, 10, cz);
    const D = span * 1.3;

    if (viewAngle === "top") {
      targetPos.current = new THREE.Vector3(cx, D, cz + 0.1);
    } else if (viewAngle === "front") {
      targetPos.current = new THREE.Vector3(cx, 10, cz + D);
    } else if (viewAngle === "back") {
      targetPos.current = new THREE.Vector3(cx, 10, cz - D);
    } else if (viewAngle === "left") {
      targetPos.current = new THREE.Vector3(cx - D, 10, cz);
    } else if (viewAngle === "right") {
      targetPos.current = new THREE.Vector3(cx + D, 10, cz);
    } else {
      targetPos.current = new THREE.Vector3(cx + span * 0.9, span * 0.6, cz + span * 0.9);
    }
  }, [viewAngle, bounds]);

  useFrame(() => {
    if (!targetPos.current || consumed.current) return;
    const pos = camera.position;
    pos.lerp(targetPos.current, 0.1);

    if (controlsRef.current) {
      controlsRef.current.target.lerp(targetLook.current, 0.1);
      controlsRef.current.update();
    }

    if (pos.distanceTo(targetPos.current) < 2) {
      pos.copy(targetPos.current);
      if (controlsRef.current) {
        controlsRef.current.target.copy(targetLook.current);
        controlsRef.current.update();
      }
      consumed.current = true;
      onViewConsumed();
    }
    camera.lookAt(targetLook.current);
    camera.updateProjectionMatrix();
  });

  useEffect(() => {
    const handleInteraction = () => {
      if (!consumed.current) {
        consumed.current = true;
        onViewConsumed();
      }
    };
    window.addEventListener("pointerdown", handleInteraction);
    window.addEventListener("wheel", handleInteraction, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", handleInteraction);
      window.removeEventListener("wheel", handleInteraction);
    };
  }, [onViewConsumed]);

  return null;
}
