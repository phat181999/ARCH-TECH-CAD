import type { Point, DrawingElement, SnapModes } from "../types";

export interface SnapResult {
  point: Point;
  type: string;
}

/**
 * Snap calculation engine for object snapping.
 * Finds nearest snap points based on active snap modes.
 */

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(p1: Point, p2: Point): Point {
  return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
}

function closestPointOnSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): Point {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { x: x1, y: y1 };
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return { x: x1 + t * dx, y: y1 + t * dy };
}

function snapEndpoint(elements: DrawingElement[], pt: Point, threshold: number): SnapResult | null {
  let best: SnapResult | null = null;
  let bestDist: number = threshold;
  for (const el of elements) {
    const points: Point[] = [];
    if (el.type === "line") {
      points.push({ x: el.x1!, y: el.y1! }, { x: el.x2!, y: el.y2! });
    } else if (el.type === "rectangle") {
      points.push(
        { x: el.x!, y: el.y! },
        { x: el.x! + el.width!, y: el.y! },
        { x: el.x! + el.width!, y: el.y! + el.height! },
        { x: el.x!, y: el.y! + el.height! }
      );
    } else if (el.type === "circle") {
      // No distinct endpoints for circles
    } else if (el.type === "text") {
      points.push({ x: el.x!, y: el.y! });
    } else if (el.type === "dimension") {
      points.push({ x: el.x1!, y: el.y1! }, { x: el.x2!, y: el.y2! });
    }
    for (const p of points) {
      const d = dist(pt, p);
      if (d < bestDist) {
        bestDist = d;
        best = { point: p, type: "endpoint" };
      }
    }
  }
  return best;
}

function snapMidpoint(elements: DrawingElement[], pt: Point, threshold: number): SnapResult | null {
  let best: SnapResult | null = null;
  let bestDist: number = threshold;
  for (const el of elements) {
    let mp: Point | null = null;
    if (el.type === "line") {
      mp = midpoint({ x: el.x1!, y: el.y1! }, { x: el.x2!, y: el.y2! });
    } else if (el.type === "rectangle") {
      // Midpoints of each edge
      const pts = [
        midpoint({ x: el.x!, y: el.y! }, { x: el.x! + el.width!, y: el.y! }),
        midpoint({ x: el.x! + el.width!, y: el.y! }, { x: el.x! + el.width!, y: el.y! + el.height! }),
        midpoint({ x: el.x! + el.width!, y: el.y! + el.height! }, { x: el.x!, y: el.y! + el.height! }),
        midpoint({ x: el.x!, y: el.y! + el.height! }, { x: el.x!, y: el.y! }),
      ];
      for (const p of pts) {
        const d = dist(pt, p);
        if (d < bestDist) {
          bestDist = d;
          best = { point: p, type: "midpoint" };
        }
      }
      continue;
    }
    if (mp) {
      const d = dist(pt, mp);
      if (d < bestDist) {
        bestDist = d;
        best = { point: mp, type: "midpoint" };
      }
    }
  }
  return best;
}

function snapCenter(elements: DrawingElement[], pt: Point, threshold: number): SnapResult | null {
  let best: SnapResult | null = null;
  let bestDist: number = threshold;
  for (const el of elements) {
    if (el.type === "circle") {
      const cp = { x: el.cx!, y: el.cy! };
      const d = dist(pt, cp);
      if (d < bestDist) {
        bestDist = d;
        best = { point: cp, type: "center" };
      }
    } else if (el.type === "rectangle") {
      const cp = { x: el.x! + el.width! / 2, y: el.y! + el.height! / 2 };
      const d = dist(pt, cp);
      if (d < bestDist) {
        bestDist = d;
        best = { point: cp, type: "center" };
      }
    }
  }
  return best;
}

function snapGrid(pt: Point, gridSize: number, threshold: number): SnapResult | null {
  const gx = Math.round(pt.x / gridSize) * gridSize;
  const gy = Math.round(pt.y / gridSize) * gridSize;
  const d = dist(pt, { x: gx, y: gy });
  if (d < threshold) {
    return { point: { x: gx, y: gy }, type: "grid" };
  }
  return null;
}

function snapIntersection(elements: DrawingElement[], pt: Point, threshold: number): SnapResult | null {
  // Check intersections of line segments
  const lines: Array<{x1: number; y1: number; x2: number; y2: number}> = [];
  for (const el of elements) {
    if (el.type === "line") {
      lines.push({ x1: el.x1!, y1: el.y1!, x2: el.x2!, y2: el.y2! });
    } else if (el.type === "rectangle") {
      const { x, y, width: w, height: h } = el as { x: number; y: number; width: number; height: number };
      lines.push(
        { x1: x, y1: y, x2: x + w, y2: y },
        { x1: x + w, y1: y, x2: x + w, y2: y + h },
        { x1: x + w, y1: y + h, x2: x, y2: y + h },
        { x1: x, y1: y + h, x2: x, y2: y }
      );
    }
  }

  let best: SnapResult | null = null;
  let bestDist: number = threshold;
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const a = lines[i];
      const b = lines[j];
      const denom = (a.x1 - a.x2) * (b.y1 - b.y2) - (a.y1 - a.y2) * (b.x1 - b.x2);
      if (Math.abs(denom) < 1e-10) continue;
      const t = ((a.x1 - b.x1) * (b.y1 - b.y2) - (a.y1 - b.y1) * (b.x1 - b.x2)) / denom;
      const u = -((a.x1 - a.x2) * (a.y1 - b.y1) - (a.y1 - a.y2) * (a.x1 - b.x1)) / denom;
      if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
        const ip = {
          x: a.x1 + t * (a.x2 - a.x1),
          y: a.y1 + t * (a.y2 - a.y1),
        };
        const d = dist(pt, ip);
        if (d < bestDist) {
          bestDist = d;
          best = { point: ip, type: "intersection" };
        }
      }
    }
  }
  return best;
}



/**
 * Draw snap indicator on canvas context.
 */
export function drawSnapIndicator(ctx: CanvasRenderingContext2D, point: Point, type: string): void {
  const size = 6;
  ctx.save();
  ctx.setLineDash([]);

  switch (type) {
    case "endpoint":
      ctx.strokeStyle = "#22c55e"; // green
      ctx.fillStyle = "#22c55e";
      ctx.strokeRect(point.x - size / 2, point.y - size / 2, size, size);
      break;
    case "midpoint":
      ctx.strokeStyle = "#eab308"; // yellow
      ctx.fillStyle = "#eab308";
      ctx.beginPath();
      ctx.moveTo(point.x, point.y - size / 2);
      ctx.lineTo(point.x + size / 2, point.y + size / 2);
      ctx.lineTo(point.x - size / 2, point.y + size / 2);
      ctx.closePath();
      ctx.stroke();
      break;
    case "center":
      ctx.strokeStyle = "#ef4444"; // red
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(point.x, point.y, size / 2, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case "grid":
      ctx.strokeStyle = "#6b7280"; // gray
      ctx.fillStyle = "#6b7280";
      ctx.beginPath();
      ctx.arc(point.x, point.y, 2, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "intersection":
      ctx.strokeStyle = "#a855f7"; // purple
      ctx.fillStyle = "#a855f7";
      ctx.beginPath();
      ctx.arc(point.x, point.y, size / 2, 0, Math.PI * 2);
      ctx.fill();
      break;
  }

  ctx.restore();
}
/**
 * Find the nearest snap point based on active snap modes.
 */
export function findNearestSnap(
  elements: DrawingElement[],
  pt: Point,
  snapModes: SnapModes,
  threshold: number,
  gridSize: number
): SnapResult | null {
  let best: SnapResult | null = null;
  let bestDist: number = threshold;

  const checkSnap = (result: SnapResult | null) => {
    if (result) {
      const d = dist(pt, result.point);
      if (d < bestDist) {
        bestDist = d;
        best = result;
      }
    }
  };

  if (snapModes.endpoint) {
    checkSnap(snapEndpoint(elements, pt, threshold));
  }
  if (snapModes.midpoint) {
    checkSnap(snapMidpoint(elements, pt, threshold));
  }
  if (snapModes.center) {
    checkSnap(snapCenter(elements, pt, threshold));
  }
  if (snapModes.intersection) {
    checkSnap(snapIntersection(elements, pt, threshold));
  }
  if (snapModes.grid) {
    checkSnap(snapGrid(pt, gridSize, threshold));
  }

  return best;
}
