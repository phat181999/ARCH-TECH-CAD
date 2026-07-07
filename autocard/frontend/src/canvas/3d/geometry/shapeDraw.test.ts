import { describe, it, expect } from "vitest";
import { makeRectangleElement, makeCircleElement, makeArcElement, offsetWall } from "./shapeDraw";
import type { DrawingElement } from "../../../types";

const opts = { layerId: "0" };

describe("makeRectangleElement", () => {
  it("normalizes corners to x/y/width/height", () => {
    const el = makeRectangleElement({ x: 100, y: 80 }, { x: 20, y: 20 }, opts)!;
    expect(el.type).toBe("rectangle");
    expect(el).toMatchObject({ x: 20, y: 20, width: 80, height: 60, layerId: "0" });
  });
  it("rejects degenerate rectangles", () => {
    expect(makeRectangleElement({ x: 0, y: 0 }, { x: 0.5, y: 100 }, opts)).toBeNull();
  });
});

describe("makeCircleElement", () => {
  it("builds a circle", () => {
    const el = makeCircleElement({ x: 10, y: 20 }, 50, opts)!;
    expect(el).toMatchObject({ type: "circle", cx: 10, cy: 20, radius: 50 });
  });
  it("rejects tiny radius", () => {
    expect(makeCircleElement({ x: 0, y: 0 }, 0.5, opts)).toBeNull();
  });
});

describe("makeArcElement", () => {
  it("builds a 3-point arc through (0,0),(50,50),(100,0) centered at (50,0)", () => {
    const el = makeArcElement({ x: 0, y: 0 }, { x: 50, y: 50 }, { x: 100, y: 0 }, opts)!;
    expect(el.type).toBe("arc");
    expect(el.cx).toBeCloseTo(50);
    expect(el.cy).toBeCloseTo(0);
    expect(el.radius).toBeCloseTo(50);
  });
  it("rejects collinear points", () => {
    expect(makeArcElement({ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }, opts)).toBeNull();
  });
});

describe("offsetWall", () => {
  const wall: DrawingElement = { id: "w1", type: "line", layerId: "0", archType: "wall", x1: 0, y1: 0, x2: 100, y2: 0 };
  it("creates a parallel wall at the signed distance", () => {
    const off = offsetWall(wall, 30)!;
    expect(off.id).not.toBe("w1");
    expect(off.archType).toBe("wall");
    expect(off.y1).toBeCloseTo(30);
    expect(off.y2).toBeCloseTo(30);
    expect(off.x1).toBeCloseTo(0);
    expect(off.x2).toBeCloseTo(100);
  });
  it("negative distance offsets the other side", () => {
    expect(offsetWall(wall, -30)!.y1).toBeCloseTo(-30);
  });
  it("rejects non-line elements", () => {
    expect(offsetWall({ id: "c", type: "circle", layerId: "0", cx: 0, cy: 0, radius: 5 }, 10)).toBeNull();
  });
});
