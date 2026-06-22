import type { DrawingElement, Point } from "../types";

export interface NearestWallResult {
  wall: DrawingElement;
  distance: number;
  projectedPoint: Point;
  angle: number;
}

/**
 * Calculates distance from a point to a line segment.
 */
function pointLineDistance(pt: Point, p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(pt.x - p1.x, pt.y - p1.y);

  let t = ((pt.x - p1.x) * dx + (pt.y - p1.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  return Math.hypot(pt.x - (p1.x + t * dx), pt.y - (p1.y + t * dy));
}

/**
 * Projects a point onto a line segment.
 */
function projectPointOnLineSegment(pt: Point, p1: Point, p2: Point): Point {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { ...p1 };

  let t = ((pt.x - p1.x) * dx + (pt.y - p1.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  return {
    x: p1.x + t * dx,
    y: p1.y + t * dy,
  };
}

/**
 * Find the nearest wall to snap an opening (door/window) to.
 */
export function findNearestWall(
  pt: Point,
  elements: DrawingElement[],
  maxDistance: number = 60
): NearestWallResult | null {
  const walls = elements.filter(el => el.type === "wall");
  let nearest: NearestWallResult | null = null;
  let minDist = maxDistance;

  for (const w of walls) {
    const s = w.start as Point | undefined;
    const e = w.end as Point | undefined;
    if (!s || !e) continue;

    const dist = pointLineDistance(pt, s, e);
    if (dist < minDist) {
      minDist = dist;
      const projected = projectPointOnLineSegment(pt, s, e);
      const angle = Math.atan2(e.y - s.y, e.x - s.x);
      nearest = {
        wall: w,
        distance: dist,
        projectedPoint: projected,
        angle,
      };
    }
  }

  return nearest;
}

/**
 * Creates an opening (door or window) drawing element that associates with a host wall.
 */
export function createOpeningElement(
  type: "door" | "window",
  hostWall: DrawingElement,
  position: Point,
  opts: {
    id?: string;
    width?: number;
    height?: number;
    sill?: number;
    swing?: string;
  } = {}
): DrawingElement {
  const id = opts.id ?? `opening-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const isDoor = type === "door";

  // Default dimensions in mm/pixels
  const width = opts.width ?? (isDoor ? 90 : 120); 
  const height = opts.height ?? (isDoor ? 210 : 120);
  const sill = opts.sill ?? (isDoor ? 0 : 90);

  return {
    id,
    type: "opening",
    archType: type,
    openingType: type,
    hostWallId: hostWall.id,
    position: { x: position.x, y: position.y },
    x: position.x,
    y: position.y,
    width,
    openingWidth: width,
    height,
    sill,
    swing: isDoor ? (opts.swing as any ?? "right-in") : undefined,
    swingDirection: isDoor ? (opts.swing as any ?? "right-in") : undefined,
    layerId: isDoor ? "A-DOOR" : "A-WIND",
  };
}
