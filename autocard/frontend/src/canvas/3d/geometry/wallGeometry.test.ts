import { describe, it, expect } from "vitest";
import { buildWallSegmentsFromSemanticWalls } from "./wallGeometry";
import type { DrawingElement } from "../../../types";

describe("buildWallSegmentsFromSemanticWalls — layered assemblies", () => {
  it("derives segment thickness and per-layer breakdown from wallLayers", () => {
    const wall: DrawingElement = {
      id: "w1", type: "line", layerId: "0", archType: "wall",
      x1: 0, y1: 0, x2: 100, y2: 0,
      wallLayers: [{ material: "brick", thicknessMm: 100 }, { material: "insulation", thicknessMm: 50 }, { material: "drywall", thicknessMm: 12 }],
    };
    const [seg] = buildWallSegmentsFromSemanticWalls([wall]);
    expect(seg.depth).toBeCloseTo(16.2); // (100+50+12)mm / 10 = 16.2 units
    expect(seg.layers).toEqual([
      { materialName: "brick", thicknessUnits: 10 },
      { materialName: "insulation", thicknessUnits: 5 },
      { materialName: "drywall", thicknessUnits: 1.2 },
    ]);
  });

  it("falls back to the legacy thickness heuristic without wallLayers", () => {
    const wall: DrawingElement = { id: "w2", type: "line", layerId: "0", x1: 0, y1: 0, x2: 100, y2: 0, wallThickness: 20 };
    const [seg] = buildWallSegmentsFromSemanticWalls([wall]);
    expect(seg.layers).toBeUndefined();
    expect(seg.depth).toBeCloseTo(4); // unchanged: max(4, 20 * 0.18)
  });
});
