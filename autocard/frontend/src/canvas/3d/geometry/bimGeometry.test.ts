import { describe, it, expect } from "vitest";
import {
  unitScaleFor, levelBaseMap, buildWallBoxes, buildColumnBoxes, buildSlabBoxes,
} from "./bimGeometry";
import type { BIMResult } from "../../../api/client";

function baseResult(partial: Partial<BIMResult>): BIMResult {
  return {
    job_id: "j", analyzed: "", units: "mm",
    levels: [], walls: [], openings: [], rooms: [], columns: [],
    ...partial,
  };
}

describe("unitScaleFor", () => {
  it("maps unit strings to mm scale", () => {
    expect(unitScaleFor("mm")).toBe(1);
    expect(unitScaleFor("m")).toBe(1000);
    expect(unitScaleFor("ft")).toBeCloseTo(304.8);
    expect(unitScaleFor(undefined)).toBe(1);
  });
});

describe("buildWallBoxes — openings cut walls", () => {
  const result = baseResult({
    walls: [{ id: "W1", level_id: "L1", role: "exterior", x1: 0, y1: 0, x2: 5000, y2: 0, thickness: 200, height: 3000 }],
    openings: [{ id: "O1", type: "door", host_wall_id: "W1", x: 1000, y: 0, width: 900, height: 2100, sill: 0 }],
  });

  it("leaves a real gap for the door (no full-height box spans the opening)", () => {
    const boxes = buildWallBoxes(result, 1, new Map());
    // Opening span along axis is [550, 1450]. A full-height (3000) pier must not cover it.
    const fullHeight = boxes.filter((b) => Math.abs(b.sy - 3000) < 1);
    const coversOpening = fullHeight.some((b) => {
      const half = b.sx / 2;
      return b.cx - half < 1450 && b.cx + half > 550;
    });
    expect(coversOpening).toBe(false);
  });

  it("adds a lintel above the door (height = wall - door = 900)", () => {
    const boxes = buildWallBoxes(result, 1, new Map());
    const lintel = boxes.find((b) => Math.abs(b.sy - 900) < 1);
    expect(lintel).toBeTruthy();
    // Lintel sits above the 2100 door: center y = 2100 + 900/2 = 2550
    expect(lintel!.cy).toBeCloseTo(2550);
  });

  it("produces two side piers flanking the door", () => {
    const boxes = buildWallBoxes(result, 1, new Map());
    const piers = boxes.filter((b) => Math.abs(b.sy - 3000) < 1).sort((a, b) => a.cx - b.cx);
    expect(piers.length).toBe(2);
    // First pier spans [0,550] → center 275; second [1450,5000] → center 3225
    expect(piers[0].cx).toBeCloseTo(275);
    expect(piers[1].cx).toBeCloseTo(3225);
  });
});

describe("level elevation stacking", () => {
  it("raises upper-level walls by the level base", () => {
    const result = baseResult({
      levels: [{ id: "L2", name: "L2", elevation: 3000, height: 3000 }],
      walls: [{ id: "W", level_id: "L2", role: "interior", x1: 0, y1: 0, x2: 1000, y2: 0, thickness: 200, height: 3000 }],
    });
    const lb = levelBaseMap(result.levels, 1);
    const boxes = buildWallBoxes(result, 1, lb);
    // Wall center y = base(3000) + height/2(1500) = 4500
    expect(boxes[0].cy).toBeCloseTo(4500);
  });
});

describe("metric scaling", () => {
  it("scales metre coordinates and heights to mm", () => {
    const result = baseResult({
      units: "m",
      walls: [{ id: "W", level_id: "", role: "ext", x1: 0, y1: 0, x2: 5, y2: 0, thickness: 0.2, height: 3 }],
    });
    const boxes = buildWallBoxes(result, unitScaleFor("m"), new Map());
    expect(boxes[0].sx).toBeCloseTo(5000); // length 5m → 5000mm
    expect(boxes[0].sy).toBeCloseTo(3000); // height 3m → 3000mm
  });
});

describe("columns and slabs", () => {
  it("builds a column box at the right place", () => {
    const cols = buildColumnBoxes(
      [{ id: "C1", level_id: "", x: 100, y: 200, width: 400, depth: 400, height: 3000 }],
      1, new Map(),
    );
    expect(cols).toHaveLength(1);
    expect(cols[0].cx).toBe(100);
    expect(cols[0].cz).toBe(200);
    expect(cols[0].cy).toBeCloseTo(1500);
  });

  it("builds one slab covering the wall bounding box", () => {
    const result = baseResult({
      walls: [
        { id: "W1", level_id: "", role: "e", x1: 0, y1: 0, x2: 4000, y2: 0, thickness: 200, height: 3000 },
        { id: "W2", level_id: "", role: "e", x1: 4000, y1: 0, x2: 4000, y2: 3000, thickness: 200, height: 3000 },
      ],
    });
    const slabs = buildSlabBoxes(result, 1, new Map());
    expect(slabs).toHaveLength(1);
    expect(slabs[0].sx).toBeCloseTo(4000);
    expect(slabs[0].sz).toBeCloseTo(3000);
    expect(slabs[0].cy).toBeLessThan(0); // slab sits below floor level
  });
});
