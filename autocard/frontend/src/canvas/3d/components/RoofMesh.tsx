import { useMemo } from "react";
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
}) {
  const geometry = useMemo(() => {
    return RoofGenerator.generate(type, x, z, width, depth, wallHeight, pitch, ridge);
  }, [type, x, z, width, depth, wallHeight, pitch, ridge]);

  const useTextures = useDrawingStore((s) => s.useTextures);

  const material = useMemo(() => {
    return MaterialService.getMaterial(materialName);
  }, [materialName, useTextures]);

  return (
    <mesh geometry={geometry} material={material} castShadow receiveShadow>
      <Edges color="#3a1e1a" threshold={20} />
    </mesh>
  );
}
