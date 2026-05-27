import test from "node:test";
import assert from "node:assert";
import { elementsToDxf, dxfToElements } from "./dxf.js";
import type { DrawingElement, DrawingDocument } from "../types.js";

// Helper to generate unique ID
const genId = () => `test-${Math.random().toString(36).substr(2, 9)}`;

test("DXF Import/Export Round-Trip", async (t) => {
  const elements: DrawingElement[] = [
    {
      id: "el-1",
      type: "line",
      x1: 10,
      y1: 20,
      x2: 100,
      y2: 200,
      strokeColor: "#1f2937",
      strokeWidth: 2,
      layerId: "A-WALL",
    },
    {
      id: "el-2",
      type: "circle",
      cx: 150,
      cy: 150,
      radius: 50,
      strokeColor: "#1f2937",
      strokeWidth: 2,
      fillColor: "transparent",
      layerId: "A-FURN",
    },
    {
      id: "el-3",
      type: "text",
      x: 300,
      y: 400,
      text: "Kitchen",
      fontSize: 16,
      strokeColor: "#1f2937",
      layerId: "A-ROOM",
    },
  ];

  await t.test("exports to DXF successfully", () => {
    const dxfText = elementsToDxf(elements);
    assert.match(dxfText, /SECTION/);
    assert.match(dxfText, /ENTITIES/);
    assert.match(dxfText, /LINE/);
    assert.match(dxfText, /CIRCLE/);
    assert.match(dxfText, /TEXT/);
    assert.match(dxfText, /EOF/);
  });

  await t.test("imports from DXF successfully", () => {
    const dxfText = elementsToDxf(elements);
    const imported = dxfToElements(dxfText);

    assert.strictEqual(imported.length, 3);

    const line = imported.find((e) => e.type === "line");
    assert.ok(line);
    assert.strictEqual(line.x1, 10);
    assert.strictEqual(line.y1, 20);
    assert.strictEqual(line.x2, 100);
    assert.strictEqual(line.y2, 200);

    const circle = imported.find((e) => e.type === "circle");
    assert.ok(circle);
    assert.strictEqual(circle.cx, 150);
    assert.strictEqual(circle.cy, 150);
    assert.strictEqual(circle.radius, 50);

    const text = imported.find((e) => e.type === "text");
    assert.ok(text);
    assert.strictEqual(text.x, 300);
    assert.strictEqual(text.y, 400);
    assert.strictEqual(text.text, "Kitchen");
  });
});

test("JSON Backward Compatibility Schema Normalizer", async (t) => {
  // Mock normalizer function identical to CanvasEditor.tsx logic
  function normalizeJson(parsed: any): DrawingDocument {
    if (Array.isArray(parsed)) {
      return {
        fileType: "ARCH-TECH-CAD-DOCUMENT",
        version: 1,
        elements: parsed,
        layers: [{ id: "layer-1", name: "Layer 1", visible: true, locked: false }],
        activeLayerId: "layer-1",
        blockDefs: {},
        currentArchitecturalPlan: null,
        measurements: [],
        constraints: [],
      };
    } else if (parsed?.fileType === "ARCH-TECH-CAD-DOCUMENT") {
      return parsed;
    } else if (parsed?.elements) {
      return {
        fileType: "ARCH-TECH-CAD-DOCUMENT",
        version: 1,
        elements: parsed.elements || [],
        layers: parsed.layers || [{ id: "layer-1", name: "Layer 1", visible: true, locked: false }],
        activeLayerId: parsed.activeLayerId || "layer-1",
        blockDefs: parsed.blockDefs || {},
        currentArchitecturalPlan: parsed.currentArchitecturalPlan || null,
        measurements: parsed.measurements || [],
        constraints: parsed.constraints || [],
      };
    }
    throw new Error("Unrecognized file format");
  }

  await t.test("normalizes v0a (legacy array format)", () => {
    const rawArray = [
      { id: "1", type: "line", x1: 0, y1: 0, x2: 10, y2: 10 }
    ];
    const doc = normalizeJson(rawArray);
    assert.strictEqual(doc.fileType, "ARCH-TECH-CAD-DOCUMENT");
    assert.strictEqual(doc.version, 1);
    assert.strictEqual(doc.elements.length, 1);
    assert.strictEqual(doc.elements[0].id, "1");
    assert.strictEqual(doc.layers.length, 1);
    assert.strictEqual(doc.layers[0].id, "layer-1");
  });

  await t.test("normalizes v0b (legacy object format)", () => {
    const rawObj = {
      elements: [{ id: "2", type: "circle", cx: 10, cy: 10, radius: 5 }],
      blockDefs: { door: { id: "door", name: "Door", insertionPoint: { x: 0, y: 0 }, elements: [] } }
    };
    const doc = normalizeJson(rawObj);
    assert.strictEqual(doc.fileType, "ARCH-TECH-CAD-DOCUMENT");
    assert.strictEqual(doc.version, 1);
    assert.strictEqual(doc.elements.length, 1);
    assert.strictEqual(doc.elements[0].id, "2");
    assert.ok(doc.blockDefs.door);
  });

  await t.test("loads v1 directly", () => {
    const v1Doc: DrawingDocument = {
      fileType: "ARCH-TECH-CAD-DOCUMENT",
      version: 1,
      elements: [{ id: "3", type: "text", x: 10, y: 10, text: "Label" }],
      layers: [{ id: "custom-layer", name: "Custom", visible: true, locked: false }],
      activeLayerId: "custom-layer",
      blockDefs: {},
      currentArchitecturalPlan: null,
      measurements: [],
      constraints: []
    };
    const doc = normalizeJson(v1Doc);
    assert.strictEqual(doc.fileType, "ARCH-TECH-CAD-DOCUMENT");
    assert.strictEqual(doc.activeLayerId, "custom-layer");
    assert.strictEqual(doc.elements[0].id, "3");
  });
});

test("Store Merge Conflict Resolution & ID Collision Policy", async (t) => {
  // Mock conflict resolution logic identical to mergeDrawingState in drawingStore.ts
  function resolveMergeConflict(current: any, importedDoc: DrawingDocument) {
    const idMap: Record<string, string> = {};

    // 1. Re-key imported elements
    const reKeyedElements = importedDoc.elements.map(el => {
      const newId = `el-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      idMap[el.id] = newId;
      return { ...el, id: newId };
    });

    // 2. Remap hostWall references
    const remappedElements = reKeyedElements.map(el => {
      if (el.hostWall && idMap[el.hostWall]) {
        return { ...el, hostWall: idMap[el.hostWall] };
      }
      return el;
    });

    // 3. Layer collision resolution
    let nextLayers = [...current.layers];
    const layerIdMap: Record<string, string> = {};
    for (const il of importedDoc.layers) {
      const byId = current.layers.find((l: any) => l.id === il.id);
      const byName = current.layers.find((l: any) => l.name === il.name);
      if (byId) {
        layerIdMap[il.id] = il.id;
      } else if (byName) {
        layerIdMap[il.id] = byName.id;
      } else {
        nextLayers.push(il);
        layerIdMap[il.id] = il.id;
      }
    }

    const finalElements = remappedElements.map(el => ({
      ...el,
      layerId: layerIdMap[el.layerId] || el.layerId
    }));

    return {
      elements: [...current.elements, ...finalElements],
      layers: nextLayers,
      idMap
    };
  }

  await t.test("re-keys elements and resolves hostWall links", () => {
    const current = {
      elements: [{ id: "wall-1", type: "line", x1: 0, y1: 0, x2: 10, y2: 0 }],
      layers: [{ id: "A-WALL", name: "Walls", visible: true, locked: false }]
    };

    const importedDoc: DrawingDocument = {
      fileType: "ARCH-TECH-CAD-DOCUMENT",
      version: 1,
      elements: [
        { id: "wall-1", type: "line", x1: 10, y1: 10, x2: 20, y2: 10, layerId: "A-WALL" },
        { id: "door-1", type: "door", x: 15, y: 10, hostWall: "wall-1", layerId: "A-DOOR" }
      ],
      layers: [
        { id: "A-WALL", name: "Walls", visible: true, locked: false },
        { id: "A-DOOR", name: "Doors", visible: true, locked: false }
      ],
      activeLayerId: "A-WALL",
      blockDefs: {},
      currentArchitecturalPlan: null,
      measurements: [],
      constraints: []
    };

    const result = resolveMergeConflict(current, importedDoc);

    // Assert that we have 3 elements total
    assert.strictEqual(result.elements.length, 3);
    
    // Assert original wall remains unchanged
    assert.ok(result.elements.some(e => e.id === "wall-1"));

    // Find imported wall and door
    const importedWall = result.elements.find(e => e.type === "line" && e.id !== "wall-1");
    const importedDoor = result.elements.find(e => e.type === "door");

    assert.ok(importedWall);
    assert.ok(importedDoor);
    
    // Check that wall was re-keyed
    assert.notStrictEqual(importedWall.id, "wall-1");
    assert.ok(importedWall.id.startsWith("el-"));

    // Check that door hostWall reference was updated to match the new wall ID
    assert.strictEqual(importedDoor.hostWall, importedWall.id);
  });
});
