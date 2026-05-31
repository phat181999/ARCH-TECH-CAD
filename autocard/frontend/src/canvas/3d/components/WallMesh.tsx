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
    const dist = camera.position.distanceTo(new THREE.Vector3(segment.centerX, wallHeight / 2, segment.centerZ));

    let opacity = 1;
    if (dist < 800) {
       if (dist < 300) {
         opacity = 0.15;
       } else {
         opacity = 0.15 + 0.85 * ((dist - 300) / 500);
       }
    }

    materialRef.current.transparent = opacity < 1 || (hovered && activeTool === "eraser");
    materialRef.current.opacity = hovered && activeTool === "eraser" ? 0.9 : opacity;
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
