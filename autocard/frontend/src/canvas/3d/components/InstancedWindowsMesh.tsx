import { useRef, useEffect, useMemo } from "react";
import * as THREE from "three";
import type { DrawingElement } from "../../../types";
import { timeOfDayToWindowEmissive } from "../materials/windowEmissive";

// Visual constants
const GLASS_COLOR            = "#93c5fd";
const FRAME_COLOR            = "#e2e8f0";
const DEFAULT_WINDOW_WIDTH   = 120; // cm
const DEFAULT_WINDOW_HEIGHT  = 120; // cm
const DEFAULT_SILL_HEIGHT    = 90;  // cm above floor
const FRAME_DEPTH            = 8;   // cm — frame extrusion depth
const GLASS_THICKNESS_FACTOR = 0.05; // relative to frame depth

interface InstancedWindowsMeshProps {
  elements:  DrawingElement[];
  cx:        number;
  cz:        number;
  timeOfDay: number; // hours, 0–24 — drives interior-light glow (dusk/night)
}

/**
 * InstancedWindowsMesh — renders all window elements in two draw calls:
 *   1. Semi-transparent glass panes (InstancedMesh)
 *   2. Opaque frame boxes (InstancedMesh)
 *
 * Windows are identified by archType:"window" or ifcType:"IfcWindow".
 */
export function InstancedWindowsMesh({
  elements,
  cx,
  cz,
  timeOfDay,
}: InstancedWindowsMeshProps) {
  const glassRef = useRef<THREE.InstancedMesh>(null);
  const frameRef = useRef<THREE.InstancedMesh>(null);

  const windows = useMemo(
    () =>
      elements.filter(
        (el) => el.archType === "window" || el.ifcType === "IfcWindow",
      ),
    [elements],
  );

  const glassMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color:       GLASS_COLOR,
        transparent: true,
        opacity:     0.4,
        roughness:   0.05,
        metalness:   0.1,
        side:        THREE.DoubleSide,
      }),
    [],
  );

  // Single shared material drives ALL window instances — emissive glow is
  // therefore uniform across every window, updated only when timeOfDay changes.
  useEffect(() => {
    const { color, intensity } = timeOfDayToWindowEmissive(timeOfDay);
    glassMat.emissive.set(color);
    glassMat.emissiveIntensity = intensity;
  }, [glassMat, timeOfDay]);

  const frameMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color:     FRAME_COLOR,
        roughness: 0.6,
        metalness: 0,
      }),
    [],
  );

  useEffect(() => {
    if (windows.length === 0) return;
    const dummy = new THREE.Object3D();

    windows.forEach((win, i) => {
      const w    = win.openingWidth ?? win.width ?? DEFAULT_WINDOW_WIDTH;
      const h    = (win.height as number | undefined) ?? DEFAULT_WINDOW_HEIGHT;
      const sill = (win as Record<string, unknown>).sillHeight as number | undefined ?? DEFAULT_SILL_HEIGHT;
      const x    = (win.x ?? 0) - cx;
      const z    = ((win.y as number | undefined) ?? 0) - cz;
      const rot  = ((win.rotation ?? 0) * Math.PI) / 180;

      dummy.position.set(x, sill + h / 2, z);
      dummy.rotation.set(0, rot, 0);
      dummy.scale.set(w, h, FRAME_DEPTH);
      dummy.updateMatrix();

      glassRef.current?.setMatrixAt(i, dummy.matrix);
      frameRef.current?.setMatrixAt(i, dummy.matrix);
    });

    if (glassRef.current) glassRef.current.instanceMatrix.needsUpdate = true;
    if (frameRef.current) frameRef.current.instanceMatrix.needsUpdate = true;
  }, [windows, cx, cz]);

  if (windows.length === 0) return null;

  return (
    <>
      {/* Glass pane — thin relative slab */}
      <instancedMesh
        ref={glassRef}
        args={[undefined, undefined, windows.length]}
        material={glassMat}
      >
        <boxGeometry args={[1, 1, GLASS_THICKNESS_FACTOR]} />
      </instancedMesh>
      {/* Frame box — full FRAME_DEPTH extrusion */}
      <instancedMesh
        ref={frameRef}
        args={[undefined, undefined, windows.length]}
        material={frameMat}
      >
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
    </>
  );
}
