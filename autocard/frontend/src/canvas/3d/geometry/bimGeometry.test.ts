import test from "node:test";
import assert from "node:assert";
import {
  unitScaleFor, levelBaseMap, buildWallBoxes, buildColumnBoxes, buildSlabBoxes,
} from "./bimGeometry.js";
import type { BIMResult } from "../../../api/client.js";

function baseResult(partial: Partial<BIMResult>): BIMResult {
  return {
    job_id: "j", analyzed: "", units: "mm",
    levels: [], walls: [], openings: [], rooms: [], columns: [],
    ...partial,
  };
}

test("unitScaleFor maps unit strings to mm scale", () => {
  assert.equal(unitScaleFor("mm"), 1);
  assert.equal(unitScaleFor("m"), 1000);
  assert.ok(Math.abs(unitScaleFor("ft") - 304.8) < 1e-6);
  assert.equal(unitScaleFor(undefined), 1);
});

test("openings cut a real gap — no full-height pier spans the door", () => {
  const result = baseResult({
    walls: [{ id: "W1", level_id: "L1", role: "exterior", x1: 0, y1: 0, x2: 5000, y2: 0, thickness: 200, height: 3000 }],
    openings: [{ id: "O1", type: "door", host_wall_id: "W1", x: 1000, y: 0, width: 900, height: 2100, sill: 0 }],
  });
  const boxes = buildWallBoxes(result, 1, new Map());
  const fullHeight = boxes.filter((b) => Math.abs(b.sy - 3000) < 1);
  const coversOpening = fullHeight.some((b) => {
    const half = b.sx / 2;
    return b.cx - half < 1450 && b.cx + half > 550; // opening span [550,1450]
  });
  assert.equal(coversOpening, false);
});

test("door gets a lintel above it (height 900, center y 2550)", () => {
  const result = baseResult({
    walls: [{ id: "W1", level_id: "L1", role: "exterior", x1: 0, y1: 0, x2: 5000, y2: 0, thickness: 200, height: 3000 }],
    openings: [{ id: "O1", type: "door", host_wall_id: "W1", x: 1000, y: 0, width: 900, height: 2100, sill: 0 }],
  });
  const boxes = buildWallBoxes(result, 1, new Map());
  const lintel = boxes.find((b) => Math.abs(b.sy - 900) < 1);
  assert.ok(lintel, "expected a lintel piece");
  assert.ok(Math.abs(lintel!.cy - 2550) < 1e-6);
});

test("two side piers flank the door", () => {
  const result = baseResult({
    walls: [{ id: "W1", level_id: "L1", role: "exterior", x1: 0, y1: 0, x2: 5000, y2: 0, thickness: 200, height: 3000 }],
    openings: [{ id: "O1", type: "door", host_wall_id: "W1", x: 1000, y: 0, width: 900, height: 2100, sill: 0 }],
  });
  const boxes = buildWallBoxes(result, 1, new Map());
  const piers = boxes.filter((b) => Math.abs(b.sy - 3000) < 1).sort((a, b) => a.cx - b.cx);
  assert.equal(piers.length, 2);
  assert.ok(Math.abs(piers[0].cx - 275) < 1e-6);  // [0,550]
  assert.ok(Math.abs(piers[1].cx - 3225) < 1e-6); // [1450,5000]
});

test("level elevation raises upper-floor walls", () => {
  const result = baseResult({
    levels: [{ id: "L2", name: "L2", elevation: 3000, height: 3000 }],
    walls: [{ id: "W", level_id: "L2", role: "interior", x1: 0, y1: 0, x2: 1000, y2: 0, thickness: 200, height: 3000 }],
  });
  const boxes = buildWallBoxes(result, 1, levelBaseMap(result.levels, 1));
  assert.ok(Math.abs(boxes[0].cy - 4500) < 1e-6); // base 3000 + height/2 1500
});

test("metric coordinates and heights scale to mm", () => {
  const result = baseResult({
    units: "m",
    walls: [{ id: "W", level_id: "", role: "ext", x1: 0, y1: 0, x2: 5, y2: 0, thickness: 0.2, height: 3 }],
  });
  const boxes = buildWallBoxes(result, unitScaleFor("m"), new Map());
  assert.ok(Math.abs(boxes[0].sx - 5000) < 1e-6);
  assert.ok(Math.abs(boxes[0].sy - 3000) < 1e-6);
});

test("column box is placed at its coordinates", () => {
  const cols = buildColumnBoxes(
    [{ id: "C1", level_id: "", x: 100, y: 200, width: 400, depth: 400, height: 3000 }],
    1, new Map(),
  );
  assert.equal(cols.length, 1);
  assert.equal(cols[0].cx, 100);
  assert.equal(cols[0].cz, 200);
  assert.ok(Math.abs(cols[0].cy - 1500) < 1e-6);
});

test("one slab covers the wall bounding box and sits below floor", () => {
  const result = baseResult({
    walls: [
      { id: "W1", level_id: "", role: "e", x1: 0, y1: 0, x2: 4000, y2: 0, thickness: 200, height: 3000 },
      { id: "W2", level_id: "", role: "e", x1: 4000, y1: 0, x2: 4000, y2: 3000, thickness: 200, height: 3000 },
    ],
  });
  const slabs = buildSlabBoxes(result, 1, new Map());
  assert.equal(slabs.length, 1);
  assert.ok(Math.abs(slabs[0].sx - 4000) < 1e-6);
  assert.ok(Math.abs(slabs[0].sz - 3000) < 1e-6);
  assert.ok(slabs[0].cy < 0);
});
