import { create } from "zustand";
import { useDrawingStore } from "./drawingStore";

const COMMANDS = {
  LINE: {
    args: [{ name: "x1,y1", optional: false }, { name: "x2,y2", optional: false }],
    desc: "Draw a line between two points",
  },
  RECT: {
    args: [{ name: "x,y", optional: false }, { name: "w,h", optional: false }],
    desc: "Draw a rectangle at position with width and height",
  },
  CIRCLE: {
    args: [{ name: "cx,cy", optional: false }, { name: "r", optional: false }],
    desc: "Draw a circle with center and radius",
  },
  TEXT: {
    args: [{ name: "x,y", optional: false }, { name: '"content"', optional: false }],
    desc: "Add text at position",
  },
  ZOOM: {
    args: [{ name: "factor", optional: false }],
    desc: "Set zoom level (e.g. 2 for 200%)",
  },
  PAN: {
    args: [{ name: "dx,dy", optional: false }],
    desc: "Pan canvas by offset",
  },
  UNDO: { args: [], desc: "Undo last action" },
  REDO: { args: [], desc: "Redo last undone action" },
  SAVE: { args: [], desc: "Save current drawing" },
  EXPORT: {
    args: [{ name: "format", optional: false }],
    desc: "Export as png or svg",
  },
  GRID: {
    args: [{ name: "on/off", optional: false }],
    desc: "Toggle grid visibility",
  },
  SNAP: {
    args: [{ name: "mode", optional: true }],
    desc: "Toggle snap mode (endpoint/midpoint/center/grid) or show status",
  },
  LAYER: {
    args: [{ name: "action", optional: false }, { name: "name", optional: true }],
    desc: "Layer commands: new <name>, set <name>, rename <old> <new>, delete <name>",
  },
  DIM: {
    args: [{ name: "x1,y1", optional: false }, { name: "x2,y2", optional: false }],
    desc: "Add dimension between two points",
  },
  BLOCK: {
    args: [{ name: "action", optional: false }, { name: "name", optional: true }],
    desc: "Block commands: define <name>, insert <name>, explode",
  },
  HELP: { args: [], desc: "Show available commands" },
};

function parseCoord(str) {
  const parts = str.split(",");
  if (parts.length === 2) {
    const x = parseFloat(parts[0]);
    const y = parseFloat(parts[1]);
    if (!isNaN(x) && !isNaN(y)) return { x, y };
  }
  return null;
}

function executeCommand(input, getCanvasState) {
  const parts = input.trim().split(/\s+/);
  const cmd = parts[0].toUpperCase();
  const args = parts.slice(1);

  const store = useDrawingStore.getState();
  const canvasState = getCanvasState ? getCanvasState() : {};

  switch (cmd) {
    case "LINE": {
      if (args.length < 2) return "Usage: LINE x1,y1 x2,y2";
      const p1 = parseCoord(args[0]);
      const p2 = parseCoord(args[1]);
      if (!p1 || !p2) return "Invalid coordinates. Use format: x,y";
      const id = `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      store.addElement({
        id,
        type: "line",
        x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y,
        strokeColor: "#1f2937", strokeWidth: 2,
        layerId: store.activeLayerId,
      });
      return `Line created from (${p1.x},${p1.y}) to (${p2.x},${p2.y})`;
    }

    case "RECT": {
      if (args.length < 2) return "Usage: RECT x,y w,h";
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
      return `Rectangle created at (${pos.x},${pos.y}) size ${size.x}x${size.y}`;
    }

    case "CIRCLE": {
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
      return `Circle created at (${center.x},${center.y}) radius ${r}`;
    }

    case "TEXT": {
      if (args.length < 2) return "Usage: TEXT x,y \"content\"";
      const textPos = parseCoord(args[0]);
      if (!textPos) return "Invalid position. Usage: TEXT x,y \"content\"";
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
      return `Text added at (${textPos.x},${textPos.y}): "${textContent}"`;
    }

    case "ZOOM": {
      const factor = parseFloat(args[0]);
      if (isNaN(factor) || factor <= 0) return "Usage: ZOOM factor (positive number)";
      store.setZoom(factor);
      return `Zoom set to ${factor}x`;
    }

    case "PAN": {
      if (args.length < 1) return "Usage: PAN dx,dy";
      const offset = parseCoord(args[0]);
      if (!offset) return "Invalid offset. Usage: PAN dx,dy";
      const current = store.panOffset;
      store.setPanOffset({ x: current.x + offset.x, y: current.y + offset.y });
      return `Panned by (${offset.x},${offset.y})`;
    }

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
        store.toggleSnapMode(mode);
        return `Snap ${mode}: ${store.snapModes[mode] ? "on" : "off"}`;
      }
      return `Unknown snap mode: ${mode}. Options: endpoint, midpoint, center, grid, intersection`;
    }

    case "LAYER": {
      const action = args[0]?.toLowerCase();
      if (!action) return "Usage: LAYER new <name> | set <name> | rename <old> <new> | delete <name>";
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

    case "DIM": {
      if (args.length < 2) return "Usage: DIM x1,y1 x2,y2";
      const dp1 = parseCoord(args[0]);
      const dp2 = parseCoord(args[1]);
      if (!dp1 || !dp2) return "Invalid coordinates. Use format: x,y";
      const dimId = `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      store.addElement({
        id: dimId,
        type: "dimension",
        x1: dp1.x, y1: dp1.y, x2: dp2.x, y2: dp2.y,
        offset: 30,
        strokeColor: "#1f2937", strokeWidth: 1.5,
        layerId: store.activeLayerId,
      });
      const dist = Math.hypot(dp2.x - dp1.x, dp2.y - dp1.y).toFixed(2);
      return `Dimension created: distance ${dist}`;
    }

    case "BLOCK": {
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
        const blockDef = store.blockDefs[name];
        if (!blockDef) return `Block not found: "${name}"`;
        const center = { x: 400, y: 300 };
        store.insertBlock(name, center.x, center.y);
        return `Block "${name}" inserted at (${center.x},${center.y})`;
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

    case "HELP":
      return Object.entries(COMMANDS)
        .map(([name, info]) => {
          const argsStr = info.args.map((a) => `<${a.name}>`).join(" ");
          return `  ${name} ${argsStr} — ${info.desc}`;
        })
        .join("\n");

    default:
      return `Unknown command: ${cmd}. Type HELP for available commands.`;
  }
}

export const useCommandStore = create((set, get) => ({
  input: "",
  history: [],
  historyIndex: -1,
  suggestions: [],
  showSuggestions: false,
  isFocused: false,
  output: null,

  setInput: (input) => {
    set({ input });
    if (input.trim()) {
      const parts = input.trim().split(/\s+/);
      const partial = parts[0].toUpperCase();
      const matches = Object.keys(COMMANDS).filter((c) => c.startsWith(partial));
      set({ suggestions: matches.slice(0, 8), showSuggestions: matches.length > 0 && matches.length < Object.keys(COMMANDS).length });
    } else {
      set({ suggestions: [], showSuggestions: false });
    }
  },

  execute: (getCanvasState) => {
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

  setFocused: (isFocused) => set({ isFocused }),
  clearOutput: () => set({ output: null }),

  getCommands: () => COMMANDS,
}));