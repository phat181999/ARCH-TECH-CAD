import { describe, it, expect } from "vitest";
import { snapFixtureToWall } from "./fixtureSnap";
import type { DrawingElement } from "../../../types";

const wall: DrawingElement = { id: "w1", type: "line", layerId: "0", archType: "wall", x1: 0, y1: 0, x2: 100, y2: 0 };

describe("snapFixtureToWall", () => {
  it("projects onto the wall and offsets toward the click side", () => {
    const s = snapFixtureToWall({ x: 50, y: 10 }, [wall], 60, 12)!;
    expect(s.x).toBeCloseTo(50);
    expect(s.y).toBeCloseTo(12);
    expect(s.angleDeg).toBeCloseTo(0);
    expect(s.wallId).toBe("w1");
  });

  it("offsets to the other side for a click below the wall", () => {
    const s = snapFixtureToWall({ x: 50, y: -10 }, [wall], 60, 12)!;
    expect(s.y).toBeCloseTo(-12);
  });

  it("clamps the projection to the wall segment", () => {
    const s = snapFixtureToWall({ x: 130, y: 10 }, [wall], 60, 12)!;
    expect(s.x).toBeCloseTo(100);
  });

  it("returns null when no wall is within maxDist", () => {
    expect(snapFixtureToWall({ x: 50, y: 100 }, [wall], 60, 12)).toBeNull();
  });

  it("returns null with no walls", () => {
    expect(snapFixtureToWall({ x: 0, y: 0 }, [], 60, 12)).toBeNull();
  });
});
