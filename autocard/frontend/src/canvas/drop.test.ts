import test from "node:test";
import assert from "node:assert/strict";

import { buildDroppedToolElement, resolveCanvasDropAction } from "./drop.ts";

test("resolveCanvasDropAction keeps block drag-and-drop working", () => {
  const action = resolveCanvasDropAction({
    blockId: "sofa",
    point: { x: 400, y: 300 },
  });

  assert.deepEqual(action, {
    kind: "insert-block",
    blockId: "sofa",
    point: { x: 400, y: 300 },
  });
});

test("resolveCanvasDropAction supports dropping drawing tools onto the canvas", () => {
  const action = resolveCanvasDropAction({
    toolId: "line",
    point: { x: 250, y: 180 },
  });

  assert.equal(action.kind, "insert-element");
  if (action.kind !== "insert-element") {
    return;
  }

  const element = buildDroppedToolElement({
    tool: action.tool,
    point: action.point,
    layerId: "0",
    id: "line-1",
  });

  assert.deepEqual(element, {
    id: "line-1",
    type: "line",
    x1: 190,
    y1: 180,
    x2: 310,
    y2: 180,
    strokeColor: "#1f2937",
    strokeWidth: 2,
    layerId: "0",
  });
});
