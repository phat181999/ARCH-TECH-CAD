import test from "node:test";
import assert from "node:assert";
import { summarizeDxfLayers, scaleElements, dxfToElements } from "./dxf.js";
import type { DrawingElement } from "../types.js";

const els: DrawingElement[] = [
  { id: "a", type: "line", x1: 0, y1: 0, x2: 100, y2: 0, layerId: "A-WALL" },
  { id: "b", type: "line", x1: 0, y1: 0, x2: 50, y2: 0, layerId: "A-WALL" },
  { id: "c", type: "arc", cx: 10, cy: 0, radius: 5, layerId: "A-DOOR" },
  { id: "d", type: "text", x: 1, y: 2, layerId: "A-ANNO-TEXT" },
];

test("summarizeDxfLayers groups by layer with counts and auto type", () => {
  const s = summarizeDxfLayers(els);
  const wall = s.find((l) => l.layerId === "A-WALL")!;
  assert.equal(wall.count, 2);
  assert.equal(wall.autoType, "wall");
  assert.equal(s.find((l) => l.layerId === "A-DOOR")!.autoType, "door");
  assert.equal(s.find((l) => l.layerId === "A-ANNO-TEXT")!.autoType, "ignore");
});

test("scaleElements multiplies all coordinates by the factor", () => {
  const out = scaleElements(els, 1000);
  const a = out.find((e) => e.id === "a")!;
  assert.equal(a.x2, 100000);
  const c = out.find((e) => e.id === "c")!;
  assert.equal(c.cx, 10000);
  assert.equal(c.radius, 5000);
  const d = out.find((e) => e.id === "d")!;
  assert.equal(d.x, 1000);
  // Original array is not mutated
  assert.equal(els.find((e) => e.id === "a")!.x2, 100);
});

test("INSERT with a door-like block name becomes a door element", () => {
  const dxf = [
    "0", "SECTION", "2", "ENTITIES",
    "0", "INSERT", "8", "A-DOOR", "2", "DOOR_SINGLE", "10", "1000", "20", "2000",
    "0", "ENDSEC", "0", "EOF",
  ].join("\r\n");
  const out = dxfToElements(dxf);
  const door = out.find((e) => e.archType === "door");
  assert.ok(door, "expected a door element from the INSERT");
  assert.equal(typeof door!.x, "number");
});
