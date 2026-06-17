import test from "node:test";
import assert from "node:assert";
import { worldToDrawingXY, makeWallElement, isValidWall } from "./wallDraw.js";

test("worldToDrawingXY adds the floating-origin center (scene Z → drawing Y)", () => {
  const d = worldToDrawingXY({ x: 10, z: -5 }, { cx: 1000, cz: 2000 });
  assert.equal(d.x, 1010);
  assert.equal(d.y, 1995);
});

test("worldToDrawingXY is identity at zero center (fresh drawing)", () => {
  const d = worldToDrawingXY({ x: 42, z: 7 }, { cx: 0, cz: 0 });
  assert.deepEqual(d, { x: 42, y: 7 });
});

test("makeWallElement creates an archType:wall line that round-trips", () => {
  const el = makeWallElement({ x: 0, y: 0 }, { x: 5000, y: 0 }, { layerId: "layer-1", idSeed: 1 });
  assert.equal(el.type, "line");
  assert.equal(el.archType, "wall");      // → 3D extrudes it, 2D draws the line
  assert.equal(el.layerId, "layer-1");
  assert.equal(el.x1, 0); assert.equal(el.x2, 5000);
});

test("isValidWall rejects degenerate (zero-length) walls", () => {
  assert.equal(isValidWall({ x: 0, y: 0 }, { x: 0, y: 0 }), false);
  assert.equal(isValidWall({ x: 0, y: 0 }, { x: 0.2, y: 0 }), false);
  assert.equal(isValidWall({ x: 0, y: 0 }, { x: 3000, y: 0 }), true);
});
