import { useMemo } from "react";
import * as THREE from "three";
import type { DrawingElement } from "../../../types";

// Scale: 1 drawing unit = 1 Three.js unit; 100 units = 1 m
const SCALE = 1;

// Concrete material — shared across all foundation instances
const concreteMaterial = new THREE.MeshStandardMaterial({
  color: "#b0a898",
  roughness: 0.95,
  metalness: 0,
});

// Semi-transparent concrete for underground / below-grade portions
const undergroundMaterial = new THREE.MeshStandardMaterial({
  color: "#8a7f72",
  roughness: 0.95,
  metalness: 0,
  transparent: true,
  opacity: 0.55,
  side: THREE.DoubleSide,
});

// Rebar/pile material
const pileMaterial = new THREE.MeshStandardMaterial({
  color: "#78716c",
  roughness: 0.8,
  metalness: 0.2,
  transparent: true,
  opacity: 0.6,
});

interface FoundationMeshProps {
  elements: DrawingElement[];
  cx: number;
  cz: number;
  undergroundSectionDepth: number; // cm; 0 = show all underground
}

/** Strip footing along a wall line */
function StripFootingMesh({ el, cx, cz }: { el: DrawingElement; cx: number; cz: number }) {
  const footingWidth = (el.footingWidth as number | undefined) ?? 60;
  const footingDepth = (el.footingDepth as number | undefined) ?? 100;
  const footingThickness = (el.footingThickness as number | undefined) ?? 30;

  const geometry = useMemo(() => {
    const x1 = (el.x1 ?? 0) - cx;
    const z1 = (el.y1 ?? 0) - cz;
    const x2 = (el.x2 ?? 0) - cx;
    const z2 = (el.y2 ?? 0) - cz;

    const length = Math.sqrt((x2 - x1) ** 2 + (z2 - z1) ** 2);
    const angle = Math.atan2(z2 - z1, x2 - x1);
    const cx2d = (x1 + x2) / 2;
    const cz2d = (z1 + z2) / 2;

    return { length, angle, cx2d, cz2d };
  }, [el, cx, cz]);

  if (geometry.length < 1) return null;

  const yTop = -(footingDepth * SCALE);
  const yCenter = yTop - (footingThickness * SCALE) / 2;

  return (
    <mesh
      position={[geometry.cx2d, yCenter, geometry.cz2d]}
      rotation={[0, -geometry.angle, 0]}
      material={undergroundMaterial}
      receiveShadow
    >
      <boxGeometry args={[geometry.length, footingThickness * SCALE, footingWidth * SCALE]} />
    </mesh>
  );
}

/** Isolated spread footing + column above ground */
function SpreadFootingMesh({ el, cx, cz }: { el: DrawingElement; cx: number; cz: number }) {
  const footingW   = (el.footingWidth     as number | undefined) ?? (el.width  ?? 80);
  const footingH   = (el.footingHeight    as number | undefined) ?? (el.height ?? 80);
  const footingDep = (el.footingDepth     as number | undefined) ?? 100;
  const footingThk = (el.footingThickness as number | undefined) ?? 30;
  const colW       = (el.columnWidth      as number | undefined) ?? 25;
  const colHeight  = (el.columnHeight     as number | undefined) ?? 270;

  const x = (el.x ?? 0) + footingW / 2 - cx;
  const z = (el.y ?? 0) + footingH / 2 - cz;
  const yFootingCenter = -(footingDep + footingThk / 2);
  const yColCenter = colHeight / 2;

  return (
    <group position={[x, 0, z]}>
      {/* footing pad */}
      <mesh position={[0, yFootingCenter, 0]} material={undergroundMaterial} receiveShadow>
        <boxGeometry args={[footingW, footingThk, footingH]} />
      </mesh>
      {/* column above grade */}
      <mesh position={[0, yColCenter, 0]} material={concreteMaterial} castShadow receiveShadow>
        <boxGeometry args={[colW, colHeight, colW]} />
      </mesh>
    </group>
  );
}

/** Raft slab from polygon points */
function RaftSlabMesh({ el, cx, cz }: { el: DrawingElement; cx: number; cz: number }) {
  const raftDepth = (el.raftDepth     as number | undefined) ?? 80;
  const raftThk   = (el.raftThickness as number | undefined) ?? 25;
  const points    = el.points ?? [];

  const geometry = useMemo(() => {
    if (points.length < 3) return null;
    const shape = new THREE.Shape(points.map((p) => new THREE.Vector2(p.x - cx, p.y - cz)));
    return new THREE.ExtrudeGeometry(shape, {
      depth: raftThk,
      bevelEnabled: false,
    });
  }, [points, cx, cz, raftThk]);

  if (!geometry) return null;

  return (
    <mesh
      geometry={geometry}
      material={undergroundMaterial}
      position={[0, -(raftDepth + raftThk), 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
    />
  );
}

/** Bored/driven pile with cap */
function PileMesh({ el, cx, cz }: { el: DrawingElement; cx: number; cz: number }) {
  const radius     = (el.radius      as number | undefined) ?? 25;
  const pileLen    = (el.pileLength  as number | undefined) ?? 600;
  const capW       = (el.capWidth    as number | undefined) ?? (radius * 3);
  const capThk     = (el.capThickness as number | undefined) ?? 30;

  const x = (el.x ?? el.cx ?? 0) - cx;
  const z = (el.y ?? el.cy ?? 0) - cz;

  return (
    <group position={[x, 0, z]}>
      {/* pile shaft — extends downward */}
      <mesh position={[0, -(pileLen / 2), 0]} material={pileMaterial} castShadow>
        <cylinderGeometry args={[radius, radius * 0.85, pileLen, 12]} />
      </mesh>
      {/* pile cap at grade */}
      <mesh position={[0, -capThk / 2, 0]} material={undergroundMaterial} receiveShadow>
        <boxGeometry args={[capW, capThk, capW]} />
      </mesh>
    </group>
  );
}

/** Grade beam connecting two points */
function GradeBeamMesh({ el, cx, cz }: { el: DrawingElement; cx: number; cz: number }) {
  const beamWidth = (el.beamWidth  as number | undefined) ?? 30;
  const beamDepth = (el.beamDepth  as number | undefined) ?? 50;
  const elevation = (el.elevation  as number | undefined) ?? -50; // cm, negative = below grade

  const x1 = (el.x1 ?? 0) - cx;
  const z1 = (el.y1 ?? 0) - cz;
  const x2 = (el.x2 ?? 0) - cx;
  const z2 = (el.y2 ?? 0) - cz;
  const length = Math.sqrt((x2 - x1) ** 2 + (z2 - z1) ** 2);
  const angle  = Math.atan2(z2 - z1, x2 - x1);
  const mx     = (x1 + x2) / 2;
  const mz     = (z1 + z2) / 2;

  if (length < 1) return null;

  return (
    <mesh
      position={[mx, elevation - beamDepth / 2, mz]}
      rotation={[0, -angle, 0]}
      material={undergroundMaterial}
      receiveShadow
    >
      <boxGeometry args={[length, beamDepth, beamWidth]} />
    </mesh>
  );
}

/** Root component — renders all foundation elements in the scene */
export function FoundationMesh({ elements, cx, cz, undergroundSectionDepth }: FoundationMeshProps) {
  const foundations = useMemo(
    () => elements.filter((el) =>
      el.archType === "foundation-strip" ||
      el.archType === "foundation-spread" ||
      el.archType === "foundation-raft" ||
      el.archType === "foundation-pile" ||
      el.archType === "column" ||
      el.archType === "grade-beam"
    ),
    [elements]
  );

  if (foundations.length === 0) return null;

  // undergroundSectionDepth is available for future clipping plane use
  void undergroundSectionDepth;

  return (
    <group>
      {foundations.map((el) => {
        switch (el.archType) {
          case "foundation-strip":
            return <StripFootingMesh key={el.id} el={el} cx={cx} cz={cz} />;
          case "foundation-spread":
            return <SpreadFootingMesh key={el.id} el={el} cx={cx} cz={cz} />;
          case "foundation-raft":
            return <RaftSlabMesh key={el.id} el={el} cx={cx} cz={cz} />;
          case "foundation-pile":
            return <PileMesh key={el.id} el={el} cx={cx} cz={cz} />;
          case "grade-beam":
            return <GradeBeamMesh key={el.id} el={el} cx={cx} cz={cz} />;
          default:
            return null;
        }
      })}
    </group>
  );
}
