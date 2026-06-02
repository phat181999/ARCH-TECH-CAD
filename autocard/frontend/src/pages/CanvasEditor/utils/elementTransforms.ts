import { DrawingElement, Point } from "../../../types";

export function rotatePt(pt: Point, pivot: Point, angle: number): Point {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const dx = pt.x - pivot.x, dy = pt.y - pivot.y;
  return { x: pivot.x + dx * cos - dy * sin, y: pivot.y + dx * sin + dy * cos };
}

export function scalePtFn(pt: Point, pivot: Point, factor: number): Point {
  return { x: pivot.x + (pt.x - pivot.x) * factor, y: pivot.y + (pt.y - pivot.y) * factor };
}

export function getSelectionCentroid(elems: DrawingElement[], ids: string[]): Point {
  const sel = elems.filter(e => ids.includes(e.id));
  if (sel.length === 0) return { x: 0, y: 0 };
  let x = 0, y = 0, count = 0;
  sel.forEach(el => {
    if (el.type === "line" && el.x1 !== undefined) { x += (el.x1 + (el.x2 || 0)) / 2; y += ((el.y1 || 0) + (el.y2 || 0)) / 2; count++; }
    else if (el.type === "circle" || el.type === "arc" || el.type === "ellipse") { x += el.cx || 0; y += el.cy || 0; count++; }
    else if ((el.type === "rectangle" || el.type === "text") && el.x !== undefined) { x += (el.x || 0) + (el.width || 0) / 2; y += (el.y || 0) + (el.height || 0) / 2; count++; }
    else if (el.type === "wall") { const s = (el as any).start, e2 = (el as any).end; if (s && e2) { x += (s.x + e2.x) / 2; y += (s.y + e2.y) / 2; count++; } }
    else if ((el.type === "polyline" || el.type === "leader" || el.type === "hatch") && el.points?.length) {
      x += el.points.reduce((s: number, p: Point) => s + p.x, 0) / el.points.length;
      y += el.points.reduce((s: number, p: Point) => s + p.y, 0) / el.points.length;
      count++;
    }
  });
  return count > 0 ? { x: x / count, y: y / count } : { x: 0, y: 0 };
}

export function applyElementRotation(el: DrawingElement, pivot: Point, angle: number): Partial<DrawingElement> {
  if (el.type === "line") {
    const p1 = rotatePt({ x: el.x1!, y: el.y1! }, pivot, angle);
    const p2 = rotatePt({ x: el.x2!, y: el.y2! }, pivot, angle);
    return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
  } else if (el.type === "circle") {
    const c = rotatePt({ x: el.cx!, y: el.cy! }, pivot, angle);
    return { cx: c.x, cy: c.y };
  } else if (el.type === "arc") {
    const c = rotatePt({ x: el.cx!, y: el.cy! }, pivot, angle);
    const deg = (angle * 180) / Math.PI;
    return {
      cx: c.x,
      cy: c.y,
      startAngle: ((el.startAngle as number) || 0) + deg,
      endAngle: ((el.endAngle as number) || 0) + deg
    };
  } else if (el.type === "ellipse") {
    const c = rotatePt({ x: el.cx!, y: el.cy! }, pivot, angle);
    const deg = (angle * 180) / Math.PI;
    return {
      cx: c.x,
      cy: c.y,
      rotation: ((el.rotation as number) || 0) + deg
    };
  } else if (el.type === "rectangle") {
    const p = rotatePt({ x: el.x!, y: el.y! }, pivot, angle);
    return { x: p.x, y: p.y, rotation: ((el.rotation as number) || 0) + (angle * 180 / Math.PI) };
  } else if (el.type === "polyline") {
    return { points: (el.points || []).map((pt: Point) => rotatePt(pt, pivot, angle)) };
  } else if (el.type === "wall") {
    const s = (el as any).start, e2 = (el as any).end;
    return { start: rotatePt(s, pivot, angle), end: rotatePt(e2, pivot, angle) } as any;
  } else if (el.type === "text" || el.type === "block") {
    const p = rotatePt({ x: el.x!, y: el.y! }, pivot, angle);
    return { x: p.x, y: p.y, rotation: ((el.rotation as number) || 0) + (angle * 180 / Math.PI) };
  } else if (el.type === "dimension" || el.type === "leader") {
    if (el.x1 !== undefined) {
      const p1 = rotatePt({ x: el.x1!, y: el.y1! }, pivot, angle);
      const p2 = rotatePt({ x: el.x2!, y: el.y2! }, pivot, angle);
      return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
    }
    return { points: (el.points || []).map((pt: Point) => rotatePt(pt, pivot, angle)) };
  }
  return {};
}

export function applyElementScale(el: DrawingElement, pivot: Point, factor: number): Partial<DrawingElement> {
  if (el.type === "line") {
    const p1 = scalePtFn({ x: el.x1!, y: el.y1! }, pivot, factor);
    const p2 = scalePtFn({ x: el.x2!, y: el.y2! }, pivot, factor);
    return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
  } else if (el.type === "circle" || el.type === "arc" || el.type === "ellipse") {
    const c = scalePtFn({ x: el.cx!, y: el.cy! }, pivot, factor);
    return { cx: c.x, cy: c.y, radius: (el.radius || 0) * factor, rx: ((el as any).rx || 0) * factor, ry: ((el as any).ry || 0) * factor };
  } else if (el.type === "rectangle") {
    const p = scalePtFn({ x: el.x!, y: el.y! }, pivot, factor);
    return { x: p.x, y: p.y, width: (el.width || 0) * factor, height: (el.height || 0) * factor };
  } else if (el.type === "polyline") {
    return { points: (el.points || []).map((pt: Point) => scalePtFn(pt, pivot, factor)) };
  } else if (el.type === "wall") {
    const s = (el as any).start, e2 = (el as any).end;
    return { start: scalePtFn(s, pivot, factor), end: scalePtFn(e2, pivot, factor) } as any;
  } else if (el.type === "text") {
    const p = scalePtFn({ x: el.x!, y: el.y! }, pivot, factor);
    return { x: p.x, y: p.y, fontSize: (el.fontSize || 16) * factor };
  }
  return {};
}

export function offsetElement(el: DrawingElement, dx: number, dy: number): DrawingElement {
  if (el.type === "line") return { ...el, x1: el.x1! + dx, y1: el.y1! + dy, x2: el.x2! + dx, y2: el.y2! + dy };
  if (el.type === "circle" || el.type === "arc" || el.type === "ellipse") return { ...el, cx: el.cx! + dx, cy: el.cy! + dy };
  if (el.type === "rectangle" || el.type === "text") return { ...el, x: el.x! + dx, y: el.y! + dy };
  if (el.type === "wall") { const s = (el as any).start, e2 = (el as any).end; return { ...el, start: { x: s.x + dx, y: s.y + dy }, end: { x: e2.x + dx, y: e2.y + dy } } as any; }
  if (el.type === "polyline" || el.type === "leader" || el.type === "hatch") return { ...el, points: (el.points || []).map((p: Point) => ({ x: p.x + dx, y: p.y + dy })) };
  if (el.type === "dimension") return { ...el, x1: el.x1! + dx, y1: el.y1! + dy, x2: el.x2! + dx, y2: el.y2! + dy };
  return { ...el };
}

const _genLocalId = () => `el-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function breakElement(el: DrawingElement, p1: Point, p2: Point): DrawingElement[] | null {
  if (el.type === "line" && typeof el.x1 === "number" && typeof el.y1 === "number" &&
      typeof el.x2 === "number" && typeof el.y2 === "number") {
    const dx = el.x2 - el.x1, dy = el.y2 - el.y1, len2 = dx * dx + dy * dy;
    if (len2 < 1) return null;
    const t1 = Math.max(0, Math.min(1, ((p1.x - el.x1) * dx + (p1.y - el.y1) * dy) / len2));
    const t2 = Math.max(0, Math.min(1, ((p2.x - el.x1) * dx + (p2.y - el.y1) * dy) / len2));
    const tMin = Math.min(t1, t2), tMax = Math.max(t1, t2);
    if (tMax - tMin < 0.01) return null;
    const bx1 = el.x1 + tMin * dx, by1 = el.y1 + tMin * dy;
    const bx2 = el.x1 + tMax * dx, by2 = el.y1 + tMax * dy;
    const base = { strokeColor: el.strokeColor, strokeWidth: el.strokeWidth, layerId: el.layerId };
    const pieces: DrawingElement[] = [];
    if (tMin > 0.01) pieces.push({ ...base, id: _genLocalId(), type: "line", x1: el.x1, y1: el.y1, x2: bx1, y2: by1 });
    if (tMax < 0.99) pieces.push({ ...base, id: _genLocalId(), type: "line", x1: bx2, y1: by2, x2: el.x2, y2: el.y2 });
    return pieces.length > 0 ? pieces : null;
  }
  return null;
}

export function createRectangularArray(elements: DrawingElement[], rows: number, cols: number, dx: number, dy: number): DrawingElement[] {
  const result: DrawingElement[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (r === 0 && c === 0) continue;
      elements.forEach(el => {
        result.push(offsetElement({ ...el, id: _genLocalId() }, c * dx, r * dy));
      });
    }
  }
  return result;
}

export function createPolarArray(elements: DrawingElement[], count: number, cx: number, cy: number): DrawingElement[] {
  const result: DrawingElement[] = [];
  const pivot: Point = { x: cx, y: cy };
  for (let i = 1; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    elements.forEach(el => {
      result.push(applyElementRotation({ ...el, id: _genLocalId() }, pivot, angle) as DrawingElement);
    });
  }
  return result;
}
