import type { StateCreator } from "zustand";
import { drawings as drawingsApi } from "../../api/client";
import type { Drawing, DrawingDocument, ViewportBounds } from "../../types";
import { ALL_BLOCK_DEFS } from "../../data/blockLibrary";
import { ensureLayersForElements } from "./canvasSlice";

export interface DrawingSlice {
  drawings: Drawing[];
  loading: boolean;
  error: string | null;
  currentDrawing: Drawing | null;
  currentDrawingId: string | null;
  currentVersion: number;
  dxfLayerOverride: Record<string, "wall" | "door" | "window" | "slab" | "ignore"> | null;
  setDxfLayerOverride(map: Record<string, "wall" | "door" | "window" | "slab" | "ignore"> | null): void;
  fetchDrawings(): Promise<void>;
  createDrawing(name?: string): Promise<Drawing | null>;
  loadDrawing(id: string): Promise<void>;
  saveDrawing(): Promise<void>;
  deleteDrawing(id: string): Promise<void>;
  renameDrawing(id: string, name: string): Promise<void>;
  uploadDrawingAvatar(id: string, file: File): Promise<void>;
  duplicateDrawing(drawing: Drawing): Promise<Drawing | null>;
  importDrawingState(doc: DrawingDocument): void;
  mergeDrawingState(doc: DrawingDocument): void;
  resetEditor(): void;
}

export const createDrawingSlice: StateCreator<DrawingSlice & any, [], [], DrawingSlice> = (set, get) => ({
  drawings: [],
  loading: false,
  error: null,
  currentDrawing: null,
  currentDrawingId: null,
  currentVersion: 0,
  dxfLayerOverride: null,
  setDxfLayerOverride: (map) => set({ dxfLayerOverride: map }),

  fetchDrawings: async () => {
    set({ loading: true, error: null });
    try {
      const data = await drawingsApi.list();
      set({ drawings: data, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

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

  loadDrawing: async (id) => {
    set({ loading: true, error: null });
    try {
      const data = await drawingsApi.get(id);
      const parsed = data.data ? JSON.parse(data.data) : {};
      const elements = Array.isArray(parsed) ? parsed : (parsed.elements || []);
      const parsedBlockDefs = parsed.blockDefs || {};
      const mergedBlockDefs = { ...ALL_BLOCK_DEFS, ...get().blockDefs, ...parsedBlockDefs };
      const measurements = parsed.measurements || [];
      const constraints = parsed.constraints || [];
      const savedLayers = parsed.layers || [];
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
      get().fetchVersions(id);
      get().fetchComments(id);
      get().fetchPermissions(id);
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  saveDrawing: async () => {
    const {
      currentDrawingId, elements, blockDefs, currentDrawing, currentVersion,
      measurements, constraints, currentStyle, layers, activeLayerId, currentArchitecturalPlan,
    } = get();
    if (!currentDrawingId) return;
    set({ loading: true, error: null });
    try {
      const data = JSON.stringify({ elements, blockDefs, measurements, constraints, currentStyle, layers, activeLayerId, currentArchitecturalPlan });
      await drawingsApi.update(currentDrawingId, {
        name: currentDrawing?.name || "Untitled",
        data,
        version: currentVersion,
      });
      set((state: DrawingSlice) => ({ loading: false, currentVersion: state.currentVersion + 1 }));
    } catch (err: any) {
      if (err.message.includes("version conflict")) {
        set({ error: "Version conflict: someone else saved. Please refresh." });
      } else {
        set({ error: err.message, loading: false });
      }
    }
  },

  deleteDrawing: async (id) => {
    set({ loading: true, error: null });
    try {
      await drawingsApi.delete(id);
      set((state: DrawingSlice) => ({
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
      set((state: DrawingSlice) => ({
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
      set((state: DrawingSlice) => ({
        drawings: state.drawings.map((d) =>
          d.id === id ? { ...d, image_url: res.image_url } : d
        ),
        loading: false,
      }));
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  duplicateDrawing: async (drawing) => {
    set({ loading: true, error: null });
    try {
      const copyName = `${drawing.name} (Copy)`;
      const data = await drawingsApi.create({
        name: copyName,
        data: drawing.data || "{}",
        image_url: drawing.image_url || "",
      });
      if (data) {
        set((state: DrawingSlice) => ({
          drawings: [data, ...state.drawings],
          loading: false,
        }));
        return data;
      }
      set({ loading: false });
      return null;
    } catch (err: any) {
      set({ error: err.message, loading: false });
      return null;
    }
  },

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

    const reKeyed = doc.elements.map((el: any) => {
      const newId = `el-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      idMap[el.id] = newId;
      return { ...el, id: newId };
    });

    const remapped = reKeyed.map((el: any) =>
      el.hostWall && idMap[el.hostWall] ? { ...el, hostWall: idMap[el.hostWall] } : el
    );

    let nextLayers = [...state.layers];
    const layerIdMap: Record<string, string> = {};
    for (const il of doc.layers) {
      const byId = state.layers.find((l: any) => l.id === il.id);
      const byName = state.layers.find((l: any) => l.name === il.name);
      if (byId) {
        layerIdMap[il.id] = il.id;
      } else if (byName) {
        layerIdMap[il.id] = byName.id;
      } else {
        nextLayers.push(il);
        layerIdMap[il.id] = il.id;
      }
    }

    const withLayers = remapped.map((el: any) => ({
      ...el,
      layerId: layerIdMap[el.layerId] || el.layerId,
    }));

    const nextBlockDefs = { ...state.blockDefs };
    for (const [blockId, blockDef] of Object.entries(doc.blockDefs)) {
      if (!nextBlockDefs[blockId]) {
        nextBlockDefs[blockId] = blockDef as any;
      } else if (JSON.stringify((nextBlockDefs[blockId] as any).elements) !== JSON.stringify((blockDef as any).elements)) {
        const newBlockId = `${blockId}_merged_${Date.now()}`;
        nextBlockDefs[newBlockId] = { ...(blockDef as any), id: newBlockId };
        withLayers.forEach((el: any, i: number) => {
          if (el.blockId === blockId) withLayers[i] = { ...el, blockId: newBlockId };
        });
      }
    }

    let nextPlan = state.currentArchitecturalPlan;
    if (doc.currentArchitecturalPlan) {
      const ip = doc.currentArchitecturalPlan;
      const ts = Date.now().toString();
      if (nextPlan) {
        nextPlan = {
          ...nextPlan,
          walls: [...nextPlan.walls, ...ip.walls.map((w: any) => ({ ...w, id: `${w.id}_m${ts}` }))],
          openings: [...nextPlan.openings, ...ip.openings.map((o: any) => ({ ...o, id: `${o.id}_m${ts}`, hostWallId: idMap[o.hostWallId] || o.hostWallId }))],
          rooms: [...nextPlan.rooms, ...ip.rooms.map((r: any) => ({ ...r, id: `${r.id}_m${ts}` }))],
          gridAxes: [...nextPlan.gridAxes, ...ip.gridAxes.map((g: any) => ({ ...g, id: `${g.id}_m${ts}` }))],
          dimensions: [...nextPlan.dimensions, ...ip.dimensions.map((d: any) => ({ ...d, id: `${d.id}_m${ts}` }))],
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

  resetEditor: () =>
    set({
      currentDrawing: null,
      currentDrawingId: null,
      currentVersion: 0,
      dxfLayerOverride: null,
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
      blockDefs: { ...ALL_BLOCK_DEFS },
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
});
