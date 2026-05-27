import { create } from "zustand";
import { useDrawingStore } from "./drawingStore";
import type { Point, ToolType, DrawingElement, SnapModes } from "../types";

interface CommandArg {
  name: string;
  optional: boolean;
}

interface CommandInfo {
  alias?: string;
  args?: CommandArg[];
  desc: string;
}

interface CanvasState {
  onExport?: (format: string) => void;
  [key: string]: unknown;
}

interface CommandStore {
  input: string;
  history: string[];
  historyIndex: number;
  suggestions: string[];
  showSuggestions: boolean;
  isFocused: boolean;
  output: string | null;
  setInput: (input: string) => void;
  execute: (getCanvasState?: () => CanvasState) => void;
  historyUp: () => void;
  historyDown: () => void;
  setFocused: (isFocused: boolean) => void;
  clearOutput: () => void;
  getCommands: () => Record<string, CommandInfo>;
}

// AutoCAD/BricsCAD compatible command map
const COMMANDS: Record<string, CommandInfo> = {
  // === Core Drawing (90% usage) ===
  L: { alias: "LINE", desc: "Draw line" },
  LINE: {
    args: [{ name: "x1,y1", optional: false }, { name: "x2,y2", optional: false }],
    desc: "Draw a line between two points",
  },
  C: { alias: "CIRCLE", desc: "Draw circle" },
  CIRCLE: {
    args: [{ name: "cx,cy", optional: false }, { name: "r", optional: false }],
    desc: "Draw a circle with center and radius",
  },
  REC: { alias: "RECTANGLE", desc: "Draw rectangle" },
  RECTANGLE: {
    args: [{ name: "x,y", optional: false }, { name: "w,h", optional: false }],
    desc: "Draw a rectangle at position with width and height",
  },
  PL: { alias: "PLINE", desc: "Draw polyline" },
  PLINE: {
    args: [{ name: "points...", optional: false }],
    desc: "Draw a polyline through multiple points (x1,y1 x2,y2 ...)",
  },
  A: { alias: "ARC", desc: "Draw arc" },
  ARC: {
    args: [{ name: "x1,y1", optional: false }, { name: "x2,y2", optional: false }, { name: "x3,y3", optional: false }],
    desc: "Draw an arc through three points",
  },

  // === Modify Commands ===
  M: { alias: "MOVE", desc: "Move object" },
  MOVE: {
    args: [{ name: "dx,dy", optional: false }],
    desc: "Move selected objects by offset",
  },
  CO: { alias: "COPY", desc: "Copy object" },
  CP: { alias: "COPY", desc: "Copy object" },
  COPY: {
    args: [{ name: "dx,dy", optional: false }],
    desc: "Copy selected objects by offset",
  },
  RO: { alias: "ROTATE", desc: "Rotate" },
  ROTATE: {
    args: [{ name: "angle", optional: false }],
    desc: "Rotate selected objects by angle (degrees)",
  },
  SC: { alias: "SCALE", desc: "Resize" },
  SCALE: {
    args: [{ name: "factor", optional: false }],
    desc: "Scale selected objects by factor",
  },
  TR: { alias: "TRIM", desc: "Trim/cut object" },
  TRIM: {
    args: [],
    desc: "Trim mode: click on element to trim (select element first)",
  },
  EX: { alias: "EXTEND", desc: "Extend object" },
  EXTEND: {
    args: [],
    desc: "Extend mode: click on element to extend",
  },
  MI: { alias: "MIRROR", desc: "Mirror" },
  MIRROR: {
    args: [{ name: "x1,y1", optional: false }, { name: "x2,y2", optional: false }],
    desc: "Mirror selected objects across a line",
  },
  O: { alias: "OFFSET", desc: "Create parallel copy" },
  OFFSET: {
    args: [{ name: "distance", optional: false }],
    desc: "Offset selected object by distance",
  },

  // === View / Navigation ===
  Z: { alias: "ZOOM", desc: "Zoom" },
  ZOOM: {
    args: [{ name: "factor", optional: true }],
    desc: "Set zoom level (e.g. 2 for 200%). Z A = Zoom All, Z E = Zoom Extents",
  },
  P: { alias: "PAN", desc: "Pan view" },
  PAN: {
    args: [{ name: "dx,dy", optional: false }],
    desc: "Pan canvas by offset",
  },

  // === Measurement ===
  DI: { alias: "DIST", desc: "Measure distance" },
  DIST: {
    args: [{ name: "x1,y1", optional: false }, { name: "x2,y2", optional: false }],
    desc: "Measure distance between two points",
  },
  MEA: { alias: "MEASURE", desc: "Measure segments" },
  MEASURE: {
    args: [{ name: "x1,y1", optional: false }, { name: "x2,y2", optional: false }],
    desc: "Measure distance between two points",
  },

  // === Layer & Properties ===
  LA: { alias: "LAYER", desc: "Open layer manager" },
  LAYER: {
    args: [{ name: "action", optional: false }, { name: "name", optional: true }],
    desc: "Layer commands: new <name>, set <name>, rename <old> <new>, delete <name>",
  },
  CH: { alias: "PROPERTIES", desc: "Change properties" },
  PROPERTIES: {
    args: [{ name: "prop", optional: false }, { name: "value", optional: false }],
    desc: "Change property of selected objects: color <name>, width <n>, layer <name>",
  },
  MA: { alias: "MATCHPROP", desc: "Match properties" },
  MATCHPROP: {
    args: [],
    desc: "Match properties from one object to another (select source then target)",
  },

  // === Advanced ===
  B: { alias: "BLOCK", desc: "Create block" },
  BLOCK: {
    args: [{ name: "action", optional: false }, { name: "name", optional: true }],
    desc: "Block commands: define <name>, insert <name>, explode",
  },
  I: { alias: "INSERT", desc: "Insert block" },
  INSERT: {
    args: [{ name: "name", optional: false }],
    desc: "Insert a block by name",
  },
  X: { alias: "EXPLODE", desc: "Explode/break object" },
  EXPLODE: {
    args: [],
    desc: "Explode selected block into individual elements",
  },
  H: { alias: "HATCH", desc: "Fill pattern" },
  HATCH: {
    args: [{ name: "pattern", optional: true }],
    desc: "Hatch selected closed shape. Patterns: solid, cross, diagonal, dots",
  },

  // === Text ===
  TEXT: {
    args: [{ name: "x,y", optional: false }, { name: '"content"', optional: false }],
    desc: "Add text at position",
  },

  // === Utility ===
  UNDO: { args: [], desc: "Undo last action" },
  REDO: { args: [], desc: "Redo last undone action" },
  SAVE: { args: [], desc: "Save current drawing" },
  EXPORT: {
    args: [{ name: "format", optional: false }],
    desc: "Export as png or svg",
  },
  GRID: {
    args: [{ name: "on/off", optional: true }],
    desc: "Toggle grid visibility",
  },
  SNAP: {
    args: [{ name: "mode", optional: true }],
    desc: "Toggle snap mode (endpoint/midpoint/center/grid/intersection/nearest/geometricCenter/node/quadrant/perpendicular/tangent/insertion/extension/apparentIntersection) or show status",
  },
  DIM: {
    args: [{ name: "x1,y1", optional: false }, { name: "x2,y2", optional: false }],
    desc: "Add dimension between two points",
  },
  HELP: { args: [], desc: "Show available commands" },
  DELETE: { args: [], desc: "Delete selected objects" },
  ERASE: { alias: "DELETE", desc: "Delete selected objects" },
  SEL: { alias: "SELECT", desc: "Select all" },
  SELECT: { args: [{ name: "all", optional: true }], desc: "Select all objects" },
};

// Resolve aliases to canonical commands
function resolveCommand(name: string): CommandInfo | null {
  const cmd = COMMANDS[name];
  if (!cmd) return null;
  if (cmd.alias) return resolveCommand(cmd.alias);
  return cmd;
}

function parseCoord(str: string): Point | null {
  const parts = str.split(",");
  if (parts.length === 2) {
    const x = parseFloat(parts[0]);
    const y = parseFloat(parts[1]);
    if (!isNaN(x) && !isNaN(y)) return { x, y };
  }
  return null;
}

function executeCommand(input: string, getCanvasState?: () => CanvasState): string {
  const parts = input.trim().split(/\s+/);
  const cmdName = parts[0].toUpperCase();
  const args = parts.slice(1);

  const store = useDrawingStore.getState();
  const canvasState: CanvasState = getCanvasState ? getCanvasState() : {};

  // Handle Z + A / Z + E special cases
  if (cmdName === "Z" && args.length > 0) {
    const sub = args[0].toUpperCase();
    if (sub === "A") {
      store.setZoom(1);
      store.setPanOffset({ x: 0, y: 0 });
      return "Zoom All";
    }
    if (sub === "E") {
      store.setZoom(1);
      store.setPanOffset({ x: 0, y: 0 });
      return "Zoom Extents";
    }
  }

  const cmd = resolveCommand(cmdName);
  if (!cmd) return `Unknown command: ${cmdName}. Type HELP for available commands.`;

  switch (cmdName) {
    // === Core Drawing ===
    case "LINE":
    case "L": {
      if (args.length < 2) return "Usage: LINE x1,y1 x2,y2";
      const p1 = parseCoord(args[0]);
      const p2 = parseCoord(args[1]);
      if (!p1 || !p2) return "Invalid coordinates. Use format: x,y";
      const lineId = `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      store.addElement({
        id: lineId,
        type: "line",
        x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y,
        strokeColor: "#1f2937", strokeWidth: 2,
        layerId: store.activeLayerId,
      });
      return `Line from (${p1.x},${p1.y}) to (${p2.x},${p2.y})`;
    }

    case "RECTANGLE":
    case "REC": {
      if (args.length < 2) return "Usage: RECTANGLE x,y w,h";
      const pos = parseCoord(args[0]);
      const size = parseCoord(args[1]);
      if (!pos || !size) return "Invalid coordinates. Use format: x,y";
      const rectId = `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      store.addElement({
        id: rectId,
        type: "rectangle",
        x: pos.x, y: pos.y, width: size.x, height: size.y,
        strokeColor: "#1f2937", strokeWidth: 2, fillColor: "transparent",
        layerId: store.activeLayerId,
      });
      return `Rectangle at (${pos.x},${pos.y}) size ${size.x}x${size.y}`;
    }

    case "CIRCLE":
    case "C": {
      if (args.length < 2) return "Usage: CIRCLE cx,cy r";
      const center = parseCoord(args[0]);
      const r = parseFloat(args[1]);
      if (!center || isNaN(r)) return "Invalid arguments. Usage: CIRCLE cx,cy r";
      const circleId = `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      store.addElement({
        id: circleId,
        type: "circle",
        cx: center.x, cy: center.y, radius: r,
        strokeColor: "#1f2937", strokeWidth: 2, fillColor: "transparent",
        layerId: store.activeLayerId,
      });
      return `Circle at (${center.x},${center.y}) radius ${r}`;
    }

    case "PLINE":
    case "PL": {
      if (args.length < 2) return "Usage: PLINE x1,y1 x2,y2 [x3,y3 ...]";
      const points: Point[] = args.map((a) => parseCoord(a)).filter((p): p is Point => p !== null);
      if (points.length < 2) return "Need at least 2 valid points";
      const plineId = `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      store.addElement({
        id: plineId,
        type: "polyline",
        points,
        strokeColor: "#1f2937", strokeWidth: 2,
        layerId: store.activeLayerId,
      });
      return `Polyline with ${points.length} points`;
    }

    case "ARC":
    case "A": {
      if (args.length < 3) return "Usage: ARC x1,y1 x2,y2 x3,y3";
      const ap1 = parseCoord(args[0]);
      const ap2 = parseCoord(args[1]);
      const ap3 = parseCoord(args[2]);
      if (!ap1 || !ap2 || !ap3) return "Invalid coordinates";
      const arcId = `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      store.addElement({
        id: arcId,
        type: "arc",
        x1: ap1.x, y1: ap1.y, x2: ap2.x, y2: ap2.y, x3: ap3.x, y3: ap3.y,
        strokeColor: "#1f2937", strokeWidth: 2,
        layerId: store.activeLayerId,
      });
      return `Arc through 3 points`;
    }

    // === Modify Commands ===
    case "MOVE":
    case "M": {
      if (args.length < 1) return "Usage: MOVE dx,dy";
      const moveOffset = parseCoord(args[0]);
      if (!moveOffset) return "Invalid offset";
      if (store.selectedElementIds.length === 0) return "No objects selected";
      store.selectedElementIds.forEach((id) => {
        const el = store.elements.find((e) => e.id === id);
        if (el) {
          store.updateElement(id, {
            x: (el.x || 0) + moveOffset.x,
            y: (el.y || 0) + moveOffset.y,
          });
        }
      });
      return `Moved ${store.selectedElementIds.length} object(s) by (${moveOffset.x},${moveOffset.y})`;
    }

    case "COPY":
    case "CO":
    case "CP": {
      if (args.length < 1) return "Usage: COPY dx,dy";
      const copyOffset = parseCoord(args[0]);
      if (!copyOffset) return "Invalid offset";
      if (store.selectedElementIds.length === 0) return "No objects selected";
      const newEls = store.selectedElementIds.map((id) => {
        const el = store.elements.find((e) => e.id === id);
        if (!el) return null;
        const newId = `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        return { ...el, id: newId, x: (el.x || 0) + copyOffset.x, y: (el.y || 0) + copyOffset.y };
      }).filter((e) => e !== null) as DrawingElement[];
      newEls.forEach((el: DrawingElement) => store.addElement(el));
      return `Copied ${newEls.length} object(s)`;
    }

    case "ROTATE":
    case "RO": {
      if (args.length < 1) return "Usage: ROTATE angle";
      const angle = parseFloat(args[0]);
      if (isNaN(angle)) return "Invalid angle";
      if (store.selectedElementIds.length === 0) return "No objects selected";
      store.selectedElementIds.forEach((id) => {
        const el = store.elements.find((e) => e.id === id);
        if (el) {
          store.updateElement(id, { rotation: (el.rotation || 0) + angle });
        }
      });
      return `Rotated ${store.selectedElementIds.length} object(s) by ${angle}°`;
    }

    case "SCALE":
    case "SC": {
      if (args.length < 1) return "Usage: SCALE factor";
      const factor = parseFloat(args[0]);
      if (isNaN(factor) || factor <= 0) return "Invalid factor";
      if (store.selectedElementIds.length === 0) return "No objects selected";
      store.selectedElementIds.forEach((id) => {
        const el = store.elements.find((e) => e.id === id);
        if (el) {
          store.updateElement(id, { scale: (el.scale || 1) * factor });
        }
      });
      return `Scaled ${store.selectedElementIds.length} object(s) by ${factor}x`;
    }

    case "TRIM":
    case "TR": {
      store.setTool("trim");
      return "Trim mode activated. Click on element to trim.";
    }

    case "EXTEND":
    case "EX": {
      store.setTool("extend");
      return "Extend mode activated. Click on element to extend.";
    }

    case "MIRROR":
    case "MI": {
      if (args.length < 2) return "Usage: MIRROR x1,y1 x2,y2";
      const mp1 = parseCoord(args[0]);
      const mp2 = parseCoord(args[1]);
      if (!mp1 || !mp2) return "Invalid coordinates";
      if (store.selectedElementIds.length === 0) return "No objects selected";
      store.selectedElementIds.forEach((id) => {
        const el = store.elements.find((e) => e.id === id);
        if (!el) return;
        const dx = el.x || 0;
        const dy = el.y || 0;
        // Reflect across line
        const ldx = mp2.x - mp1.x;
        const ldy = mp2.y - mp1.y;
        const t = ((dx - mp1.x) * ldx + (dy - mp1.y) * ldy) / (ldx * ldx + ldy * ldy);
        const rx = 2 * (mp1.x + t * ldx) - dx;
        const ry = 2 * (mp1.y + t * ldy) - dy;
        store.updateElement(id, { x: rx, y: ry });
      });
      return `Mirrored ${store.selectedElementIds.length} object(s)`;
    }

    case "OFFSET":
    case "O": {
      if (args.length < 1) return "Usage: OFFSET distance";
      const dist = parseFloat(args[0]);
      if (isNaN(dist)) return "Invalid distance";
      if (store.selectedElementIds.length === 0) return "No objects selected";
      store.selectedElementIds.forEach((id) => {
        const el = store.elements.find((e) => e.id === id);
        if (!el) return;
        const newId = `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const offset = dist;
        store.addElement({ ...el, id: newId, x: (el.x || 0) + offset, y: (el.y || 0) + offset });
      });
      return `Offset ${store.selectedElementIds.length} object(s) by ${dist}`;
    }

    // === View ===
    case "ZOOM":
    case "Z": {
      const factor = parseFloat(args[0]);
      if (isNaN(factor) || factor <= 0) return `Zoom: ${store.zoom}x. Usage: ZOOM factor`;
      store.setZoom(factor);
      return `Zoom set to ${factor}x`;
    }

    case "PAN":
    case "P": {
      if (args.length < 1) return "Usage: PAN dx,dy";
      const panOffset = parseCoord(args[0]);
      if (!panOffset) return "Invalid offset";
      const current = store.panOffset;
      store.setPanOffset({ x: current.x + panOffset.x, y: current.y + panOffset.y });
      return `Panned by (${panOffset.x},${panOffset.y})`;
    }

    // === Measurement ===
    case "DIST":
    case "DI":
    case "MEASURE":
    case "MEA": {
      if (args.length < 2) return "Usage: DIST x1,y1 x2,y2";
      const md1 = parseCoord(args[0]);
      const md2 = parseCoord(args[1]);
      if (!md1 || !md2) return "Invalid coordinates";
      const distVal = Math.hypot(md2.x - md1.x, md2.y - md1.y);
      return `Distance: ${distVal.toFixed(2)}`;
    }

    // === Layer ===
    case "LAYER":
    case "LA": {
      const action = args[0]?.toLowerCase();
      if (!action) {
        const layers = store.layers;
        return `Layers: ${layers.map((l) => `${l.name}${l.id === store.activeLayerId ? " (active)" : ""}${!l.visible ? " (hidden)" : ""}${l.locked ? " (locked)" : ""}`).join(", ")}`;
      }
      if (action === "new") {
        store.addLayer();
        const layers = store.layers;
        return `Layer created: ${layers[layers.length - 1].name}`;
      }
      if (action === "set") {
        const name = args.slice(1).join(" ");
        const layer = store.layers.find((l) => l.name === name);
        if (!layer) return `Layer not found: ${name}`;
        store.setActiveLayer(layer.id);
        return `Active layer: ${name}`;
      }
      if (action === "rename") {
        if (args.length < 3) return "Usage: LAYER rename <old> <new>";
        const oldName = args[1];
        const newName = args.slice(2).join(" ");
        const layer = store.layers.find((l) => l.name === oldName);
        if (!layer) return `Layer not found: ${oldName}`;
        store.renameLayer(layer.id, newName);
        return `Layer renamed: ${oldName} → ${newName}`;
      }
      if (action === "delete") {
        const name = args.slice(1).join(" ");
        const layer = store.layers.find((l) => l.name === name);
        if (!layer) return `Layer not found: ${name}`;
        if (store.layers.length <= 1) return "Cannot delete the last layer";
        store.deleteLayer(layer.id);
        return `Layer deleted: ${name}`;
      }
      return `Unknown layer action: ${action}`;
    }

    // === Properties ===
    case "PROPERTIES":
    case "CH": {
      if (args.length < 2) return "Usage: PROPERTIES <prop> <value>. Props: color, width, layer";
      const prop = args[0].toLowerCase();
      const value = args.slice(1).join(" ");
      if (store.selectedElementIds.length === 0) return "No objects selected";
      store.selectedElementIds.forEach((id) => {
        if (prop === "color") store.updateElement(id, { strokeColor: value });
        else if (prop === "width") store.updateElement(id, { strokeWidth: parseFloat(value) || 2 });
        else if (prop === "layer") {
          const layer = store.layers.find((l) => l.name === value);
          if (layer) store.updateElement(id, { layerId: layer.id });
        }
      });
      return `Set ${prop} = ${value} on ${store.selectedElementIds.length} object(s)`;
    }

    case "MATCHPROP":
    case "MA": {
      return "Match properties: select source object, then target object(s)";
    }

    // === Advanced ===
    case "BLOCK":
    case "B": {
      const blockAction = args[0]?.toLowerCase();
      if (!blockAction) return "Usage: BLOCK define <name> | insert <name> | explode";
      if (blockAction === "define") {
        const name = args.slice(1).join(" ");
        if (!name) return "Usage: BLOCK define <name>";
        if (store.selectedElementIds.length === 0)
          return "Select elements first, then run BLOCK define <name>";
        const selectedEls = store.elements.filter((el) =>
          store.selectedElementIds.includes(el.id)
        );
        store.defineBlock(name, selectedEls, { x: 0, y: 0 });
        return `Block defined: "${name}" with ${selectedEls.length} elements`;
      }
      if (blockAction === "insert") {
        const name = args.slice(1).join(" ");
        if (!name) return "Usage: BLOCK insert <name>";
        const blockDef = Object.values(store.blockDefs).find((b) => b.name === name);
        if (!blockDef) return `Block not found: "${name}"`;
        // Insert at canvas center
        const panOffset = store.panOffset || { x: 0, y: 0 };
        const zoom = store.zoom || 1;
        const cx = (window.innerWidth / 2 - panOffset.x) / zoom;
        const cy = (window.innerHeight / 2 - panOffset.y) / zoom;
        store.insertBlock(blockDef.id, cx, cy);
        return `Block "${name}" inserted at center`;
      }
      if (blockAction === "explode") {
        if (store.selectedElementIds.length !== 1) return "Select one block instance to explode";
        const el = store.elements.find((e) => e.id === store.selectedElementIds[0]);
        if (!el || el.type !== "block") return "Selected element is not a block instance";
        store.explodeBlock(el.id);
        return "Block exploded";
      }
      return `Unknown block action: ${blockAction}`;
    }

    case "INSERT":
    case "I": {
      const name = args.join(" ");
      if (!name) return "Usage: INSERT <name>";
      const blockDef = Object.values(store.blockDefs).find((b) => b.name === name);
      if (!blockDef) return `Block not found: "${name}"`;
      store.insertBlock(blockDef.id, 400, 300);
      return `Block "${name}" inserted`;
    }

    case "EXPLODE":
    case "X": {
      if (store.selectedElementIds.length !== 1) return "Select one block instance to explode";
      const el = store.elements.find((e) => e.id === store.selectedElementIds[0]);
      if (!el || el.type !== "block") return "Selected element is not a block instance";
      store.explodeBlock(el.id);
      return "Block exploded";
    }

    case "HATCH":
    case "H": {
      const pattern = args[0] || "solid";
      if (store.selectedElementIds.length === 0) return "Select a closed shape first";
      store.selectedElementIds.forEach((id) => {
        store.updateElement(id, { fillColor: pattern === "solid" ? "#e5e7eb" : pattern === "cross" ? "#d1d5db" : pattern === "diagonal" ? "#f3f4f6" : "#e5e7eb", hatchPattern: pattern });
      });
      return `Hatched with pattern: ${pattern}`;
    }

    // === Text ===
    case "TEXT": {
      if (args.length < 2) return 'Usage: TEXT x,y "content"';
      const textPos = parseCoord(args[0]);
      if (!textPos) return 'Invalid position. Usage: TEXT x,y "content"';
      const textContent = args.slice(1).join(" ").replace(/^["']|["']$/g, "");
      const textId = `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      store.addElement({
        id: textId,
        type: "text",
        text: textContent,
        x: textPos.x, y: textPos.y,
        fontSize: 16, strokeColor: "#1f2937",
        layerId: store.activeLayerId,
      });
      return `Text at (${textPos.x},${textPos.y}): "${textContent}"`;
    }

    // === Utility ===
    case "UNDO":
      store.undo();
      return "Undone";

    case "REDO":
      store.redo();
      return "Redone";

    case "SAVE":
      store.saveDrawing();
      return "Drawing saved";

    case "EXPORT":
      if (!args[0] || !["png", "svg"].includes(args[0].toLowerCase()))
        return "Usage: EXPORT png|svg";
      canvasState.onExport?.(args[0].toLowerCase());
      return `Exporting as ${args[0].toLowerCase()}`;

    case "GRID": {
      const val = args[0]?.toLowerCase();
      if (val === "on" || val === "true" || val === "1") {
        store.setGridVisible(true);
        return "Grid on";
      } else if (val === "off" || val === "false" || val === "0") {
        store.setGridVisible(false);
        return "Grid off";
      }
      return `Grid is ${store.gridVisible ? "on" : "off"}`;
    }

    case "SNAP": {
      const mode = args[0]?.toLowerCase();
      if (!mode) {
        const modes = store.snapModes;
        const active = Object.entries(modes).filter(([, v]) => v).map(([k]) => k);
        return `Snap: ${active.length ? active.join(", ") : "none"} (${store.snapEnabled ? "enabled" : "disabled"})`;
      }
      if (mode === "on" || mode === "off") {
        store.setSnapEnabled(mode === "on");
        return `Snap ${mode === "on" ? "enabled" : "disabled"}`;
      }
      if (mode in store.snapModes) {
        const snapKey = mode as keyof SnapModes;
        store.toggleSnapMode(snapKey);
        return `Snap ${mode}: ${store.snapModes[snapKey] ? "on" : "off"}`;
      }
      return `Unknown snap mode: ${mode}. Options: endpoint, midpoint, center, grid, intersection, nearest, geometricCenter, node, quadrant, perpendicular, tangent, insertion, extension, apparentIntersection`;
    }

    case "DIM": {
      if (args.length < 2) return "Usage: DIM x1,y1 x2,y2";
      const dp1 = parseCoord(args[0]);
      const dp2 = parseCoord(args[1]);
      if (!dp1 || !dp2) return "Invalid coordinates";
      const dimId = `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      store.addElement({
        id: dimId,
        type: "dimension",
        x1: dp1.x, y1: dp1.y, x2: dp2.x, y2: dp2.y,
        offset: 30,
        strokeColor: "#1f2937", strokeWidth: 1.5,
        layerId: store.activeLayerId,
      });
      const distVal = Math.hypot(dp2.x - dp1.x, dp2.y - dp1.y).toFixed(2);
      return `Dimension: ${distVal}`;
    }

    case "DELETE":
    case "ERASE": {
      if (store.selectedElementIds.length === 0) return "No objects selected";
      store.deleteSelectedElements();
      return "Deleted selected objects";
    }

    case "SELECT":
    case "SEL": {
      const all = args[0]?.toLowerCase();
      if (all === "all") {
        store.setSelectedElementIds(store.elements.map((e) => e.id));
        return `Selected ${store.elements.length} object(s)`;
      }
      return "Usage: SELECT all";
    }

    case "HELP":
      return Object.entries(COMMANDS)
        .filter(([, cmd]) => !cmd.alias) // Only show canonical commands
        .map(([name, info]) => {
          const shortcuts = Object.entries(COMMANDS)
            .filter(([, c]) => c.alias === name)
            .map(([k]) => k);
          const aliasStr = shortcuts.length ? ` (${shortcuts.join(", ")})` : "";
          const argsStr = info.args ? info.args.map((a) => `<${a.name}>`).join(" ") : "";
          return `  ${name}${aliasStr} ${argsStr} — ${info.desc}`;
        })
        .join("\n");

    default:
      return `Unknown command: ${cmdName}. Type HELP for available commands.`;
  }
}

export const useCommandStore = create<CommandStore>((set: any, get: any) => ({
  input: "",
  history: [],
  historyIndex: -1,
  suggestions: [],
  showSuggestions: false,
  isFocused: false,
  output: null,

  setInput: (input: string) => {
    set({ input });
    if (input.trim()) {
      const parts = input.trim().split(/\s+/);
      const partial = parts[0].toUpperCase();
      const matches = Object.keys(COMMANDS).filter((c) => c.startsWith(partial));
      set({
        suggestions: matches.slice(0, 8),
        showSuggestions: matches.length > 0 && matches.length < Object.keys(COMMANDS).length,
      });
    } else {
      set({ suggestions: [], showSuggestions: false });
    }
  },

  execute: (getCanvasState?: () => CanvasState) => {
    const { input, history } = get();
    if (!input.trim()) return;
    const result = executeCommand(input, getCanvasState);
    set({
      history: [...history, input],
      historyIndex: -1,
      input: "",
      output: result,
      suggestions: [],
      showSuggestions: false,
    });
  },

  historyUp: () => {
    const { history, historyIndex } = get();
    if (history.length === 0) return;
    const newIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
    set({ historyIndex: newIndex, input: history[newIndex] });
  },

  historyDown: () => {
    const { history, historyIndex } = get();
    if (historyIndex === -1) return;
    if (historyIndex === history.length - 1) {
      set({ historyIndex: -1, input: "" });
    } else {
      set({ historyIndex: historyIndex + 1, input: history[historyIndex + 1] });
    }
  },

  setFocused: (isFocused: boolean) => set({ isFocused }),
  clearOutput: () => set({ output: null }),

  getCommands: () => COMMANDS,
}));
