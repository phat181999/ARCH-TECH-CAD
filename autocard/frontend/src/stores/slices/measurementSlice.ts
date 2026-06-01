import type { StateCreator } from "zustand";
import type { Measurement, Constraint, MeasurementMode, Point } from "../../types";

export interface MeasurementSlice {
  measurementMode: MeasurementMode;
  measurementPoints: Point[];
  measurements: Measurement[];
  constraints: Constraint[];
  setMeasurementMode(mode: MeasurementMode): void;
  addMeasurementPoint(point: Point): void;
  clearMeasurements(): void;
  addConstraint(constraint: Omit<Constraint, "id">): void;
  removeConstraint(id: string): void;
}

export const createMeasurementSlice: StateCreator<MeasurementSlice & any, [], [], MeasurementSlice> = (set, get) => ({
  measurementMode: null,
  measurementPoints: [],
  measurements: [],
  constraints: [],

  setMeasurementMode: (mode) => set({ measurementMode: mode, measurementPoints: [] }),

  addMeasurementPoint: (point) =>
    set((state: MeasurementSlice) => {
      const newPoints = [...state.measurementPoints, point];

      if (state.measurementMode === "distance" && newPoints.length === 2) {
        const dx = newPoints[1].x - newPoints[0].x;
        const dy = newPoints[1].y - newPoints[0].y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const measurement: Measurement = {
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
        const measurement: Measurement = {
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
          const measurement: Measurement = {
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

  addConstraint: (constraint) =>
    set((state: MeasurementSlice) => ({
      constraints: [...state.constraints, { id: `const-${Date.now()}`, ...constraint }],
    })),

  removeConstraint: (id) =>
    set((state: MeasurementSlice) => ({
      constraints: state.constraints.filter((c) => c.id !== id),
    })),
});
