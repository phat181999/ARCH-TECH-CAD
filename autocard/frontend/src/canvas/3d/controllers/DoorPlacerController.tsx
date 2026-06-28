/**
 * DoorPlacerController — click near a wall in 3D to place a door or window.
 * Snaps to the nearest wall, shows a ghost preview, then on click opens a
 * confirm panel. Pressing Place (or Enter) writes a DrawingElement to the store
 * so it renders in both 2D and 3D immediately.
 */
import { useEffect, useState, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { useDrawingStore } from "../../../stores/drawingStore";
import { worldToDrawing } from "../geometry/coordBridge";
import type { DrawingElement } from "../../../types";

// Default dimensions (world units = cm)
const DEFAULT_DOOR_WIDTH  = 90;
const DEFAULT_DOOR_HEIGHT = 210;
const DEFAULT_WIN_WIDTH   = 120;
const DEFAULT_WIN_HEIGHT  = 120;

// Max snap distance to a wall (world units)
const SNAP_THRESHOLD = 60;

// Sequence counter for unique element IDs
let openingSeq = 0;

interface WallDef {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface DoorPlacerProps {
  activeTool: string;
  center: { cx: number; cz: number };
  wallElements: DrawingElement[];
}

interface SnapResult {
  snapped: THREE.Vector3;
  wallId: string;
  angle: number;
}

export function DoorPlacerController({ activeTool, center, wallElements }: DoorPlacerProps) {
  const { camera, gl } = useThree();
  const active   = activeTool === "door-place3d" || activeTool === "window-place3d";
  const isWindow = activeTool === "window-place3d";

  const groundPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));

  const [preview,   setPreview]   = useState<{ pos: THREE.Vector3; wallAngle: number } | null>(null);
  const [confirmed, setConfirmed] = useState<{ pos: THREE.Vector3; wallId: string; wallAngle: number } | null>(null);

  const defaultWidth  = isWindow ? DEFAULT_WIN_WIDTH  : DEFAULT_DOOR_WIDTH;
  const defaultHeight = isWindow ? DEFAULT_WIN_HEIGHT : DEFAULT_DOOR_HEIGHT;
  const [openingWidth,  setOpeningWidth]  = useState(defaultWidth);
  const [openingHeight, setOpeningHeight] = useState(defaultHeight);

  function toGround(e: PointerEvent): THREE.Vector3 | null {
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

  function buildWallDefs(): WallDef[] {
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
        id: el.id,
        x1: el.x1!,
        y1: el.y1!,
        x2: el.x2!,
        y2: el.y2!,
      }));
  }

  function nearestWallSnap(pt: THREE.Vector3): SnapResult | null {
    const walls = buildWallDefs();
    let best: (SnapResult & { dist: number }) | null = null;

    for (const w of walls) {
      const ax = w.x1 - center.cx;
      const az = w.y1 - center.cz;
      const bx = w.x2 - center.cx;
      const bz = w.y2 - center.cz;

      const abx = bx - ax;
      const abz = bz - az;
      const len2 = abx * abx + abz * abz;
      if (len2 < 1) continue;

      // Clamp t to [0.1, 0.9] to avoid placing at corners
      const t = Math.max(0.1, Math.min(0.9, ((pt.x - ax) * abx + (pt.z - az) * abz) / len2));
      const sx = ax + t * abx;
      const sz = az + t * abz;
      const dist = Math.hypot(pt.x - sx, pt.z - sz);

      if (dist < SNAP_THRESHOLD && (!best || dist < best.dist)) {
        const angle = Math.atan2(abz, abx);
        best = {
          snapped: new THREE.Vector3(sx, 0, sz),
          wallId:  w.id,
          angle,
          dist,
        };
      }
    }

    return best ? { snapped: best.snapped, wallId: best.wallId, angle: best.angle } : null;
  }

  function commitPlacement(pos: THREE.Vector3, wallId: string, angle: number) {
    const pt2d = worldToDrawing({ x: pos.x, z: pos.z }, center);
    const archType = isWindow ? ("window" as const) : ("door" as const);
    const w = openingWidth;
    const h = openingHeight;

    useDrawingStore.getState().addElement({
      id:         `${archType}3d-${++openingSeq}`,
      type:       "rectangle",
      archType,
      hostWallId: wallId,
      x:          pt2d.x - w / 2,
      y:          pt2d.y - h / 2,
      width:      w,
      height:     h,
      rotation:   (angle * 180) / Math.PI,
      layerId:    archType === "door" ? "A-DOOR" : "A-WIND",
    } as DrawingElement);

    setConfirmed(null);
    setPreview(null);
  }

  // Reset width/height defaults when the tool switches between door and window
  useEffect(() => {
    setOpeningWidth(isWindow  ? DEFAULT_WIN_WIDTH  : DEFAULT_DOOR_WIDTH);
    setOpeningHeight(isWindow ? DEFAULT_WIN_HEIGHT : DEFAULT_DOOR_HEIGHT);
  }, [isWindow]);

  useEffect(() => {
    if (!active) {
      setPreview(null);
      setConfirmed(null);
      return;
    }

    const onMove = (e: PointerEvent) => {
      if (confirmed) return;
      const pt = toGround(e);
      if (!pt) return;
      const snap = nearestWallSnap(pt);
      setPreview(snap ? { pos: snap.snapped, wallAngle: snap.angle } : null);
    };

    const onClick = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const pt = toGround(e);
      if (!pt) return;
      const snap = nearestWallSnap(pt);
      if (!snap) return;
      setConfirmed({ pos: snap.snapped, wallId: snap.wallId, wallAngle: snap.angle });
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setConfirmed(null);
        setPreview(null);
      }
      if (e.key === "Enter" && confirmed) {
        commitPlacement(confirmed.pos, confirmed.wallId, confirmed.wallAngle);
      }
    };

    gl.domElement.addEventListener("pointermove", onMove);
    gl.domElement.addEventListener("pointerdown", onClick);
    window.addEventListener("keydown", onKey);

    return () => {
      gl.domElement.removeEventListener("pointermove", onMove);
      gl.domElement.removeEventListener("pointerdown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, confirmed, wallElements, center, camera, gl, openingWidth, openingHeight, isWindow]);

  if (!active) return null;

  const ghostHeight = isWindow ? DEFAULT_WIN_HEIGHT : DEFAULT_DOOR_HEIGHT;
  const ghostWidth  = isWindow ? DEFAULT_WIN_WIDTH  : DEFAULT_DOOR_WIDTH;
  const ghostColor  = isWindow ? "#06b6d4" : "#0ea5e9";

  return (
    <>
      {/* Ghost preview at snapped position */}
      {preview && !confirmed && (
        <mesh
          position={[preview.pos.x, ghostHeight / 2, preview.pos.z]}
          rotation={[0, preview.wallAngle, 0]}
        >
          <boxGeometry args={[ghostWidth, ghostHeight, 15]} />
          <meshBasicMaterial color={ghostColor} transparent opacity={0.45} />
        </mesh>
      )}

      {/* Confirm panel (Html overlay) */}
      {confirmed && (
        <Html position={[confirmed.pos.x, 300, confirmed.pos.z]} center>
          <div className="bg-slate-800/95 border border-slate-600 rounded-lg p-3 shadow-xl w-52 flex flex-col gap-2">
            <div className="text-white text-xs font-bold">
              {isWindow ? "Place Window" : "Place Door"}
            </div>

            <label className="flex flex-col gap-0.5 text-[10px] text-slate-400">
              Width (cm)
              <input
                type="number"
                min={40}
                max={400}
                value={openingWidth}
                onChange={(e) => setOpeningWidth(Number(e.target.value))}
                className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-white"
              />
            </label>

            <label className="flex flex-col gap-0.5 text-[10px] text-slate-400">
              Height (cm)
              <input
                type="number"
                min={100}
                max={400}
                value={openingHeight}
                onChange={(e) => setOpeningHeight(Number(e.target.value))}
                className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-white"
              />
            </label>

            <div className="flex gap-2 mt-1">
              <button
                onClick={() =>
                  commitPlacement(confirmed.pos, confirmed.wallId, confirmed.wallAngle)
                }
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded py-1 font-medium"
              >
                Place
              </button>
              <button
                onClick={() => {
                  setConfirmed(null);
                  setPreview(null);
                }}
                className="flex-1 bg-slate-600 hover:bg-slate-500 text-white text-xs rounded py-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </Html>
      )}

      {/* Idle hint label */}
      {!preview && !confirmed && (
        <Html position={[0, 200, 0]} center>
          <div className="bg-slate-900/90 text-cyan-400 font-mono text-[9px] font-bold px-2 py-0.5 rounded border border-cyan-500/30 select-none">
            Hover near a wall to snap
          </div>
        </Html>
      )}
    </>
  );
}
