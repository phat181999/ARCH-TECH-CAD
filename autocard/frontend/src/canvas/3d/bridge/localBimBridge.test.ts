/**
 * elementsToBimResult() is a pure function — vitest API (see
 * canvas/3d/geometry/planClassification.test.ts).
 */
import { describe, it, expect } from "vitest";
import { elementsToBimResult } from "./localBimBridge";
import type { DrawingElement } from "../../../types";

function wallEl(partial: Partial<DrawingElement>): DrawingElement {
  return {
    id: "w1",
    type: "line",
    layerId: "0",
    archType: "wall",
    x1: 0, y1: 0, x2: 5000, y2: 0,
    ...partial,
  } as DrawingElement;
}

describe("elementsToBimResult: wall height/thickness overrides", () => {
  it("falls back to defaults when no overrides are set", () => {
    const result = elementsToBimResult([wallEl({})]);
    expect(result.walls).toHaveLength(1);
    expect(result.walls[0].thickness).toBe(20);
    expect(result.walls[0].height).toBe(300);
  });

  it("honors wallHeightOverride (10 units = 1m) as mm — result units is mm, scale 1", () => {
    // 40 raw = 4m = 400cm = 4000mm
    const result = elementsToBimResult([wallEl({ wallHeightOverride: 40 })]);
    expect(result.walls[0].height).toBe(4000);
  });

  it("honors wallThicknessOverride (1:1 with cm) as mm — result units is mm, scale 1", () => {
    // 30cm = 300mm
    const result = elementsToBimResult([wallEl({ wallThicknessOverride: 30 })]);
    expect(result.walls[0].thickness).toBe(300);
  });

  it("honors both overrides together, independent of legacy thickness/height fields", () => {
    const result = elementsToBimResult([wallEl({
      wallHeightOverride: 34, wallThicknessOverride: 25,
      height: 999, wallThickness: 999,
    } as Partial<DrawingElement>)]);
    expect(result.walls[0].height).toBe(3400);
    expect(result.walls[0].thickness).toBe(250);
  });
});
