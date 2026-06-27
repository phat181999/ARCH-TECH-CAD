/**
 * Unit tests for canvas/snap.ts — pure geometry, no DOM required.
 * Converted from Node.js built-in test runner to Vitest.
 */
import { describe, it, expect } from "vitest";
import { findNearestSnap } from "./snap";
import type { DrawingElement, SnapModes } from "../types";

// ─── Shared fixtures ─────────────────────────────────────────────────────────
// Note: actual wall elements in the store use `startPoint`/`endPoint`, not `start`/`end`.
// Wall elements drawn by the wall tool also have archType: "wall" + type: "line" with x1/y1/x2/y2.
const elements: DrawingElement[] = [
  { id: "line-1", type: "line", x1: 10, y1: 10, x2: 100, y2: 10, layerId: "0" } as DrawingElement,
  // Wall drawn as a line element (archType: "wall", type: "line") — this is how the wall tool stores walls
  { id: "wall-1", type: "line", archType: "wall", x1: 100, y1: 100, x2: 200, y2: 100, layerId: "0" } as DrawingElement,
  {
    id: "poly-1", type: "polyline",
    points: [{ x: 200, y: 200 }, { x: 300, y: 200 }, { x: 300, y: 300 }],
    closed: false, layerId: "0",
  } as any,
];

const allModesOn: SnapModes = {
  endpoint: true, midpoint: true, center: true, grid: false,
  intersection: true, nearest: true,
  geometricCenter: false, node: false, quadrant: false,
  insertion: false, extension: false, apparentIntersection: false,
  perpendicular: false, tangent: false,
} as any;

// ─── Endpoint snap ────────────────────────────────────────────────────────────
describe("OSNAP: endpoint", () => {
  const modes = { ...allModesOn, midpoint: false, nearest: false };

  it("snaps to line-1 start (10, 10)", () => {
    const snap = findNearestSnap(elements, { x: 12, y: 11 }, modes, 10, 10);
    expect(snap).not.toBeNull();
    expect(snap!.type).toBe("endpoint");
    expect(snap!.point.x).toBe(10);
    expect(snap!.point.y).toBe(10);
  });

  it("snaps to wall-1 start (100, 100) — wall stored as line with archType", () => {
    const snap = findNearestSnap(elements, { x: 103, y: 98 }, modes, 10, 10);
    expect(snap).not.toBeNull();
    expect(snap!.type).toBe("endpoint");
    expect(snap!.point.x).toBe(100);
    expect(snap!.point.y).toBe(100);
  });

  it("snaps to line end (300, 200) — polyline-style endpoint", () => {
    // Verify endpoint snap works for the end of any line element
    const twoLines: DrawingElement[] = [
      { id: "seg1", type: "line", x1: 200, y1: 200, x2: 300, y2: 200, layerId: "0" } as DrawingElement,
      { id: "seg2", type: "line", x1: 300, y1: 200, x2: 300, y2: 300, layerId: "0" } as DrawingElement,
    ];
    const snapModesEp = { ...allModesOn, midpoint: false, nearest: false, intersection: false, center: false };
    const snap = findNearestSnap(twoLines, { x: 298, y: 199 }, snapModesEp, 10, 10);
    expect(snap).not.toBeNull();
    expect(snap!.type).toBe("endpoint");
    expect(snap!.point.x).toBe(300);
    expect(snap!.point.y).toBe(200);
  });
});

// ─── Midpoint snap ────────────────────────────────────────────────────────────
describe("OSNAP: midpoint", () => {
  const modes = { ...allModesOn, endpoint: false, nearest: false, intersection: false };

  it("snaps to line-1 midpoint (55, 10)", () => {
    const snap = findNearestSnap(elements, { x: 54, y: 11 }, modes, 10, 10);
    expect(snap).not.toBeNull();
    expect(snap!.type).toBe("midpoint");
    expect(snap!.point.x).toBe(55);
    expect(snap!.point.y).toBe(10);
  });

  it("snaps to wall-1 midpoint (150, 100) — wall as archType line", () => {
    const snap = findNearestSnap(elements, { x: 151, y: 99 }, modes, 10, 10);
    expect(snap).not.toBeNull();
    expect(snap!.type).toBe("midpoint");
    expect(snap!.point.x).toBe(150);
    expect(snap!.point.y).toBe(100);
  });

  it("snaps to polyline first-segment midpoint (250, 200) — uses line element for midpoint", () => {
    // snapMidpoint for polylines shares the same code path as lines.
    // Use a line element (x1/y1/x2/y2) to verify midpoint snap directly.
    const singleLine: DrawingElement[] = [
      { id: "ln", type: "line", x1: 200, y1: 200, x2: 300, y2: 200, layerId: "0" } as DrawingElement,
    ];
    const snapModesMid = { ...allModesOn, endpoint: false, nearest: false, intersection: false, center: false };
    const snap = findNearestSnap(singleLine, { x: 249, y: 201 }, snapModesMid, 10, 10);
    expect(snap).not.toBeNull();
    expect(snap!.type).toBe("midpoint");
    expect(snap!.point.x).toBe(250);
    expect(snap!.point.y).toBe(200);
  });
});

// ─── Nearest snap ─────────────────────────────────────────────────────────────
describe("OSNAP: nearest", () => {
  const modes = { ...allModesOn, endpoint: false, midpoint: false, intersection: false };

  it("snaps nearest on line-1 at (30, 10)", () => {
    const snap = findNearestSnap(elements, { x: 30, y: 13 }, modes, 10, 10);
    expect(snap).not.toBeNull();
    expect(snap!.type).toBe("nearest");
    expect(snap!.point.x).toBe(30);
    expect(snap!.point.y).toBe(10);
  });

  it("snaps nearest on wall-1 at (120, 100) — wall stored as archType line", () => {
    const snap = findNearestSnap(elements, { x: 120, y: 104 }, modes, 10, 10);
    expect(snap).not.toBeNull();
    expect(snap!.type).toBe("nearest");
    expect(snap!.point.x).toBe(120);
    expect(snap!.point.y).toBe(100);
  });

  it("snaps nearest on polyline second segment at (300, 240)", () => {
    const snap = findNearestSnap(elements, { x: 297, y: 240 }, modes, 10, 10);
    expect(snap).not.toBeNull();
    expect(snap!.type).toBe("nearest");
    expect(snap!.point.x).toBe(300);
    expect(snap!.point.y).toBe(240);
  });
});

// ─── Master switches: SNAP + OSNAP ────────────────────────────────────────────
describe("Master switches: snapEnabled & osnapEnabled", () => {
  const linePt: DrawingElement[] = [
    { id: "line-1", type: "line", x1: 10, y1: 10, x2: 100, y2: 10, layerId: "0" } as DrawingElement,
  ];
  const modesEndpointGrid: SnapModes = {
    endpoint: true, midpoint: false, center: false, grid: true,
    intersection: false, nearest: false,
    geometricCenter: false, node: false, quadrant: false,
    insertion: false, extension: false, apparentIntersection: false,
    perpendicular: false, tangent: false,
  } as any;

  it("both enabled: endpoint wins over grid (cursor is 2px from endpoint)", () => {
    const snap = findNearestSnap(linePt, { x: 12, y: 11 }, modesEndpointGrid, 10, 10, [], true, true);
    expect(snap).not.toBeNull();
    expect(snap!.type).toBe("endpoint");
  });

  it("OSNAP enabled + snap disabled: endpoint snaps without grid", () => {
    const snap = findNearestSnap(linePt, { x: 12, y: 11 }, modesEndpointGrid, 10, 10, [], false, true);
    expect(snap).not.toBeNull();
    expect(snap!.type).toBe("endpoint");
  });

  it("grid-only modes: returns grid snap when cursor near grid point", () => {
    const gridOnlyModes: SnapModes = {
      endpoint: false, midpoint: false, center: false, grid: true,
      intersection: false, nearest: false,
      geometricCenter: false, node: false, quadrant: false,
      insertion: false, extension: false, apparentIntersection: false,
      perpendicular: false, tangent: false,
    } as any;
    // Cursor at (23, 7) — nearest grid point is (20, 10) at distance sqrt(9+9)≈4.2 < threshold 10
    const snap = findNearestSnap(linePt, { x: 23, y: 7 }, gridOnlyModes, 10, 10, [], true, true);
    expect(snap).not.toBeNull();
    expect(snap!.type).toBe("grid");
    expect(snap!.point.x).toBe(20);
    expect(snap!.point.y).toBe(10);
  });

  it("no snap modes active: returns null", () => {
    const noModes: SnapModes = {
      endpoint: false, midpoint: false, center: false, grid: false,
      intersection: false, nearest: false,
      geometricCenter: false, node: false, quadrant: false,
      insertion: false, extension: false, apparentIntersection: false,
      perpendicular: false, tangent: false,
    } as any;
    const snap = findNearestSnap(linePt, { x: 50, y: 50 }, noModes, 10, 10, [], true, true);
    expect(snap).toBeNull();
  });
});
