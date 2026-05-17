/**
 * Minimal DXF import/export for 2D drafting.
 * Supports: LINE, LWPOLYLINE, CIRCLE, TEXT, DIMENSION (as LINE+TEXT).
 * Exports R12-compatible ASCII DXF.
 */

export function elementsToDxf(elements) {
  const lines = [];
  lines.push("0", "SECTION", "2", "HEADER", "0", "ENDSEC");
  lines.push("0", "SECTION", "2", "TABLES");
  lines.push("0", "TABLE", "2", "LTYPE", "70", "1", "0", "LTYPE", "2", "CONTINUOUS", "70", "0", "0", "ENDTAB");
  lines.push("0", "TABLE", "2", "LAYER", "70", "1");
  const layerNames = [...new Set(elements.map((e) => e.layerId || "0"))];
  layerNames.forEach((name, i) => {
    lines.push("0", "LAYER", "2", name, "70", "0", "62", "7", "6", "CONTINUOUS");
  });
  lines.push("0", "ENDTAB");
  lines.push("0", "TABLE", "2", "STYLE", "70", "0", "0", "ENDTAB");
  lines.push("0", "ENDSEC");

  lines.push("0", "SECTION", "2", "ENTITIES");
  elements.forEach((el) => {
    const layer = el.layerId || "0";
    switch (el.type) {
      case "line":
        lines.push(
          "0", "LINE",
          "8", layer,
          "10", String(el.x1),
          "20", String(el.y1),
          "30", "0",
          "11", String(el.x2),
          "21", String(el.y2),
          "31", "0"
        );
        break;
      case "rectangle":
        // Export as closed polyline
        lines.push(
          "0", "LWPOLYLINE",
          "8", layer,
          "70", "1",
          "90", "4",
          "10", String(el.x),
          "20", String(el.y),
          "10", String(el.x + el.width),
          "20", String(el.y),
          "10", String(el.x + el.width),
          "20", String(el.y + el.height),
          "10", String(el.x),
          "20", String(el.y + el.height)
        );
        break;
      case "circle":
        lines.push(
          "0", "CIRCLE",
          "8", layer,
          "10", String(el.cx),
          "20", String(el.cy),
          "30", "0",
          "40", String(el.radius)
        );
        break;
      case "text":
        lines.push(
          "0", "TEXT",
          "8", layer,
          "10", String(el.x),
          "20", String(el.y),
          "30", "0",
          "40", String(el.fontSize || 16),
          "1", el.text || "",
          "7", "STANDARD",
          "72", "0",
          "11", "0",
          "21", "0",
          "31", "0"
        );
        break;
      case "dimension":
        lines.push(
          "0", "LINE",
          "8", layer,
          "10", String(el.x1),
          "20", String(el.y1),
          "30", "0",
          "11", String(el.x2),
          "21", String(el.y2),
          "31", "0"
        );
        const len = Math.round(Math.hypot(el.x2 - el.x1, el.y2 - el.y1));
        const midX = (el.x1 + el.x2) / 2;
        const midY = (el.y1 + el.y2) / 2;
        lines.push(
          "0", "TEXT",
          "8", layer,
          "10", String(midX),
          "20", String(midY),
          "30", "0",
          "40", "12",
          "1", String(len),
          "7", "STANDARD",
          "72", "1",
          "11", "0",
          "21", "0",
          "31", "0"
        );
        break;
    }
  });
  lines.push("0", "ENDSEC", "0", "EOF");
  return lines.join("\r\n");
}

export function dxfToElements(dxfText) {
  const elements = [];
  const tokens = dxfText.split(/\r?\n/);
  let i = 0;

  function readPair() {
    if (i >= tokens.length) return null;
    const code = parseInt(tokens[i++], 10);
    const value = tokens[i++];
    if (isNaN(code)) return null;
    return { code, value };
  }

  function expectSection(name) {
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
  const genId = () => `dxf-${Date.now()}-${++idCounter}`;

  while (i < tokens.length) {
    const pair = readPair();
    if (!pair) break;
    if (pair.code === 0 && pair.value === "ENDSEC") break;
    if (pair.code !== 0) continue;

    const entityType = pair.value;
    const props = {};
    let layer = "0";

    while (i < tokens.length) {
      const p = readPair();
      if (!p || p.code === 0) {
        if (p) i -= 2; // unread
        break;
      }
      if (p.code === 8) layer = p.value;
      props[p.code] = p.value;
    }

    switch (entityType) {
      case "LINE": {
        const x1 = parseFloat(props[10]) || 0;
        const y1 = parseFloat(props[20]) || 0;
        const x2 = parseFloat(props[11]) || 0;
        const y2 = parseFloat(props[21]) || 0;
        elements.push({
          id: genId(),
          type: "line",
          x1, y1, x2, y2,
          strokeColor: "#1f2937",
          strokeWidth: 2,
          layerId: layer,
        });
        break;
      }
      case "LWPOLYLINE": {
        const coords = [];
        let closed = false;
        while (i < tokens.length) {
          const p = readPair();
          if (!p || p.code === 0) {
            if (p) i -= 2;
            break;
          }
          if (p.code === 70) closed = (parseInt(p.value) & 1) !== 0;
          if (p.code === 10) coords.push({ x: parseFloat(p.value), y: 0 });
          if (p.code === 20 && coords.length > 0) coords[coords.length - 1].y = parseFloat(p.value);
        }
        if (closed && coords.length > 0) coords.push({ ...coords[0] });
        for (let j = 0; j < coords.length - 1; j++) {
          elements.push({
            id: genId(),
            type: "line",
            x1: coords[j].x,
            y1: coords[j].y,
            x2: coords[j + 1].x,
            y2: coords[j + 1].y,
            strokeColor: "#1f2937",
            strokeWidth: 2,
            layerId: layer,
          });
        }
        break;
      }
      case "CIRCLE": {
        const cx = parseFloat(props[10]) || 0;
        const cy = parseFloat(props[20]) || 0;
        const radius = parseFloat(props[40]) || 0;
        elements.push({
          id: genId(),
          type: "circle",
          cx, cy, radius,
          strokeColor: "#1f2937",
          strokeWidth: 2,
          fillColor: "transparent",
          layerId: layer,
        });
        break;
      }
      case "TEXT": {
        const x = parseFloat(props[10]) || 0;
        const y = parseFloat(props[20]) || 0;
        const fontSize = parseFloat(props[40]) || 16;
        const text = props[1] || "";
        elements.push({
          id: genId(),
          type: "text",
          x, y,
          text,
          fontSize,
          strokeColor: "#1f2937",
          layerId: layer,
        });
        break;
      }
    }
  }

  return elements;
}