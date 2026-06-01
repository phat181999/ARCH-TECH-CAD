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
