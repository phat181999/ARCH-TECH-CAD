import { useEffect, useRef, useMemo, memo } from "react";
import * as THREE from "three";
import type { BIMResult } from "../../../api/client";
import {
  unitScaleFor, levelBaseMap, buildWallBoxes, buildColumnBoxes,
  buildSlabBoxes, buildOpeningPanels, type BoxDesc, type OpeningPanel,
} from "../geometry/bimGeometry";
import { MaterialService } from "../materials/materialService";
import { RoofMesh } from "./RoofMesh";
import type { RoofType } from "../geometry/RoofGenerator";
import { useDrawingStore } from "../../../stores/drawingStore";

// Renders a list of axis/rotated boxes as a single InstancedMesh.
function InstancedBoxes({ boxes, material, color, transparent, opacity }: {
  boxes: BoxDesc[]; material?: THREE.Material; color?: string; transparent?: boolean; opacity?: number;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh || boxes.length === 0) return;
    const dummy = new THREE.Object3D();
    boxes.forEach((b, i) => {
      dummy.position.set(b.cx, b.cy, b.cz);
      dummy.rotation.set(0, b.ry, 0);
      dummy.scale.set(b.sx, b.sy, b.sz);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [boxes]);

  if (boxes.length === 0) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, boxes.length]} material={material} castShadow receiveShadow>
      <boxGeometry args={[1, 1, 1]} />
      {!material && <meshStandardMaterial color={color} transparent={transparent} opacity={opacity ?? 1} />}
    </instancedMesh>
  );
}

function OpeningPanels({ panels }: { panels: OpeningPanel[] }) {
  if (panels.length === 0) return null;
  return (
    <>
      {panels.map((p) => (
        <mesh key={p.id} position={[p.cx, p.cy, p.cz]} rotation={[0, p.ry, 0]} castShadow>
          <boxGeometry args={[p.sx, p.sy, p.sz]} />
          <meshStandardMaterial
            color={p.type === "door" ? "#8B6350" : "#87CEEB"}
            transparent
            opacity={p.type === "window" ? 0.35 : 0.9}
          />
        </mesh>
      ))}
    </>
  );
}

function RoomFloors({ result, scale, levelBase }: {
  result: BIMResult; scale: number; levelBase: Map<string, number>;
}) {
  const meshes = useMemo(() => {
    return result.rooms
      .filter((r) => r.boundary.length >= 3)
      .map((room) => {
        const shape = new THREE.Shape(room.boundary.map((p) => new THREE.Vector2(p.x * scale, p.y * scale)));
        const geo = new THREE.ShapeGeometry(shape);
        const y = (levelBase.get(room.level_id) ?? 0) + 2;
        return { id: room.id, geo, y };
      });
  }, [result.rooms, scale, levelBase]);

  return (
    <>
      {meshes.map((m) => (
        <mesh key={m.id} geometry={m.geo} rotation={[-Math.PI / 2, 0, 0]} position={[0, m.y, 0]}>
          <meshStandardMaterial color="#f5f0e8" transparent opacity={0.45} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </>
  );
}

export const BimModelRenderer = memo(function BimModelRenderer({
  result,
  explodeOffset = 0,
  facadeMaterial = "plaster",
  roofMaterial = "roof_tile",
  roofType = "gable",
  roofPitch = 30,
  showRoof = false,
  showFloorSlab = false,
}: {
  result: BIMResult;
  explodeOffset?: number;
  facadeMaterial?: string;
  roofMaterial?: string;
  roofType?: RoofType;
  roofPitch?: number;
  /** Same auto-bundling problem as PlanModel: slabBoxes/RoomFloors here are
      synthesized from wall bounding boxes, not drawn by the user, and the
      roof used to render the instant any wall/slab box existed — opt-in. */
  showRoof?: boolean;
  showFloorSlab?: boolean;
}) {
  const scale = useMemo(() => unitScaleFor(result.units), [result.units]);
  
  // Custom level elevations with vertical explosion displacement
  const levelBase = useMemo(() => {
    const base = levelBaseMap(result.levels, scale);
    if (explodeOffset > 0 && result.levels.length > 0) {
      const sortedLevels = [...result.levels].sort((a, b) => (a.elevation || 0) - (b.elevation || 0));
      sortedLevels.forEach((level, index) => {
        const originalVal = base.get(level.id) || 0;
        base.set(level.id, originalVal + index * explodeOffset);
      });
    }
    return base;
  }, [result.levels, scale, explodeOffset]);

  const wallBoxes = useMemo(() => buildWallBoxes(result, scale, levelBase), [result, scale, levelBase]);
  const columnBoxes = useMemo(() => buildColumnBoxes(result.columns, scale, levelBase), [result.columns, scale, levelBase]);
  const slabBoxes = useMemo(() => buildSlabBoxes(result, scale, levelBase), [result, scale, levelBase]);
  const panels = useMemo(() => buildOpeningPanels(result, scale, levelBase), [result, scale, levelBase]);

  // Materials
  const useTextures = useDrawingStore((s) => s.useTextures);
  const wallMat = useMemo(() => MaterialService.getMaterial(facadeMaterial), [facadeMaterial, useTextures]);
  const slabMat = useMemo(() => MaterialService.getMaterial("concrete"), [useTextures]);
  const colMat = useMemo(() => MaterialService.getMaterial("concrete"), [useTextures]);

  // Compute the roof boundary and coordinates at the highest point of the model
  const roofFootprint = useMemo(() => {
    if (slabBoxes.length === 0 && wallBoxes.length === 0) return null;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, maxY = 0;
    
    slabBoxes.forEach(b => {
      minX = Math.min(minX, b.cx - b.sx/2);
      maxX = Math.max(maxX, b.cx + b.sx/2);
      minZ = Math.min(minZ, b.cz - b.sz/2);
      maxZ = Math.max(maxZ, b.cz + b.sz/2);
      maxY = Math.max(maxY, b.cy + b.sy/2);
    });

    wallBoxes.forEach(b => {
      minX = Math.min(minX, b.cx - b.sx/2);
      maxX = Math.max(maxX, b.cx + b.sx/2);
      minZ = Math.min(minZ, b.cz - b.sz/2);
      maxZ = Math.max(maxZ, b.cz + b.sz/2);
      maxY = Math.max(maxY, b.cy + b.sy/2);
    });

    if (minX === Infinity) return null;

    return {
      x: minX,
      z: minZ,
      width: maxX - minX,
      depth: maxZ - minZ,
      wallHeight: maxY
    };
  }, [slabBoxes, wallBoxes]);

  return (
    <group name="bim-model">
      {showFloorSlab && <InstancedBoxes boxes={slabBoxes} material={slabMat} />}
      <InstancedBoxes boxes={wallBoxes} material={wallMat} />
      <InstancedBoxes boxes={columnBoxes} material={colMat} />
      <OpeningPanels panels={panels} />
      {showFloorSlab && <RoomFloors result={result} scale={scale} levelBase={levelBase} />}
      {showRoof && roofFootprint && roofType && (
        <RoofMesh
          x={roofFootprint.x}
          z={roofFootprint.z}
          width={roofFootprint.width}
          depth={roofFootprint.depth}
          wallHeight={roofFootprint.wallHeight}
          type={roofType}
          pitch={roofPitch}
          materialName={roofMaterial}
        />
      )}
    </group>
  );
});
