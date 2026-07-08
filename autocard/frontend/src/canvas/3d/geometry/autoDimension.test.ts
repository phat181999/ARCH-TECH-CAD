import { describe, it, expect } from "vitest";
import { generateDimensions } from "./autoDimension";
import type { DrawingElement } from "../../../types";

describe("generateDimensions", () => {
  it("returns nothing for an empty wall list", () => {
    expect(generateDimensions([])).toEqual([]);
  });

  it("emits one per-wall line plus 2 overall lines for a single wall", () => {
    const wall: DrawingElement = { id: "w1", type: "line", layerId: "0", archType: "wall", x1: 0, y1: 0, x2: 100, y2: 0 };
    const lines = generateDimensions([wall]);
    expect(lines).toHaveLength(3);
    expect(lines[0].label).toBe("1.00m"); // 100 units = 1m, per-wall
  });

  it("labels the overall width/height chains from the wall bounding box", () => {
    const a: DrawingElement = { id: "w1", type: "line", layerId: "0", archType: "wall", x1: 0, y1: 0, x2: 100, y2: 0 };
    const b: DrawingElement = { id: "w2", type: "line", layerId: "0", archType: "wall", x1: 0, y1: 0, x2: 0, y2: 50 };
    const lines = generateDimensions([a, b]);
    const overall = lines.slice(-2);
    expect(overall.map((l) => l.label).sort()).toEqual(["0.50m", "1.00m"]);
  });

  it("offsets each per-wall dimension line away from the footprint's center", () => {
    // Two parallel walls forming a 100x50 rectangle's long sides — each
    // dimension line must sit on the outside of its own wall, not overlap it.
    const north: DrawingElement = { id: "n", type: "line", layerId: "0", archType: "wall", x1: 0, y1: 0, x2: 100, y2: 0 };
    const south: DrawingElement = { id: "s", type: "line", layerId: "0", archType: "wall", x1: 0, y1: 50, x2: 100, y2: 50 };
    const [nDim, sDim] = generateDimensions([north, south]);
    expect(nDim.y1).toBeLessThan(0);    // pushed further north (away from center at y=25)
    expect(sDim.y1).toBeGreaterThan(50); // pushed further south
  });

  it("ignores walls missing endpoint coordinates instead of throwing", () => {
    const bad: DrawingElement = { id: "bad", type: "line", layerId: "0", archType: "wall" };
    expect(generateDimensions([bad])).toEqual([]);
  });
});
