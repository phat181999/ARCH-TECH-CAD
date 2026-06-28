/**
 * WallMoveController — drag a wall in 3D along its perpendicular axis.
 * Finds the nearest wall segment to the ground-plane raycast point,
 * then translates it perpendicularly as the user drags. On mouse-up the
 * new position is committed to the store (writes back to 2D).
 */
import { useRef, useEffect, useState } from "react";
import { useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { useDrawingStore } from "../../../stores/drawingStore";
import type { DrawingElement } from "../../../types";

// Distance threshold (3D world units) for snapping to a wall during move
const WALL_SNAP_THRESHOLD = 40;

interface WallMoveWallDef {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  centerX: number;
  centerZ: number;
}

interface WallMoveControllerProps {
  activeTool: string;
  center: { cx: number; cz: number };
  wallElements: DrawingElement[];
}

export function WallMoveController({ activeTool, center, wallElements }: WallMoveControllerProps) {
  const { camera, gl } = useThree();
  const active = activeTool === "wall-move";

  const dragRef = useRef<{
    wallId: string;
    perpX: number;
    perpZ: number;
    startX: number;
    startZ: number;
    origX1: number;
    origY1: number;
    origX2: number;
    origY2: number;
  } | null>(null);

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [labelPos, setLabelPos]   = useState<[number, number, number] | null>(null);

  const groundPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));

  function raycastGround(e: PointerEvent): THREE.Vector3 | null {
    const rect = gl.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width)  *  2 - 1,
      -((e.clientY - rect.top)  / rect.height) * 2 + 1,
    );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(mouse, camera);
    const hit = new THREE.Vector3();
    return ray.ray.intersectPlane(groundPlane.current, hit) ? hit : null;
  }

  function buildWallDefs(): WallMoveWallDef[] {
    return wallElements
      .filter(
        (el) =>
          (el.archType === "wall" || el.type === "line") &&
          el.x1 !== undefined &&
          el.y1 !== undefined &&
          el.x2 !== undefined &&
          el.y2 !== undefined,
      )
      .map((el) => ({
        id:      el.id,
        x1:      el.x1!,
        y1:      el.y1!,
        x2:      el.x2!,
        y2:      el.y2!,
        centerX: (el.x1! + el.x2!) / 2 - center.cx,
        centerZ: (el.y1! + el.y2!) / 2 - center.cz,
      }));
  }

  function findNearestWall(pt: THREE.Vector3): WallMoveWallDef | null {
    const walls = buildWallDefs();
    let best: WallMoveWallDef | null = null;
    let bestDist = WALL_SNAP_THRESHOLD;

    for (const w of walls) {
      // Wall endpoints in 3D world coords (shifted by center)
      const ax = w.x1 - center.cx;
      const az = w.y1 - center.cz;
      const bx = w.x2 - center.cx;
      const bz = w.y2 - center.cz;

      const abx = bx - ax;
      const abz = bz - az;
      const len2 = abx * abx + abz * abz;
      if (len2 < 1) continue;

      const t = Math.max(0, Math.min(1, ((pt.x - ax) * abx + (pt.z - az) * abz) / len2));
      const nx = ax + t * abx;
      const nz = az + t * abz;
      const dist = Math.hypot(pt.x - nx, pt.z - nz);

      if (dist < bestDist) {
        bestDist = dist;
        best = w;
      }
    }

    return best;
  }

  useEffect(() => {
    if (!active) {
      dragRef.current = null;
      setHoveredId(null);
      setLabelPos(null);
      return;
    }

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const pt = raycastGround(e);
      if (!pt) return;

      const wall = findNearestWall(pt);
      if (!wall) return;

      // Compute unit perpendicular of wall in XZ plane
      const dx = wall.x2 - wall.x1;
      const dz = wall.y2 - wall.y1;
      const len = Math.hypot(dx, dz);
      if (len < 0.01) return;

      const perpX = -dz / len;
      const perpZ =  dx / len;

      dragRef.current = {
        wallId: wall.id,
        perpX,
        perpZ,
        startX:  pt.x,
        startZ:  pt.z,
        origX1:  wall.x1,
        origY1:  wall.y1,
        origX2:  wall.x2,
        origY2:  wall.y2,
      };

      e.stopPropagation();
    };

    const onMove = (e: PointerEvent) => {
      const pt = raycastGround(e);
      if (!pt) return;

      // Hover highlight
      const wall = findNearestWall(pt);
      setHoveredId(wall?.id ?? null);
      if (wall) {
        setLabelPos([wall.centerX, 50, wall.centerZ]);
      } else {
        setLabelPos(null);
      }

      const dr = dragRef.current;
      if (!dr) return;

      // Project mouse delta onto the perpendicular axis
      const deltaDot =
        (pt.x - dr.startX) * dr.perpX +
        (pt.z - dr.startZ) * dr.perpZ;

      // Translate wall endpoints along perpendicular
      const newX1 = dr.origX1 + dr.perpX * deltaDot;
      const newY1 = dr.origY1 + dr.perpZ * deltaDot;
      const newX2 = dr.origX2 + dr.perpX * deltaDot;
      const newY2 = dr.origY2 + dr.perpZ * deltaDot;

      // Live preview: world coords back to drawing coords (+center)
      useDrawingStore.getState().updateElement(dr.wallId, {
        x1: newX1 + center.cx,
        y1: newY1 + center.cz,
        x2: newX2 + center.cx,
        y2: newY2 + center.cz,
        editedIn3D: true,
      } as Partial<DrawingElement>);
    };

    const onUp = () => {
      dragRef.current = null;
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        dragRef.current = null;
      }
    };

    gl.domElement.addEventListener("pointerdown", onDown);
    gl.domElement.addEventListener("pointermove", onMove);
    gl.domElement.addEventListener("pointerup",   onUp);
    window.addEventListener("keydown", onKey);

    return () => {
      gl.domElement.removeEventListener("pointerdown", onDown);
      gl.domElement.removeEventListener("pointermove", onMove);
      gl.domElement.removeEventListener("pointerup",   onUp);
      window.removeEventListener("keydown", onKey);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, wallElements, center, camera, gl]);

  if (!active) return null;

  return (
    <>
      {hoveredId && labelPos && (
        <Html position={labelPos} center>
          <div className="bg-blue-900/90 text-blue-200 font-mono text-[9px] font-bold px-2 py-0.5 rounded border border-blue-500/40 shadow-md select-none whitespace-nowrap">
            Drag to move wall
          </div>
        </Html>
      )}
    </>
  );
}
