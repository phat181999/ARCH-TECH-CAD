import { describe, it, expect } from "vitest";
import { deriveRidgeParams } from "./roofRidge";

const bounds = { minX: 0, maxX: 1000, minZ: 0, maxZ: 600 };

describe("deriveRidgeParams", () => {
  it("detects an X-aligned ridge and its length", () => {
    const p = deriveRidgeParams({ x1: 100, y1: 300, x2: 700, y2: 300 }, bounds);
    expect(p.alongX).toBe(true);
    expect(p.ridgeLen).toBeCloseTo(600);
  });

  it("detects a Z-aligned ridge", () => {
    const p = deriveRidgeParams({ x1: 500, y1: 100, x2: 520, y2: 500 }, bounds);
    expect(p.alongX).toBe(false);
  });

  it("highSide is +1 when the ridge sits past the footprint center on the cross axis", () => {
    // X-aligned ridge at y=500; center y is 300 → +1
    expect(deriveRidgeParams({ x1: 0, y1: 500, x2: 800, y2: 500 }, bounds).highSide).toBe(1);
    expect(deriveRidgeParams({ x1: 0, y1: 100, x2: 800, y2: 100 }, bounds).highSide).toBe(-1);
  });

  it("highSide for a Z-aligned ridge uses the X axis", () => {
    expect(deriveRidgeParams({ x1: 900, y1: 0, x2: 900, y2: 600 }, bounds).highSide).toBe(1);
    expect(deriveRidgeParams({ x1: 100, y1: 0, x2: 100, y2: 600 }, bounds).highSide).toBe(-1);
  });
});
