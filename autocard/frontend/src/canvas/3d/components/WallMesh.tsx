import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { WallSegment } from "../types";

// Single wall — used for AI-generated or hand-drawn plans (small counts).
export function WallMesh({
  segment,
  color,
  wallHeight,
  activeTool,
  onElementClick,
}: {
  segment: WallSegment;
  color: string;
  wallHeight: number;
  activeTool?: string;
  onElementClick?: (id: string) => void;
}) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const [hovered, setHovered] = useState(false);

  // Event-driven color update — no useFrame polling per wall
  useEffect(() => {
    if (!matRef.current) return;
    const isEraserHover = hovered && activeTool === "eraser";
    matRef.current.color.set(isEraserHover ? "#ef4444" : color);
    matRef.current.transparent = isEraserHover;
    matRef.current.opacity = isEraserHover ? 0.9 : 1;
    matRef.current.needsUpdate = true;
  }, [hovered, activeTool, color]);

  return (
    <mesh
      position={[segment.centerX, wallHeight / 2, segment.centerZ]}
      receiveShadow
      castShadow
      onPointerOver={(e) => { if (activeTool === "eraser") { e.stopPropagation(); setHovered(true); } }}
      onPointerOut={() => setHovered(false)}
      onClick={(e) => { if (activeTool === "eraser" && segment.id) { e.stopPropagation(); onElementClick?.(segment.id); } }}
    >
      <boxGeometry args={[segment.width, wallHeight, segment.depth]} />
      <meshStandardMaterial ref={matRef} color={color} />
    </mesh>
  );
}

// Batched wall renderer — single draw call for large DXF imports (1k+ walls).
// Uses InstancedMesh with a unit box scaled per wall. No per-wall hover.
export function InstancedWallsMesh({
  segments,
  wallHeight,
  color,
}: {
  segments: WallSegment[];
  wallHeight: number;
  color: string;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh || segments.length === 0) return;
    const dummy = new THREE.Object3D();
    segments.forEach((seg, i) => {
      dummy.position.set(seg.centerX, wallHeight / 2, seg.centerZ);
      dummy.scale.set(seg.width, wallHeight, seg.depth);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [segments, wallHeight]);

  if (segments.length === 0) return null;

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, segments.length]} receiveShadow castShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={color} />
    </instancedMesh>
  );
}
