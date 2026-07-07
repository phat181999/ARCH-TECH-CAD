import { describe, it, expect } from "vitest";
import { RoofGenerator } from "./RoofGenerator";

// Collect [x,y,z] triples with the maximum y from a generated geometry.
function apexVerts(geo: import("three").BufferGeometry): [number, number, number][] {
  const pos = geo.getAttribute("position");
  let maxY = -Infinity;
  for (let i = 0; i < pos.count; i++) maxY = Math.max(maxY, pos.getY(i));
  const out: [number, number, number][] = [];
  for (let i = 0; i < pos.count; i++) {
    if (Math.abs(pos.getY(i) - maxY) < 1e-6) out.push([pos.getX(i), pos.getY(i), pos.getZ(i)]);
  }
  return out;
}

describe("RoofGenerator with ridge params", () => {
  it("gable ridge follows alongX=false even on a wide footprint", () => {
    const geo = RoofGenerator.generate("gable", 0, 0, 1000, 600, 260, 30, { alongX: false, ridgeLen: 600, highSide: 1 });
    // ridge along Z → every apex vertex sits at x = width/2
    for (const [x] of apexVerts(geo)) expect(x).toBeCloseTo(500);
  });

  it("hip with ridgeLen 0 degenerates to a pyramid (single apex point)", () => {
    const geo = RoofGenerator.generate("hip", 0, 0, 1000, 600, 260, 30, { alongX: true, ridgeLen: 0, highSide: 1 });
    const apex = apexVerts(geo);
    for (const [x, , z] of apex) { expect(x).toBeCloseTo(500); expect(z).toBeCloseTo(300); }
  });

  it("hip ridge length is respected", () => {
    const geo = RoofGenerator.generate("hip", 0, 0, 1000, 600, 260, 30, { alongX: true, ridgeLen: 400, highSide: 1 });
    const xs = apexVerts(geo).map(([x]) => x);
    expect(Math.min(...xs)).toBeCloseTo(300); // (1000-400)/2
    expect(Math.max(...xs)).toBeCloseTo(700);
  });

  it("shed high edge follows highSide across the ridge's cross axis", () => {
    const hi = RoofGenerator.generate("shed", 0, 0, 1000, 600, 260, 30, { alongX: true, ridgeLen: 0, highSide: 1 });
    for (const [, , z] of apexVerts(hi)) expect(z).toBeCloseTo(600); // +Z edge high
    const lo = RoofGenerator.generate("shed", 0, 0, 1000, 600, 260, 30, { alongX: true, ridgeLen: 0, highSide: -1 });
    for (const [, , z] of apexVerts(lo)) expect(z).toBeCloseTo(0);
  });

  it("without ridge params behavior is unchanged (gable ridge along the long axis)", () => {
    const geo = RoofGenerator.generate("gable", 0, 0, 1000, 600, 260, 30);
    for (const [, , z] of apexVerts(geo)) expect(z).toBeCloseTo(300);
  });
});
