import { useRef, useEffect, useMemo } from "react";
import * as THREE from "three";
import type { DrawingElement } from "../../../types";

// Visual constants — named so magic numbers are self-documenting
const COLUMN_COLOR         = "#b0a898";
const DEFAULT_COLUMN_SIZE  = 25;  // cm — column cross-section side length

interface InstancedColumnsMeshProps {
  elements:   DrawingElement[];
  cx:         number;
  cz:         number;
  wallHeight: number;
}

/**
 * InstancedColumnsMesh — renders all column elements in a single draw call.
 * Uses THREE.InstancedMesh with a unit box scaled per column.
 * Columns are identified by archType:"column" or ifcType:"IfcColumn".
 */
export function InstancedColumnsMesh({
  elements,
  cx,
  cz,
  wallHeight,
}: InstancedColumnsMeshProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const columns = useMemo(
    () =>
      elements.filter(
        (el) =>
          (el.archType === "column" || el.ifcType === "IfcColumn") &&
          el.x !== undefined,
      ),
    [elements],
  );

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color:     COLUMN_COLOR,
        roughness: 0.8,
        metalness: 0,
      }),
    [],
  );

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || columns.length === 0) return;

    const dummy = new THREE.Object3D();
    columns.forEach((col, i) => {
      const w      = col.width  ?? DEFAULT_COLUMN_SIZE;
      const d      = col.height ?? col.width ?? DEFAULT_COLUMN_SIZE;
      const worldX = (col.x ?? 0) - cx + w / 2;
      const worldZ = ((col.y as number | undefined) ?? 0) - cz + d / 2;

      dummy.position.set(worldX, wallHeight / 2, worldZ);
      dummy.scale.set(w, wallHeight, d);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [columns, cx, cz, wallHeight]);

  if (columns.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, columns.length]}
      material={material}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[1, 1, 1]} />
    </instancedMesh>
  );
}
