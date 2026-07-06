import { describe, it, expect } from "vitest";
import { collectSnapCandidates, applySnap } from "./snap3d";
import type { DrawingElement } from "../../../types";

const center = { cx: 0, cz: 0 };
const line: DrawingElement = { id: "l1", type: "line", layerId: "0", x1: 0, y1: 0, x2: 100, y2: 0 };

describe("collectSnapCandidates", () => {
  it("collects line endpoints and midpoint in world coords", () => {
    const c = collectSnapCandidates([line], center);
    expect(c.endpoints).toContainEqual({ x: 0, z: 0 });
    expect(c.endpoints).toContainEqual({ x: 100, z: 0 });
    expect(c.midpoints).toContainEqual({ x: 50, z: 0 });
  });

  it("applies the center offset", () => {
    const c = collectSnapCandidates([line], { cx: 10, cz: 20 });
    expect(c.endpoints).toContainEqual({ x: -10, z: -20 });
  });

  it("collects rectangle corners", () => {
    const rect: DrawingElement = { id: "r1", type: "rectangle", layerId: "0", x: 0, y: 0, width: 40, height: 30 };
    const c = collectSnapCandidates([rect], center);
    expect(c.endpoints).toContainEqual({ x: 0, z: 0 });
    expect(c.endpoints).toContainEqual({ x: 40, z: 30 });
  });
});

describe("applySnap", () => {
  const candidates = collectSnapCandidates([line], center);

  it("snaps to an endpoint within tolerance", () => {
    const r = applySnap({ x: 5, z: 4 }, candidates, { tolerance: 12 });
    expect(r).toEqual({ point: { x: 0, z: 0 }, type: "endpoint" });
  });

  it("does not snap beyond tolerance", () => {
    const r = applySnap({ x: 30, z: 30 }, candidates, { tolerance: 12 });
    expect(r.type).toBe("none");
    expect(r.point).toEqual({ x: 30, z: 30 });
  });

  it("prefers endpoint over midpoint when both are in range", () => {
    const r = applySnap({ x: 3, z: 0 }, candidates, { tolerance: 60 });
    expect(r.type).toBe("endpoint");
  });

  it("snaps to midpoint when endpoint is out of range", () => {
    const r = applySnap({ x: 52, z: 5 }, candidates, { tolerance: 12 });
    expect(r).toEqual({ point: { x: 50, z: 0 }, type: "midpoint" });
  });

  it("locks to the dominant axis from the anchor when axisLock is set", () => {
    const r = applySnap({ x: 80, z: 15 }, { endpoints: [], midpoints: [] }, { anchor: { x: 0, z: 0 }, axisLock: true });
    expect(r).toEqual({ point: { x: 80, z: 0 }, type: "axis" });
  });

  it("snaps to grid when gridSize is set and no point snap hits", () => {
    const r = applySnap({ x: 23, z: 48 }, { endpoints: [], midpoints: [] }, { gridSize: 25, tolerance: 12 });
    expect(r).toEqual({ point: { x: 25, z: 50 }, type: "grid" });
  });
});
