import { useEffect, useRef, useState, useMemo } from "react";
import * as THREE from "three";
import type { WallSegment } from "../types";
import { MaterialService } from "../materials/materialService";
import { usePBRWallMaterial } from "../hooks/usePBRWallMaterial";
import { useDrawingStore } from "../../../stores/drawingStore";

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

  const useTextures = useDrawingStore((s) => s.useTextures);

  const baseMaterial = useMemo(() => {
    return MaterialService.getMaterial(materialName);
  }, [materialName, useTextures]);

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

  // Multi-layer assembly: stack one slab per layer along the thickness axis.
  if (segment.layers && segment.layers.length > 1) {
    const thicknessAxisIsZ = segment.width >= segment.depth; // long along X → thin along Z
    const total = segment.layers.reduce((s, l) => s + l.thicknessUnits, 0);
    let offset = -total / 2;
    return (
      <group>
        {segment.layers.map((layer, i) => {
          const center = offset + layer.thicknessUnits / 2;
          offset += layer.thicknessUnits;
          const pos: [number, number, number] = thicknessAxisIsZ
            ? [segment.centerX, effectiveHeight / 2, segment.centerZ + center]
            : [segment.centerX + center, effectiveHeight / 2, segment.centerZ];
          const size: [number, number, number] = thicknessAxisIsZ
            ? [segment.width, effectiveHeight, layer.thicknessUnits]
            : [layer.thicknessUnits, effectiveHeight, segment.depth];
          return (
            <mesh
              key={i}
              position={pos}
              receiveShadow castShadow
              onPointerOver={(e) => { if (activeTool === "eraser" || activeTool === "wall-height") { e.stopPropagation(); setHovered(true); } }}
              onPointerOut={() => setHovered(false)}
              onClick={(e) => {
                if ((activeTool === "eraser" || activeTool === "wall-height") && segment.id) { e.stopPropagation(); onElementClick?.(segment.id); }
              }}
            >
              <boxGeometry args={size} />
              <meshStandardMaterial color={`#${MaterialService.getMaterial(layer.materialName).color.getHexString()}`} />
            </mesh>
          );
        })}
      </group>
    );
  }

  return (
    <mesh
      position={[segment.centerX, effectiveHeight / 2, segment.centerZ]}
      receiveShadow
      castShadow
      material={pbrMaterial ?? undefined}
      onPointerOver={(e) => { if (activeTool === "eraser" || activeTool === "wall-height" || activeTool === "select" || activeTool === "paint3d") { e.stopPropagation(); setHovered(true); } }}
      onPointerOut={() => setHovered(false)}
      onClick={(e) => {
        if (activeTool === "eraser" && segment.id) { e.stopPropagation(); onElementClick?.(segment.id); }
        if (activeTool === "wall-height" && segment.id) { e.stopPropagation(); onElementClick?.(segment.id); }
        if ((activeTool === "select" || activeTool === "paint3d") && segment.id) { e.stopPropagation(); onElementClick?.(segment.id); }
      }}
    >
      <boxGeometry args={[segment.width, effectiveHeight, segment.depth]} />
      {!pbrMaterial && <meshStandardMaterial ref={matRef} />}
    </mesh>
  );
}

// Batched wall renderer — single draw call for large DXF imports (1k+ walls).
// Uses InstancedMesh with a unit box scaled per wall.
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
  activeTool,
  onElementClick,
}: {
  segments: WallSegment[];
  wallHeight: number;
  color: string;
  materialName?: string;
  activeTool?: string;
  onElementClick?: (id: string) => void;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const [hovered, setHovered] = useState<number | null>(null);

  const useTextures = useDrawingStore((s) => s.useTextures);

  const material = useMemo(() => {
    return MaterialService.getMaterial(materialName);
  }, [materialName, useTextures]);

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

  // Instance-aware interaction for eraser/wall-height. Handlers are only
  // attached while one of those tools is active, so orbit/pan never pays the
  // per-instance raycast. Within a single InstancedMesh, pointerover/out don't
  // fire between instances — pointermove + e.instanceId is the reliable signal.
  const interactive = ["eraser", "wall-height", "select", "paint3d"].includes(activeTool ?? "");
  useEffect(() => {
    if (!interactive) setHovered(null);
  }, [interactive]);
  useEffect(() => {
    setHovered(null);
  }, [segments]);

  if (segments.length === 0) return null;

  const hoveredSeg = hovered !== null ? segments[hovered] : null;

  return (
    <>
      <instancedMesh
        ref={ref}
        args={[undefined, undefined, segments.length]}
        material={material}
        receiveShadow
        castShadow
        {...(interactive
          ? {
              onPointerMove: (e: any) => {
                e.stopPropagation();
                if (e.instanceId !== undefined && e.instanceId !== hovered) setHovered(e.instanceId);
              },
              onPointerOut: () => setHovered(null),
              onClick: (e: any) => {
                e.stopPropagation();
                const seg = e.instanceId !== undefined ? segments[e.instanceId] : undefined;
                if (seg?.id) onElementClick?.(seg.id);
              },
            }
          : {})}
      >
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
      {/* Hover highlight — a slightly inflated overlay box on the hovered
          instance. Cheaper and safer than per-instance colors: the material is
          shared via MaterialService, and lazily creating an instanceColor
          buffer would zero-fill (blacken) every other instance. */}
      {hoveredSeg && (
        <mesh position={[hoveredSeg.centerX, wallHeight / 2, hoveredSeg.centerZ]}>
          <boxGeometry args={[hoveredSeg.width * 1.02, wallHeight * 1.02, hoveredSeg.depth * 1.02]} />
          <meshStandardMaterial
            color={activeTool === "eraser" ? "#ef4444" : "#2563eb"}
            transparent
            opacity={activeTool === "eraser" ? 0.9 : 0.85}
          />
        </mesh>
      )}
    </>
  );
}
