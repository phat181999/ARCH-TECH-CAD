

  import { create } from "zustand";
import { drawings as drawingsApi } from "../api/client";

export const useDrawingStore = create((set, get) => ({
  // Drawing list
  drawings: [],
  loading: false,
  error: null,

  // Current drawing being edited
  currentDrawing: null,
  currentDrawingId: null,

  // Canvas state
  elements: [],
  selectedElementIds: [],
  tool: "select",
  panOffset: { x: 0, y: 0 },
  zoom: 1,
  gridVisible: true,
  snapEnabled: true,
  snapModes: {
    endpoint: true,
    midpoint: true,
    center: true,
    grid: true,
    intersection: false,
  },
  snapThreshold: 10,

  // Block definitions
  blockDefs: {},

  // Layers
  layers: [{ id: "layer-1", name: "Layer 1", visible: true, locked: false }],
  activeLayerId: "layer-1",

  // History (undo/redo)
  history: [],
  historyIndex: -1,

  // Fetch all drawings
  fetchDrawings: async () => {
    set({ loading: true, error: null });
    try {
      const data = await drawingsApi.list();
      set({ drawings: data, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  // Create new drawing
  createDrawing: async (name = "Untitled") => {
    set({ loading: true, error: null });
    try {
      const data = await drawingsApi.create({ name, data: "[]" });
      set({ loading: false });
      return data;
    } catch (err) {
      set({ error: err.message, loading: false });
      return null;
    }
  },

  // Load a drawing for editing
  loadDrawing: async (id) => {
    set({ loading: true, error: null });
    try {
      const data = await drawingsApi.get(id);
      const elements = data.data ? JSON.parse(data.data) : [];
      set({
        currentDrawing: data,
        currentDrawingId: id,
        elements,
        loading: false,
        history: [elements],
        historyIndex: 0,
      });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  // Save current drawing
  saveDrawing: async () => {
    const { currentDrawingId, elements, currentDrawing } = get();
    if (!currentDrawingId) return;
    set({ loading: true, error: null });
    try {
      const data = JSON.stringify(elements);
      await drawingsApi.update(currentDrawingId, {
        name: currentDrawing?.name || "Untitled",
        data,
      });
      set({ loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
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
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  // Canvas actions
  setTool: (tool) => set({ tool }),
  setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(10, zoom)) }),
  setPanOffset: (panOffset) => set({ panOffset }),

  addElement: (element) =>
    set((state) => {
      const newElements = [...state.elements, element];
      return {
        elements: newElements,
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

  deleteSelectedElements: () =>
    set((state) => {
      const newElements = state.elements.filter(
        (el) => !state.selectedElementIds.includes(el.id)
      );
      return {
        elements: newElements,
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
  toggleSnapMode: (mode) =>
    set((state) => ({
      snapModes: { ...state.snapModes, [mode]: !state.snapModes[mode] },
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
      history: [[]],
      historyIndex: 0,
    }),

  resetEditor: () =>
    set({
      currentDrawing: null,
      currentDrawingId: null,
      elements: [],
      selectedElementIds: [],
      tool: "select",
      panOffset: { x: 0, y: 0 },
      zoom: 1,
      gridVisible: true,
      snapEnabled: true,
      snapModes: {
        endpoint: true,
        midpoint: true,
        center: true,
        grid: true,
        intersection: false,
      },
      snapThreshold: 10,
      blockDefs: {},
      layers: [{ id: "layer-1", name: "Layer 1", visible: true, locked: false }],
      activeLayerId: "layer-1",
      history: [[]],
      historyIndex: -1,
    }),
}));