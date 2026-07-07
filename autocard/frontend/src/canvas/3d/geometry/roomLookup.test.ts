import { describe, it, expect } from "vitest";
import { pointInRoom } from "./roomLookup";

const room = { id: "r1", polygon: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }] };

describe("pointInRoom", () => {
  it("finds the room containing the point", () => {
    expect(pointInRoom({ x: 50, y: 50 }, [room])).toBe(room);
  });
  it("returns null outside every room", () => {
    expect(pointInRoom({ x: 200, y: 200 }, [room])).toBeNull();
  });
  it("returns null when there are no rooms", () => {
    expect(pointInRoom({ x: 1, y: 1 }, [])).toBeNull();
  });
});
