// Factories for shape elements created by the 3D drawing tools. All inputs are
// 2D drawing coords; outputs are DrawingElements that render in both 2D and 3D.
import type { DrawingElement } from "../../../types";

type Pt = { x: number; y: number };
export interface ShapeOpts { layerId: string; strokeColor?: string }

let shapeSeq = 0;
const nextId = (kind: string) => `${kind}3d-${++shapeSeq}-${Math.random().toString(36).slice(2, 7)}`;

export function makeRectangleElement(a: Pt, b: Pt, opts: ShapeOpts): DrawingElement | null {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  const width = Math.abs(b.x - a.x), height = Math.abs(b.y - a.y);
  if (width < 1 || height < 1) return null;
  return { id: nextId("rect"), type: "rectangle", layerId: opts.layerId, x, y, width, height, strokeColor: opts.strokeColor ?? "#1f2937" };
}

export function makeCircleElement(c: Pt, radius: number, opts: ShapeOpts): DrawingElement | null {
  if (radius < 1) return null;
  return { id: nextId("circle"), type: "circle", layerId: opts.layerId, cx: c.x, cy: c.y, radius, strokeColor: opts.strokeColor ?? "#1f2937" };
}

// 3-point arc (start, through, end) via circumcenter. Angles stored in degrees
// (the convention of ElementRenderer and ArcMesh3D).
export function makeArcElement(p1: Pt, p2: Pt, p3: Pt, opts: ShapeOpts): DrawingElement | null {
  const d = 2 * (p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y));
  if (Math.abs(d) < 1e-6) return null; // collinear
  const s1 = p1.x * p1.x + p1.y * p1.y;
  const s2 = p2.x * p2.x + p2.y * p2.y;
  const s3 = p3.x * p3.x + p3.y * p3.y;
  const cx = (s1 * (p2.y - p3.y) + s2 * (p3.y - p1.y) + s3 * (p1.y - p2.y)) / d;
  const cy = (s1 * (p3.x - p2.x) + s2 * (p1.x - p3.x) + s3 * (p2.x - p1.x)) / d;
  const radius = Math.hypot(p1.x - cx, p1.y - cy);
  if (radius < 1) return null;

  const angleOf = (p: Pt) => (Math.atan2(p.y - cy, p.x - cx) * 180) / Math.PI;
  let startAngle = angleOf(p1);
  let endAngle = angleOf(p3);
  const midAngle = angleOf(p2);
  // Ensure the arc sweeps through p2: if the CCW sweep start→end skips the
  // mid angle, swap direction.
  const norm = (a: number) => ((a % 360) + 360) % 360;
  const sweepContains = (s: number, e: number, m: number) => {
    const span = norm(e - s), off = norm(m - s);
    return off <= span;
  };
  if (!sweepContains(startAngle, endAngle, midAngle)) [startAngle, endAngle] = [endAngle, startAngle];

  return { id: nextId("arc"), type: "arc", layerId: opts.layerId, cx, cy, radius, startAngle, endAngle, strokeColor: opts.strokeColor ?? "#1f2937" };
}

// Parallel copy of a line wall. Positive distance offsets toward +90° from the
// a→b direction (i.e. downward-right of travel in screen coords, y down).
export function offsetWall(el: DrawingElement, distance: number): DrawingElement | null {
  if (el.type !== "line" || el.x1 == null || el.y1 == null || el.x2 == null || el.y2 == null) return null;
  const dx = el.x2 - el.x1, dy = el.y2 - el.y1;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return null;
  const nx = (-dy / len) * distance, ny = (dx / len) * distance;
  return {
    ...JSON.parse(JSON.stringify(el)),
    id: nextId("wall-offset"),
    x1: el.x1 + nx, y1: el.y1 + ny,
    x2: el.x2 + nx, y2: el.y2 + ny,
  };
}
