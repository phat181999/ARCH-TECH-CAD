/**
 * Regression test for getPlanBounds() block scaling — vitest API (see canvas/snap.test.ts).
 * Note: sibling files in this directory (hugeCoords.test.ts, etc.) use node:test/node:assert
 * and are silently skipped by `vitest run` — a pre-existing tooling mismatch, not addressed here.
 */
import { describe, it, expect } from "vitest";
import { getPlanBounds } from "./planClassification";
import type { BlockDef, DrawingElement } from "../../../types";

describe("getPlanBounds: block scaling", () => {
  // Base footprint spans x:[-10,10], y:[-5,5] in the block's local space.
  const blockDefs: Record<string, BlockDef> = {
    sofa: {
      id: "sofa",
      name: "Sofa",
      insertionPoint: { x: 0, y: 0 },
      elements: [
        { id: "s1", type: "rectangle", layerId: "0", x: -10, y: -5, width: 20, height: 10 } as DrawingElement,
      ],
    },
  };

  it("scales a block's bounding-box contribution by el.scale, not just its insertion point", () => {
    const el: DrawingElement = { id: "b1", type: "block", layerId: "0", blockId: "sofa", x: 0, y: 0, scale: 5 };
    const bounds = getPlanBounds([el], blockDefs);

    expect(bounds).not.toBeNull();
    // Zero-size-point bug would report bounds of {0,0,0,0}. Correct footprint is
    // the local rect (±10 x, ±5 y) scaled by 5 → ±50 x, ±25 y around the insertion point.
    expect(bounds!.minX).toBe(-50);
    expect(bounds!.maxX).toBe(50);
    expect(bounds!.minZ).toBe(-25);
    expect(bounds!.maxZ).toBe(25);
  });

  it("offsets the scaled footprint by the insertion point", () => {
    const el: DrawingElement = { id: "b2", type: "block", layerId: "0", blockId: "sofa", x: 100, y: 200, scale: 2 };
    const bounds = getPlanBounds([el], blockDefs);

    expect(bounds).not.toBeNull();
    expect(bounds!.minX).toBe(100 - 20);
    expect(bounds!.maxX).toBe(100 + 20);
    expect(bounds!.minZ).toBe(200 - 10);
    expect(bounds!.maxZ).toBe(200 + 10);
  });

  it("falls back to the insertion point when no block definition is available", () => {
    const el: DrawingElement = { id: "b3", type: "block", layerId: "0", blockId: "unknown", x: 5, y: 5, scale: 5 };
    const bounds = getPlanBounds([el]);

    expect(bounds).toEqual({ minX: 5, minZ: 5, maxX: 5, maxZ: 5 });
  });
});
