import type { DrawingElement, Point } from "../types";

function rotatePoint(pt: Point, pivot: Point, angleRad: number): Point {
  const cos = Math.cos(angleRad), sin = Math.sin(angleRad);
  const dx = pt.x - pivot.x, dy = pt.y - pivot.y;
  return { x: pivot.x + dx * cos - dy * sin, y: pivot.y + dx * sin + dy * cos };
}

export function computeGrips(el: DrawingElement): Point[] {
  switch (el.type) {
    case "line":
      return [
        { x: el.x1!, y: el.y1! },
        { x: (el.x1! + el.x2!) / 2, y: (el.y1! + el.y2!) / 2 },
        { x: el.x2!, y: el.y2! },
      ];
    case "circle":
      return [
        { x: el.cx!, y: el.cy! },
        { x: el.cx!, y: el.cy! - el.radius! },
        { x: el.cx! + el.radius!, y: el.cy! },
        { x: el.cx!, y: el.cy! + el.radius! },
        { x: el.cx! - el.radius!, y: el.cy! },
      ];
    case "arc": {
      const sa = (((el.startAngle as number) || 0) * Math.PI) / 180;
      const ea = (((el.endAngle as number) || 180) * Math.PI) / 180;
      return [
        { x: el.cx!, y: el.cy! },
        { x: el.cx! + el.radius! * Math.cos(sa), y: el.cy! + el.radius! * Math.sin(sa) },
        { x: el.cx! + el.radius! * Math.cos(ea), y: el.cy! + el.radius! * Math.sin(ea) },
      ];
    }
    case "rectangle": {
      const x = el.x!, y = el.y!, w = el.width!, h = el.height!;
      const r = el.rotation || 0;
      const pts = [
        { x, y }, { x: x + w / 2, y }, { x: x + w, y },
        { x: x + w, y: y + h / 2 },
        { x: x + w, y: y + h }, { x: x + w / 2, y: y + h }, { x, y: y + h },
        { x, y: y + h / 2 },
      ];
      if (r !== 0) {
        const rad = r * Math.PI / 180;
        const pivot = { x, y };
        return pts.map(pt => rotatePoint(pt, pivot, rad));
      }
      return pts;
    }
    case "ellipse": {
      const rx = (el as any).rx || 50, ry = (el as any).ry || 30;
      const r = el.rotation || 0;
      const pts = [
        { x: el.cx!, y: el.cy! },
        { x: el.cx!, y: el.cy! - ry },
        { x: el.cx! + rx, y: el.cy! },
        { x: el.cx!, y: el.cy! + ry },
        { x: el.cx! - rx, y: el.cy! },
      ];
      if (r !== 0) {
        const rad = r * Math.PI / 180;
        const pivot = { x: el.cx!, y: el.cy! };
        return pts.map(pt => rotatePoint(pt, pivot, rad));
      }
      return pts;
    }
    case "wall": {
      const s = (el as any).start, e2 = (el as any).end;
      if (!s || !e2) return [];
      return [
        { x: s.x, y: s.y },
        { x: (s.x + e2.x) / 2, y: (s.y + e2.y) / 2 },
        { x: e2.x, y: e2.y },
      ];
    }
    case "dimension":
      return [
        { x: el.x1!, y: el.y1! },
        { x: (el.x1! + el.x2!) / 2, y: (el.y1! + el.y2!) / 2 },
        { x: el.x2!, y: el.y2! },
      ];
    case "text":
    case "block":
      return [{ x: el.x!, y: el.y! }];
    case "polyline":
    case "hatch":
    case "leader":
      return (el.points || []).map((p: Point) => ({ x: p.x, y: p.y }));
    default:
      return [];
  }
}

export function applyGripDrag(el: DrawingElement, gripIndex: number, pt: Point): Partial<DrawingElement> {
  switch (el.type) {
    case "line":
      if (gripIndex === 0) return { x1: pt.x, y1: pt.y };
      if (gripIndex === 1) {
        const dx = pt.x - (el.x1! + el.x2!) / 2, dy = pt.y - (el.y1! + el.y2!) / 2;
        return { x1: el.x1! + dx, y1: el.y1! + dy, x2: el.x2! + dx, y2: el.y2! + dy };
      }
      return { x2: pt.x, y2: pt.y };
    case "circle":
      if (gripIndex === 0) return { cx: pt.x, cy: pt.y };
      return { radius: Math.hypot(pt.x - el.cx!, pt.y - el.cy!) };
    case "arc":
      if (gripIndex === 0) return { cx: pt.x, cy: pt.y };
      if (gripIndex === 1) return { startAngle: Math.atan2(pt.y - el.cy!, pt.x - el.cx!) * 180 / Math.PI };
      return { endAngle: Math.atan2(pt.y - el.cy!, pt.x - el.cx!) * 180 / Math.PI };
    case "rectangle": {
      const x = el.x!, y = el.y!, w = el.width!, h = el.height!;
      if (gripIndex === 0) return { x: pt.x, y: pt.y, width: Math.max(1, w + x - pt.x), height: Math.max(1, h + y - pt.y) };
      if (gripIndex === 1) return { y: pt.y, height: Math.max(1, h + y - pt.y) };
      if (gripIndex === 2) return { y: pt.y, width: Math.max(1, pt.x - x), height: Math.max(1, h + y - pt.y) };
      if (gripIndex === 3) return { width: Math.max(1, pt.x - x) };
      if (gripIndex === 4) return { width: Math.max(1, pt.x - x), height: Math.max(1, pt.y - y) };
      if (gripIndex === 5) return { height: Math.max(1, pt.y - y) };
      if (gripIndex === 6) return { x: pt.x, width: Math.max(1, w + x - pt.x), height: Math.max(1, pt.y - y) };
      if (gripIndex === 7) return { x: pt.x, width: Math.max(1, w + x - pt.x) };
      return {};
    }
    case "ellipse": {
      if (gripIndex === 0) return { cx: pt.x, cy: pt.y };
      if (gripIndex === 1 || gripIndex === 3) return { ry: Math.abs(pt.y - el.cy!) } as any;
      return { rx: Math.abs(pt.x - el.cx!) } as any;
    }
    case "wall": {
      const s = (el as any).start, e2 = (el as any).end;
      if (gripIndex === 0) return { start: { x: pt.x, y: pt.y } } as any;
      if (gripIndex === 1) {
        const dx = pt.x - (s.x + e2.x) / 2, dy = pt.y - (s.y + e2.y) / 2;
        return { start: { x: s.x + dx, y: s.y + dy }, end: { x: e2.x + dx, y: e2.y + dy } } as any;
      }
      return { end: { x: pt.x, y: pt.y } } as any;
    }
    case "dimension":
      if (gripIndex === 0) return { x1: pt.x, y1: pt.y };
      if (gripIndex === 1) {
        const dx = pt.x - (el.x1! + el.x2!) / 2, dy = pt.y - (el.y1! + el.y2!) / 2;
        return { x1: el.x1! + dx, y1: el.y1! + dy, x2: el.x2! + dx, y2: el.y2! + dy };
      }
      return { x2: pt.x, y2: pt.y };
    case "text":
    case "block":
      return { x: pt.x, y: pt.y };
    case "polyline":
    case "hatch":
    case "leader": {
      const pts = [...(el.points || [])];
      if (gripIndex < pts.length) pts[gripIndex] = { x: pt.x, y: pt.y };
      return { points: pts };
    }
    default:
      return {};
  }
}
