import type { DrawingElement, Point } from "../types";

/**
 * Minimal DXF import/export for 2D drafting.
 * Supports: LINE, LWPOLYLINE, CIRCLE, TEXT, DIMENSION (as LINE+TEXT).
 * Exports R12-compatible ASCII DXF.
 */

export function elementsToDxf(elements: DrawingElement[]): string {
  // Canvas Y goes down; DXF Y goes up. Flip Y on export for correct interoperability.
  let maxY = -Infinity, minY = Infinity;
  for (const el of elements) {
    const ys: number[] = [];
    if (el.type === "line") ys.push(el.y1 as number, el.y2 as number);
    else if (el.type === "circle" || el.type === "arc") { const r = (el.radius as number) || 0; ys.push((el.cy as number) + r, (el.cy as number) - r); }
    else if (typeof el.y === "number") ys.push(el.y);
    else if (el.type === "dimension") ys.push(el.y1 as number, el.y2 as number);
    ys.forEach(y => { if (isFinite(y)) { maxY = Math.max(maxY, y); minY = Math.min(minY, y); } });
  }
  const fy = (y: number) => isFinite(maxY) ? maxY - y + minY : y;

  const lines: string[] = [];
  lines.push("0", "SECTION", "2", "HEADER", "0", "ENDSEC");
  lines.push("0", "SECTION", "2", "TABLES");
  lines.push("0", "TABLE", "2", "LTYPE", "70", "1", "0", "LTYPE", "2", "CONTINUOUS", "70", "0", "0", "ENDTAB");
  lines.push("0", "TABLE", "2", "LAYER", "70", "1");
  const layerNames: string[] = [...new Set(elements.map((e: DrawingElement) => e.layerId || "0"))];
  layerNames.forEach((name, i) => {
    lines.push("0", "LAYER", "2", name, "70", "0", "62", "7", "6", "CONTINUOUS");
  });
  lines.push("0", "ENDTAB");
  lines.push("0", "TABLE", "2", "STYLE", "70", "0", "0", "ENDTAB");
  lines.push("0", "ENDSEC");

  lines.push("0", "SECTION", "2", "ENTITIES");
  elements.forEach((el: DrawingElement) => {
    const layer = el.layerId || "0";
    switch (el.type) {
      case "line":
        lines.push(
          "0", "LINE", "8", layer,
          "10", String(el.x1!), "20", String(fy(el.y1!)), "30", "0",
          "11", String(el.x2!), "21", String(fy(el.y2!)), "31", "0"
        );
        break;
      case "rectangle": {
        const rx = el.x!, ry = el.y!, rw = el.width!, rh = el.height!;
        lines.push(
          "0", "LWPOLYLINE", "8", layer, "70", "1", "90", "4",
          "10", String(rx),    "20", String(fy(ry)),
          "10", String(rx+rw), "20", String(fy(ry)),
          "10", String(rx+rw), "20", String(fy(ry+rh)),
          "10", String(rx),    "20", String(fy(ry+rh))
        );
        break;
      }
      case "circle":
        lines.push(
          "0", "CIRCLE", "8", layer,
          "10", String(el.cx!), "20", String(fy(el.cy!)), "30", "0",
          "40", String(el.radius)
        );
        break;
      case "arc":
        // Flip arc angles for Y-inversion
        lines.push(
          "0", "ARC", "8", layer,
          "10", String(el.cx!), "20", String(fy(el.cy!)), "30", "0",
          "40", String(el.radius),
          "50", String((360 - ((el.endAngle as number) ?? 360) + 360) % 360),
          "51", String((360 - ((el.startAngle as number) ?? 0) + 360) % 360)
        );
        break;
      case "text":
        lines.push(
          "0", "TEXT", "8", layer,
          "10", String(el.x!), "20", String(fy(el.y!)), "30", "0",
          "40", String(el.fontSize || 16),
          "1", el.text || "",
          "7", "STANDARD", "72", "0", "11", "0", "21", "0", "31", "0"
        );
        break;
      case "dimension": {
        lines.push(
          "0", "LINE", "8", layer,
          "10", String(el.x1!), "20", String(fy(el.y1!)), "30", "0",
          "11", String(el.x2!), "21", String(fy(el.y2!)), "31", "0"
        );
        const len = Math.round(Math.hypot(el.x2! - el.x1!, el.y2! - el.y1!));
        const midX = (el.x1! + el.x2!) / 2;
        const midY = (el.y1! + el.y2!) / 2;
        lines.push(
          "0", "TEXT", "8", layer,
          "10", String(midX), "20", String(fy(midY)), "30", "0",
          "40", "12", "1", String(len),
          "7", "STANDARD", "72", "1", "11", "0", "21", "0", "31", "0"
        );
        break;
      }
    }
  });
  lines.push("0", "ENDSEC", "0", "EOF");
  return lines.join("\r\n");
}

// DXF uses a right-handed coordinate system (Y up), Canvas uses Y down.
// After parsing, flip all Y coords by reflecting around the drawing's midpoint.
function flipYAxis(elements: DrawingElement[]): DrawingElement[] {
  let maxY = -Infinity;
  let minY = Infinity;
  for (const el of elements) {
    const collect = (y: number) => { if (isFinite(y)) { maxY = Math.max(maxY, y); minY = Math.min(minY, y); } };
    if (el.type === "line") { collect(el.y1 as number); collect(el.y2 as number); }
    else if (el.type === "circle" || el.type === "ellipse") { const r = (el.radius as number) || (el.ry as number) || 0; collect((el.cy as number) + r); collect((el.cy as number) - r); }
    else if (el.type === "arc") { collect((el.cy as number) + (el.radius as number || 0)); collect((el.cy as number) - (el.radius as number || 0)); }
    else if (typeof el.y === "number") collect(el.y);
    if (el.points) (el.points as Point[]).forEach(p => collect(p.y));
  }
  if (!isFinite(maxY)) return elements;

  const flip = (y: number) => maxY - y + minY;

  return elements.map(el => {
    if (el.type === "line") return { ...el, y1: flip(el.y1 as number), y2: flip(el.y2 as number) };
    if (el.type === "arc") {
      // Mirror arc angles: negate and adjust for Y-flip
      const sa = (el.startAngle as number) ?? 0;
      const ea = (el.endAngle as number) ?? 360;
      return { ...el, cy: flip(el.cy as number), startAngle: (360 - ea + 360) % 360, endAngle: (360 - sa + 360) % 360 };
    }
    if (el.type === "circle" || el.type === "ellipse") return { ...el, cy: flip(el.cy as number) };
    if (el.type === "text") return { ...el, y: flip(el.y as number) };
    if (el.points) return { ...el, points: (el.points as Point[]).map((p: Point) => ({ x: p.x, y: flip(p.y) })) };
    if (typeof el.y === "number") return { ...el, y: flip(el.y) };
    return el;
  });
}

export function dxfToElements(dxfText: string): DrawingElement[] {
  const elements: DrawingElement[] = [];
  const tokens = dxfText.split(/\r?\n/);
  let i = 0;

  function readPair(): { code: number; value: string } | null {
    if (i >= tokens.length) return null;
    const code = parseInt(tokens[i++], 10);
    const value = tokens[i++];
    if (isNaN(code)) return null;
    return { code, value };
  }

  function expectSection(name: string): boolean {
    while (i < tokens.length) {
      const pair = readPair();
      if (!pair) break;
      if (pair.code === 2 && pair.value === name) return true;
      if (pair.code === 0 && pair.value === "ENDSEC") break;
    }
    return false;
  }

  // Skip to ENTITIES section
  while (i < tokens.length) {
    const p = readPair();
    if (!p) break;
    if (p.code === 0 && p.value === "SECTION") {
      const p2 = readPair();
      if (p2 && p2.code === 2 && p2.value === "ENTITIES") break;
    }
  }

  let idCounter = 0;
  const genId = (): string => `dxf-${Date.now()}-${++idCounter}`;

  // Track vertex sequences for LWPOLYLINE and POLYLINE
  let pendingPolylineCoords: Point[] = [];
  let pendingPolylineLayer = "0";
  let pendingPolylineClosed = false;

  function flushPolyline() {
    if (pendingPolylineCoords.length < 2) { pendingPolylineCoords = []; return; }
    const coords = pendingPolylineClosed
      ? [...pendingPolylineCoords, { ...pendingPolylineCoords[0] }]
      : pendingPolylineCoords;
    for (let j = 0; j < coords.length - 1; j++) {
      elements.push({
        id: genId(), type: "line",
        x1: coords[j].x, y1: coords[j].y,
        x2: coords[j + 1].x, y2: coords[j + 1].y,
        strokeColor: "#1f2937", strokeWidth: 2,
        layerId: pendingPolylineLayer,
      });
    }
    pendingPolylineCoords = [];
    pendingPolylineClosed = false;
  }

  while (i < tokens.length) {
    const pair = readPair();
    if (!pair) break;
    if (pair.code === 0 && pair.value === "ENDSEC") break;
    if (pair.code !== 0) continue;

    const entityType = pair.value;
    const props: Record<string | number, string> = {};
    let layer = "0";
    // Accumulate repeating vertex coords during prop scan (fixes LWPOLYLINE parsing)
    const vertexCoords: Point[] = [];
    let lwFlags = 0;

    while (i < tokens.length) {
      const p = readPair();
      if (!p || p.code === 0) {
        if (p) i -= 2;
        break;
      }
      if (p.code === 8) layer = p.value;
      // Accumulate repeating 10/20 coord groups
      if (p.code === 10) vertexCoords.push({ x: parseFloat(p.value), y: 0 });
      if (p.code === 20 && vertexCoords.length > 0) vertexCoords[vertexCoords.length - 1].y = parseFloat(p.value);
      if (p.code === 70) lwFlags = parseInt(p.value) || 0;
      props[p.code] = p.value; // last value wins for unique codes
    }

    // Skip non-drawable entities
    const SKIP_ENTITIES = new Set(["VIEWPORT", "ATTDEF", "ATTRIB", "SHAPE", "SOLID", "TRACE", "REGION", "BODY", "3DSOLID", "IMAGE", "XLINE", "RAY", "ACAD_TABLE"]);
    if (SKIP_ENTITIES.has(entityType)) continue;

    switch (entityType) {
      case "LINE": {
        elements.push({
          id: genId(), type: "line",
          x1: parseFloat(props[10]) || 0, y1: parseFloat(props[20]) || 0,
          x2: parseFloat(props[11]) || 0, y2: parseFloat(props[21]) || 0,
          strokeColor: "#1f2937", strokeWidth: 2, layerId: layer,
        });
        break;
      }
      case "LWPOLYLINE": {
        // vertexCoords collected above during prop scan
        const closed = (lwFlags & 1) !== 0;
        const coords = closed && vertexCoords.length > 0
          ? [...vertexCoords, { ...vertexCoords[0] }]
          : vertexCoords;
        for (let j = 0; j < coords.length - 1; j++) {
          elements.push({
            id: genId(), type: "line",
            x1: coords[j].x, y1: coords[j].y,
            x2: coords[j + 1].x, y2: coords[j + 1].y,
            strokeColor: "#1f2937", strokeWidth: 2, layerId: layer,
          });
        }
        break;
      }
      case "POLYLINE": {
        // Old-style POLYLINE — vertices follow as VERTEX entities
        flushPolyline();
        pendingPolylineLayer = layer;
        pendingPolylineClosed = (lwFlags & 1) !== 0;
        break;
      }
      case "VERTEX": {
        const vx = parseFloat(props[10]) || 0;
        const vy = parseFloat(props[20]) || 0;
        pendingPolylineCoords.push({ x: vx, y: vy });
        break;
      }
      case "SEQEND": {
        flushPolyline();
        break;
      }
      case "ARC": {
        const cx = parseFloat(props[10]) || 0;
        const cy = parseFloat(props[20]) || 0;
        const radius = parseFloat(props[40]) || 0;
        const startAngle = parseFloat(props[50]) || 0;
        const endAngle = parseFloat(props[51]) || 360;
        elements.push({
          id: genId(), type: "arc",
          cx, cy, radius,
          startAngle, endAngle,
          strokeColor: "#1f2937", strokeWidth: 2,
          fillColor: "transparent", layerId: layer,
        });
        break;
      }
      case "CIRCLE": {
        elements.push({
          id: genId(), type: "circle",
          cx: parseFloat(props[10]) || 0,
          cy: parseFloat(props[20]) || 0,
          radius: parseFloat(props[40]) || 0,
          strokeColor: "#1f2937", strokeWidth: 2,
          fillColor: "transparent", layerId: layer,
        });
        break;
      }
      case "ELLIPSE": {
        // props: center(10,20), major axis endpoint relative(11,21), ratio(40)
        const cx = parseFloat(props[10]) || 0;
        const cy = parseFloat(props[20]) || 0;
        const rx = Math.hypot(parseFloat(props[11]) || 50, parseFloat(props[21]) || 0);
        const ratio = parseFloat(props[40]) || 1;
        elements.push({
          id: genId(), type: "ellipse",
          cx, cy, rx, ry: rx * ratio,
          strokeColor: "#1f2937", strokeWidth: 2,
          fillColor: "transparent", layerId: layer,
        });
        break;
      }
      case "SPLINE": {
        // Approximate SPLINE as a polyline through fit/control points
        if (vertexCoords.length >= 2) {
          for (let j = 0; j < vertexCoords.length - 1; j++) {
            elements.push({
              id: genId(), type: "line",
              x1: vertexCoords[j].x, y1: vertexCoords[j].y,
              x2: vertexCoords[j + 1].x, y2: vertexCoords[j + 1].y,
              strokeColor: "#1f2937", strokeWidth: 2, layerId: layer,
            });
          }
        }
        break;
      }
      case "TEXT": {
        elements.push({
          id: genId(), type: "text",
          x: parseFloat(props[10]) || 0,
          y: parseFloat(props[20]) || 0,
          text: props[1] || "",
          fontSize: parseFloat(props[40]) || 16,
          strokeColor: "#1f2937", layerId: layer,
        });
        break;
      }
      case "MTEXT": {
        // Strip RTF control codes like \P \pxq \fArial;
        const raw = props[1] || "";
        const text = raw.replace(/\\[A-Za-z0-9;]+/g, "").replace(/[{}]/g, "").trim();
        if (text) {
          elements.push({
            id: genId(), type: "text",
            x: parseFloat(props[10]) || 0,
            y: parseFloat(props[20]) || 0,
            text,
            fontSize: parseFloat(props[40]) || 16,
            strokeColor: "#1f2937", layerId: layer,
          });
        }
        break;
      }
      case "INSERT": {
        // Block reference — represent as a placeholder text marker
        const blockName = props[2] || "";
        if (blockName) {
          elements.push({
            id: genId(), type: "text",
            x: parseFloat(props[10]) || 0,
            y: parseFloat(props[20]) || 0,
            text: `[${blockName}]`,
            fontSize: 10,
            strokeColor: "#64748b", layerId: layer,
          });
        }
        break;
      }
    }
  }

  // Flush any trailing polyline
  flushPolyline();

  return flipYAxis(elements);
}