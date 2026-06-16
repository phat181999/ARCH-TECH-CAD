import test from "node:test";
import assert from "node:assert";
import { getPlanBounds, layerClassify, computeAutoWallHeight } from "./planClassification.js";
import { buildWallSegmentsFromSemanticWalls } from "./wallGeometry.js";
import type { DrawingElement } from "../../../types.js";

// Mimics the imported DXF in the screenshot: lines far from origin (~ -283086, 426922).
const OFFX = -283086, OFFY = 426922;
const els: DrawingElement[] = [
  { id: "l1", type: "line", x1: OFFX, y1: OFFY, x2: OFFX + 5000, y2: OFFY, layerId: "A-WALL" },
  { id: "l2", type: "line", x1: OFFX + 5000, y1: OFFY, x2: OFFX + 5000, y2: OFFY + 4000, layerId: "A-WALL" },
  { id: "l3", type: "line", x1: OFFX + 5000, y1: OFFY + 4000, x2: OFFX, y2: OFFY + 4000, layerId: "A-WALL" },
  { id: "l4", type: "line", x1: OFFX, y1: OFFY + 4000, x2: OFFX, y2: OFFY, layerId: "A-WALL" },
];

test("getPlanBounds returns finite bounds far from origin", () => {
  const b = getPlanBounds(els);
  assert.ok(b, "bounds should not be null");
  assert.ok(Number.isFinite(b!.minX) && Number.isFinite(b!.maxX));
  assert.ok(b!.minX < -200000, "bounds reflect the huge offset");
});

test("layerClassify routes A-WALL lines to walls", () => {
  const c = layerClassify(els);
  assert.equal(c.walls.length, 4);
});

test("wall segments are finite at huge coords", () => {
  const segs = buildWallSegmentsFromSemanticWalls(layerClassify(els).walls);
  assert.ok(segs.length > 0, "should build segments");
  for (const s of segs) {
    assert.ok(Number.isFinite(s.centerX) && Number.isFinite(s.centerZ), "finite centers");
    assert.ok(s.width > 0 && s.depth > 0, "positive dims");
  }
});

test("computeAutoWallHeight is sane at huge coords", () => {
  const h = computeAutoWallHeight(els, 34);
  assert.ok(Number.isFinite(h) && h > 0);
});
