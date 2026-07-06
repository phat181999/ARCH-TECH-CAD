// Pure element-transform helpers for the 3D gizmo. All coords are 2D drawing
// space; patches are fed to drawingStore.updateElement / batch commits.
import type { DrawingElement, Point } from "../../../types";

export function elementAnchor(el: DrawingElement): { x: number; y: number } | null {
  if (el.type === "line" && el.x1 != null && el.x2 != null) {
    return { x: (el.x1 + el.x2) / 2, y: ((el.y1 ?? 0) + (el.y2 ?? 0)) / 2 };
  }
  if (el.cx != null && el.cy != null) return { x: el.cx, y: el.cy };
  if (el.x != null && el.width != null && el.height != null) {
    return { x: el.x + el.width / 2, y: (el.y ?? 0) + el.height / 2 };
  }
  if (el.x != null) return { x: el.x, y: el.y ?? 0 };
  if (Array.isArray(el.points) && el.points.length > 0) {
    const n = el.points.length;
    return {
      x: el.points.reduce((s, p) => s + p.x, 0) / n,
      y: el.points.reduce((s, p) => s + p.y, 0) / n,
    };
  }
  return null;
}

export function translatePatch(el: DrawingElement, dx: number, dy: number): Partial<DrawingElement> {
  const p: Partial<DrawingElement> = {};
  if (el.x1 != null) { p.x1 = el.x1 + dx; p.y1 = (el.y1 ?? 0) + dy; }
  if (el.x2 != null) { p.x2 = el.x2 + dx; p.y2 = (el.y2 ?? 0) + dy; }
  if (el.x != null) { p.x = el.x + dx; p.y = (el.y ?? 0) + dy; }
  if (el.cx != null) { p.cx = el.cx + dx; p.cy = (el.cy ?? 0) + dy; }
  if (Array.isArray(el.points)) p.points = el.points.map((pt) => ({ x: pt.x + dx, y: pt.y + dy }));
  return p;
}

function rotateAbout(pt: Point, pivot: Point, rad: number): Point {
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const dx = pt.x - pivot.x, dy = pt.y - pivot.y;
  return { x: pivot.x + dx * cos - dy * sin, y: pivot.y + dx * sin + dy * cos };
}

export function rotatePatch(el: DrawingElement, deltaDeg: number): Partial<DrawingElement> {
  // Elements whose renderers honor `rotation` rotate via the field.
  if (el.type === "block" || el.type === "rectangle" || el.type === "text") {
    return { rotation: (((el.rotation ?? 0) + deltaDeg) % 360 + 360) % 360 };
  }
  const anchor = elementAnchor(el);
  if (!anchor) return {};
  const rad = (deltaDeg * Math.PI) / 180;
  const p: Partial<DrawingElement> = {};
  if (el.x1 != null && el.x2 != null) {
    const a = rotateAbout({ x: el.x1, y: el.y1 ?? 0 }, anchor, rad);
    const b = rotateAbout({ x: el.x2, y: el.y2 ?? 0 }, anchor, rad);
    p.x1 = a.x; p.y1 = a.y; p.x2 = b.x; p.y2 = b.y;
  }
  if (Array.isArray(el.points)) p.points = el.points.map((pt) => rotateAbout(pt, anchor, rad));
  return p;
}

export function scalePatch(el: DrawingElement, factor: number): Partial<DrawingElement> {
  if (factor <= 0) return {};
  if (el.type === "block") return { scale: (el.scale ?? 1) * factor };
  if (el.type === "circle" && el.radius != null) return { radius: el.radius * factor };
  if (el.type === "rectangle" && el.x != null && el.width != null && el.height != null) {
    const cx = el.x + el.width / 2, cy = (el.y ?? 0) + el.height / 2;
    const w = el.width * factor, h = el.height * factor;
    return { x: cx - w / 2, y: cy - h / 2, width: w, height: h };
  }
  const anchor = elementAnchor(el);
  if (!anchor) return {};
  const p: Partial<DrawingElement> = {};
  if (el.x1 != null && el.x2 != null) {
    p.x1 = anchor.x + (el.x1 - anchor.x) * factor;
    p.y1 = anchor.y + ((el.y1 ?? 0) - anchor.y) * factor;
    p.x2 = anchor.x + (el.x2 - anchor.x) * factor;
    p.y2 = anchor.y + ((el.y2 ?? 0) - anchor.y) * factor;
  }
  if (Array.isArray(el.points)) {
    p.points = el.points.map((pt) => ({
      x: anchor.x + (pt.x - anchor.x) * factor,
      y: anchor.y + (pt.y - anchor.y) * factor,
    }));
  }
  return p;
}

export function duplicateElement(el: DrawingElement): DrawingElement {
  const copy: DrawingElement = JSON.parse(JSON.stringify(el));
  copy.id = `${el.type}-${Math.random().toString(36).slice(2, 10)}`;
  return copy;
}
