import type { Point, DrawingElement, SnapModes } from "../types";

export interface SnapResult {
  point: Point;
  type: string;
}

export type Segment = { x1: number; y1: number; x2: number; y2: number };

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

// Unclamped projection — t may be outside [0,1] for extension / perpendicular
function closestPointOnLine(px: number, py: number, x1: number, y1: number, x2: number, y2: number): { point: Point; t: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { point: { x: x1, y: y1 }, t: 0 };
  const t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  return { point: { x: x1 + t * dx, y: y1 + t * dy }, t };
}

function collectSegments(elements: DrawingElement[]): Segment[] {
  const segs: Segment[] = [];
  for (const el of elements) {
    if (el.type === "line") {
      segs.push({ x1: el.x1!, y1: el.y1!, x2: el.x2!, y2: el.y2! });
    } else if (el.type === "wall" && el.start && el.end) {
      const s = el.start as Point;
      const e2 = el.end as Point;
      segs.push({ x1: s.x, y1: s.y, x2: e2.x, y2: e2.y });
    } else if (el.type === "rectangle") {
      const x = el.x!, y = el.y!, w = el.width!, h = el.height!;
      segs.push(
        { x1: x, y1: y, x2: x + w, y2: y },
        { x1: x + w, y1: y, x2: x + w, y2: y + h },
        { x1: x + w, y1: y + h, x2: x, y2: y + h },
        { x1: x, y1: y + h, x2: x, y2: y }
      );
    } else if (
      (el.type === "polyline" || el.type === "leader" || el.type === "hatch") &&
      el.points?.length
    ) {
      const pts = el.points;
      for (let i = 0; i < pts.length - 1; i++) {
        segs.push({ x1: pts[i].x, y1: pts[i].y, x2: pts[i + 1].x, y2: pts[i + 1].y });
      }
      if (el.type === "hatch" && pts.length >= 3) {
        segs.push({ x1: pts[pts.length - 1].x, y1: pts[pts.length - 1].y, x2: pts[0].x, y2: pts[0].y });
      }
    }
  }
  return segs;
}

function snapEndpoint(elements: DrawingElement[], pt: Point, threshold: number): SnapResult | null {
  let best: SnapResult | null = null;
  let bestDist = threshold;
  for (const el of elements) {
    const points: Point[] = [];
    if (el.type === "line") {
      points.push({ x: el.x1!, y: el.y1! }, { x: el.x2!, y: el.y2! });
    } else if (el.type === "wall" && el.start && el.end) {
      points.push(el.start as Point, el.end as Point);
    } else if (el.type === "rectangle") {
      points.push(
        { x: el.x!, y: el.y! },
        { x: el.x! + el.width!, y: el.y! },
        { x: el.x! + el.width!, y: el.y! + el.height! },
        { x: el.x!, y: el.y! + el.height! }
      );
    } else if (el.type === "text") {
      points.push({ x: el.x!, y: el.y! });
    } else if (el.type === "dimension") {
      points.push({ x: el.x1!, y: el.y1! }, { x: el.x2!, y: el.y2! });
    } else if ((el.type === "polyline" || el.type === "leader") && el.points?.length) {
      el.points.forEach((p: Point) => points.push(p));
    }
    for (const p of points) {
      const d = dist(pt, p);
      if (d < bestDist) { bestDist = d; best = { point: p, type: "endpoint" }; }
    }
  }
  return best;
}

function snapMidpoint(elements: DrawingElement[], pt: Point, threshold: number): SnapResult | null {
  let best: SnapResult | null = null;
  let bestDist = threshold;
  for (const el of elements) {
    let mp: Point | null = null;
    if (el.type === "line") {
      mp = midpoint({ x: el.x1!, y: el.y1! }, { x: el.x2!, y: el.y2! });
    } else if (el.type === "wall" && el.start && el.end) {
      mp = midpoint(el.start as Point, el.end as Point);
    } else if (el.type === "rectangle") {
      const pts = [
        midpoint({ x: el.x!, y: el.y! }, { x: el.x! + el.width!, y: el.y! }),
        midpoint({ x: el.x! + el.width!, y: el.y! }, { x: el.x! + el.width!, y: el.y! + el.height! }),
        midpoint({ x: el.x! + el.width!, y: el.y! + el.height! }, { x: el.x!, y: el.y! + el.height! }),
        midpoint({ x: el.x!, y: el.y! + el.height! }, { x: el.x!, y: el.y! }),
      ];
      for (const p of pts) {
        const d = dist(pt, p);
        if (d < bestDist) { bestDist = d; best = { point: p, type: "midpoint" }; }
      }
      continue;
    } else if ((el.type === "polyline" || el.type === "leader") && el.points && el.points.length > 1) {
      for (let i = 0; i < el.points.length - 1; i++) {
        const p = midpoint(el.points[i], el.points[i + 1]);
        const d = dist(pt, p);
        if (d < bestDist) { bestDist = d; best = { point: p, type: "midpoint" }; }
      }
      continue;
    }
    if (mp) {
      const d = dist(pt, mp);
      if (d < bestDist) { bestDist = d; best = { point: mp, type: "midpoint" }; }
    }
  }
  return best;
}

function snapCenter(elements: DrawingElement[], pt: Point, threshold: number): SnapResult | null {
  let best: SnapResult | null = null;
  let bestDist = threshold;
  for (const el of elements) {
    if ((el.type === "circle" || el.type === "arc") && el.cx != null && el.cy != null) {
      const cp = { x: el.cx!, y: el.cy! };
      const d = dist(pt, cp);
      if (d < bestDist) { bestDist = d; best = { point: cp, type: "center" }; }
    } else if (el.type === "rectangle") {
      const cp = { x: el.x! + el.width! / 2, y: el.y! + el.height! / 2 };
      const d = dist(pt, cp);
      if (d < bestDist) { bestDist = d; best = { point: cp, type: "center" }; }
    }
  }
  return best;
}

function snapGrid(pt: Point, gridSize: number, threshold: number): SnapResult | null {
  const gx = Math.round(pt.x / gridSize) * gridSize;
  const gy = Math.round(pt.y / gridSize) * gridSize;
  const d = dist(pt, { x: gx, y: gy });
  if (d < threshold) return { point: { x: gx, y: gy }, type: "grid" };
  return null;
}

function snapIntersection(elements: DrawingElement[], pt: Point, threshold: number): SnapResult | null {
  const lines = collectSegments(elements);
  let best: SnapResult | null = null;
  let bestDist = threshold;
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const a = lines[i], b = lines[j];
      const denom = (a.x1 - a.x2) * (b.y1 - b.y2) - (a.y1 - a.y2) * (b.x1 - b.x2);
      if (Math.abs(denom) < 1e-10) continue;
      const t = ((a.x1 - b.x1) * (b.y1 - b.y2) - (a.y1 - b.y1) * (b.x1 - b.x2)) / denom;
      const u = -((a.x1 - a.x2) * (a.y1 - b.y1) - (a.y1 - a.y2) * (a.x1 - b.x1)) / denom;
      if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
        const ip = { x: a.x1 + t * (a.x2 - a.x1), y: a.y1 + t * (a.y2 - a.y1) };
        const d = dist(pt, ip);
        if (d < bestDist) { bestDist = d; best = { point: ip, type: "intersection" }; }
      }
    }
  }
  return best;
}

function snapNearest(elements: DrawingElement[], pt: Point, threshold: number, wallSegments?: Segment[]): SnapResult | null {
  const segs = [...collectSegments(elements), ...(wallSegments ?? [])];
  let best: SnapResult | null = null;
  let bestDist = threshold;
  for (const seg of segs) {
    const proj = closestPointOnSegment(pt.x, pt.y, seg.x1, seg.y1, seg.x2, seg.y2);
    const d = dist(pt, proj);
    if (d < bestDist) { bestDist = d; best = { point: proj, type: "nearest" }; }
  }
  return best;
}

// ── New snap modes ──────────────────────────────────────────────────────────

function snapGeometricCenter(elements: DrawingElement[], pt: Point, threshold: number): SnapResult | null {
  let best: SnapResult | null = null;
  let bestDist = threshold;
  for (const el of elements) {
    let cp: Point | null = null;
    if (el.type === "rectangle") {
      cp = { x: el.x! + el.width! / 2, y: el.y! + el.height! / 2 };
    } else if (el.type === "circle") {
      cp = { x: el.cx!, y: el.cy! };
    } else if ((el.type === "polyline" || el.type === "hatch") && el.points && el.points.length >= 3) {
      let sx = 0, sy = 0;
      for (const p of el.points) { sx += p.x; sy += p.y; }
      cp = { x: sx / el.points.length, y: sy / el.points.length };
    }
    if (cp) {
      const d = dist(pt, cp);
      if (d < bestDist) { bestDist = d; best = { point: cp, type: "geometricCenter" }; }
    }
  }
  return best;
}

function snapNode(elements: DrawingElement[], pt: Point, threshold: number): SnapResult | null {
  let best: SnapResult | null = null;
  let bestDist = threshold;
  for (const el of elements) {
    if ((el.type === "block" || el.type === "point") && el.x != null && el.y != null) {
      const p: Point = { x: el.x!, y: el.y! };
      const d = dist(pt, p);
      if (d < bestDist) { bestDist = d; best = { point: p, type: "node" }; }
    }
  }
  return best;
}

function angleInArcRange(angleDeg: number, startDeg: number, endDeg: number): boolean {
  const norm = (a: number) => ((a % 360) + 360) % 360;
  const a = norm(angleDeg), s = norm(startDeg), e = norm(endDeg);
  return s <= e ? (a >= s && a <= e) : (a >= s || a <= e);
}

function snapQuadrant(elements: DrawingElement[], pt: Point, threshold: number): SnapResult | null {
  let best: SnapResult | null = null;
  let bestDist = threshold;
  for (const el of elements) {
    const candidates: Point[] = [];
    if (el.type === "circle" && el.cx != null && el.cy != null && el.radius != null) {
      const { cx, cy } = el as { cx: number; cy: number };
      const r = el.radius!;
      candidates.push(
        { x: cx + r, y: cy },
        { x: cx, y: cy - r },
        { x: cx - r, y: cy },
        { x: cx, y: cy + r }
      );
    } else if (el.type === "arc" && el.cx != null && el.cy != null && el.radius != null) {
      const cx = el.cx!, cy = el.cy!, r = el.radius!;
      const sa = (el as any).startAngle ?? 0;
      const ea = (el as any).endAngle ?? 360;
      for (const qa of [0, 90, 180, 270]) {
        if (angleInArcRange(qa, sa, ea)) {
          const rad = (qa * Math.PI) / 180;
          candidates.push({ x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) });
        }
      }
    } else if (el.type === "ellipse" && el.cx != null && el.cy != null) {
      const cx = el.cx!, cy = el.cy!;
      const rx: number = (el as any).rx ?? (el.width ? el.width / 2 : 0);
      const ry: number = (el as any).ry ?? (el.height ? el.height / 2 : 0);
      candidates.push(
        { x: cx + rx, y: cy },
        { x: cx, y: cy - ry },
        { x: cx - rx, y: cy },
        { x: cx, y: cy + ry }
      );
    }
    for (const p of candidates) {
      const d = dist(pt, p);
      if (d < bestDist) { bestDist = d; best = { point: p, type: "quadrant" }; }
    }
  }
  return best;
}

function snapPerpendicular(elements: DrawingElement[], pt: Point, threshold: number, startPoint: Point): SnapResult | null {
  let best: SnapResult | null = null;
  let bestDist = threshold;
  for (const seg of collectSegments(elements)) {
    const { point, t } = closestPointOnLine(startPoint.x, startPoint.y, seg.x1, seg.y1, seg.x2, seg.y2);
    if (t >= 0 && t <= 1) {
      const d = dist(pt, point);
      if (d < bestDist) { bestDist = d; best = { point, type: "perpendicular" }; }
    }
  }
  for (const el of elements) {
    if ((el.type === "circle" || el.type === "arc") && el.cx != null && el.cy != null && el.radius != null) {
      const cx = el.cx!, cy = el.cy!, r = el.radius!;
      const angle = Math.atan2(startPoint.y - cy, startPoint.x - cx);
      for (const sign of [1, -1] as const) {
        const p = { x: cx + sign * r * Math.cos(angle), y: cy + sign * r * Math.sin(angle) };
        const d = dist(pt, p);
        if (d < bestDist) { bestDist = d; best = { point: p, type: "perpendicular" }; }
      }
    }
  }
  return best;
}

function snapTangent(elements: DrawingElement[], pt: Point, threshold: number, startPoint: Point): SnapResult | null {
  let best: SnapResult | null = null;
  let bestDist = threshold;
  for (const el of elements) {
    if ((el.type === "circle" || el.type === "arc") && el.cx != null && el.cy != null && el.radius != null) {
      const cx = el.cx!, cy = el.cy!, r = el.radius!;
      const d = dist(startPoint, { x: cx, y: cy });
      if (d <= r + 1e-6) continue;
      // direction from center O toward startPoint P
      const phi = Math.atan2(startPoint.y - cy, startPoint.x - cx);
      const delta = Math.acos(Math.min(1, r / d));
      for (const sign of [1, -1] as const) {
        const p = { x: cx + r * Math.cos(phi + sign * delta), y: cy + r * Math.sin(phi + sign * delta) };
        const pd = dist(pt, p);
        if (pd < bestDist) { bestDist = pd; best = { point: p, type: "tangent" }; }
      }
    }
  }
  return best;
}

function snapInsertion(elements: DrawingElement[], pt: Point, threshold: number): SnapResult | null {
  let best: SnapResult | null = null;
  let bestDist = threshold;
  for (const el of elements) {
    if ((el.type === "text" || el.type === "block") && el.x != null && el.y != null) {
      const p: Point = { x: el.x!, y: el.y! };
      const d = dist(pt, p);
      if (d < bestDist) { bestDist = d; best = { point: p, type: "insertion" }; }
    }
  }
  return best;
}

function snapExtension(elements: DrawingElement[], pt: Point, threshold: number): SnapResult | null {
  let best: SnapResult | null = null;
  let bestDist = threshold;
  for (const seg of collectSegments(elements)) {
    const { point, t } = closestPointOnLine(pt.x, pt.y, seg.x1, seg.y1, seg.x2, seg.y2);
    if (t < -1e-6 || t > 1 + 1e-6) {
      const d = dist(pt, point);
      if (d < bestDist) { bestDist = d; best = { point, type: "extension" }; }
    }
  }
  return best;
}

function snapApparentIntersection(elements: DrawingElement[], pt: Point, threshold: number): SnapResult | null {
  const lines = collectSegments(elements);
  let best: SnapResult | null = null;
  let bestDist = threshold;
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const a = lines[i], b = lines[j];
      const denom = (a.x1 - a.x2) * (b.y1 - b.y2) - (a.y1 - a.y2) * (b.x1 - b.x2);
      if (Math.abs(denom) < 1e-10) continue;
      const t = ((a.x1 - b.x1) * (b.y1 - b.y2) - (a.y1 - b.y1) * (b.x1 - b.x2)) / denom;
      const ip = { x: a.x1 + t * (a.x2 - a.x1), y: a.y1 + t * (a.y2 - a.y1) };
      const d = dist(pt, ip);
      if (d < bestDist) { bestDist = d; best = { point: ip, type: "apparentIntersection" }; }
    }
  }
  return best;
}

// ── Visual indicators ───────────────────────────────────────────────────────

export function drawSnapIndicator(ctx: CanvasRenderingContext2D, point: Point, type: string): void {
  const size = 6;
  ctx.save();
  ctx.setLineDash([]);
  ctx.lineWidth = 1.5;

  switch (type) {
    case "endpoint":
      ctx.strokeStyle = "#22c55e";
      ctx.strokeRect(point.x - size / 2, point.y - size / 2, size, size);
      break;
    case "midpoint":
      ctx.strokeStyle = "#eab308";
      ctx.beginPath();
      ctx.moveTo(point.x, point.y - size / 2);
      ctx.lineTo(point.x + size / 2, point.y + size / 2);
      ctx.lineTo(point.x - size / 2, point.y + size / 2);
      ctx.closePath();
      ctx.stroke();
      break;
    case "center":
      ctx.strokeStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(point.x, point.y, size / 2, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case "grid":
      ctx.strokeStyle = "#6b7280";
      ctx.fillStyle = "#6b7280";
      ctx.beginPath();
      ctx.arc(point.x, point.y, 2, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "intersection":
      ctx.strokeStyle = "#a855f7";
      ctx.beginPath();
      ctx.moveTo(point.x - size / 2, point.y - size / 2);
      ctx.lineTo(point.x + size / 2, point.y + size / 2);
      ctx.moveTo(point.x + size / 2, point.y - size / 2);
      ctx.lineTo(point.x - size / 2, point.y + size / 2);
      ctx.stroke();
      break;
    case "nearest":
      ctx.strokeStyle = "#f97316";
      ctx.beginPath();
      ctx.moveTo(point.x - size / 2, point.y - size / 2);
      ctx.lineTo(point.x + size / 2, point.y + size / 2);
      ctx.moveTo(point.x + size / 2, point.y - size / 2);
      ctx.lineTo(point.x - size / 2, point.y + size / 2);
      ctx.stroke();
      break;
    case "geometricCenter":
      ctx.strokeStyle = "#22c55e";
      ctx.strokeRect(point.x - size / 2, point.y - size / 2, size, size);
      ctx.beginPath();
      ctx.moveTo(point.x - size / 3, point.y);
      ctx.lineTo(point.x + size / 3, point.y);
      ctx.moveTo(point.x, point.y - size / 3);
      ctx.lineTo(point.x, point.y + size / 3);
      ctx.stroke();
      break;
    case "node":
      ctx.strokeStyle = "#eab308";
      ctx.beginPath();
      ctx.arc(point.x, point.y, size / 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(point.x - size / 2, point.y - size / 2);
      ctx.lineTo(point.x + size / 2, point.y + size / 2);
      ctx.moveTo(point.x + size / 2, point.y - size / 2);
      ctx.lineTo(point.x - size / 2, point.y + size / 2);
      ctx.stroke();
      break;
    case "quadrant":
      ctx.strokeStyle = "#f97316";
      ctx.beginPath();
      ctx.moveTo(point.x, point.y - size / 2);
      ctx.lineTo(point.x + size / 2, point.y);
      ctx.lineTo(point.x, point.y + size / 2);
      ctx.lineTo(point.x - size / 2, point.y);
      ctx.closePath();
      ctx.stroke();
      break;
    case "perpendicular":
      ctx.strokeStyle = "#818cf8";
      ctx.beginPath();
      ctx.moveTo(point.x - size / 2, point.y - size / 2);
      ctx.lineTo(point.x - size / 2, point.y + size / 2);
      ctx.lineTo(point.x + size / 2, point.y + size / 2);
      ctx.stroke();
      ctx.strokeRect(point.x - size / 2, point.y, size / 3, size / 2);
      break;
    case "tangent":
      ctx.strokeStyle = "#fb923c";
      ctx.beginPath();
      ctx.arc(point.x, point.y, size / 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(point.x - size / 2, point.y - size / 2);
      ctx.lineTo(point.x + size / 2, point.y + size / 2);
      ctx.stroke();
      break;
    case "insertion":
      ctx.strokeStyle = "#34d399";
      ctx.beginPath();
      ctx.moveTo(point.x - size / 3, point.y - size / 3);
      ctx.lineTo(point.x + size / 3, point.y - size / 3);
      ctx.lineTo(point.x + size / 3, point.y + size / 3);
      ctx.lineTo(point.x - size / 3, point.y + size / 3);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(point.x, point.y - size / 2);
      ctx.lineTo(point.x, point.y + size / 2);
      ctx.moveTo(point.x - size / 2, point.y);
      ctx.lineTo(point.x + size / 2, point.y);
      ctx.stroke();
      break;
    case "extension":
      ctx.strokeStyle = "#94a3b8";
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(point.x - size / 2, point.y);
      ctx.lineTo(point.x + size / 2, point.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#94a3b8";
      ctx.beginPath();
      ctx.arc(point.x, point.y, 2, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "apparentIntersection":
      ctx.strokeStyle = "#f43f5e";
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(point.x - size / 2, point.y - size / 2);
      ctx.lineTo(point.x + size / 2, point.y + size / 2);
      ctx.moveTo(point.x + size / 2, point.y - size / 2);
      ctx.lineTo(point.x - size / 2, point.y + size / 2);
      ctx.stroke();
      ctx.setLineDash([]);
      break;
  }

  // Label drawn to the right of the indicator
  const labels: Record<string, string> = {
    endpoint: "End", midpoint: "Mid", center: "Cen", grid: "Grid",
    intersection: "Int", nearest: "Near", geometricCenter: "GCen",
    node: "Node", quadrant: "Quad", perpendicular: "Perp", tangent: "Tan",
    insertion: "Ins", extension: "Ext", apparentIntersection: "AppInt",
  };
  const label = labels[type];
  if (label) {
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 9px monospace";
    ctx.fillText(label, point.x + size / 2 + 2, point.y + 3);
  }

  ctx.restore();
}

// ── Main entry point ────────────────────────────────────────────────────────

export function findNearestSnap(
  elements: DrawingElement[],
  pt: Point,
  snapModes: SnapModes,
  threshold: number,
  gridSize: number,
  wallSegments?: Segment[],
  snapEnabled?: boolean,
  osnapEnabled?: boolean,
  startPoint?: Point | null
): SnapResult | null {
  let best: SnapResult | null = null;
  let bestDist = threshold;

  const checkSnap = (result: SnapResult | null) => {
    if (result) {
      const d = dist(pt, result.point);
      if (d < bestDist) { bestDist = d; best = result; }
    }
  };

  if (osnapEnabled !== false) {
    if (snapModes.endpoint)             checkSnap(snapEndpoint(elements, pt, threshold));
    if (snapModes.midpoint)             checkSnap(snapMidpoint(elements, pt, threshold));
    if (snapModes.center)               checkSnap(snapCenter(elements, pt, threshold));
    if (snapModes.intersection)         checkSnap(snapIntersection(elements, pt, threshold));
    if (snapModes.nearest)              checkSnap(snapNearest(elements, pt, threshold, wallSegments));
    if (snapModes.geometricCenter)      checkSnap(snapGeometricCenter(elements, pt, threshold));
    if (snapModes.node)                 checkSnap(snapNode(elements, pt, threshold));
    if (snapModes.quadrant)             checkSnap(snapQuadrant(elements, pt, threshold));
    if (snapModes.insertion)            checkSnap(snapInsertion(elements, pt, threshold));
    if (snapModes.extension)            checkSnap(snapExtension(elements, pt, threshold));
    if (snapModes.apparentIntersection) checkSnap(snapApparentIntersection(elements, pt, threshold));
    if (snapModes.perpendicular && startPoint) checkSnap(snapPerpendicular(elements, pt, threshold, startPoint));
    if (snapModes.tangent && startPoint)       checkSnap(snapTangent(elements, pt, threshold, startPoint));
  }
  if (snapEnabled !== false) {
    if (snapModes.grid)                 checkSnap(snapGrid(pt, gridSize, threshold));
  }

  return best;
}
