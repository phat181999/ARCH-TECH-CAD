import { useMemo, useState } from "react";
import { Edges } from "@react-three/drei";
import * as THREE from "three";
import { RoofGenerator, RoofType } from "../geometry/RoofGenerator";
import type { RidgeParams } from "../geometry/roofRidge";
import { MaterialService } from "../materials/materialService";
import { useDrawingStore } from "../../../stores/drawingStore";

export function RoofMesh({
  x,
  z,
  width,
  depth,
  wallHeight,
  type = "gable",
  pitch = 30,
  materialName = "roof_tile",
  ridge,
  activeTool,
  selected = false,
  onClick,
}: {
  x: number;
  z: number;
  width: number;
  depth: number;
  wallHeight: number;
  type?: RoofType;
  pitch?: number;
  materialName?: string;
  ridge?: RidgeParams;
  activeTool?: string;
  selected?: boolean;
  onClick?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const geometry = useMemo(() => {
    return RoofGenerator.generate(type, x, z, width, depth, wallHeight, pitch, ridge);
  }, [type, x, z, width, depth, wallHeight, pitch, ridge]);

  const useTextures = useDrawingStore((s) => s.useTextures);

  const material = useMemo(() => {
    return MaterialService.getMaterial(materialName);
  }, [materialName, useTextures]);

  const clickable = activeTool === "select";

  return (
    <mesh
      geometry={geometry}
      material={material}
      castShadow
      receiveShadow
      onPointerOver={(e) => { if (clickable) { e.stopPropagation(); setHovered(true); } }}
      onPointerOut={() => setHovered(false)}
      onClick={(e) => { if (clickable) { e.stopPropagation(); onClick?.(); } }}
    >
      <Edges color={selected ? "#3b82f6" : hovered ? "#60a5fa" : "#3a1e1a"} threshold={20} linewidth={selected ? 2 : 1} />
    </mesh>
  );
}
