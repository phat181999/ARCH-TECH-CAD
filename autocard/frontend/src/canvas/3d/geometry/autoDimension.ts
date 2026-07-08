// Auto-generates dimension lines from wall elements for the Views tab: one
// line per wall (offset outward, parallel to the wall) plus two overall
// chains (total width along the top, total height along the left), each
// labeled with its length in meters.
//
// v1 scope: walls only (no doors/windows), line-type walls only (polyline
// walls lack x1/y1/x2/y2 and are silently skipped), no per-room chains yet
// — see the design spec's non-goals.
import type { DrawingElement } from "../../../types";

export interface DimensionLine {
  x1: number; y1: number; x2: number; y2: number;
  label: string;
}

const PER_WALL_OFFSET = 30;   // drawing units outward from each wall
const OVERALL_OFFSET = 80;    // drawing units outward for the overall chains

function fmt(units: number): string {
  return `${(units / 100).toFixed(2)}m`;
}

export function generateDimensions(walls: DrawingElement[]): DimensionLine[] {
  const usable = walls.filter(
    (w): w is DrawingElement & { x1: number; y1: number; x2: number; y2: number } =>
      w.x1 != null && w.y1 != null && w.x2 != null && w.y2 != null,
  );
  if (usable.length === 0) return [];

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const w of usable) {
    minX = Math.min(minX, w.x1, w.x2); maxX = Math.max(maxX, w.x1, w.x2);
    minY = Math.min(minY, w.y1, w.y2); maxY = Math.max(maxY, w.y1, w.y2);
  }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;

  const lines: DimensionLine[] = [];

  for (const w of usable) {
    const dx = w.x2 - w.x1, dy = w.y2 - w.y1;
    const len = Math.hypot(dx, dy);
    if (len < 1) continue;
    const midX = (w.x1 + w.x2) / 2, midY = (w.y1 + w.y2) / 2;
    // Perpendicular unit normal, flipped to point away from the footprint's
    // center so the dimension line sits outside the building, not through it.
    let nx = -dy / len, ny = dx / len;
    if ((midX - cx) * nx + (midY - cy) * ny < 0) { nx = -nx; ny = -ny; }
    const ox = nx * PER_WALL_OFFSET, oy = ny * PER_WALL_OFFSET;
    lines.push({ x1: w.x1 + ox, y1: w.y1 + oy, x2: w.x2 + ox, y2: w.y2 + oy, label: fmt(len) });
  }

  // Overall width — along the top edge (minY side), offset further out.
  lines.push({ x1: minX, y1: minY - OVERALL_OFFSET, x2: maxX, y2: minY - OVERALL_OFFSET, label: fmt(maxX - minX) });
  // Overall height — along the left edge (minX side), offset further out.
  lines.push({ x1: minX - OVERALL_OFFSET, y1: minY, x2: minX - OVERALL_OFFSET, y2: maxY, label: fmt(maxY - minY) });

  return lines;
}
