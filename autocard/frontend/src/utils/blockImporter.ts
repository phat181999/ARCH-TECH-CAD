import type { BlockDef, DrawingElement, Point } from "../types";
import { dxfToElements } from "../canvas/dxf";

function centroid(elements: DrawingElement[]): Point {
  let sx = 0, sy = 0, n = 0;
  for (const el of elements) {
    if (el.type === "rectangle" && el.x !== undefined && el.y !== undefined) {
      sx += el.x + (el.width ?? 0) / 2; sy += el.y + (el.height ?? 0) / 2; n++;
    } else if (el.type === "circle" && el.cx !== undefined && el.cy !== undefined) {
      sx += el.cx; sy += el.cy; n++;
    } else if (el.type === "line" && el.x1 !== undefined && el.y1 !== undefined) {
      sx += ((el.x1) + (el.x2 ?? el.x1)) / 2;
      sy += ((el.y1) + (el.y2 ?? el.y1)) / 2;
      n++;
    } else if ((el.type === "polyline" || el.type === "spline") && el.points?.length) {
      const xs = el.points.map((p) => p.x), ys = el.points.map((p) => p.y);
      sx += (Math.min(...xs) + Math.max(...xs)) / 2;
      sy += (Math.min(...ys) + Math.max(...ys)) / 2;
      n++;
    }
  }
  return n > 0 ? { x: sx / n, y: sy / n } : { x: 0, y: 0 };
}

/**
 * Parse an ARCH-TECH-CAD JSON drawing export into a BlockDef.
 * Accepts either a raw elements array or a full drawing export { elements: [...] }.
 */
export function importBlockFromJson(json: string): BlockDef | null {
  try {
    const parsed = JSON.parse(json);
    const elements: DrawingElement[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.elements)
      ? parsed.elements
      : null;
    if (!elements || elements.length === 0) return null;
    const id = `imported-${Date.now()}`;
    return { id, name: "Imported Block", elements, insertionPoint: centroid(elements) };
  } catch {
    return null;
  }
}

/**
 * Parse an SVG file's primitives (rect, circle, line, polyline, polygon)
 * into a BlockDef scaled to a ~100-unit coordinate space.
 */
export function importBlockFromSVG(svgString: string): BlockDef | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, "image/svg+xml");
    if (doc.querySelector("parsererror")) return null;
    const svgEl = doc.querySelector("svg");
    if (!svgEl) return null;

    const vbParts = (svgEl.getAttribute("viewBox") ?? "0 0 100 100")
      .split(/[\s,]+/)
      .map(Number);
    const [ox, oy, vw, vh] = vbParts.length >= 4 ? vbParts : [0, 0, 100, 100];
    const scale = 100 / Math.max(vw, vh, 1);

    const elements: DrawingElement[] = [];
    let seq = 0;
    const genId = () => `svg-${Date.now()}-${seq++}`;

    doc.querySelectorAll("rect").forEach((r) => {
      const x = (parseFloat(r.getAttribute("x") ?? "0") - ox) * scale;
      const y = (parseFloat(r.getAttribute("y") ?? "0") - oy) * scale;
      const w = parseFloat(r.getAttribute("width") ?? "0") * scale;
      const h = parseFloat(r.getAttribute("height") ?? "0") * scale;
      if (w > 0 && h > 0) {
        elements.push({
          id: genId(), type: "rectangle", x, y, width: w, height: h,
          layerId: "0",
          strokeColor: r.getAttribute("stroke") ?? "#111827",
          strokeWidth: 1,
        });
      }
    });

    doc.querySelectorAll("circle").forEach((c) => {
      const cx = (parseFloat(c.getAttribute("cx") ?? "0") - ox) * scale;
      const cy = (parseFloat(c.getAttribute("cy") ?? "0") - oy) * scale;
      const radius = parseFloat(c.getAttribute("r") ?? "0") * scale;
      if (radius > 0) {
        elements.push({
          id: genId(), type: "circle", cx, cy, radius,
          layerId: "0",
          strokeColor: c.getAttribute("stroke") ?? "#111827",
          strokeWidth: 1,
        });
      }
    });

    doc.querySelectorAll("line").forEach((l) => {
      elements.push({
        id: genId(), type: "line",
        x1: (parseFloat(l.getAttribute("x1") ?? "0") - ox) * scale,
        y1: (parseFloat(l.getAttribute("y1") ?? "0") - oy) * scale,
        x2: (parseFloat(l.getAttribute("x2") ?? "0") - ox) * scale,
        y2: (parseFloat(l.getAttribute("y2") ?? "0") - oy) * scale,
        layerId: "0",
        strokeColor: l.getAttribute("stroke") ?? "#111827",
        strokeWidth: 1,
      });
    });

    doc.querySelectorAll("polyline, polygon").forEach((p) => {
      const raw = (p.getAttribute("points") ?? "").trim().split(/[\s,]+/).map(Number);
      if (raw.length < 4) return;
      const points: Point[] = [];
      for (let i = 0; i + 1 < raw.length; i += 2) {
        points.push({ x: (raw[i] - ox) * scale, y: (raw[i + 1] - oy) * scale });
      }
      elements.push({
        id: genId(), type: "polyline", points,
        layerId: "0",
        strokeColor: p.getAttribute("stroke") ?? "#111827",
        strokeWidth: 1,
      });
    });

    if (elements.length === 0) return null;
    const id = `imported-${Date.now()}`;
    return { id, name: "SVG Block", elements, insertionPoint: centroid(elements) };
  } catch {
    return null;
  }
}

/**
 * dasd
 * Parse a DXF file into a BlockDef using the existing canvas/dxf parser.
 */
export function importBlockFromDXF(dxfString: string): BlockDef | null {
  try {
    const elements = dxfToElements(dxfString);
    if (!elements || elements.length === 0) return null;
    const id = `imported-${Date.now()}`;
    return { id, name: "DXF Block", elements, insertionPoint: centroid(elements) };
  } catch {
    return null;
  }
}

export function importBlockFromFile(file: File): Promise<BlockDef | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return resolve(null);
      const name = file.name.toLowerCase();
      if (name.endsWith(".json")) return resolve(importBlockFromJson(text));
      if (name.endsWith(".svg")) return resolve(importBlockFromSVG(text));
      if (name.endsWith(".dxf")) return resolve(importBlockFromDXF(text));
      resolve(null);
    };
    reader.onerror = () => resolve(null);
    reader.readAsText(file);
  });
}
