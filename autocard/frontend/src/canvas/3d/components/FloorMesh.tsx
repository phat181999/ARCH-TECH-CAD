import { useMemo } from "react";
import * as THREE from "three";
import type { DrawingElement } from "../../../types";

// Floor finish → material color map
const FINISH_COLORS: Record<string, string> = {
  concrete: "#c4b9a8",
  tile:     "#e8e0d0",
  wood:     "#b5874d",
  screed:   "#d4c8b4",
};

const DEFAULT_FINISH = "concrete";

// Small Y offset to prevent z-fighting with the ground plane
const FLOOR_Y_OFFSET = 0.5;
// Scale factor: 1 cm elevation → 0.01 Three.js units
const ELEVATION_SCALE = 0.01;

interface FloorMeshProps {
  el: DrawingElement;
  cx: number;
  cz: number;
}

export function FloorMesh({ el, cx, cz }: FloorMeshProps) {
  const pts = el.points;
  const elevation = (el.elevation as number | undefined) ?? 0;
  const finish    = (el.floorFinish as string | undefined) ?? DEFAULT_FINISH;

  const geometry = useMemo(() => {
    if (!pts || pts.length < 3) return null;
    // Convert 2D polygon (drawing coords) to 3D shape (scene coords)
    const shape = new THREE.Shape(
      pts.map((p) => new THREE.Vector2(p.x - cx, p.y - cz)),
    );
    return new THREE.ShapeGeometry(shape);
  }, [pts, cx, cz]);

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: FINISH_COLORS[finish] ?? FINISH_COLORS[DEFAULT_FINISH],
        roughness: 0.9,
        metalness: 0,
        side: THREE.DoubleSide,
      }),
    [finish],
  );

  if (!geometry) return null;

  return (
    <mesh
      geometry={geometry}
      material={material}
      // ShapeGeometry is in XY plane; rotate to lie flat on XZ ground plane
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, elevation * ELEVATION_SCALE + FLOOR_Y_OFFSET, 0]}
      receiveShadow
    />
  );
}
