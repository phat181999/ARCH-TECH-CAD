import { DrawingElement, Point } from "../../../types";
import { computeGrips } from "../../../canvas/grips";

export function pointToSegmentDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

export function getShapeAtPoint(elements: any[], x: number, y: number) {
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    if (el.type === "rectangle") {
      if (x >= el.x && x <= el.x + el.width && y >= el.y && y <= el.y + el.height) {
        return el;
      }
    } else if (el.type === "circle") {
      const dx = x - el.cx;
      const dy = y - el.cy;
      if (dx * dx + dy * dy <= el.radius * el.radius) return el;
    } else if (el.type === "arc") {
      const dist = Math.hypot(x - (el.cx || 0), y - (el.cy || 0));
      if (Math.abs(dist - (el.radius || 0)) < 10) return el;
    } else if (el.type === "ellipse") {
      const rx = (el as any).rx || 50, ry = (el as any).ry || 30;
      if (rx > 0 && ry > 0) {
        const norm = ((x - (el.cx || 0)) ** 2) / (rx * rx) + ((y - (el.cy || 0)) ** 2) / (ry * ry);
        if (norm <= 1.2) return el;
      }
    } else if (el.type === "line") {
      const dist = pointToSegmentDist(x, y, el.x1, el.y1, el.x2, el.y2);
      if (dist < 8) return el;
    } else if (el.type === "text") {
      if (x >= el.x && x <= el.x + (el.text?.length || 1) * 12 && y >= el.y - 16 && y <= el.y + 4) {
        return el;
      }
    } else if (el.type === "leader") {
      const pts = el.points || [];
      for (let j = 0; j < pts.length - 1; j++) {
        const dist = pointToSegmentDist(x, y, pts[j].x, pts[j].y, pts[j+1].x, pts[j+1].y);
        if (dist < 8) return el;
      }
    } else if (el.type === "hatch") {
      const pts = el.points || [];
      if (pts.length >= 3) {
        let inside = false;
        for (let j = 0, k = pts.length - 1; j < pts.length; k = j++) {
          const xi = pts[j].x, yi = pts[j].y;
          const xk = pts[k].x, yk = pts[k].y;
          const intersect = ((yi > y) !== (yk > y)) && (x < (xk - xi) * (y - yi) / (yk - yi) + xi);
          if (intersect) inside = !inside;
        }
        if (inside) return el;
      }
    }
  }
  return null;
}

// Returns true if any part of the element overlaps the given world-space bounding box
export function elementInBox(el: DrawingElement, minX: number, minY: number, maxX: number, maxY: number): boolean {
  if (el.type === "line") {
    return (el.x1! >= minX && el.x1! <= maxX && el.y1! >= minY && el.y1! <= maxY) ||
           (el.x2! >= minX && el.x2! <= maxX && el.y2! >= minY && el.y2! <= maxY);
  }
  if (el.type === "circle" || el.type === "arc" || el.type === "ellipse") {
    return el.cx! >= minX && el.cx! <= maxX && el.cy! >= minY && el.cy! <= maxY;
  }
  if (el.type === "rectangle") {
    return el.x! < maxX && (el.x! + (el.width || 0)) > minX && el.y! < maxY && (el.y! + (el.height || 0)) > minY;
  }
  if (el.type === "text" || el.type === "block") {
    return el.x! >= minX && el.x! <= maxX && el.y! >= minY && el.y! <= maxY;
  }
  if (el.type === "wall") {
    const s = (el as any).start, e2 = (el as any).end;
    if (!s || !e2) return false;
    return (s.x >= minX && s.x <= maxX && s.y >= minY && s.y <= maxY) ||
           (e2.x >= minX && e2.x <= maxX && e2.y >= minY && e2.y <= maxY);
  }
  if (el.type === "dimension") {
    return (el.x1! >= minX && el.x1! <= maxX && el.y1! >= minY && el.y1! <= maxY) ||
           (el.x2! >= minX && el.x2! <= maxX && el.y2! >= minY && el.y2! <= maxY);
  }
  const pts: Point[] = el.points || [];
  return pts.some((p: Point) => p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY);
}

export function elementFullyInBox(el: DrawingElement, minX: number, minY: number, maxX: number, maxY: number): boolean {
  if (el.type === "line")
    return el.x1! >= minX && el.x1! <= maxX && el.y1! >= minY && el.y1! <= maxY &&
           el.x2! >= minX && el.x2! <= maxX && el.y2! >= minY && el.y2! <= maxY;
  if (el.type === "circle")
    return el.cx! - el.radius! >= minX && el.cx! + el.radius! <= maxX &&
           el.cy! - el.radius! >= minY && el.cy! + el.radius! <= maxY;
  if (el.type === "rectangle")
    return el.x! >= minX && el.x! + (el.width || 0) <= maxX &&
           el.y! >= minY && el.y! + (el.height || 0) <= maxY;
  if (el.type === "arc" || el.type === "ellipse")
    return el.cx! >= minX && el.cx! <= maxX && el.cy! >= minY && el.cy! <= maxY;
  if (el.type === "text" || el.type === "block")
    return el.x! >= minX && el.x! <= maxX && el.y! >= minY && el.y! <= maxY;
  if (el.type === "wall") {
    const s = (el as any).start, e2 = (el as any).end;
    if (!s || !e2) return false;
    return s.x >= minX && s.x <= maxX && s.y >= minY && s.y <= maxY &&
           e2.x >= minX && e2.x <= maxX && e2.y >= minY && e2.y <= maxY;
  }
  if (el.type === "dimension")
    return el.x1! >= minX && el.x1! <= maxX && el.y1! >= minY && el.y1! <= maxY &&
           el.x2! >= minX && el.x2! <= maxX && el.y2! >= minY && el.y2! <= maxY;
  const pts: Point[] = el.points || [];
  if (pts.length === 0) return false;
  return pts.every((p: Point) => p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY);
}

export function checkGripHit(
  pt: Point,
  elements: DrawingElement[],
  selectedIds: string[],
  zoom: number
): { elementId: string; gripIndex: number } | null {
  const threshold = 7 / zoom;
  for (const id of selectedIds) {
    const el = elements.find(e => e.id === id);
    if (!el) continue;
    const grips = computeGrips(el);
    for (let i = 0; i < grips.length; i++) {
      if (Math.hypot(pt.x - grips[i].x, pt.y - grips[i].y) < threshold) {
        return { elementId: id, gripIndex: i };
      }
    }
  }
  return null;
}
