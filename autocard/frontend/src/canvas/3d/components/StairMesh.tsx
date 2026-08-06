import { useMemo } from "react";
import { Edges } from "@react-three/drei";
import * as THREE from "three";
import type { DrawingElement } from "../../../types";

const DEFAULT_RISE  = 18;  // cm per step
const DEFAULT_RUN   = 27;  // cm tread depth (unused directly but kept for reference)
const DEFAULT_TOTAL = 270; // cm total floor-to-floor height

const STAIR_COLOR = "#94a3b8";
const SELECTION_COLOR = "#3b82f6";
// Sphere segments for stair meshes (unused — we use BoxGeometry)
const STAIR_ROTATION_DEG_TO_RAD = Math.PI / 180;

// Suppress unused constant lint — DEFAULT_RUN is documented for callers
void DEFAULT_RUN;

interface StairMeshProps {
  el: DrawingElement;
  cx: number;
  cz: number;
  activeTool?: string;
  onElementClick?: (id: string) => void;
  selected?: boolean;
}

// Module-level material so it's shared across all StairMesh instances
const stairMaterial = new THREE.MeshStandardMaterial({
  color: STAIR_COLOR,
  roughness: 0.8,
  metalness: 0,
});

export function StairMesh({ el, cx, cz, activeTool, onElementClick, selected = false }: StairMeshProps) {
  const width     = el.width  ?? 120;
  const depth     = el.height ?? 240;
  const rise      = (el.stairRise  as number | undefined) ?? DEFAULT_RISE;
  const totalRise = (el.totalRise  as number | undefined) ?? DEFAULT_TOTAL;
  const rotation  = ((el.rotation ?? 0) * STAIR_ROTATION_DEG_TO_RAD);
  const steps     = Math.max(1, Math.round(totalRise / rise));
  const run       = depth / steps;

  const x = (el.x ?? 0) - cx;
  const z = (el.y ?? 0) - cz;

  const stepMeshes = useMemo(() => {
    const result: { pos: [number, number, number]; args: [number, number, number] }[] = [];
    for (let i = 0; i < steps; i++) {
      result.push({
        pos:  [0, rise * i + rise / 2, run * i + run / 2 - depth / 2],
        args: [width, rise, run],
      });
    }
    return result;
  }, [steps, rise, run, width, depth]);

  // Shared module-level material means no per-instance hover/select tint
  // (mutating it would recolor every stair) — selection instead draws a blue
  // Edges outline per step, which is independent line geometry and doesn't
  // touch the shared material at all.
  const clickable = activeTool === "select" || activeTool === "eraser";

  return (
    <group
      position={[x + width / 2, 0, z + depth / 2]}
      rotation={[0, rotation, 0]}
      onClick={(e) => {
        if (clickable) {
          e.stopPropagation();
          onElementClick?.(el.id);
        }
      }}
    >
      {stepMeshes.map((s, i) => (
        <mesh key={i} position={s.pos} material={stairMaterial} castShadow receiveShadow>
          <boxGeometry args={s.args} />
          {selected && <Edges color={SELECTION_COLOR} threshold={20} linewidth={2} />}
        </mesh>
      ))}
    </group>
  );
}
