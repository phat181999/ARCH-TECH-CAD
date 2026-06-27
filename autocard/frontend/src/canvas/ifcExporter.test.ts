/**
 * Unit tests for canvas/ifcExporter.ts — pure text generation, no DOM or WASM.
 */
import { describe, it, expect } from "vitest";
import { exportToIFC } from "./ifcExporter";
import type { DrawingElement } from "../types";

function makeWall(x1: number, y1: number, x2: number, y2: number, thickness = 200, height = 3000): DrawingElement {
  return { id: `w_${Math.random()}`, type: "line", archType: "wall", x1, y1, x2, y2, wallThickness: thickness, height } as any;
}
function makeDoor(x: number, y: number, width = 900, height = 2100): DrawingElement {
  return { id: `d_${Math.random()}`, type: "rectangle", archType: "door", x, y, width, height } as any;
}
function makeWindow(x: number, y: number, width = 1200, height = 1200): DrawingElement {
  return { id: `w_${Math.random()}`, type: "rectangle", archType: "window", x, y, width, height } as any;
}

describe("IFC 2x3 exporter — file structure", () => {
  it("produces valid ISO-10303-21 envelope", () => {
    const ifc = exportToIFC([]);
    expect(ifc).toMatch(/^ISO-10303-21;/);
    expect(ifc).toMatch(/END-ISO-10303-21;$/);
    expect(ifc).toContain("FILE_SCHEMA(('IFC2X3'))");
    expect(ifc).toContain("ENDSEC;");
    expect(ifc).toContain("DATA;");
  });

  it("always includes project, site, building and storey entities", () => {
    const ifc = exportToIFC([]);
    expect(ifc).toContain("IFCPROJECT");
    expect(ifc).toContain("IFCSITE");
    expect(ifc).toContain("IFCBUILDING");
    expect(ifc).toContain("IFCBUILDINGSTOREY");
  });

  it("includes aggregation relationships", () => {
    const ifc = exportToIFC([]);
    expect(ifc).toContain("IFCRELAGGREGATES");
  });

  it("includes unit assignment with metres", () => {
    const ifc = exportToIFC([]);
    expect(ifc).toContain("IFCUNITASSIGNMENT");
    expect(ifc).toContain(".LENGTHUNIT.");
    expect(ifc).toContain(".METRE.");
  });
});

describe("IFC 2x3 exporter — walls", () => {
  it("generates IFCWALL entity for wall element", () => {
    const ifc = exportToIFC([makeWall(0, 0, 1000, 0)]);
    expect(ifc).toContain("IFCWALL");
  });

  it("generates IFCEXTRUDEDAREASOLID for wall geometry", () => {
    const ifc = exportToIFC([makeWall(0, 0, 1000, 0)]);
    expect(ifc).toContain("IFCEXTRUDEDAREASOLID");
    expect(ifc).toContain("IFCRECTANGLEPROFILEDEF");
  });

  it("converts px to metres correctly — 1000px wall ≈ 1.0m", () => {
    const ifc = exportToIFC([makeWall(0, 0, 1000, 0, 200, 3000)]);
    // px2m(1000) = 1, px2m(200) = 0.2, px2m(3000) = 3
    // The profile center x = px2m(500) = 0.5
    expect(ifc).toContain("0.5");    // profile center offset (half of length)
    expect(ifc).toContain("0.2");    // thickness in metres
    expect(ifc).toContain(",3)");    // height 3m in the extrude call
  });

  it("skips degenerate walls shorter than 10px", () => {
    const ifc = exportToIFC([makeWall(0, 0, 5, 0)]);
    expect(ifc).not.toContain("IFCWALL");
  });

  it("generates one IFCWALL per wall element", () => {
    const walls = [makeWall(0, 0, 1000, 0), makeWall(0, 0, 0, 1000), makeWall(500, 0, 500, 800)];
    const ifc = exportToIFC(walls);
    const matches = ifc.match(/IFCWALL\(/g) ?? [];
    expect(matches.length).toBe(3);
  });

  it("includes spatial containment when walls present", () => {
    const ifc = exportToIFC([makeWall(0, 0, 1000, 0)]);
    expect(ifc).toContain("IFCRELCONTAINEDINSPATIALSTRUCTURE");
  });
});

describe("IFC 2x3 exporter — doors & windows", () => {
  it("generates IFCDOOR entity", () => {
    const ifc = exportToIFC([makeDoor(100, 100)]);
    expect(ifc).toContain("IFCDOOR");
  });

  it("generates IFCWINDOW entity", () => {
    const ifc = exportToIFC([makeWindow(200, 200)]);
    expect(ifc).toContain("IFCWINDOW");
  });

  it("handles mixed elements — wall + door + window", () => {
    const els = [makeWall(0, 0, 5000, 0), makeDoor(1000, 0), makeWindow(3000, 0)];
    const ifc = exportToIFC(els);
    expect(ifc).toContain("IFCWALL");
    expect(ifc).toContain("IFCDOOR");
    expect(ifc).toContain("IFCWINDOW");
  });

  it("no containment relation when no products generated (empty)", () => {
    const ifc = exportToIFC([]);
    expect(ifc).not.toContain("IFCRELCONTAINEDINSPATIALSTRUCTURE");
  });
});

describe("IFC 2x3 exporter — determinism", () => {
  it("entity IDs are sequential integers starting at #1", () => {
    const ifc = exportToIFC([]);
    // First entity should be #1
    expect(ifc).toMatch(/#1= /);
  });

  it("each call resets the ID counter (produces same structure)", () => {
    const a = exportToIFC([makeWall(0, 0, 1000, 0)]);
    const b = exportToIFC([makeWall(0, 0, 1000, 0)]);
    // Both should have same entity count (GUIDs differ, but entity types at same IDs)
    const entityCountA = (a.match(/^#\d+=/gm) ?? []).length;
    const entityCountB = (b.match(/^#\d+=/gm) ?? []).length;
    expect(entityCountA).toBe(entityCountB);
  });
});
