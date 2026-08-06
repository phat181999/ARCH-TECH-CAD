import { useMemo } from "react";
import { Edges } from "@react-three/drei";
import * as THREE from "three";
import type { DrawingElement } from "../../../types";
import { MaterialService } from "../materials/materialService";
import { MaterialRegistry } from "../materials/materialRegistry";

const DEFAULT_FINISH = "concrete";
const SELECTION_COLOR = "#3b82f6";

// Small Y offset to prevent z-fighting with the ground plane
export const FLOOR_Y_OFFSET = 0.5;
// Scale factor: 1 cm elevation → 0.01 Three.js units
export const ELEVATION_SCALE = 0.01;

interface FloorMeshProps {
  el: DrawingElement;
  cx: number;
  cz: number;
  activeTool?: string;
  onElementClick?: (id: string) => void;
  selected?: boolean;
}

export function FloorMesh({ el, cx, cz, activeTool, onElementClick, selected = false }: FloorMeshProps) {
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

  const material = useMemo(() => {
    if (typeof el.material === "string") {
      const m = MaterialService.getMaterial(el.material).clone();
      m.side = THREE.DoubleSide;
      if (selected) m.color.lerp(new THREE.Color(SELECTION_COLOR), 0.35);
      return m;
    }
    const entry = MaterialRegistry.get(`floor_${finish}`) ?? MaterialRegistry.get(`floor_${DEFAULT_FINISH}`);
    const base = new THREE.Color(entry?.color ?? "#c4b9a8");
    return new THREE.MeshStandardMaterial({
      color: selected ? base.lerp(new THREE.Color(SELECTION_COLOR), 0.35) : base,
      roughness: 0.9,
      metalness: 0,
      side: THREE.DoubleSide,
    });
  }, [finish, el.material, selected]);

  if (!geometry) return null;

  return (
    <mesh
      geometry={geometry}
      material={material}
      // ShapeGeometry is in XY plane; rotate to lie flat on XZ ground plane
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, elevation * ELEVATION_SCALE + FLOOR_Y_OFFSET, 0]}
      receiveShadow
      onClick={(e) => {
        if (activeTool === "paint3d" || activeTool === "select" || activeTool === "eraser") {
          e.stopPropagation();
          onElementClick?.(el.id);
        }
      }}
    >
      {selected && <Edges color={SELECTION_COLOR} threshold={20} linewidth={2} />}
    </mesh>
  );
}
