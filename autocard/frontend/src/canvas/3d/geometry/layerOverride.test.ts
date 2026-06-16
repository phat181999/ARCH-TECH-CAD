import test from "node:test";
import assert from "node:assert";
import { layerClassify } from "./planClassification.js";
import type { DrawingElement } from "../../../types.js";

// A line on a non-standard layer name auto-classifies as wall; override forces "ignore".
const els: DrawingElement[] = [
  { id: "x", type: "line", x1: 0, y1: 0, x2: 10, y2: 0, layerId: "MYLAYER" },
];

test("override map reroutes a layer to ignore (loose)", () => {
  const c = layerClassify(els, { MYLAYER: "ignore" });
  assert.equal(c.walls.length, 0);
  assert.equal(c.loose.length, 1);
});

test("override map can force a line layer to door", () => {
  const c = layerClassify(els, { MYLAYER: "door" });
  assert.equal(c.doors.length, 1);
  assert.equal(c.walls.length, 0);
});

test("no override preserves existing behavior (line → wall)", () => {
  const c = layerClassify(els);
  assert.equal(c.walls.length, 1);
});
