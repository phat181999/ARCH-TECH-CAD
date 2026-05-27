import test from "node:test";
import assert from "node:assert";
import { findNearestSnap } from "./snap.js";
import type { DrawingElement, Point, SnapModes } from "../types.js";

test("Object Snapping Calculations (OSNAP)", async (t) => {
  const elements: DrawingElement[] = [
    // Line: (10, 10) to (100, 10)
    { id: "line-1", type: "line", x1: 10, y1: 10, x2: 100, y2: 10, layerId: "0" },
    // Wall: (100, 100) to (200, 100)
    { id: "wall-1", type: "wall", start: { x: 100, y: 100 }, end: { x: 200, y: 100 }, thickness: 15, layerId: "0" } as any,
    // Polyline: (200, 200) -> (300, 200) -> (300, 300)
    {
      id: "poly-1",
      type: "polyline",
      points: [
        { x: 200, y: 200 },
        { x: 300, y: 200 },
        { x: 300, y: 300 },
      ],
      closed: false,
      layerId: "0"
    }
  ];

  const allModesOn: SnapModes = {
    endpoint: true,
    midpoint: true,
    center: true,
    grid: false,
    intersection: true,
    nearest: true,
  };

  await t.test("Endpoint snapping on lines, walls, and polylines", () => {
    // Hovering near line-1 start (10, 10)
    const snap1 = findNearestSnap(elements, { x: 12, y: 11 }, { ...allModesOn, midpoint: false, nearest: false }, 10, 10);
    assert.ok(snap1);
    assert.strictEqual(snap1.type, "endpoint");
    assert.strictEqual(snap1.point.x, 10);
    assert.strictEqual(snap1.point.y, 10);

    // Hovering near wall-1 start (100, 100)
    const snap2 = findNearestSnap(elements, { x: 103, y: 98 }, { ...allModesOn, midpoint: false, nearest: false }, 10, 10);
    assert.ok(snap2);
    assert.strictEqual(snap2.type, "endpoint");
    assert.strictEqual(snap2.point.x, 100);
    assert.strictEqual(snap2.point.y, 100);

    // Hovering near polyline middle vertex (300, 200)
    const snap3 = findNearestSnap(elements, { x: 298, y: 202 }, { ...allModesOn, midpoint: false, nearest: false }, 10, 10);
    assert.ok(snap3);
    assert.strictEqual(snap3.type, "endpoint");
    assert.strictEqual(snap3.point.x, 300);
    assert.strictEqual(snap3.point.y, 200);
  });

  await t.test("Midpoint snapping on lines, walls, and polylines", () => {
    // Hovering near midpoint of line-1: center is (55, 10)
    const snap1 = findNearestSnap(elements, { x: 54, y: 11 }, { ...allModesOn, endpoint: false, nearest: false }, 10, 10);
    assert.ok(snap1);
    assert.strictEqual(snap1.type, "midpoint");
    assert.strictEqual(snap1.point.x, 55);
    assert.strictEqual(snap1.point.y, 10);

    // Hovering near midpoint of wall-1: center is (150, 100)
    const snap2 = findNearestSnap(elements, { x: 151, y: 99 }, { ...allModesOn, endpoint: false, nearest: false }, 10, 10);
    assert.ok(snap2);
    assert.strictEqual(snap2.type, "midpoint");
    assert.strictEqual(snap2.point.x, 150);
    assert.strictEqual(snap2.point.y, 100);

    // Hovering near midpoint of poly-1 first segment (200, 200) to (300, 200) => (250, 200)
    const snap3 = findNearestSnap(elements, { x: 249, y: 201 }, { ...allModesOn, endpoint: false, nearest: false }, 10, 10);
    assert.ok(snap3);
    assert.strictEqual(snap3.type, "midpoint");
    assert.strictEqual(snap3.point.x, 250);
    assert.strictEqual(snap3.point.y, 200);
  });

  await t.test("Nearest snapping on lines, walls, and polylines", () => {
    // Hovering on line-1 at (30, 10)
    const snap1 = findNearestSnap(elements, { x: 30, y: 13 }, { ...allModesOn, endpoint: false, midpoint: false }, 10, 10);
    assert.ok(snap1);
    assert.strictEqual(snap1.type, "nearest");
    assert.strictEqual(snap1.point.x, 30);
    assert.strictEqual(snap1.point.y, 10);

    // Hovering on wall-1 at (120, 100)
    const snap2 = findNearestSnap(elements, { x: 120, y: 104 }, { ...allModesOn, endpoint: false, midpoint: false }, 10, 10);
    assert.ok(snap2);
    assert.strictEqual(snap2.type, "nearest");
    assert.strictEqual(snap2.point.x, 120);
    assert.strictEqual(snap2.point.y, 100);

    // Hovering on polyline second segment at (300, 240)
    const snap3 = findNearestSnap(elements, { x: 297, y: 240 }, { ...allModesOn, endpoint: false, midpoint: false }, 10, 10);
    assert.ok(snap3);
    assert.strictEqual(snap3.type, "nearest");
    assert.strictEqual(snap3.point.x, 300);
    assert.strictEqual(snap3.point.y, 240);
  });
});

test("Separate SNAP (Grid Snap) and OSNAP (Object Snap) Master Switches", async (t) => {
  const elements: DrawingElement[] = [
    { id: "line-1", type: "line", x1: 10, y1: 10, x2: 100, y2: 10, layerId: "0" }
  ];

  const snapModes: SnapModes = {
    endpoint: true,
    midpoint: true,
    center: true,
    grid: true,
    intersection: true,
    nearest: false,
  };

  // 1. Both enabled
  // Hovering near line endpoint (10, 10) at (12, 11). Endpoint snap should be selected (endpoint has precedence).
  const snapBoth = findNearestSnap(elements, { x: 12, y: 11 }, snapModes, 10, 10, [], true, true);
  assert.ok(snapBoth);
  assert.strictEqual(snapBoth.type, "endpoint");

  // 2. OSNAP disabled, grid snap enabled
  // Hovering near (12, 11). Since OSNAP is off, it should not snap to endpoint, but should snap to Grid (10, 10).
  const snapGridOnly = findNearestSnap(elements, { x: 12, y: 11 }, snapModes, 10, 10, [], true, false);
  assert.ok(snapGridOnly);
  assert.strictEqual(snapGridOnly.type, "grid");
  assert.strictEqual(snapGridOnly.point.x, 10);
  assert.strictEqual(snapGridOnly.point.y, 10);

  // 3. OSNAP enabled, grid snap disabled
  // Hovering near (12, 11). It should snap to endpoint (10, 10) but not to grid.
  const snapOsnapOnly = findNearestSnap(elements, { x: 12, y: 11 }, snapModes, 10, 10, [], false, true);
  assert.ok(snapOsnapOnly);
  assert.strictEqual(snapOsnapOnly.type, "endpoint");

  // 4. Both disabled
  // Hovering near (12, 11). It should not snap to anything.
  const snapNone = findNearestSnap(elements, { x: 12, y: 11 }, snapModes, 10, 10, [], false, false);
  assert.strictEqual(snapNone, null);
});
