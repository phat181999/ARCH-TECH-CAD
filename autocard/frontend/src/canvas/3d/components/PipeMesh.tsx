import { useMemo } from "react";
import * as THREE from "three";
import type { DrawingElement } from "../../../types";

const SYSTEM_COLORS: Record<string, string> = {
  water:    "#0284c7",
  hvac:     "#06b6d4",
  drain:    "#ea580c",
  electric: "#ca8a04",
  gas:      "#dc2626",
};

// 1 mm = 0.1 drawing units (100 units = 1 m = 1000 mm)
const UNITS_PER_MM = 0.1;
// Default pipe diameter in mm
const DEFAULT_PIPE_DIAMETER_MM = 50;
// Default pipe elevation in cm above floor
const DEFAULT_PIPE_ELEVATION_CM = 250;
// Minimum pipe length to bother rendering
const MIN_PIPE_LENGTH = 1;
// Cylinder radial segments — low poly for MEP pipes
const PIPE_RADIAL_SEGMENTS = 10;

interface PipeMeshProps {
  el: DrawingElement;
  cx: number;
  cz: number;
}

export function PipeMesh({ el, cx, cz }: PipeMeshProps) {
  const pipeSystem  = (el.pipeSystem  as string | undefined) ?? "water";
  const pipeDiam    = (el.pipeDiameter as number | undefined) ?? DEFAULT_PIPE_DIAMETER_MM;
  const elevation   = (el.elevation   as number | undefined) ?? DEFAULT_PIPE_ELEVATION_CM;

  const radius = (pipeDiam / 2) * UNITS_PER_MM;

  const { position, rotation, length } = useMemo(() => {
    const x1 = (el.x1 ?? 0) - cx;
    const z1 = (el.y1 ?? 0) - cz;
    const x2 = (el.x2 ?? 0) - cx;
    const z2 = (el.y2 ?? 0) - cz;
    const len = Math.sqrt((x2 - x1) ** 2 + (z2 - z1) ** 2);
    const mx  = (x1 + x2) / 2;
    const mz  = (z1 + z2) / 2;
    const angle = Math.atan2(z2 - z1, x2 - x1);
    return { position: new THREE.Vector3(mx, elevation, mz), rotation: angle, length: len };
  }, [el, cx, cz, elevation]);

  // An explicit strokeColor (set via the Pipe tool's color picker) overrides
  // the system default so per-run color customization matches the 2D overlay.
  const color = (el.strokeColor as string | undefined) || SYSTEM_COLORS[pipeSystem] || SYSTEM_COLORS.water;
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.4,
        metalness: 0.6,
      }),
    [color],
  );

  if (length < MIN_PIPE_LENGTH) return null;

  return (
    <mesh
      position={position}
      rotation={[0, -rotation, Math.PI / 2]}
      material={material}
      castShadow
    >
      <cylinderGeometry args={[radius, radius, length, PIPE_RADIAL_SEGMENTS, 1]} />
    </mesh>
  );
}
