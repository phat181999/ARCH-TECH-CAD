import { useEffect, useRef, useState, useMemo } from "react";
import * as THREE from "three";
import type { WallSegment } from "../types";
import { MaterialService } from "../materials/materialService";

// Single wall — used for AI-generated or hand-drawn plans (small counts).
export function WallMesh({
  segment,
  color,
  wallHeight,
  activeTool,
  onElementClick,
  materialName = "plaster",
}: {
  segment: WallSegment;
  color: string;
  wallHeight: number;
  activeTool?: string;
  onElementClick?: (id: string) => void;
  materialName?: string;
}) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const [hovered, setHovered] = useState(false);

  const baseMaterial = useMemo(() => {
    return MaterialService.getMaterial(materialName);
  }, [materialName]);

  // Event-driven color update — no useFrame polling per wall
  useEffect(() => {
    if (!matRef.current) return;
    const isEraserHover = hovered && activeTool === "eraser";
    if (isEraserHover) {
      matRef.current.color.set("#ef4444");
      matRef.current.transparent = true;
      matRef.current.opacity = 0.9;
    } else {
      matRef.current.color.copy(baseMaterial.color);
      matRef.current.transparent = baseMaterial.transparent;
      matRef.current.opacity = baseMaterial.opacity;
      matRef.current.roughness = baseMaterial.roughness;
      matRef.current.metalness = baseMaterial.metalness;
    }
    matRef.current.needsUpdate = true;
  }, [hovered, activeTool, baseMaterial]);

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
      <meshStandardMaterial ref={matRef} />
    </mesh>
  );
}

// Batched wall renderer — single draw call for large DXF imports (1k+ walls).
// Uses InstancedMesh with a unit box scaled per wall. No per-wall hover.
export function InstancedWallsMesh({
  segments,
  wallHeight,
  color,
  materialName = "plaster",
}: {
  segments: WallSegment[];
  wallHeight: number;
  color: string;
  materialName?: string;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);

  const material = useMemo(() => {
    return MaterialService.getMaterial(materialName);
  }, [materialName]);

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
    <instancedMesh ref={ref} args={[undefined, undefined, segments.length]} material={material} receiveShadow castShadow>
      <boxGeometry args={[1, 1, 1]} />
    </instancedMesh>
  );
}
