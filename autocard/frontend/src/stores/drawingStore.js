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
  currentVersion: 0,

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

  // Measurement state
  measurementMode: null, // "distance", "angle", "area"
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
      const data = await drawingsApi.create({ name, data: "{}" });
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
      const parsed = data.data ? JSON.parse(data.data) : {};
      const elements = Array.isArray(parsed) ? parsed : (parsed.elements || []);
      const blockDefs = parsed.blockDefs || {};
      const measurements = parsed.measurements || [];
      const constraints = parsed.constraints || [];
      set({
        currentDrawing: data,
        currentDrawingId: id,
        currentVersion: data.version || 0,
        elements,
        blockDefs,
        measurements,
        constraints,
        loading: false,
        history: [elements],
        historyIndex: 0,
      });
      // Fetch versions and comments in background
      get().fetchVersions(id);
      get().fetchComments(id);
      get().fetchPermissions(id);
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  // Save current drawing
  saveDrawing: async () => {
    const { currentDrawingId, elements, blockDefs, currentDrawing, currentVersion, measurements, constraints } = get();
    if (!currentDrawingId) return;
    set({ loading: true, error: null });
    try {
      const data = JSON.stringify({ elements, blockDefs, measurements, constraints });
      const updated = await drawingsApi.update(currentDrawingId, {
        name: currentDrawing?.name || "Untitled",
        data,
        version: currentVersion,
      });
      set((state) => ({ loading: false, currentVersion: state.currentVersion + 1 }));
    } catch (err) {
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
    } catch (e) {
      // ignore
    }
  },
  setShowVersionHistory: (show) => set({ showVersionHistory: show }),

  // === COMMENTS ===
  fetchComments: async (drawingId) => {
    try {
      const comments = await drawingsApi.getComments(drawingId);
      set({ comments });
    } catch (e) {
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
    } catch (e) {
      // ignore
    }
  },

  // === PERMISSIONS ===
  fetchPermissions: async (drawingId) => {
    try {
      const permissions = await drawingsApi.getPermissions(drawingId);
      set({ permissions });
    } catch (e) {
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
    } catch (e) {
      // ignore
    }
  },
  removePermission: async (userId) => {
    const { currentDrawingId } = get();
    if (!currentDrawingId) return;
    try {
      await drawingsApi.removePermission(currentDrawingId, userId);
      await get().fetchPermissions(currentDrawingId);
    } catch (e) {
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
}));
