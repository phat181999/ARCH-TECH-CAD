import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Edges } from "@react-three/drei";
import * as THREE from "three";
import type { WallSegment } from "../types";

export function WallMesh({
  segment,
  color,
  wallHeight,
  activeTool,
  onElementClick
}: {
  segment: WallSegment;
  color: string;
  wallHeight: number;
  activeTool?: string;
  onElementClick?: (id: string) => void;
}) {
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const [hovered, setHovered] = useState(false);

  useFrame(({ camera }) => {
    if (!materialRef.current) return;
    // Only apply transparency for eraser hover — remove the distance fade
    // (distance fade hides walls when camera is far away, which breaks large DXF drawings)
    const isEraserHover = hovered && activeTool === "eraser";
    materialRef.current.transparent = isEraserHover;
    materialRef.current.opacity = isEraserHover ? 0.9 : 1;
    materialRef.current.needsUpdate = true;
  });

  const handlePointerOver = (e: any) => {
    if (activeTool === "eraser") {
      e.stopPropagation();
      setHovered(true);
    }
  };

  const handlePointerOut = () => {
    setHovered(false);
  };

  const handleClick = (e: any) => {
    if (activeTool === "eraser" && segment.id) {
      e.stopPropagation();
      onElementClick?.(segment.id);
    }
  };

  return (
    <mesh
      position={[segment.centerX, wallHeight / 2, segment.centerZ]}
      receiveShadow
      castShadow
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
    >
      <boxGeometry args={[segment.width, wallHeight, segment.depth]} />
      <meshStandardMaterial
        ref={materialRef}
        color={hovered && activeTool === "eraser" ? "#ef4444" : color}
      />
      <Edges color="#3a4a5a" threshold={12} />
    </mesh>
  );
}
