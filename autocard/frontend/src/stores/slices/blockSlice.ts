import type { StateCreator } from "zustand";
import type { BlockDef, DrawingElement, Point } from "../../types";
import { ALL_BLOCK_DEFS } from "../../data/blockLibrary";

const BUILTIN_BLOCK_DEFS: Record<string, BlockDef> = {
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
      { id: "t2", type: "circle", cx: 0, cy: -20, radius: 10, strokeWidth: 1, strokeColor: "#9CA3AF" }
    ]
  },
  plant: {
    id: "plant", name: "Plant", insertionPoint: { x: 0, y: 0 }, elements: [
      { id: "p1", type: "circle", cx: 0, cy: 0, radius: 15, strokeWidth: 2, strokeColor: "#111827", fillColor: "#D1D5DB" },
      { id: "p2", type: "circle", cx: 0, cy: -10, radius: 8, strokeWidth: 1, strokeColor: "#10B981", fillColor: "#34D399" },
      { id: "p3", type: "circle", cx: 10, cy: 5, radius: 8, strokeWidth: 1, strokeColor: "#10B981", fillColor: "#34D399" },
      { id: "p4", type: "circle", cx: -10, cy: 5, radius: 8, strokeWidth: 1, strokeColor: "#10B981", fillColor: "#34D399" }
    ]
  },
  toilet: {
    id: "toilet", name: "Toilet", insertionPoint: { x: 0, y: 0 }, elements: [
      { id: "tl1", type: "rectangle", x: -12, y: -20, width: 24, height: 15, strokeWidth: 2, strokeColor: "#111827", fillColor: "#F8FAFC" },
      { id: "tl2", type: "circle", cx: 0, cy: 5, radius: 12, strokeWidth: 2, strokeColor: "#111827", fillColor: "#F8FAFC" }
    ]
  },
  sink: {
    id: "sink", name: "Sink", insertionPoint: { x: 0, y: 0 }, elements: [
      { id: "sk1", type: "rectangle", x: -20, y: -15, width: 40, height: 30, strokeWidth: 2, strokeColor: "#111827", fillColor: "#F8FAFC" },
      { id: "sk2", type: "circle", cx: 0, cy: 0, radius: 10, strokeWidth: 1, strokeColor: "#9CA3AF", fillColor: "#E5E7EB" },
      { id: "sk3", type: "circle", cx: 0, cy: -10, radius: 2, strokeWidth: 1, strokeColor: "#111827" }
    ]
  },
  car: {
    id: "car", name: "Car", insertionPoint: { x: 0, y: 0 }, elements: [
      { id: "cr1", type: "rectangle", x: -25, y: -50, width: 50, height: 100, strokeWidth: 2, strokeColor: "#111827", fillColor: "#E5E7EB" },
      { id: "cr2", type: "rectangle", x: -20, y: -20, width: 40, height: 40, strokeWidth: 1, strokeColor: "#38BDF8", fillColor: "#BAE6FD" }
    ]
  },
} as unknown as Record<string, BlockDef>;

export interface BlockSlice {
  blockDefs: Record<string, BlockDef>;
  defineBlock(name: string, elements: DrawingElement[], insertionPoint: Point): void;
  insertBlock(blockId: string, x: number, y: number, scale?: number, rotation?: number): void;
  explodeBlock(instanceId: string): void;
  deleteBlockDef(blockId: string): void;
}

export const createBlockSlice: StateCreator<BlockSlice & any, [], [], BlockSlice> = (set, get) => ({
  blockDefs: BUILTIN_BLOCK_DEFS,

  defineBlock: (name, elements, insertionPoint) =>
    set((state: BlockSlice) => {
      const id = `block-${Date.now()}`;
      return {
        blockDefs: {
          ...state.blockDefs,
          [id]: { id, name, elements: JSON.parse(JSON.stringify(elements)), insertionPoint },
        },
      };
    }),

  insertBlock: (blockId, x, y, scale = 1, rotation = 0) =>
    set((state: any) => {
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
    set((state: any) => {
      const instance = state.elements.find((el: DrawingElement) => el.id === instanceId);
      if (!instance || instance.type !== "block") return state;
      const blockDef = state.blockDefs[instance.blockId];
      if (!blockDef) return state;
      const newEls = blockDef.elements.map((el: DrawingElement) => ({
        ...el,
        id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        x: (el.x || 0) + instance.x,
        y: (el.y || 0) + instance.y,
        layerId: instance.layerId,
      }));
      const newElements = state.elements
        .filter((el: DrawingElement) => el.id !== instanceId)
        .concat(newEls);
      return {
        elements: newElements,
        history: [...state.history.slice(0, state.historyIndex + 1), newElements],
        historyIndex: state.historyIndex + 1,
      };
    }),

  deleteBlockDef: (blockId) =>
    set((state: BlockSlice) => {
      const { [blockId]: _, ...rest } = state.blockDefs;
      return { blockDefs: rest };
    }),
});
