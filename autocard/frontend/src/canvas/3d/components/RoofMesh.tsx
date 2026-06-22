import { useMemo } from "react";
import { Edges } from "@react-three/drei";
import * as THREE from "three";
import { RoofGenerator, RoofType } from "../geometry/RoofGenerator";
import { MaterialService } from "../materials/materialService";

export function RoofMesh({
  x,
  z,
  width,
  depth,
  wallHeight,
  type = "gable",
  pitch = 30,
  materialName = "roof_tile",
}: {
  x: number;
  z: number;
  width: number;
  depth: number;
  wallHeight: number;
  type?: RoofType;
  pitch?: number;
  materialName?: string;
}) {
  const geometry = useMemo(() => {
    return RoofGenerator.generate(type, x, z, width, depth, wallHeight, pitch);
  }, [type, x, z, width, depth, wallHeight, pitch]);

  const material = useMemo(() => {
    return MaterialService.getMaterial(materialName);
  }, [materialName]);

  return (
    <mesh geometry={geometry} material={material} castShadow receiveShadow>
      <Edges color="#3a1e1a" threshold={20} />
    </mesh>
  );
}
