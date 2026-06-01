import type { StateCreator } from "zustand";
import type { ArchitecturalPlan } from "../../types";

function shiftArchitecturalPlan(plan: ArchitecturalPlan, elementId: string, dx: number, dy: number): ArchitecturalPlan {
  return {
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
}

export interface ArchitectureSlice {
  currentArchitecturalPlan: ArchitecturalPlan | null;
  setCurrentArchitecturalPlan(plan: ArchitecturalPlan | null): void;
  moveArchitecturalElement(elementId: string, dx: number, dy: number): void;
  updateArchitecturalEntity(entityId: string, updates: Record<string, unknown>): void;
}

export const createArchitectureSlice: StateCreator<ArchitectureSlice & any, [], [], ArchitectureSlice> = (set, get) => ({
  currentArchitecturalPlan: null,

  setCurrentArchitecturalPlan: (plan) => set({ currentArchitecturalPlan: plan }),

  moveArchitecturalElement: (elementId, dx, dy) =>
    set((state: ArchitectureSlice & any) => {
      if (!state.currentArchitecturalPlan) return state;
      const nextPlan = shiftArchitecturalPlan(state.currentArchitecturalPlan, elementId, dx, dy);
      const nextElements = state.elements.map((el: any) => {
        if (el.id !== elementId) return el;
        if (typeof el.x === "number" && typeof el.y === "number") {
          return { ...el, x: el.x + dx, y: el.y + dy };
        }
        if (
          typeof el.x1 === "number" &&
          typeof el.y1 === "number" &&
          typeof el.x2 === "number" &&
          typeof el.y2 === "number"
        ) {
          return { ...el, x1: el.x1 + dx, y1: el.y1 + dy, x2: el.x2 + dx, y2: el.y2 + dy };
        }
        if (typeof el.cx === "number" && typeof el.cy === "number") {
          return { ...el, cx: el.cx + dx, cy: el.cy + dy };
        }
        if (el.points) {
          return { ...el, points: el.points.map((p: any) => ({ x: p.x + dx, y: p.y + dy })) };
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

  updateArchitecturalEntity: (entityId, updates) =>
    set((state: ArchitectureSlice) => {
      if (!state.currentArchitecturalPlan) return state;
      const plan = state.currentArchitecturalPlan;
      return {
        currentArchitecturalPlan: {
          ...plan,
          walls: plan.walls.map((w: any) => w.id === entityId ? { ...w, ...updates } : w),
          openings: plan.openings.map((o: any) => o.id === entityId ? { ...o, ...updates } : o),
          rooms: plan.rooms.map((r: any) => r.id === entityId ? { ...r, ...updates } : r),
          gridAxes: plan.gridAxes.map((g: any) => g.id === entityId ? { ...g, ...updates } : g),
          dimensions: plan.dimensions.map((d: any) => d.id === entityId ? { ...d, ...updates } : d),
        },
      };
    }),
});
