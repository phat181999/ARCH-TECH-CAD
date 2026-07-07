import { describe, it, expect } from "vitest";
import { computeMepJoints } from "./mepJoints";
import type { DrawingElement } from "../../../types";

const seg = (x1: number, y1: number, x2: number, y2: number): DrawingElement => ({
  id: `p-${x1}-${y1}-${x2}-${y2}`, type: "line", layerId: "0", archType: "pipe",
  pipeSystem: "electric", elevation: 280, pipeDiameter: 20, x1, y1, x2, y2,
});

describe("computeMepJoints", () => {
  it("marks a shared endpoint between two segments as a joint", () => {
    const joints = computeMepJoints([seg(0, 0, 100, 0), seg(100, 0, 100, 100)]);
    const shared = joints.find((j) => j.x === 100 && j.y === 0);
    expect(shared?.kind).toBe("joint");
  });

  it("marks the two open ends of an L-bend as ends", () => {
    const joints = computeMepJoints([seg(0, 0, 100, 0), seg(100, 0, 100, 100)]);
    const start = joints.find((j) => j.x === 0 && j.y === 0);
    const tail = joints.find((j) => j.x === 100 && j.y === 100);
    expect(start?.kind).toBe("end");
    expect(tail?.kind).toBe("end");
    expect(joints).toHaveLength(3);
  });

  it("does not merge endpoints from different systems or elevations", () => {
    const water: DrawingElement = { ...seg(100, 0, 100, 100), id: "w1", pipeSystem: "water", elevation: 30 };
    const joints = computeMepJoints([seg(0, 0, 100, 0), water]);
    expect(joints.every((j) => j.kind === "end")).toBe(true);
  });

  it("ignores non-pipe elements", () => {
    const wall: DrawingElement = { id: "wall1", type: "line", layerId: "0", archType: "wall", x1: 0, y1: 0, x2: 100, y2: 0 };
    expect(computeMepJoints([wall])).toEqual([]);
  });
});
