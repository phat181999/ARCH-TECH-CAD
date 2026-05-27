import { Point } from "../types";

// Distance between two points
export function distance(p1: Point, p2: Point): number {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

// Calculate intersection of two line segments
export function getLineIntersection(
  p0: Point, p1: Point, p2: Point, p3: Point,
  extendLine1 = false, extendLine2 = false
): Point | null {
  const s1_x = p1.x - p0.x;
  const s1_y = p1.y - p0.y;
  const s2_x = p3.x - p2.x;
  const s2_y = p3.y - p2.y;

  const s = (-s1_y * (p0.x - p2.x) + s1_x * (p0.y - p2.y)) / (-s2_x * s1_y + s1_x * s2_y);
  const t = ( s2_x * (p0.y - p2.y) - s2_y * (p0.x - p2.x)) / (-s2_x * s1_y + s1_x * s2_y);

  if ((extendLine1 || (t >= 0 && t <= 1)) && (extendLine2 || (s >= 0 && s <= 1))) {
    return {
      x: p0.x + (t * s1_x),
      y: p0.y + (t * s1_y)
    };
  }
  return null;
}

// Offset a line by distance d (positive is "left" of the directed line, negative is "right")
export function offsetLine(start: Point, end: Point, dist: number): { start: Point, end: Point } {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy);
  
  if (len === 0) return { start, end };
  
  // Normal vector
  const nx = -dy / len;
  const ny = dx / len;
  
  return {
    start: { x: start.x + nx * dist, y: start.y + ny * dist },
    end: { x: end.x + nx * dist, y: end.y + ny * dist }
  };
}

// Check if a point is close to a line segment
export function pointLineDistance(p: Point, v: Point, w: Point): number {
  return distance(p, projectPointOnLineSegment(p, v, w));
}

// Project a point onto a line segment
export function projectPointOnLineSegment(p: Point, v: Point, w: Point): Point {
  const l2 = (w.x - v.x) ** 2 + (w.y - v.y) ** 2;
  if (l2 === 0) return { ...v };
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) };
}

// Calculate polygon area (shoelace formula)
export function polygonArea(points: Point[]): number {
  if (points.length < 3) return 0;
  let area = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    area += (points[j].x + points[i].x) * (points[j].y - points[i].y);
  }
  return Math.abs(area / 2);
}
