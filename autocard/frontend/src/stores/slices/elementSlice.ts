import type { StateCreator } from "zustand";
import type { DrawingElement } from "../../types";
import { ensureLayersForElements } from "./canvasSlice";

export interface ElementSlice {
  elements: DrawingElement[];
  history: DrawingElement[][];
  historyIndex: number;
  selectedElementIds: string[];
  addElement(element: DrawingElement): void;
  addElements(elements: DrawingElement[]): void;
  updateElement(id: string, updates: Partial<DrawingElement>): void;
  updateElements(ids: string[], updates: Partial<DrawingElement>): void;
  deleteSelectedElements(): void;
  deleteElement(id: string): void;
  setSelectedElementIds(ids: string[]): void;
  undo(): void;
  redo(): void;
  clearCanvas(): void;
}

export const createElementSlice: StateCreator<ElementSlice & any, [], [], ElementSlice> = (set, get) => ({
  elements: [],
  history: [],
  historyIndex: -1,
  selectedElementIds: [],

  addElement: (element) =>
    set((state: any) => {
      const newElements = [...state.elements, element];
      const newVisible = state.viewportBounds
        ? [...state.visibleElementIds, element.id]
        : state.visibleElementIds;
      return {
        elements: newElements,
        layers: ensureLayersForElements(state.layers, [element]),
        visibleElementIds: newVisible,
        history: [...state.history.slice(0, state.historyIndex + 1), newElements],
        historyIndex: state.historyIndex + 1,
      };
    }),

  addElements: (elements) =>
    set((state: any) => {
      if (elements.length === 0) return state;
      const newElements = [...state.elements, ...elements];
      const newVisible = state.viewportBounds
        ? [...state.visibleElementIds, ...elements.map((e: DrawingElement) => e.id)]
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
    set((state: any) => {
      const newElements = state.elements.map((el: DrawingElement) =>
        el.id === id ? { ...el, ...updates } : el
      );
      return {
        elements: newElements,
        history: [...state.history.slice(0, state.historyIndex + 1), newElements],
        historyIndex: state.historyIndex + 1,
      };
    }),

  updateElements: (ids, updates) =>
    set((state: any) => {
      const idSet = new Set(ids);
      const newElements = state.elements.map((el: DrawingElement) =>
        idSet.has(el.id) ? { ...el, ...updates } : el
      );
      return {
        elements: newElements,
        history: [...state.history.slice(0, state.historyIndex + 1), newElements],
        historyIndex: state.historyIndex + 1,
      };
    }),

  deleteSelectedElements: () =>
    set((state: any) => {
      const newElements = state.elements.filter(
        (el: DrawingElement) => !state.selectedElementIds.includes(el.id)
      );
      const newVisible = state.visibleElementIds.filter(
        (id: string) => !state.selectedElementIds.includes(id)
      );
      return {
        elements: newElements,
        visibleElementIds: newVisible,
        selectedElementIds: [],
        history: [...state.history.slice(0, state.historyIndex + 1), newElements],
        historyIndex: state.historyIndex + 1,
      };
    }),

  deleteElement: (id) =>
    set((state: any) => {
      const newElements = state.elements.filter((el: DrawingElement) => el.id !== id);
      return {
        elements: newElements,
        visibleElementIds: state.visibleElementIds.filter((vid: string) => vid !== id),
        selectedElementIds: state.selectedElementIds.filter((sid: string) => sid !== id),
        history: [...state.history.slice(0, state.historyIndex + 1), newElements],
        historyIndex: state.historyIndex + 1,
      };
    }),

  setSelectedElementIds: (ids) => set({ selectedElementIds: ids }),

  undo: () =>
    set((state: any) => {
      if (state.historyIndex <= 0) return state;
      const newIndex = state.historyIndex - 1;
      return {
        elements: state.history[newIndex],
        historyIndex: newIndex,
      };
    }),

  redo: () =>
    set((state: any) => {
      if (state.historyIndex >= state.history.length - 1) return state;
      const newIndex = state.historyIndex + 1;
      return {
        elements: state.history[newIndex],
        historyIndex: newIndex,
      };
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
});
