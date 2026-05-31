import { useMemo } from "react";
import { Edges } from "@react-three/drei";
import * as THREE from "three";

export function RoofMesh({ x, z, width, depth, wallHeight }: {
  x: number; z: number; width: number; depth: number; wallHeight: number;
}) {
  const ridgeH = Math.max(wallHeight * 0.55, 20);
  const isWide = width >= depth;

  const geometry = useMemo(() => {
    const wh = wallHeight;
    const rh = ridgeH;
    const A = [x,         wh, z];
    const B = [x + width, wh, z];
    const C = [x + width, wh, z + depth];
    const D = [x,         wh, z + depth];
    let E: number[], F: number[], verts: number[];

    if (isWide) {
      // Ridge runs along X; gables on left/right ends
      E = [x,         wh + rh, z + depth / 2];
      F = [x + width, wh + rh, z + depth / 2];
      verts = [
        ...A, ...B, ...F,   ...A, ...F, ...E,   // front slope
        ...D, ...E, ...F,   ...D, ...F, ...C,   // back slope
        ...A, ...E, ...D,                        // left gable
        ...B, ...C, ...F,                        // right gable
      ];
    } else {
      // Ridge runs along Z; gables on front/back ends
      E = [x + width / 2, wh + rh, z];
      F = [x + width / 2, wh + rh, z + depth];
      verts = [
        ...A, ...D, ...F,   ...A, ...F, ...E,   // left slope
        ...B, ...F, ...C,   ...B, ...E, ...F,   // right slope
        ...A, ...B, ...E,                        // front gable
        ...D, ...F, ...C,                        // back gable
      ];
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(verts), 3));
    geo.computeVertexNormals();
    return geo;
  }, [x, z, width, depth, wallHeight, ridgeH, isWide]);

  return (
    <mesh geometry={geometry} castShadow>
      <meshStandardMaterial color="#7a98b0" side={THREE.DoubleSide} />
      <Edges color="#3a4a5a" threshold={10} />
    </mesh>
  );
}
