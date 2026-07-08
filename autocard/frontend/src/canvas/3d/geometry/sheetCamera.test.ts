import { describe, it, expect } from "vitest";
import { sheetFrustum } from "./sheetCamera";

const bounds = { minX: -500, maxX: 500, minZ: -300, maxZ: 300 };

describe("sheetFrustum", () => {
  it("plan view: top-down ortho covering the footprint plus margin", () => {
    const f = sheetFrustum(bounds, "plan", 260, 400, 100);
    expect(f.right - f.left).toBeCloseTo(1000 + 200);
    expect(f.top - f.bottom).toBeCloseTo(600 + 200);
    expect(f.position[1]).toBeGreaterThan(1000);
    expect(f.up).toEqual([0, 0, -1]);
  });

  it("front view: looks along -Z, height covers walls + roof allowance", () => {
    const f = sheetFrustum(bounds, "front", 260, 400, 100);
    expect(f.position[2]).toBeGreaterThan(bounds.maxZ);
    expect(f.top - f.bottom).toBeCloseTo(260 + 400 + 200);
    expect(f.right - f.left).toBeCloseTo(1000 + 200);
  });

  it("side view: looks along -X, width covers the Z extent", () => {
    const f = sheetFrustum(bounds, "side", 260, 400, 100);
    expect(f.position[0]).toBeGreaterThan(bounds.maxX);
    expect(f.right - f.left).toBeCloseTo(600 + 200);
  });
});

describe("sheetFrustum — elevation-N/S/E/W", () => {
  it("elevation-N looks south from beyond +Z (matches the existing 'front' math)", () => {
    const f = sheetFrustum(bounds, "elevation-N", 260, 400, 100);
    expect(f.position[2]).toBeGreaterThan(bounds.maxZ);
    expect(f.top - f.bottom).toBeCloseTo(260 + 400 + 200);
    expect(f.right - f.left).toBeCloseTo(1000 + 200);
  });

  it("elevation-S looks north from beyond -Z (mirror of elevation-N)", () => {
    const f = sheetFrustum(bounds, "elevation-S", 260, 400, 100);
    expect(f.position[2]).toBeLessThan(bounds.minZ);
    expect(f.top - f.bottom).toBeCloseTo(260 + 400 + 200);
    expect(f.right - f.left).toBeCloseTo(1000 + 200);
  });

  it("elevation-E looks west from beyond +X (matches the existing 'side' math)", () => {
    const f = sheetFrustum(bounds, "elevation-E", 260, 400, 100);
    expect(f.position[0]).toBeGreaterThan(bounds.maxX);
    expect(f.right - f.left).toBeCloseTo(600 + 200);
  });

  it("elevation-W looks east from beyond -X (mirror of elevation-E)", () => {
    const f = sheetFrustum(bounds, "elevation-W", 260, 400, 100);
    expect(f.position[0]).toBeLessThan(bounds.minX);
    expect(f.right - f.left).toBeCloseTo(600 + 200);
  });
});

describe("sheetFrustum — section", () => {
  it("positions the camera along the cut line's normal, looking at its midpoint", () => {
    const line = { x1: 0, z1: 0, x2: 100, z2: 0 }; // horizontal line along X
    const f = sheetFrustum(bounds, "section", 260, 400, 100, line);
    expect(f.target).toEqual([50, expect.any(Number), 0]);
    expect(f.position[0]).toBeCloseTo(50);
    expect(f.position[2]).toBeGreaterThan(0); // normal of a horizontal line points along +Z
    expect(f.right - f.left).toBeCloseTo(100 + 200); // line length + margin
  });

  it("throws when view is 'section' without a sectionLine", () => {
    expect(() => sheetFrustum(bounds, "section", 260)).toThrow(/sectionLine/);
  });
});
