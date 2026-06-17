import type { DrawingElement, Point } from "../types";
import { insUnitsToUnit, type DxfUnit } from "./dxf.units";
import { inferArchTypeFromLayer } from "./3d/geometry/planClassification";
import { convertVniToUnicode, detectVniEncoding } from "./vniConverter";

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

// Scans the DXF HEADER section for the $INSUNITS variable and maps it to a
// DxfUnit. Returns null when the file has no usable units declaration.
export function parseDxfInsUnits(dxfText: string): DxfUnit | null {
  const tokens = dxfText.split(/\r?\n/);
  for (let i = 0; i + 3 < tokens.length; i++) {
    // $INSUNITS appears as: 9 / $INSUNITS  then  70 / <code>
    if (tokens[i].trim() === "9" && tokens[i + 1].trim() === "$INSUNITS") {
      const code = parseInt(tokens[i + 3], 10);
      if (!Number.isNaN(code)) return insUnitsToUnit(code);
      return null;
    }
    // Stop once we leave the header into entities (cheap early-out).
    if (tokens[i].trim() === "2" && tokens[i + 1].trim() === "ENTITIES") break;
  }
  return null;
}

export interface DxfLayerInfo {
  layerId: string;
  count: number;
  autoType: "wall" | "door" | "window" | "slab" | "ignore";
}

// Groups parsed elements by layer with a per-layer auto-classification, reusing
// the same AIA/NCS inference the 3D viewer uses.
export function summarizeDxfLayers(elements: DrawingElement[]): DxfLayerInfo[] {
  const map = new Map<string, number>();
  for (const el of elements) {
    const id = el.layerId || "0";
    map.set(id, (map.get(id) || 0) + 1);
  }
  const out: DxfLayerInfo[] = [];
  for (const [layerId, count] of map) {
    const inferred = inferArchTypeFromLayer(layerId);
    let autoType: DxfLayerInfo["autoType"];
    if (inferred === "wall") autoType = "wall";
    else if (inferred === "door") autoType = "door";
    else if (inferred === "window") autoType = "window";
    else if (inferred === "floor") autoType = "slab";
    else if (inferred === "skip") autoType = "ignore";
    else autoType = "wall"; // unknown layer with geometry defaults to wall (matches layerClassify)
    out.push({ layerId, count, autoType });
  }
  return out.sort((a, b) => b.count - a.count);
}

// Returns a new array with every coordinate field multiplied by `factor`.
// Does not mutate the input. Used to normalize imported DXF to millimetres.
export function scaleElements(elements: DrawingElement[], factor: number): DrawingElement[] {
  if (factor === 1) return elements;
  const s = (v: number | undefined) => (typeof v === "number" ? v * factor : v);
  return elements.map((el) => {
    const next: DrawingElement = { ...el };
    if (typeof next.x1 === "number") next.x1 = next.x1 * factor;
    if (typeof next.y1 === "number") next.y1 = next.y1 * factor;
    if (typeof next.x2 === "number") next.x2 = next.x2 * factor;
    if (typeof next.y2 === "number") next.y2 = next.y2 * factor;
    if (typeof next.x === "number") next.x = next.x * factor;
    if (typeof next.y === "number") next.y = next.y * factor;
    if (typeof next.cx === "number") next.cx = next.cx * factor;
    if (typeof next.cy === "number") next.cy = next.cy * factor;
    if (typeof next.radius === "number") next.radius = next.radius * factor;
    if (typeof next.width === "number") next.width = next.width * factor;
    if (typeof next.height === "number") next.height = next.height * factor;
    if (typeof next.rx === "number") next.rx = next.rx * factor;
    if (typeof next.ry === "number") next.ry = next.ry * factor;
    if (Array.isArray(next.points)) next.points = next.points.map((p) => ({ x: s(p.x)!, y: s(p.y)! }));
    return next;
  });
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
  const tokens = dxfText.split(/\r?\n/);
  let i = 0;
  let idCounter = 0;

  function readPair(): { code: number; value: string } | null {
    if (i >= tokens.length) return null;
    const code = parseInt(tokens[i++], 10);
    const value = (tokens[i++] ?? "").trim();
    if (isNaN(code)) return null;
    return { code, value };
  }

  const genId = (): string => `dxf-${Date.now()}-${++idCounter}`;

  // ── VNI encoding detection ───────────────────────────────────────────────
  // Collect all text values (group code 1) to detect VNI encoding once,
  // then convert all text if VNI is detected.
  const allTextValues: string[] = [];
  const textTokensCopy = [...tokens];
  let ti = 0;
  while (ti < textTokensCopy.length - 1) {
    const code = parseInt(textTokensCopy[ti], 10);
    const val = (textTokensCopy[ti + 1] ?? "").trim();
    if (code === 1 && val) allTextValues.push(val);
    ti += 2;
  }
  const isVni = detectVniEncoding(allTextValues.join(" "));
  if (isVni) {
    console.log("%c[DXF Import] 🇻🇳 VNI encoding detected — converting text to Unicode", "color:#22d3ee;font-weight:bold");
  }
  const fixText = (s: string) => isVni ? convertVniToUnicode(s) : s;

  // ── Entity parser ────────────────────────────────────────────────────────
  // Parses one continuous run of entities until ENDSEC / ENDBLK / EOF.
  // Appends DrawingElement objects into `out`. Stops when the cursor
  // advances past the section boundary.
  function parseEntities(out: DrawingElement[]) {
    let pendingPolylineCoords: Point[] = [];
    let pendingPolylineLayer = "0";
    let pendingPolylineClosed = false;

    function flushPolyline() {
      if (pendingPolylineCoords.length < 2) { pendingPolylineCoords = []; return; }
      const coords = pendingPolylineClosed
        ? [...pendingPolylineCoords, { ...pendingPolylineCoords[0] }]
        : pendingPolylineCoords;
      for (let j = 0; j < coords.length - 1; j++) {
        out.push({
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

    const SKIP_ENTITIES = new Set([
      "VIEWPORT", "ATTDEF", "ATTRIB", "SHAPE", "SOLID", "TRACE",
      "REGION", "BODY", "3DSOLID", "IMAGE", "XLINE", "RAY", "ACAD_TABLE",
      // Block header/footer — not geometry
      "BLOCK", "ENDBLK",
    ]);

    while (i < tokens.length) {
      const pair = readPair();
      if (!pair) break;
      // End of section or block
      if (pair.code === 0 && (pair.value === "ENDSEC" || pair.value === "ENDBLK")) break;
      if (pair.code !== 0) continue;

      const entityType = pair.value;
      const props: Record<string | number, string> = {};
      let layer = "0";
      const vertexCoords: Point[] = [];
      let lwFlags = 0;

      while (i < tokens.length) {
        const p = readPair();
        if (!p || p.code === 0) {
          if (p) i -= 2; // push back the next entity header
          break;
        }
        if (p.code === 8) layer = p.value;
        if (p.code === 10) vertexCoords.push({ x: parseFloat(p.value), y: 0 });
        if (p.code === 20 && vertexCoords.length > 0) vertexCoords[vertexCoords.length - 1].y = parseFloat(p.value);
        if (p.code === 70) lwFlags = parseInt(p.value) || 0;
        props[p.code] = p.value;
      }

      if (SKIP_ENTITIES.has(entityType)) continue;

      switch (entityType) {
        case "LINE": {
          out.push({
            id: genId(), type: "line",
            x1: parseFloat(props[10]) || 0, y1: parseFloat(props[20]) || 0,
            x2: parseFloat(props[11]) || 0, y2: parseFloat(props[21]) || 0,
            strokeColor: "#1f2937", strokeWidth: 2, layerId: layer,
          });
          break;
        }
        case "LWPOLYLINE": {
          const closed = (lwFlags & 1) !== 0;
          const coords = closed && vertexCoords.length > 0
            ? [...vertexCoords, { ...vertexCoords[0] }]
            : vertexCoords;
          for (let j = 0; j < coords.length - 1; j++) {
            out.push({
              id: genId(), type: "line",
              x1: coords[j].x, y1: coords[j].y,
              x2: coords[j + 1].x, y2: coords[j + 1].y,
              strokeColor: "#1f2937", strokeWidth: 2, layerId: layer,
            });
          }
          break;
        }
        case "POLYLINE": {
          flushPolyline();
          pendingPolylineLayer = layer;
          pendingPolylineClosed = (lwFlags & 1) !== 0;
          break;
        }
        case "VERTEX": {
          pendingPolylineCoords.push({ x: parseFloat(props[10]) || 0, y: parseFloat(props[20]) || 0 });
          break;
        }
        case "SEQEND": {
          flushPolyline();
          break;
        }
        case "ARC": {
          out.push({
            id: genId(), type: "arc",
            cx: parseFloat(props[10]) || 0,
            cy: parseFloat(props[20]) || 0,
            radius: parseFloat(props[40]) || 0,
            startAngle: parseFloat(props[50]) || 0,
            endAngle: parseFloat(props[51]) || 360,
            strokeColor: "#1f2937", strokeWidth: 2,
            fillColor: "transparent", layerId: layer,
          });
          break;
        }
        case "CIRCLE": {
          out.push({
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
          const rx = Math.hypot(parseFloat(props[11]) || 50, parseFloat(props[21]) || 0);
          out.push({
            id: genId(), type: "ellipse",
            cx: parseFloat(props[10]) || 0,
            cy: parseFloat(props[20]) || 0,
            rx, ry: rx * (parseFloat(props[40]) || 1),
            strokeColor: "#1f2937", strokeWidth: 2,
            fillColor: "transparent", layerId: layer,
          });
          break;
        }
        case "SPLINE": {
          for (let j = 0; j < vertexCoords.length - 1; j++) {
            out.push({
              id: genId(), type: "line",
              x1: vertexCoords[j].x, y1: vertexCoords[j].y,
              x2: vertexCoords[j + 1].x, y2: vertexCoords[j + 1].y,
              strokeColor: "#1f2937", strokeWidth: 2, layerId: layer,
            });
          }
          break;
        }
        case "TEXT": {
          out.push({
            id: genId(), type: "text",
            x: parseFloat(props[10]) || 0,
            y: parseFloat(props[20]) || 0,
            text: fixText(props[1] || ""),
            fontSize: parseFloat(props[40]) || 16,
            strokeColor: "#1f2937", layerId: layer,
          });
          break;
        }
        case "MTEXT": {
          // MTEXT format codes use backslash sequences. Clean them properly:
          //   \fVnArial|b1|i0|c163|p34; → font spec (pipe-separated params)
          //   \H0.125x;                 → height (decimal, letter suffix)
          //   \A1;                      → alignment
          //   \P or \n                  → paragraph break → space
          //   \~                        → non-breaking space
          //   {…}                       → group braces
          const rawMtext = props[1] || "";
          const text = rawMtext
            .replace(/\\f[^;\\]*/g, "")    // \fFont|b0|i0|c163|p34  (no semicolon yet)
            .replace(/\\[A-Za-z][^;\\]*;/g, " ") // \X...;  codes with semicolon terminator → space
            .replace(/\\[Ppn~]/g, " ")     // paragraph breaks / non-breaking space
            .replace(/\\\\/g, "\\")        // escaped backslash
            .replace(/[{}]/g, "")          // group delimiters
            .replace(/\|[a-z0-9]+/gi, "")  // leftover pipe font params |b0|i0|c163
            .replace(/\s{2,}/g, " ")       // collapse multiple spaces
            .trim();
          if (text) {
            out.push({
              id: genId(), type: "text",
              x: parseFloat(props[10]) || 0,
              y: parseFloat(props[20]) || 0,
              text: fixText(text),
              fontSize: parseFloat(props[40]) || 16,
              strokeColor: "#1f2937", layerId: layer,
            });
          }
          break;
        }

        case "INSERT": {
          const blockName = props[2] || "";
          const ix = parseFloat(props[10]) || 0;
          const iy = parseFloat(props[20]) || 0;
          const upper = blockName.toUpperCase();
          const isDoor = /DOOR|DR\b|PORTE|TUR/.test(upper);
          const isWindow = /WIN|GLAZ|FENETRE/.test(upper);
          // Skip paper-space viewport markers (*Paper_Space, *Viewport...)
          if (/^\*/.test(blockName)) break;
          if (isDoor || isWindow) {
            const size = isDoor ? 900 : 1200;
            out.push({
              id: genId(), type: "rectangle",
              x: ix - size / 2, y: iy - size / 2, width: size, height: size,
              archType: isDoor ? "door" : "window",
              strokeColor: "#64748b", strokeWidth: 2, fillColor: "transparent", layerId: layer,
            });
          } else if (blockName) {
            out.push({
              id: genId(), type: "text",
              x: ix, y: iy, text: `[${blockName}]`,
              fontSize: 10, strokeColor: "#64748b", layerId: layer,
            });
          }
          break;
        }
      }
    }

    flushPolyline();
  }

  // ── Scan all sections ────────────────────────────────────────────────────
  // Modern AutoCAD DXF stores geometry in BLOCKS (*Model_Space) not ENTITIES.
  // We parse BLOCKS first (picking only *Model_Space), then ENTITIES as supplement.

  const modelSpaceElements: DrawingElement[] = [];
  const entitySectionElements: DrawingElement[] = [];

  while (i < tokens.length) {
    const p = readPair();
    if (!p) break;
    if (p.code !== 0 || p.value !== "SECTION") continue;

    const nameP = readPair();
    if (!nameP) break;

    if (nameP.value === "BLOCKS") {
      // Scan each block; only parse *MODEL_SPACE (case-insensitive)
      while (i < tokens.length) {
        const bp = readPair();
        if (!bp) break;
        if (bp.code === 0 && bp.value === "ENDSEC") break;
        if (bp.code !== 0 || bp.value !== "BLOCK") continue;

        // Read block header to find block name (code 2)
        let blockName = "";
        const headerStart = i;
        while (i < tokens.length) {
          const hp = readPair();
          if (!hp || hp.code === 0) {
            if (hp) i -= 2;
            break;
          }
          if (hp.code === 2) blockName = hp.value;
        }

        const isModelSpace = /^\*MODEL.?SPACE$/i.test(blockName) || blockName === "*Model_Space";
        if (isModelSpace) {
          parseEntities(modelSpaceElements);
        } else {
          // Skip to ENDBLK
          while (i < tokens.length) {
            const sp = readPair();
            if (!sp) break;
            if (sp.code === 0 && sp.value === "ENDBLK") break;
          }
        }
      }
    } else if (nameP.value === "ENTITIES") {
      parseEntities(entitySectionElements);
    }
    // Skip HEADER, TABLES, OBJECTS sections
  }

  // Prefer model-space geometry; fall back to ENTITIES if BLOCKS was empty
  const combined = modelSpaceElements.length > 0
    ? modelSpaceElements
    : entitySectionElements;

  // Filter out pure text placeholders like [Viewport6] if we have real geometry
  const hasGeometry = combined.some(e => e.type === "line" || e.type === "arc" || e.type === "circle" || e.type === "ellipse" || e.type === "polyline");
  const result = hasGeometry
    ? combined.filter(e => !(e.type === "text" && typeof e.text === "string" && /^\[.*\]$/.test(e.text)))
    : combined;

  return flipYAxis(result);
}
