import { create } from "zustand";
import { drawings as drawingsApi, auth as authApi } from "../api/client";

let _prefsTimer: ReturnType<typeof setTimeout> | null = null;
const _scheduleSavePrefs = () => {
  if (_prefsTimer) clearTimeout(_prefsTimer);
  _prefsTimer = setTimeout(() => {
    if (!localStorage.getItem("token")) return;
    const { snapModes, snapEnabled } = useDrawingStore.getState();
    authApi.updatePreferences({ snapModes, snapEnabled }).catch(() => {});
  }, 800);
};
import type {
  DrawingElement, BlockDef, Layer, Measurement, Constraint,
  Comment, Permission, Version, Drawing, ViewportBounds,
  ToolType, MeasurementMode, SnapModes, Style, Point, ArchitecturalPlan,
  DrawingDocument,
} from "../types";
import { ALL_BLOCK_DEFS } from "../data/blockLibrary";

const ARCH_LAYER_STYLES: Record<string, Partial<Style>> = {
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
};

function ensureLayersForElements(layers: Layer[], elements: DrawingElement[]): Layer[] {
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

function shiftArchitecturalPlan(plan: ArchitecturalPlan, elementId: string, dx: number, dy: number): ArchitecturalPlan {
  const nextPlan: ArchitecturalPlan = {
    ...plan,
    walls: (plan.walls || []).map((wall) =>
      wall.id === elementId
        ? { ...wall, x1: wall.x1 + dx, y1: wall.y1 + dy, x2: wall.x2 + dx, y2: wall.y2 + dy }
        : wall
    ),
    openings: (plan.openings || []).map((opening) =>
      opening.id === elementId
        ? { ...opening, x: opening.x + dx, y: opening.y + dy }
        : opening
    ),
    rooms: (plan.rooms || []).map((room) =>
      room.id === elementId
        ? {
            ...room,
            labelX: room.labelX + dx,
            labelY: room.labelY + dy,
            boundary: room.boundary.map((p) => ({ x: p.x + dx, y: p.y + dy })),
          }
        : room
    ),
    dimensions: plan.dimensions.map((dim) =>
      dim.id === elementId
        ? { ...dim, x1: dim.x1 + dx, y1: dim.y1 + dy, x2: dim.x2 + dx, y2: dim.y2 + dy }
        : dim
    ),
    gridAxes: plan.gridAxes.map((axis) =>
      axis.id === elementId
        ? { ...axis, value: axis.value + (axis.orientation === "vertical" ? dx : dy) }
        : axis
    ),
  };

  return nextPlan;
}

export interface DrawingStore {
  drawings: Drawing[];
  loading: boolean;
  error: string | null;
  currentDrawing: Drawing | null;
  currentDrawingId: string | null;
  currentVersion: number;
  elements: DrawingElement[];
  selectedElementIds: string[];
  tool: ToolType;
  panOffset: Point;
  zoom: number;
  currentStyle: Style;
  gridVisible: boolean;
  snapEnabled: boolean;
  osnapEnabled: boolean;
  snapModes: SnapModes;
  snapThreshold: number;
  blockDefs: Record<string, BlockDef>;
  layers: Layer[];
  activeLayerId: string;
  history: DrawingElement[][];
  historyIndex: number;
  measurementMode: MeasurementMode;
  measurementPoints: Point[];
  measurements: Measurement[];
  constraints: Constraint[];
  versions: Version[];
  showVersionHistory: boolean;
  comments: Comment[];
  showComments: boolean;
  commentMode: boolean;
  permissions: Permission[];
  showShareDialog: boolean;
  viewportBounds: ViewportBounds | null;
  visibleElementIds: string[];
  currentArchitecturalPlan: ArchitecturalPlan | null;
  fetchDrawings: () => Promise<void>;
  createDrawing: (name?: string) => Promise<Drawing | null>;
  loadDrawing: (id: string) => Promise<void>;
  saveDrawing: () => Promise<void>;
  deleteDrawing: (id: string) => Promise<void>;
  renameDrawing: (id: string, name: string) => Promise<void>;
  uploadDrawingAvatar: (id: string, file: File) => Promise<void>;
  setTool: (tool: ToolType) => void;
  setZoom: (zoom: number) => void;
  setPanOffset: (panOffset: Point) => void;
  setStyle: (style: Partial<Style>) => void;
  getResolvedStyle: (el: DrawingElement) => Style;
  addElement: (element: DrawingElement) => void;
  addElements: (elements: DrawingElement[]) => void;
  updateElement: (id: string, updates: Partial<DrawingElement>) => void;
  updateElements: (ids: string[], updates: Partial<DrawingElement>) => void;
  updateArchitecturalEntity: (entityId: string, updates: Record<string, unknown>) => void;
  deleteSelectedElements: () => void;
  setSelectedElementIds: (ids: string[]) => void;
  undo: () => void;
  redo: () => void;
  addLayer: () => void;
  setActiveLayer: (id: string) => void;
  toggleLayerVisibility: (id: string) => void;
  toggleLayerLock: (id: string) => void;
  deleteLayer: (id: string) => void;
  renameLayer: (id: string, name: string) => void;
  setGridVisible: (visible: boolean) => void;
  setSnapEnabled: (enabled: boolean) => void;
  setOsnapEnabled: (enabled: boolean) => void;
  toggleSnapMode: (mode: keyof SnapModes) => void;
  loadPreferences: (prefs: { snapModes?: Partial<SnapModes>; snapEnabled?: boolean }) => void;
  defineBlock: (name: string, elements: DrawingElement[], insertionPoint: Point) => void;
  insertBlock: (blockId: string, x: number, y: number, scale?: number, rotation?: number) => void;
  explodeBlock: (instanceId: string) => void;
  deleteBlockDef: (blockId: string) => void;
  clearCanvas: () => void;
  resetEditor: () => void;
  setMeasurementMode: (mode: MeasurementMode) => void;
  addMeasurementPoint: (point: Point) => void;
  clearMeasurements: () => void;
  addConstraint: (constraint: Omit<Constraint, "id">) => void;
  removeConstraint: (id: string) => void;
  fetchVersions: (drawingId: string) => Promise<void>;
  setShowVersionHistory: (show: boolean) => void;
  fetchComments: (drawingId: string) => Promise<void>;
  setShowComments: (show: boolean) => void;
  setCommentMode: (mode: boolean) => void;
  addComment: (x: number, y: number, message: string, parentId?: string | null) => Promise<void>;
  fetchPermissions: (drawingId: string) => Promise<void>;
  setShowShareDialog: (show: boolean) => void;
  shareDrawing: (email: string, role: string) => Promise<void>;
  removePermission: (userId: string) => Promise<void>;
  updateViewportBounds: (bounds: ViewportBounds | null) => void;
  setCurrentArchitecturalPlan: (plan: ArchitecturalPlan | null) => void;
  moveArchitecturalElement: (elementId: string, dx: number, dy: number) => void;
  revisionKey: string;
  importDrawingState: (doc: DrawingDocument) => void;
  mergeDrawingState: (doc: DrawingDocument) => void;
}

export const useDrawingStore = create<DrawingStore>((set: any, get: any) => ({
  // Drawing list
  drawings: [],
  loading: false,
  error: null,

  // Current drawing being edited
  currentDrawing: null,
  currentDrawingId: null,
  currentVersion: 0,

  // Canvas state
  elements: [],
  selectedElementIds: [],
  tool: "select",
  panOffset: { x: 0, y: 0 },
  zoom: 1,
  currentStyle: {
    strokeColor: "#1f2937",
    fillColor: "transparent",
    lineWidth: 2,
    lineType: "solid",
  },
  gridVisible: true,
  snapEnabled: true,
  osnapEnabled: true,
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

  // Block definitions — merged with the comprehensive catalog
  blockDefs: ({
    ...ALL_BLOCK_DEFS,
    door: {
      id: "door", name: "Door", insertionPoint: { x: 0, y: 0 }, elements: [
        { id: "d1", type: "rectangle", x: 0, y: -40, width: 40, height: 40, strokeWidth: 1, strokeColor: "#8B5A2B" },
        { id: "d2", type: "arc", cx: 0, cy: 0, radius: 40, startAngle: 270, endAngle: 360, strokeWidth: 1, lineType: "dashed" }
      ]
    },
    window: {
      id: "window", name: "Window", insertionPoint: { x: 0, y: 0 }, elements: [
        { id: "w1", type: "rectangle", x: -20, y: -5, width: 40, height: 10, strokeWidth: 1, strokeColor: "#38BDF8" },
        { id: "w2", type: "line", x1: -20, y1: 0, x2: 20, y2: 0, strokeWidth: 1, strokeColor: "#38BDF8" }
      ]
    },
    desk: {
      id: "desk", name: "Desk", insertionPoint: { x: 0, y: 0 }, elements: [
        { id: "de1", type: "rectangle", x: -30, y: -20, width: 60, height: 40, strokeWidth: 2, strokeColor: "#111827", fillColor: "#F3F4F6" }
      ]
    },
    chair: {
      id: "chair", name: "Chair", insertionPoint: { x: 0, y: 0 }, elements: [
        { id: "c1", type: "circle", cx: 0, cy: 0, radius: 15, strokeWidth: 2, strokeColor: "#111827" },
        { id: "c2", type: "rectangle", x: -12, y: -18, width: 24, height: 8, strokeWidth: 2, strokeColor: "#111827", fillColor: "#9CA3AF" }
      ]
    },
    bed: {
      id: "bed", name: "Bed", insertionPoint: { x: 0, y: 0 }, elements: [
        { id: "b1", type: "rectangle", x: -40, y: -50, width: 80, height: 100, strokeWidth: 2, strokeColor: "#111827", fillColor: "#F3F4F6" },
        { id: "b2", type: "rectangle", x: -35, y: -45, width: 30, height: 20, strokeWidth: 1, strokeColor: "#9CA3AF", fillColor: "#FFFFFF" },
        { id: "b3", type: "rectangle", x: 5, y: -45, width: 30, height: 20, strokeWidth: 1, strokeColor: "#9CA3AF", fillColor: "#FFFFFF" },
        { id: "b4", type: "line", x1: -40, y1: -20, x2: 40, y2: -20, strokeWidth: 1, strokeColor: "#111827" }
      ]
    },
    bath: {
      id: "bath", name: "Bath", insertionPoint: { x: 0, y: 0 }, elements: [
        { id: "bt1", type: "rectangle", x: -30, y: -40, width: 60, height: 80, strokeWidth: 2, strokeColor: "#111827", fillColor: "#F8FAFC" },
        { id: "bt2", type: "circle", cx: 0, cy: 30, radius: 4, strokeWidth: 1, strokeColor: "#64748B" }
      ]
    },
    sofa: {
      id: "sofa", name: "Sofa", insertionPoint: { x: 0, y: 0 }, elements: [
        { id: "s1", type: "rectangle", x: -40, y: -20, width: 80, height: 40, strokeWidth: 2, strokeColor: "#111827", fillColor: "#E5E7EB" },
        { id: "s2", type: "rectangle", x: -40, y: -25, width: 80, height: 10, strokeWidth: 2, strokeColor: "#111827", fillColor: "#D1D5DB" },
        { id: "s3", type: "rectangle", x: -45, y: -20, width: 10, height: 40, strokeWidth: 2, strokeColor: "#111827", fillColor: "#D1D5DB" },
        { id: "s4", type: "rectangle", x: 35, y: -20, width: 10, height: 40, strokeWidth: 2, strokeColor: "#111827", fillColor: "#D1D5DB" }
      ]
    },
    table: {
      id: "table", name: "Table", insertionPoint: { x: 0, y: 0 }, elements: [
        { id: "t1", type: "circle", cx: 0, cy: 0, radius: 40, strokeWidth: 2, strokeColor: "#111827", fillColor: "#F3F4F6" },
        { id: "t2", type: "circle", cx: 0, cy: -20, radius: 10, strokeWidth: 1, strokeColor: "#9CA3AF" } // Centerpiece
      ]
    },
    plant: {
      id: "plant", name: "Plant", insertionPoint: { x: 0, y: 0 }, elements: [
        { id: "p1", type: "circle", cx: 0, cy: 0, radius: 15, strokeWidth: 2, strokeColor: "#111827", fillColor: "#D1D5DB" }, // Pot
        { id: "p2", type: "circle", cx: 0, cy: -10, radius: 8, strokeWidth: 1, strokeColor: "#10B981", fillColor: "#34D399" }, // Leaf
        { id: "p3", type: "circle", cx: 10, cy: 5, radius: 8, strokeWidth: 1, strokeColor: "#10B981", fillColor: "#34D399" }, // Leaf
        { id: "p4", type: "circle", cx: -10, cy: 5, radius: 8, strokeWidth: 1, strokeColor: "#10B981", fillColor: "#34D399" } // Leaf
      ]
    },
    toilet: {
      id: "toilet", name: "Toilet", insertionPoint: { x: 0, y: 0 }, elements: [
        { id: "tl1", type: "rectangle", x: -12, y: -20, width: 24, height: 15, strokeWidth: 2, strokeColor: "#111827", fillColor: "#F8FAFC" }, // Tank
        { id: "tl2", type: "circle", cx: 0, cy: 5, radius: 12, strokeWidth: 2, strokeColor: "#111827", fillColor: "#F8FAFC" } // Bowl
      ]
    },
    sink: {
      id: "sink", name: "Sink", insertionPoint: { x: 0, y: 0 }, elements: [
        { id: "sk1", type: "rectangle", x: -20, y: -15, width: 40, height: 30, strokeWidth: 2, strokeColor: "#111827", fillColor: "#F8FAFC" }, // Counter
        { id: "sk2", type: "circle", cx: 0, cy: 0, radius: 10, strokeWidth: 1, strokeColor: "#9CA3AF", fillColor: "#E5E7EB" }, // Basin
        { id: "sk3", type: "circle", cx: 0, cy: -10, radius: 2, strokeWidth: 1, strokeColor: "#111827" } // Faucet
      ]
    },
    car: {
      id: "car", name: "Car", insertionPoint: { x: 0, y: 0 }, elements: [
        { id: "cr1", type: "rectangle", x: -25, y: -50, width: 50, height: 100, strokeWidth: 2, strokeColor: "#111827", fillColor: "#E5E7EB" }, // Body
        { id: "cr2", type: "rectangle", x: -20, y: -20, width: 40, height: 40, strokeWidth: 1, strokeColor: "#38BDF8", fillColor: "#BAE6FD" } // Roof/Windows
      ]
    },
  } as unknown as Record<string, BlockDef>),

  // Layers
  layers: [{ id: "layer-1", name: "Layer 1", visible: true, locked: false }],
  activeLayerId: "layer-1",

  // History (undo/redo)
  history: [],
  historyIndex: -1,

  // Measurement state
  measurementMode: null,
  measurementPoints: [],
  measurements: [],

  // Constraint system
  constraints: [],

  // Version history
  versions: [],
  showVersionHistory: false,

  // Comments
  comments: [],
  showComments: false,
  commentMode: false,

  // Permissions
  permissions: [],
  showShareDialog: false,

  // Performance: virtual canvas
  viewportBounds: null,
  visibleElementIds: [],
  currentArchitecturalPlan: null,
  revisionKey: Date.now().toString(),

  // Fetch all drawings
  fetchDrawings: async () => {
    set({ loading: true, error: null });
    try {
      const data = await drawingsApi.list();
      set({ drawings: data, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  // Create new drawing
  createDrawing: async (name = "Untitled") => {
    set({ loading: true, error: null });
    try {
      const data = await drawingsApi.create({ name, data: "{}" });
      set({ loading: false });
      return data;
    } catch (err: any) {
      set({ error: err.message, loading: false });
      return null;
    }
  },

  // Load a drawing for editing
  loadDrawing: async (id) => {
    set({ loading: true, error: null });
    try {
      const data = await drawingsApi.get(id);
      const parsed = data.data ? JSON.parse(data.data) : {};
      const elements = Array.isArray(parsed) ? parsed : (parsed.elements || []);
      const parsedBlockDefs = parsed.blockDefs || {};
      const mergedBlockDefs = { ...get().blockDefs, ...parsedBlockDefs };
      const measurements = parsed.measurements || [];
      const constraints = parsed.constraints || [];
      const savedLayers: Layer[] = parsed.layers || [];
      const activeLayerId: string = parsed.activeLayerId || (savedLayers[0]?.id ?? "layer-1");
      const currentArchitecturalPlan = parsed.currentArchitecturalPlan ?? null;
      const mergedLayers = ensureLayersForElements(
        savedLayers.length > 0 ? savedLayers : [{ id: "layer-1", name: "Layer 1", visible: true, locked: false }],
        elements,
      );
      const stateUpdate: Record<string, unknown> = {
        currentDrawing: data,
        currentDrawingId: id,
        currentVersion: data.version || 0,
        elements,
        blockDefs: mergedBlockDefs,
        measurements,
        constraints,
        layers: mergedLayers,
        activeLayerId,
        currentArchitecturalPlan,
        loading: false,
        history: [elements],
        historyIndex: 0,
      };
      if (parsed.currentStyle) stateUpdate.currentStyle = parsed.currentStyle;
      set(stateUpdate);
      // Fetch versions and comments in background
      get().fetchVersions(id);
      get().fetchComments(id);
      get().fetchPermissions(id);
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  // Save current drawing
  saveDrawing: async () => {
    const { currentDrawingId, elements, blockDefs, currentDrawing, currentVersion, measurements, constraints, currentStyle, layers, activeLayerId, currentArchitecturalPlan } = get();
    if (!currentDrawingId) return;
    set({ loading: true, error: null });
    try {
      const data = JSON.stringify({ elements, blockDefs, measurements, constraints, currentStyle, layers, activeLayerId, currentArchitecturalPlan });
      const updated = await drawingsApi.update(currentDrawingId, {
        name: currentDrawing?.name || "Untitled",
        data,
        version: currentVersion,
      });
      set((state) => ({ loading: false, currentVersion: state.currentVersion + 1 }));
    } catch (err: any) {
      if (err.message.includes("version conflict")) {
        set({ error: "Version conflict: someone else saved. Please refresh." });
      } else {
        set({ error: err.message, loading: false });
      }
    }
  },

  // Delete a drawing
  deleteDrawing: async (id) => {
    set({ loading: true, error: null });
    try {
      await drawingsApi.delete(id);
      set((state) => ({
        drawings: state.drawings.filter((d) => d.id !== id),
        loading: false,
      }));
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  renameDrawing: async (id, name) => {
    set({ loading: true, error: null });
    try {
      await drawingsApi.rename(id, name);
      set((state) => ({
        drawings: state.drawings.map((d) => (d.id === id ? { ...d, name } : d)),
        loading: false,
      }));
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  uploadDrawingAvatar: async (id, file) => {
    set({ loading: true, error: null });
    try {
      const res = await drawingsApi.uploadAvatar(id, file);
      set((state) => ({
        drawings: state.drawings.map((d) =>
          d.id === id ? { ...d, image_url: res.image_url } : d
        ),
        loading: false,
      }));
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  // Canvas actions
  setTool: (tool) => set({ tool }),
  setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(10, zoom)) }),
  setPanOffset: (panOffset) => set({ panOffset }),
  setStyle: (style) => set({ currentStyle: { ...get().currentStyle, ...style } }),
  getResolvedStyle: (el) => {
    const state = get();
    const layer = state.layers.find((l) => l.id === el.layerId);
    const layerStyle = layer?.style || {};
    return {
      strokeColor: el.strokeColor || layerStyle.strokeColor || state.currentStyle.strokeColor,
      fillColor: el.fillColor || layerStyle.fillColor || state.currentStyle.fillColor,
      lineWidth: el.strokeWidth || el.lineWidth || layerStyle.lineWidth || state.currentStyle.lineWidth,
      lineType: el.lineType || layerStyle.lineType || state.currentStyle.lineType,
    };
  },

  addElement: (element) =>
    set((state) => {
      const newElements = [...state.elements, element];
      const newVisible = state.viewportBounds ? [...state.visibleElementIds, element.id] : state.visibleElementIds;
      return {
        elements: newElements,
        layers: ensureLayersForElements(state.layers, [element]),
        visibleElementIds: newVisible,
        history: [...state.history.slice(0, state.historyIndex + 1), newElements],
        historyIndex: state.historyIndex + 1,
      };
    }),

  addElements: (elements) =>
    set((state) => {
      if (elements.length === 0) return state;
      const newElements = [...state.elements, ...elements];
      const newVisible = state.viewportBounds 
        ? [...state.visibleElementIds, ...elements.map(e => e.id)] 
        : state.visibleElementIds;
      return {
        elements: newElements,
        layers: ensureLayersForElements(state.layers, elements),
        visibleElementIds: newVisible,
        history: [...state.history.slice(0, state.historyIndex + 1), newElements],
        historyIndex: state.historyIndex + 1,
      };
    }),

  updateElement: (id, updates) =>
    set((state) => {
      const newElements = state.elements.map((el) =>
        el.id === id ? { ...el, ...updates } : el
      );
      return {
        elements: newElements,
        history: [...state.history.slice(0, state.historyIndex + 1), newElements],
        historyIndex: state.historyIndex + 1,
      };
    }),

  updateElements: (ids, updates) =>
    set((state) => {
      const idSet = new Set(ids);
      const newElements = state.elements.map((el) =>
        idSet.has(el.id) ? { ...el, ...updates } : el
      );
      return {
        elements: newElements,
        history: [...state.history.slice(0, state.historyIndex + 1), newElements],
        historyIndex: state.historyIndex + 1,
      };
    }),

  updateArchitecturalEntity: (entityId, updates) =>
    set((state) => {
      if (!state.currentArchitecturalPlan) return state;
      const plan = state.currentArchitecturalPlan;
      return {
        currentArchitecturalPlan: {
          ...plan,
          walls: plan.walls.map((w) => w.id === entityId ? { ...w, ...updates } : w),
          openings: plan.openings.map((o) => o.id === entityId ? { ...o, ...updates } : o),
          rooms: plan.rooms.map((r) => r.id === entityId ? { ...r, ...updates } : r),
          gridAxes: plan.gridAxes.map((g) => g.id === entityId ? { ...g, ...updates } : g),
          dimensions: plan.dimensions.map((d) => d.id === entityId ? { ...d, ...updates } : d),
        },
      };
    }),

  deleteSelectedElements: () =>
    set((state) => {
      const newElements = state.elements.filter(
        (el) => !state.selectedElementIds.includes(el.id)
      );
      const newVisible = state.visibleElementIds.filter(
        (id) => !state.selectedElementIds.includes(id)
      );
      return {
        elements: newElements,
        visibleElementIds: newVisible,
        selectedElementIds: [],
        history: [...state.history.slice(0, state.historyIndex + 1), newElements],
        historyIndex: state.historyIndex + 1,
      };
    }),

  setSelectedElementIds: (ids) => set({ selectedElementIds: ids }),

  undo: () =>
    set((state) => {
      if (state.historyIndex <= 0) return state;
      const newIndex = state.historyIndex - 1;
      return {
        elements: state.history[newIndex],
        historyIndex: newIndex,
      };
    }),

  redo: () =>
    set((state) => {
      if (state.historyIndex >= state.history.length - 1) return state;
      const newIndex = state.historyIndex + 1;
      return {
        elements: state.history[newIndex],
        historyIndex: newIndex,
      };
    }),

  // Layer actions
  addLayer: () =>
    set((state) => {
      const id = `layer-${Date.now()}`;
      return {
        layers: [...state.layers, { id, name: `Layer ${state.layers.length + 1}`, visible: true, locked: false }],
        activeLayerId: id,
      };
    }),

  setActiveLayer: (id) => set({ activeLayerId: id }),

  toggleLayerVisibility: (id) =>
    set((state) => ({
      layers: state.layers.map((l) =>
        l.id === id ? { ...l, visible: !l.visible } : l
      ),
    })),

  toggleLayerLock: (id) =>
    set((state) => ({
      layers: state.layers.map((l) =>
        l.id === id ? { ...l, locked: !l.locked } : l
      ),
    })),

  deleteLayer: (id) =>
    set((state) => {
      const newLayers = state.layers.filter((l) => l.id !== id);
      return {
        layers: newLayers.length ? newLayers : state.layers,
        activeLayerId:
          state.activeLayerId === id
            ? newLayers[0]?.id || state.layers[0].id
            : state.activeLayerId,
      };
    }),

  renameLayer: (id, name) =>
    set((state) => ({
      layers: state.layers.map((l) => (l.id === id ? { ...l, name } : l)),
    })),

  // Grid & Snap
  setGridVisible: (visible) => set({ gridVisible: visible }),
  setSnapEnabled: (enabled) => set({ snapEnabled: enabled }),
  setOsnapEnabled: (enabled) => set({ osnapEnabled: enabled }),
  toggleSnapMode: (mode) => {
    set((state) => ({ snapModes: { ...state.snapModes, [mode]: !state.snapModes[mode] } }));
    _scheduleSavePrefs();
  },

  loadPreferences: (prefs) =>
    set((state) => ({
      snapModes: prefs.snapModes ? { ...state.snapModes, ...prefs.snapModes } : state.snapModes,
      snapEnabled: prefs.snapEnabled !== undefined ? prefs.snapEnabled : state.snapEnabled,
    })),

  // Block definitions
  defineBlock: (name, elements, insertionPoint) =>
    set((state) => {
      const id = `block-${Date.now()}`;
      return {
        blockDefs: {
          ...state.blockDefs,
          [id]: { id, name, elements: JSON.parse(JSON.stringify(elements)), insertionPoint },
        },
      };
    }),

  insertBlock: (blockId, x, y, scale = 1, rotation = 0) =>
    set((state) => {
      const id = `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const newElements = [
        ...state.elements,
        { id, type: "block", blockId, x, y, scale, rotation, layerId: state.activeLayerId },
      ];
      return {
        elements: newElements,
        history: [...state.history.slice(0, state.historyIndex + 1), newElements],
        historyIndex: state.historyIndex + 1,
      };
    }),

  explodeBlock: (instanceId) =>
    set((state) => {
      const instance = state.elements.find((el) => el.id === instanceId);
      if (!instance || instance.type !== "block") return state;
      const blockDef = state.blockDefs[instance.blockId];
      if (!blockDef) return state;
      const newEls = blockDef.elements.map((el) => ({
        ...el,
        id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        x: (el.x || 0) + instance.x,
        y: (el.y || 0) + instance.y,
        layerId: instance.layerId,
      }));
      const newElements = state.elements
        .filter((el) => el.id !== instanceId)
        .concat(newEls);
      return {
        elements: newElements,
        history: [...state.history.slice(0, state.historyIndex + 1), newElements],
        historyIndex: state.historyIndex + 1,
      };
    }),

  deleteBlockDef: (blockId) =>
    set((state) => {
      const { [blockId]: _, ...rest } = state.blockDefs;
      return { blockDefs: rest };
    }),

  clearCanvas: () =>
    set({
      elements: [],
      selectedElementIds: [],
      measurements: [],
      constraints: [],
      history: [[]],
      historyIndex: 0,
    }),

  resetEditor: () =>
    set({
      currentDrawing: null,
      currentDrawingId: null,
      currentVersion: 0,
      elements: [],
      selectedElementIds: [],
      tool: "select",
      panOffset: { x: 0, y: 0 },
      zoom: 1,
      gridVisible: true,
      snapEnabled: true,
      osnapEnabled: true,
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
      blockDefs: {},
      layers: [{ id: "layer-1", name: "Layer 1", visible: true, locked: false }],
      activeLayerId: "layer-1",
      history: [[]],
      historyIndex: -1,
      measurementMode: null,
      measurementPoints: [],
      measurements: [],
      constraints: [],
      versions: [],
      showVersionHistory: false,
      comments: [],
      showComments: false,
      commentMode: false,
      permissions: [],
      showShareDialog: false,
      viewportBounds: null,
      visibleElementIds: [],
    }),

  // === MEASUREMENT TOOLS ===
  setMeasurementMode: (mode) => set({ measurementMode: mode, measurementPoints: [] }),
  addMeasurementPoint: (point) =>
    set((state) => {
      const newPoints = [...state.measurementPoints, point];
      // If we have enough points, compute measurement
      if (state.measurementMode === "distance" && newPoints.length === 2) {
        const dx = newPoints[1].x - newPoints[0].x;
        const dy = newPoints[1].y - newPoints[0].y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const measurement = {
          id: `meas-${Date.now()}`,
          type: "distance",
          points: [...newPoints],
          value: distance,
          label: `${distance.toFixed(2)}`,
        };
        return {
          measurementPoints: [],
          measurements: [...state.measurements, measurement],
        };
      }
      if (state.measurementMode === "angle" && newPoints.length === 3) {
        const p1 = newPoints[0], p2 = newPoints[1], p3 = newPoints[2];
        const a1 = Math.atan2(p1.y - p2.y, p1.x - p2.x);
        const a2 = Math.atan2(p3.y - p2.y, p3.x - p2.x);
        let angle = Math.abs((a2 - a1) * 180 / Math.PI);
        if (angle > 180) angle = 360 - angle;
        const measurement = {
          id: `meas-${Date.now()}`,
          type: "angle",
          points: [...newPoints],
          value: angle,
          label: `${angle.toFixed(1)}°`,
        };
        return {
          measurementPoints: [],
          measurements: [...state.measurements, measurement],
        };
      }
      if (state.measurementMode === "area" && newPoints.length >= 3) {
        // Check if polygon is closed (click near first point)
        const first = newPoints[0];
        const last = newPoints[newPoints.length - 1];
        const dist = Math.sqrt((last.x - first.x) ** 2 + (last.y - first.y) ** 2);
        if (dist < 10 && newPoints.length > 3) {
          const pts = newPoints.slice(0, -1);
          let area = 0;
          for (let i = 0; i < pts.length; i++) {
            const j = (i + 1) % pts.length;
            area += pts[i].x * pts[j].y;
            area -= pts[j].x * pts[i].y;
          }
          area = Math.abs(area) / 2;
          const measurement = {
            id: `meas-${Date.now()}`,
            type: "area",
            points: pts,
            value: area,
            label: `${area.toFixed(2)} sq units`,
          };
          return {
            measurementPoints: [],
            measurements: [...state.measurements, measurement],
          };
        }
        return { measurementPoints: newPoints };
      }
      return { measurementPoints: newPoints };
    }),
  clearMeasurements: () => set({ measurements: [], measurementPoints: [] }),

  // === CONSTRAINT SYSTEM ===
  addConstraint: (constraint) =>
    set((state) => ({
      constraints: [...state.constraints, { id: `const-${Date.now()}`, ...constraint }],
    })),
  removeConstraint: (id) =>
    set((state) => ({
      constraints: state.constraints.filter((c) => c.id !== id),
    })),

  // === VERSION HISTORY ===
  fetchVersions: async (drawingId) => {
    try {
      const versions = await drawingsApi.getVersions(drawingId);
      set({ versions });
    } catch (e: any) {
      // ignore
    }
  },
  setShowVersionHistory: (show) => set({ showVersionHistory: show }),

  // === COMMENTS ===
  fetchComments: async (drawingId) => {
    try {
      const comments = await drawingsApi.getComments(drawingId);
      set({ comments });
    } catch (e: any) {
      // ignore
    }
  },
  setShowComments: (show) => set({ showComments: show }),
  setCommentMode: (mode) => set({ commentMode: mode }),
  addComment: async (x, y, message, parentId = null) => {
    const { currentDrawingId } = get();
    if (!currentDrawingId) return;
    try {
      const comment = await drawingsApi.createComment(currentDrawingId, { x, y, message, parent_id: parentId });
      set((state) => ({ comments: [...state.comments, comment] }));
    } catch (e: any) {
      // ignore
    }
  },

  // === PERMISSIONS ===
  fetchPermissions: async (drawingId) => {
    try {
      const permissions = await drawingsApi.getPermissions(drawingId);
      set({ permissions });
    } catch (e: any) {
      // ignore
    }
  },
  setShowShareDialog: (show) => set({ showShareDialog: show }),
  shareDrawing: async (email, role) => {
    const { currentDrawingId } = get();
    if (!currentDrawingId) return;
    try {
      await drawingsApi.share(currentDrawingId, { email, role });
      await get().fetchPermissions(currentDrawingId);
    } catch (e: any) {
      // ignore
    }
  },
  removePermission: async (userId) => {
    const { currentDrawingId } = get();
    if (!currentDrawingId) return;
    try {
      await drawingsApi.removePermission(currentDrawingId, userId);
      await get().fetchPermissions(currentDrawingId);
    } catch (e: any) {
      // ignore
    }
  },

  // === PERFORMANCE: Virtual Canvas ===
  updateViewportBounds: (bounds) => {
    const { elements } = get();
    if (!bounds) {
      set({ viewportBounds: null, visibleElementIds: elements.map((e) => e.id) });
      return;
    }
    // Simple AABB culling
    const margin = 100;
    const visibleIds = elements
      .filter((el) => {
        const ex = el.x || 0;
        const ey = el.y || 0;
        return (
          ex >= bounds.x - margin &&
          ex <= bounds.x + bounds.width + margin &&
          ey >= bounds.y - margin &&
          ey <= bounds.y + bounds.height + margin
        );
      })
      .map((el) => el.id);
    set({ viewportBounds: bounds, visibleElementIds: visibleIds });
  },
  setCurrentArchitecturalPlan: (plan) => set({ currentArchitecturalPlan: plan }),

  importDrawingState: (doc) => {
    const layers = ensureLayersForElements(doc.layers, doc.elements);
    set({
      elements: doc.elements,
      layers,
      activeLayerId: doc.activeLayerId,
      blockDefs: { ...get().blockDefs, ...doc.blockDefs },
      currentArchitecturalPlan: doc.currentArchitecturalPlan,
      measurements: doc.measurements,
      constraints: doc.constraints,
      selectedElementIds: [],
      history: [doc.elements],
      historyIndex: 0,
      revisionKey: Date.now().toString(),
    });
  },

  mergeDrawingState: (doc) => {
    const state = get();
    const idMap: Record<string, string> = {};

    // Re-key all imported elements
    const reKeyed = doc.elements.map(el => {
      const newId = `el-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      idMap[el.id] = newId;
      return { ...el, id: newId };
    });

    // Remap hostWall references
    const remapped = reKeyed.map(el =>
      el.hostWall && idMap[el.hostWall] ? { ...el, hostWall: idMap[el.hostWall] } : el
    );

    // Layer collision resolution
    let nextLayers = [...state.layers];
    const layerIdMap: Record<string, string> = {};
    for (const il of doc.layers) {
      const byId = state.layers.find(l => l.id === il.id);
      const byName = state.layers.find(l => l.name === il.name);
      if (byId) {
        layerIdMap[il.id] = il.id;
      } else if (byName) {
        layerIdMap[il.id] = byName.id;
      } else {
        nextLayers.push(il);
        layerIdMap[il.id] = il.id;
      }
    }

    const withLayers = remapped.map(el => ({
      ...el,
      layerId: layerIdMap[el.layerId] || el.layerId,
    }));

    // Block def collision resolution
    const nextBlockDefs = { ...state.blockDefs };
    for (const [blockId, blockDef] of Object.entries(doc.blockDefs)) {
      if (!nextBlockDefs[blockId]) {
        nextBlockDefs[blockId] = blockDef;
      } else if (JSON.stringify(nextBlockDefs[blockId].elements) !== JSON.stringify(blockDef.elements)) {
        const newBlockId = `${blockId}_merged_${Date.now()}`;
        nextBlockDefs[newBlockId] = { ...blockDef, id: newBlockId };
        withLayers.forEach((el, i) => {
          if (el.blockId === blockId) withLayers[i] = { ...el, blockId: newBlockId };
        });
      }
    }

    // Merge architectural plan
    let nextPlan = state.currentArchitecturalPlan;
    if (doc.currentArchitecturalPlan) {
      const ip = doc.currentArchitecturalPlan;
      const ts = Date.now().toString();
      if (nextPlan) {
        nextPlan = {
          ...nextPlan,
          walls: [...nextPlan.walls, ...ip.walls.map(w => ({ ...w, id: `${w.id}_m${ts}` }))],
          openings: [...nextPlan.openings, ...ip.openings.map(o => ({ ...o, id: `${o.id}_m${ts}`, hostWallId: idMap[o.hostWallId] || o.hostWallId }))],
          rooms: [...nextPlan.rooms, ...ip.rooms.map(r => ({ ...r, id: `${r.id}_m${ts}` }))],
          gridAxes: [...nextPlan.gridAxes, ...ip.gridAxes.map(g => ({ ...g, id: `${g.id}_m${ts}` }))],
          dimensions: [...nextPlan.dimensions, ...ip.dimensions.map(d => ({ ...d, id: `${d.id}_m${ts}` }))],
        };
      } else {
        nextPlan = ip;
      }
    }

    const nextElements = [...state.elements, ...withLayers];
    const finalLayers = ensureLayersForElements(nextLayers, withLayers);
    set({
      elements: nextElements,
      layers: finalLayers,
      blockDefs: nextBlockDefs,
      currentArchitecturalPlan: nextPlan,
      measurements: [...state.measurements, ...doc.measurements],
      constraints: [...state.constraints, ...doc.constraints],
      history: [...state.history.slice(0, state.historyIndex + 1), nextElements],
      historyIndex: state.historyIndex + 1,
    });
  },

  moveArchitecturalElement: (elementId, dx, dy) =>
    set((state) => {
      if (!state.currentArchitecturalPlan) return state;
      const nextPlan = shiftArchitecturalPlan(state.currentArchitecturalPlan, elementId, dx, dy);
      const nextElements = state.elements.map((el) => {
        if (el.id !== elementId) return el;
        if (typeof el.x === "number" && typeof el.y === "number") {
          return { ...el, x: el.x + dx, y: el.y + dy };
        }
        if (typeof el.x1 === "number" && typeof el.y1 === "number" && typeof el.x2 === "number" && typeof el.y2 === "number") {
          return { ...el, x1: el.x1 + dx, y1: el.y1 + dy, x2: el.x2 + dx, y2: el.y2 + dy };
        }
        if (typeof el.cx === "number" && typeof el.cy === "number") {
          return { ...el, cx: el.cx + dx, cy: el.cy + dy };
        }
        if (el.points) {
          return { ...el, points: el.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) };
        }
        return el;
      });
      return {
        currentArchitecturalPlan: nextPlan,
        elements: nextElements,
        history: [...state.history.slice(0, state.historyIndex + 1), nextElements],
        historyIndex: state.historyIndex + 1,
      };
    }),
}));
