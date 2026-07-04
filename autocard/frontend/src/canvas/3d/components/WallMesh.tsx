import { useEffect, useRef, useState, useMemo } from "react";
import * as THREE from "three";
import type { WallSegment } from "../types";
import { MaterialService } from "../materials/materialService";
import { usePBRWallMaterial } from "../hooks/usePBRWallMaterial";

// Single wall — used for AI-generated or hand-drawn plans (small counts).
export function WallMesh({
  segment,
  color,
  wallHeight,
  activeTool,
  onElementClick,
  materialName = "plaster",
  enablePBRShaders = false,
}: {
  segment: WallSegment;
  color: string;
  wallHeight: number;
  activeTool?: string;
  onElementClick?: (id: string) => void;
  materialName?: string;
  enablePBRShaders?: boolean;
}) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const [hovered, setHovered] = useState(false);

  const baseMaterial = useMemo(() => {
    return MaterialService.getMaterial(materialName);
  }, [materialName]);

  const pbrMaterial = usePBRWallMaterial({
    color: `#${baseMaterial.color.getHexString()}`,
    roughness: baseMaterial.roughness,
    enabled: enablePBRShaders,
  });

  const effectiveHeight = segment.heightOverride ?? wallHeight;

  // Event-driven color update — no useFrame polling per wall.
  // Only applies to the standard material path: the triplanar shader has no
  // per-instance color uniform for eraser/height-tool hover highlighting.
  useEffect(() => {
    if (!matRef.current || pbrMaterial) return;
    const isEraserHover = hovered && activeTool === "eraser";
    const isHeightHover = hovered && activeTool === "wall-height";
    if (isEraserHover) {
      matRef.current.color.set("#ef4444");
      matRef.current.transparent = true;
      matRef.current.opacity = 0.9;
    } else if (isHeightHover) {
      matRef.current.color.set("#2563eb");
      matRef.current.transparent = true;
      matRef.current.opacity = 0.85;
    } else {
      matRef.current.color.copy(baseMaterial.color);
      matRef.current.transparent = baseMaterial.transparent;
      matRef.current.opacity = baseMaterial.opacity;
      matRef.current.roughness = baseMaterial.roughness;
      matRef.current.metalness = baseMaterial.metalness;
    }
    matRef.current.needsUpdate = true;
  }, [hovered, activeTool, baseMaterial, pbrMaterial]);

  return (
    <mesh
      position={[segment.centerX, effectiveHeight / 2, segment.centerZ]}
      receiveShadow
      castShadow
      material={pbrMaterial ?? undefined}
      onPointerOver={(e) => { if (activeTool === "eraser" || activeTool === "wall-height") { e.stopPropagation(); setHovered(true); } }}
      onPointerOut={() => setHovered(false)}
      onClick={(e) => {
        if (activeTool === "eraser" && segment.id) { e.stopPropagation(); onElementClick?.(segment.id); }
        if (activeTool === "wall-height" && segment.id) { e.stopPropagation(); onElementClick?.(segment.id); }
      }}
    >
      <boxGeometry args={[segment.width, effectiveHeight, segment.depth]} />
      {!pbrMaterial && <meshStandardMaterial ref={matRef} />}
    </mesh>
  );
}

// Batched wall renderer — single draw call for large DXF imports (1k+ walls).
// Uses InstancedMesh with a unit box scaled per wall. No per-wall hover.
// Does not support enablePBRShaders: TriplanarWallMaterial's vertex shader is
// hand-written GLSL that reads `position`/`normal` directly and never applies
// `instanceMatrix`, unlike Three's built-in materials (which multiply it in via
// the shared project_vertex/worldpos_vertex chunks). On an InstancedMesh every
// instance would collapse to the same untransformed unit cube. Fixing this
// would mean patching the shader itself, out of scope for this wiring task.
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
