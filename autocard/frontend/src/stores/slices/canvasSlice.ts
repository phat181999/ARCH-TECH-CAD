import type { StateCreator } from "zustand";
import { auth as authApi } from "../../api/client";
import type { ToolType, Point, SnapModes, Style, DrawingElement, Layer } from "../../types";

let _prefsTimer: ReturnType<typeof setTimeout> | null = null;
export const _scheduleSavePrefs = (getState: () => { snapModes: SnapModes; snapEnabled: boolean }) => {
  if (_prefsTimer) clearTimeout(_prefsTimer);
  _prefsTimer = setTimeout(() => {
    if (!localStorage.getItem("token")) return;
    const { snapModes, snapEnabled } = getState();
    authApi.updatePreferences({ snapModes, snapEnabled }).catch(() => {});
  }, 800);
};

export const ARCH_LAYER_STYLES: Record<string, Partial<Style>> = {
  "A-WALL": { strokeColor: "#111827", lineWidth: 2, lineType: "solid" },
  "A-DOOR": { strokeColor: "#0F766E", lineWidth: 1.3, lineType: "solid" },
  "A-WIND": { strokeColor: "#2563EB", lineWidth: 1, lineType: "solid" },
  "A-DIMS": { strokeColor: "#DC2626", lineWidth: 1, lineType: "solid" },
  "A-GRID": { strokeColor: "#94A3B8", lineWidth: 0.8, lineType: "dashed" },
  "A-ROOM": { strokeColor: "#334155", lineWidth: 1, lineType: "solid" },
  "A-HATCH": { strokeColor: "#CBD5E1", lineWidth: 0.6, lineType: "solid" },
  "A-FLR": { strokeColor: "#E5E7EB", lineWidth: 0.6, lineType: "solid" },
  "A-TEXT": { strokeColor: "#0F172A", lineWidth: 1, lineType: "solid" },
  "A-META": { strokeColor: "transparent", lineWidth: 0, lineType: "solid" },
  "M-PIPE": { strokeColor: "#0284c7", lineWidth: 1.5, lineType: "dashed" },
  "E-POWR": { strokeColor: "#ca8a04", lineWidth: 1.5, lineType: "dashed" },
};

// Sensible default pipe diameter (mm) per MEP system, applied when the user
// switches system in the Pipe tool without having overridden it themselves.
export const MEP_DEFAULT_DIAMETER: Record<"water" | "electric", number> = {
  water: 50,
  electric: 20,
};

export function ensureLayersForElements(layers: Layer[], elements: DrawingElement[]): Layer[] {
  const known = new Set(layers.map((layer) => layer.id));
  const nextLayers = [...layers];

  for (const element of elements) {
    if (!element.layerId || known.has(element.layerId)) continue;
    known.add(element.layerId);
    nextLayers.push({
      id: element.layerId,
      name: element.layerId,
      visible: true,
      locked: false,
      style: ARCH_LAYER_STYLES[element.layerId] || {},
    });
  }

  return nextLayers;
}

export interface CanvasSlice {
  tool: ToolType;
  panOffset: Point;
  zoom: number;
  gridVisible: boolean;
  snapEnabled: boolean;
  osnapEnabled: boolean;
  orthoEnabled: boolean;
  polarAngle: number;
  snapModes: SnapModes;
  snapThreshold: number;
  currentStyle: Style;
  activeMepSystem: "water" | "electric";
  activeMepDiameter: number;
  // null = use the system's default color (water blue / electric amber); a real
  // color is a per-run override. Kept separate from currentStyle.strokeColor,
  // which defaults to dark gray — tying pipe color to it directly would make
  // every pipe render gray instead of its system color unless explicitly reset.
  activeMepColor: string | null;
  unit: "m" | "mm" | "ft" | "in";
  drawingScale: number;
  viewportBounds: import("../../types").ViewportBounds | null;
  visibleElementIds: string[];
  revisionKey: string;
  setTool(t: ToolType): void;
  setZoom(z: number): void;
  setPanOffset(p: Point): void;
  setStyle(style: Partial<Style>): void;
  setActiveMepSystem(system: "water" | "electric"): void;
  setActiveMepDiameter(diameter: number): void;
  setActiveMepColor(color: string | null): void;
  getResolvedStyle(el: DrawingElement): Style;
  setGridVisible(visible: boolean): void;
  setSnapEnabled(enabled: boolean): void;
  setOsnapEnabled(enabled: boolean): void;
  toggleSnapMode(mode: keyof SnapModes): void;
  loadPreferences(prefs: { snapModes?: Partial<SnapModes>; snapEnabled?: boolean }): void;
  setUnit(unit: "m" | "mm" | "ft" | "in"): void;
  formatLength(valueInMeters: number): string;
  formatArea(valueInSqMeters: number): string;
  updateViewportBounds(bounds: import("../../types").ViewportBounds | null): void;
}

export const createCanvasSlice: StateCreator<CanvasSlice & any, [], [], CanvasSlice> = (set, get) => ({
  tool: "select",
  panOffset: { x: 0, y: 0 },
  zoom: 1,
  currentStyle: {
    strokeColor: "#1f2937",
    fillColor: "transparent",
    lineWidth: 2,
    lineType: "solid",
  },
  activeMepSystem: "water",
  activeMepDiameter: MEP_DEFAULT_DIAMETER.water,
  activeMepColor: null,
  gridVisible: true,
  snapEnabled: true,
  osnapEnabled: true,
  orthoEnabled: false,
  polarAngle: 45,
  snapModes: {
    endpoint: true,
    midpoint: true,
    center: true,
    grid: true,
    intersection: true,
    nearest: false,
    geometricCenter: true,
    node: false,
    quadrant: true,
    perpendicular: true,
    tangent: true,
    insertion: true,
    extension: false,
    apparentIntersection: false,
  },
  snapThreshold: 10,
  unit: "m",
  drawingScale: 1,
  viewportBounds: null,
  visibleElementIds: [],
  revisionKey: Date.now().toString(),

  setTool: (tool) => set({ tool }),
  setZoom: (zoom) => set({ zoom: Math.max(0.001, Math.min(10, zoom)) }),
  setPanOffset: (panOffset) => set({ panOffset }),
  setStyle: (style) => set({ currentStyle: { ...get().currentStyle, ...style } }),
  setActiveMepSystem: (system) => set({ activeMepSystem: system, activeMepDiameter: MEP_DEFAULT_DIAMETER[system], activeMepColor: null }),
  setActiveMepDiameter: (diameter) => set({ activeMepDiameter: diameter }),
  setActiveMepColor: (color) => set({ activeMepColor: color }),
  getResolvedStyle: (el) => {
    const state = get();
    const layer = state.layers.find((l: Layer) => l.id === el.layerId);
    const layerStyle = layer?.style || {};
    return {
      strokeColor: el.strokeColor || layerStyle.strokeColor || state.currentStyle.strokeColor,
      fillColor: el.fillColor || layerStyle.fillColor || state.currentStyle.fillColor,
      lineWidth: el.strokeWidth || el.lineWidth || layerStyle.lineWidth || state.currentStyle.lineWidth,
      lineType: el.lineType || layerStyle.lineType || state.currentStyle.lineType,
    };
  },

  setGridVisible: (visible) => set({ gridVisible: visible }),
  setSnapEnabled: (enabled) => set({ snapEnabled: enabled }),
  setOsnapEnabled: (enabled) => set({ osnapEnabled: enabled }),
  toggleSnapMode: (mode) => {
    set((state: CanvasSlice) => ({ snapModes: { ...state.snapModes, [mode]: !state.snapModes[mode] } }));
    _scheduleSavePrefs(() => get());
  },

  loadPreferences: (prefs) =>
    set((state: CanvasSlice) => ({
      snapModes: prefs.snapModes ? { ...state.snapModes, ...prefs.snapModes } : state.snapModes,
      snapEnabled: prefs.snapEnabled !== undefined ? prefs.snapEnabled : state.snapEnabled,
    })),

  setUnit: (unit) => set({ unit }),

  formatLength: (meters) => {
    const unit = get().unit;
    if (unit === "mm") {
      return `${(meters * 1000).toFixed(0)} mm`;
    }
    if (unit === "ft") {
      const totalInches = meters * 39.3701;
      const feet = Math.floor(totalInches / 12);
      const inches = Math.round(totalInches % 12);
      return `${feet}'-${inches}"`;
    }
    if (unit === "in") {
      return `${(meters * 39.3701).toFixed(1)}"`;
    }
    return `${meters.toFixed(2)} m`;
  },

  formatArea: (sqMeters) => {
    const unit = get().unit;
    if (unit === "ft" || unit === "in") {
      const sqFeet = sqMeters * 10.7639;
      return `${sqFeet.toFixed(1)} sq ft`;
    }
    return `${sqMeters.toFixed(1)} m²`;
  },

  updateViewportBounds: (bounds) => {
    const { elements } = get();
    if (!bounds) {
      set({ viewportBounds: null, visibleElementIds: elements.map((e: DrawingElement) => e.id) });
      return;
    }
    const margin = 100;
    const visibleIds = elements
      .filter((el: DrawingElement) => {
        const ex = el.x || 0;
        const ey = el.y || 0;
        return (
          ex >= bounds.x - margin &&
          ex <= bounds.x + bounds.width + margin &&
          ey >= bounds.y - margin &&
          ey <= bounds.y + bounds.height + margin
        );
      })
      .map((el: DrawingElement) => el.id);
    set({ viewportBounds: bounds, visibleElementIds: visibleIds });
  },
});
