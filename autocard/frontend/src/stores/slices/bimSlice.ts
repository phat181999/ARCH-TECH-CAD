import type { StateCreator } from "zustand";
import type { BimPropertySet, BimQuantities, IfcStorey } from "../../types";

export interface BimSlice {
  // Global pset overrides per element (elementId → psets)
  elementPsets: Record<string, BimPropertySet[]>;

  // Computed quantity cache (elementId → quantities)
  quantityCache: Record<string, BimQuantities>;

  // IFC storey levels
  storeys: IfcStorey[];

  // Actions
  setElementPset(elementId: string, psets: BimPropertySet[]): void;
  updatePsetProperty(
    elementId: string,
    psetName: string,
    propertyKey: string,
    value: BimPropertySet["properties"][string],
  ): void;
  setQuantityCache(elementId: string, quantities: BimQuantities): void;
  invalidateQuantityCache(elementIds: string[]): void;
  addStorey(storey: IfcStorey): void;
  removeStorey(id: string): void;
  setStoreys(storeys: IfcStorey[]): void;
}

export const createBimSlice: StateCreator<BimSlice, [], [], BimSlice> = (set) => ({
  elementPsets:  {},
  quantityCache: {},
  storeys: [
    { id: "storey-0", name: "Tầng trệt", elevation: 0,    floorIndex: 0 },
    { id: "storey-1", name: "Tầng 1",    elevation: 3000,  floorIndex: 1 },
  ],

  setElementPset: (elementId, psets) =>
    set((state: BimSlice) => ({
      elementPsets: { ...state.elementPsets, [elementId]: psets },
    })),

  updatePsetProperty: (elementId, psetName, propertyKey, value) =>
    set((state: BimSlice) => {
      const existing = state.elementPsets[elementId] ?? [];
      const updated  = existing.map((pset) =>
        pset.name === psetName
          ? { ...pset, properties: { ...pset.properties, [propertyKey]: value } }
          : pset,
      );
      // If pset doesn't exist yet, create it
      if (!updated.find((p) => p.name === psetName)) {
        updated.push({ name: psetName, properties: { [propertyKey]: value } });
      }
      return { elementPsets: { ...state.elementPsets, [elementId]: updated } };
    }),

  setQuantityCache: (elementId, quantities) =>
    set((state: BimSlice) => ({
      quantityCache: { ...state.quantityCache, [elementId]: quantities },
    })),

  invalidateQuantityCache: (elementIds) =>
    set((state: BimSlice) => {
      const next = { ...state.quantityCache };
      for (const id of elementIds) delete next[id];
      return { quantityCache: next };
    }),

  addStorey: (storey) =>
    set((state: BimSlice) => ({
      storeys: [...state.storeys, storey].sort((a, b) => a.elevation - b.elevation),
    })),

  removeStorey: (id) =>
    set((state: BimSlice) => ({
      storeys: state.storeys.filter((s) => s.id !== id),
    })),

  setStoreys: (storeys) => set({ storeys }),
});
