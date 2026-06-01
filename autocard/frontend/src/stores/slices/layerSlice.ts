import type { StateCreator } from "zustand";
import type { Layer, DrawingElement } from "../../types";

export interface LayerSlice {
  layers: Layer[];
  activeLayerId: string;
  addLayer(): void;
  setActiveLayer(id: string): void;
  toggleLayerVisibility(id: string): void;
  toggleLayerLock(id: string): void;
  deleteLayer(id: string): void;
  renameLayer(id: string, name: string): void;
  duplicateLayer(id: string): void;
}

export const createLayerSlice: StateCreator<LayerSlice & any, [], [], LayerSlice> = (set, get) => ({
  layers: [{ id: "layer-1", name: "Layer 1", visible: true, locked: false }],
  activeLayerId: "layer-1",

  addLayer: () =>
    set((state: any) => {
      const id = `layer-${Date.now()}`;
      return {
        layers: [...state.layers, { id, name: `Layer ${state.layers.length + 1}`, visible: true, locked: false }],
        activeLayerId: id,
      };
    }),

  setActiveLayer: (id) => set({ activeLayerId: id }),

  toggleLayerVisibility: (id) =>
    set((state: any) => ({
      layers: state.layers.map((l) =>
        l.id === id ? { ...l, visible: !l.visible } : l
      ),
    })),

  toggleLayerLock: (id) =>
    set((state: any) => ({
      layers: state.layers.map((l) =>
        l.id === id ? { ...l, locked: !l.locked } : l
      ),
    })),

  deleteLayer: (id) =>
    set((state: any) => {
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
    set((state: any) => ({
      layers: state.layers.map((l) => (l.id === id ? { ...l, name } : l)),
    })),

  duplicateLayer: (id) =>
    set((state: any) => {
      const original = state.layers.find((l) => l.id === id);
      if (!original) return state;

      const newId = `layer-${Date.now()}`;
      const newName = `${original.name} (Copy)`;
      const newLayer: Layer = {
        id: newId,
        name: newName,
        visible: true,
        locked: false,
        style: original.style ? { ...original.style } : {},
      };

      const layerElements = state.elements.filter((el: DrawingElement) => el.layerId === id);
      const duplicatedElements = layerElements.map((el: DrawingElement) => {
        const elemCopy = {
          ...el,
          id: `elem-${Math.random().toString(36).substr(2, 9)}`,
          layerId: newId,
        };
        if (elemCopy.type === "rectangle" && typeof elemCopy.x === "number" && typeof elemCopy.y === "number") {
          elemCopy.x += 20;
          elemCopy.y += 20;
        } else if (
          elemCopy.type === "line" &&
          typeof elemCopy.x1 === "number" &&
          typeof elemCopy.y1 === "number" &&
          typeof elemCopy.x2 === "number" &&
          typeof elemCopy.y2 === "number"
        ) {
          elemCopy.x1 += 20;
          elemCopy.y1 += 20;
          elemCopy.x2 += 20;
          elemCopy.y2 += 20;
        } else if (elemCopy.type === "circle" && typeof elemCopy.cx === "number" && typeof elemCopy.cy === "number") {
          elemCopy.cx += 20;
          elemCopy.cy += 20;
        }
        return elemCopy;
      });

      const nextElements = [...state.elements, ...duplicatedElements];

      return {
        layers: [...state.layers, newLayer],
        elements: nextElements,
        activeLayerId: newId,
        history: [...state.history.slice(0, state.historyIndex + 1), nextElements],
        historyIndex: state.historyIndex + 1,
      };
    }),
});
