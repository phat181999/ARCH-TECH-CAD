import { describe, it, expect } from "vitest";
import { elementAnchor, translatePatch, rotatePatch, scalePatch, duplicateElement } from "./transformGeometry";
import type { DrawingElement } from "../../../types";

const line: DrawingElement = { id: "l1", type: "line", layerId: "0", x1: 0, y1: 0, x2: 100, y2: 0 };
const rect: DrawingElement = { id: "r1", type: "rectangle", layerId: "0", x: 10, y: 10, width: 40, height: 20 };
const circle: DrawingElement = { id: "c1", type: "circle", layerId: "0", cx: 5, cy: 5, radius: 10 };
const block: DrawingElement = { id: "b1", type: "block", layerId: "0", blockId: "sofa", x: 30, y: 40, rotation: 90, scale: 1 };

describe("elementAnchor", () => {
  it("line midpoint", () => expect(elementAnchor(line)).toEqual({ x: 50, y: 0 }));
  it("rect center", () => expect(elementAnchor(rect)).toEqual({ x: 30, y: 20 }));
  it("circle center", () => expect(elementAnchor(circle)).toEqual({ x: 5, y: 5 }));
  it("block position", () => expect(elementAnchor(block)).toEqual({ x: 30, y: 40 }));
});

describe("translatePatch", () => {
  it("shifts line endpoints", () => {
    expect(translatePatch(line, 10, 5)).toEqual({ x1: 10, y1: 5, x2: 110, y2: 5 });
  });
  it("shifts rect origin", () => {
    expect(translatePatch(rect, -10, 0)).toEqual({ x: 0, y: 10 });
  });
  it("shifts circle center", () => {
    expect(translatePatch(circle, 1, 2)).toEqual({ cx: 6, cy: 7 });
  });
  it("shifts polygon points", () => {
    const poly: DrawingElement = { id: "p1", type: "polygon", layerId: "0", points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] };
    expect(translatePatch(poly, 5, 5)).toEqual({ points: [{ x: 5, y: 5 }, { x: 15, y: 5 }] });
  });
});

describe("rotatePatch", () => {
  it("adds to the rotation field for blocks", () => {
    expect(rotatePatch(block, 45)).toEqual({ rotation: 135 });
  });
  it("rotates line endpoints around the midpoint", () => {
    const p = rotatePatch(line, 90);
    expect(p.x1).toBeCloseTo(50); expect(p.y1).toBeCloseTo(-50);
    expect(p.x2).toBeCloseTo(50); expect(p.y2).toBeCloseTo(50);
  });
});

describe("scalePatch", () => {
  it("multiplies block scale", () => expect(scalePatch(block, 2)).toEqual({ scale: 2 }));
  it("scales circle radius", () => expect(scalePatch(circle, 2)).toEqual({ radius: 20 }));
  it("scales rect about its center", () => {
    expect(scalePatch(rect, 2)).toEqual({ x: -10, y: 0, width: 80, height: 40 });
  });
  it("scales line about its midpoint", () => {
    const p = scalePatch(line, 2);
    expect(p.x1).toBeCloseTo(-50); expect(p.x2).toBeCloseTo(150);
  });
});

describe("duplicateElement", () => {
  it("deep-copies with a fresh id", () => {
    const poly: DrawingElement = { id: "p1", type: "polygon", layerId: "0", points: [{ x: 0, y: 0 }] };
    const copy = duplicateElement(poly);
    expect(copy.id).not.toBe("p1");
    expect(copy.points).toEqual(poly.points);
    expect(copy.points).not.toBe(poly.points);
  });
});
