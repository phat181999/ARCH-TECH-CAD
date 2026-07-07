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
