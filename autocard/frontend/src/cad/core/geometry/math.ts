import type { Point } from '../../contracts/document'

export function distance(p1: Point, p2: Point): number {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y)
}

export function getLineIntersection(
  p0: Point, p1: Point, p2: Point, p3: Point,
  extendLine1 = false, extendLine2 = false
): Point | null {
  const s1x = p1.x - p0.x
  const s1y = p1.y - p0.y
  const s2x = p3.x - p2.x
  const s2y = p3.y - p2.y

  const denom = -s2x * s1y + s1x * s2y
  if (denom === 0) return null

  const s = (-s1y * (p0.x - p2.x) + s1x * (p0.y - p2.y)) / denom
  const t = ( s2x * (p0.y - p2.y) - s2y * (p0.x - p2.x)) / denom

  if ((extendLine1 || (t >= 0 && t <= 1)) && (extendLine2 || (s >= 0 && s <= 1))) {
    return { x: p0.x + t * s1x, y: p0.y + t * s1y }
  }
  return null
}

export function offsetLine(start: Point, end: Point, dist: number): { start: Point; end: Point } {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const len = Math.hypot(dx, dy)
  if (len === 0) return { start, end }
  const nx = -dy / len
  const ny = dx / len
  return {
    start: { x: start.x + nx * dist, y: start.y + ny * dist },
    end:   { x: end.x   + nx * dist, y: end.y   + ny * dist },
  }
}

export function pointLineDistance(p: Point, v: Point, w: Point): number {
  return distance(p, projectPointOnLineSegment(p, v, w))
}

export function projectPointOnLineSegment(p: Point, v: Point, w: Point): Point {
  const l2 = (w.x - v.x) ** 2 + (w.y - v.y) ** 2
  if (l2 === 0) return { ...v }
  const t = Math.max(0, Math.min(1, ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2))
  return { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) }
}

export function polygonArea(points: Point[]): number {
  if (points.length < 3) return 0
  let area = 0
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    area += (points[j].x + points[i].x) * (points[j].y - points[i].y)
  }
  return Math.abs(area / 2)
}

export function midpoint(p1: Point, p2: Point): Point {
  return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }
}

export function normalizeAngle(radians: number): number {
  const TWO_PI = Math.PI * 2
  return ((radians % TWO_PI) + TWO_PI) % TWO_PI
}

export function angleBetween(p1: Point, p2: Point): number {
  return Math.atan2(p2.y - p1.y, p2.x - p1.x)
}

export function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}
