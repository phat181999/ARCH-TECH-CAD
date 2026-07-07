// Wall-snap for MEP fixtures: project the click onto the nearest wall line,
// push the point off the wall face toward the click's side, keep the wall
// angle so the fixture plate sits flush. Port of house_planner_demo.html's
// nearestWall + normal-offset logic, in 2D drawing coords.
import type { DrawingElement } from "../../../types";

export interface FixtureSnap { x: number; y: number; angleDeg: number; wallId?: string }

export function snapFixtureToWall(
  p: { x: number; y: number },
  walls: DrawingElement[],
  maxDist: number,
  offset: number,
): FixtureSnap | null {
  let best: { fx: number; fy: number; dx: number; dy: number; len: number; dist: number; id?: string } | null = null;
  for (const w of walls) {
    if (w.type !== "line" || w.x1 == null || w.y1 == null || w.x2 == null || w.y2 == null) continue;
    const dx = w.x2 - w.x1, dy = w.y2 - w.y1;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1e-9) continue;
    let t = ((p.x - w.x1) * dx + (p.y - w.y1) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const fx = w.x1 + t * dx, fy = w.y1 + t * dy;
    const dist = Math.hypot(p.x - fx, p.y - fy);
    if (!best || dist < best.dist) best = { fx, fy, dx, dy, len: Math.sqrt(len2), dist, id: w.id };
  }
  if (!best || best.dist > maxDist) return null;
  const nx = -best.dy / best.len, ny = best.dx / best.len;
  const side = (p.x - best.fx) * nx + (p.y - best.fy) * ny >= 0 ? 1 : -1;
  return {
    x: best.fx + nx * side * offset,
    y: best.fy + ny * side * offset,
    angleDeg: (Math.atan2(best.dy, best.dx) * 180) / Math.PI,
    wallId: best.id,
  };
}
