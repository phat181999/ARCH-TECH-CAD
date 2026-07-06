// 3D drawing snapping/inference: endpoint > midpoint > axis lock > grid.
// All coordinates are world-space ground-plane points ({x, z}, y = 0).
import type { DrawingElement } from "../../../types";
import { drawingToWorld, type Center } from "../geometry/coordBridge";

export type SnapType = "endpoint" | "midpoint" | "axis" | "grid" | "none";
export interface SnapPoint2D { x: number; z: number }
export interface SnapCandidates { endpoints: SnapPoint2D[]; midpoints: SnapPoint2D[] }
export interface SnapOptions {
  tolerance?: number;           // world units; 12 = 12 cm
  gridSize?: number;            // world units; unset disables grid snap
  anchor?: SnapPoint2D | null;  // chain start point, required for axisLock
  axisLock?: boolean;           // Shift held: constrain to dominant axis
}
export interface SnapResult { point: SnapPoint2D; type: SnapType }

const DEFAULT_TOLERANCE = 12;

export function collectSnapCandidates(elements: DrawingElement[], center: Center): SnapCandidates {
  const endpoints: SnapPoint2D[] = [];
  const midpoints: SnapPoint2D[] = [];
  const toWorld = (x: number, y: number): SnapPoint2D => {
    const w = drawingToWorld({ x, y }, center);
    return { x: w.x, z: w.z };
  };
  for (const el of elements) {
    if (el.type === "line" && el.x1 != null && el.y1 != null && el.x2 != null && el.y2 != null) {
      const a = toWorld(el.x1, el.y1);
      const b = toWorld(el.x2, el.y2);
      endpoints.push(a, b);
      midpoints.push({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 });
    } else if (el.type === "rectangle" && el.x != null && el.y != null && el.width != null && el.height != null) {
      endpoints.push(
        toWorld(el.x, el.y),
        toWorld(el.x + el.width, el.y),
        toWorld(el.x, el.y + el.height),
        toWorld(el.x + el.width, el.y + el.height),
      );
      midpoints.push(toWorld(el.x + el.width / 2, el.y + el.height / 2));
    } else if (el.type === "circle" && el.cx != null && el.cy != null) {
      midpoints.push(toWorld(el.cx, el.cy));
    } else if (Array.isArray(el.points) && el.points.length > 0) {
      for (const p of el.points) endpoints.push(toWorld(p.x, p.y));
      for (let i = 0; i + 1 < el.points.length; i++) {
        const a = el.points[i], b = el.points[i + 1];
        midpoints.push(toWorld((a.x + b.x) / 2, (a.y + b.y) / 2));
      }
    }
  }
  return { endpoints, midpoints };
}

function nearestWithin(pts: SnapPoint2D[], raw: SnapPoint2D, tolerance: number): SnapPoint2D | null {
  let best: SnapPoint2D | null = null;
  let bestD = tolerance;
  for (const p of pts) {
    const d = Math.hypot(p.x - raw.x, p.z - raw.z);
    if (d <= bestD) { best = p; bestD = d; }
  }
  return best;
}

export function applySnap(raw: SnapPoint2D, candidates: SnapCandidates, opts: SnapOptions = {}): SnapResult {
  const tolerance = opts.tolerance ?? DEFAULT_TOLERANCE;

  // Axis lock takes over completely: constrain to the dominant axis from the anchor.
  if (opts.axisLock && opts.anchor) {
    const dx = Math.abs(raw.x - opts.anchor.x);
    const dz = Math.abs(raw.z - opts.anchor.z);
    const point = dx >= dz ? { x: raw.x, z: opts.anchor.z } : { x: opts.anchor.x, z: raw.z };
    return { point, type: "axis" };
  }

  const ep = nearestWithin(candidates.endpoints, raw, tolerance);
  if (ep) return { point: ep, type: "endpoint" };

  const mp = nearestWithin(candidates.midpoints, raw, tolerance);
  if (mp) return { point: mp, type: "midpoint" };

  if (opts.gridSize && opts.gridSize > 0) {
    const gx = Math.round(raw.x / opts.gridSize) * opts.gridSize;
    const gz = Math.round(raw.z / opts.gridSize) * opts.gridSize;
    if (Math.hypot(gx - raw.x, gz - raw.z) <= tolerance) {
      return { point: { x: gx, z: gz }, type: "grid" };
    }
  }

  return { point: raw, type: "none" };
}
