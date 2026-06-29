/// <reference lib="webworker" />
/**
 * Geometry Worker — computes wall segments and plan centroid off the main thread.
 * Runs inside a Web Worker; no DOM access, no React imports.
 */

import type { DrawingElement } from "../types";

// Minimal wall segment shape used inside the worker (no THREE.js dependency)
interface WallSegmentWorker {
  id:              string;
  centerX:         number;
  centerZ:         number;
  width:           number;
  depth:           number;
  heightOverride?: number;
}

interface WorkerInput {
  type:                 "computeWalls";
  elements:             DrawingElement[];
  cx:                   number;
  cz:                   number;
  defaultWallThickness: number;
}

interface WorkerOutput {
  type:         "wallsComputed";
  wallSegments: WallSegmentWorker[];
  centroid:     { cx: number; cz: number };
}

// archTypes that are NOT walls and must be skipped
const NON_WALL_ARCH_TYPES = new Set(["pipe", "foundation-strip", "grade-beam"]);

// Minimum wall length in drawing units — shorter lines are degenerate
const MIN_WALL_LENGTH = 1;

function computeWallSegments(
  elements: DrawingElement[],
  cx: number,
  cz: number,
  defaultWallThickness: number,
): WallSegmentWorker[] {
  const segments: WallSegmentWorker[] = [];

  for (const el of elements) {
    // Only process wall-like line elements
    if (
      el.type !== "line" ||
      el.x1 === undefined || el.y1 === undefined ||
      el.x2 === undefined || el.y2 === undefined
    ) continue;

    const archType = el.archType as string | undefined;
    if (archType !== undefined && NON_WALL_ARCH_TYPES.has(archType)) continue;

    const x1 = (el.x1 as number) - cx;
    const z1 = (el.y1 as number) - cz;
    const x2 = (el.x2 as number) - cx;
    const z2 = (el.y2 as number) - cz;

    const dx = x2 - x1;
    const dz = z2 - z1;
    const length = Math.sqrt(dx * dx + dz * dz);
    if (length < MIN_WALL_LENGTH) continue;

    const thickness = (el.wallThickness as number | undefined) ?? defaultWallThickness;

    segments.push({
      id:             el.id,
      centerX:        (x1 + x2) / 2,
      centerZ:        (z1 + z2) / 2,
      width:          length,
      depth:          thickness,
      heightOverride: el.wallHeightOverride as number | undefined,
    });
  }

  return segments;
}

function computeCentroid(elements: DrawingElement[]): { cx: number; cz: number } {
  const lines = elements.filter(
    (el) =>
      el.type === "line" &&
      el.x1 !== undefined && el.x2 !== undefined &&
      el.y1 !== undefined && el.y2 !== undefined,
  );
  if (lines.length === 0) return { cx: 0, cz: 0 };

  let sumX = 0;
  let sumY = 0;
  for (const el of lines) {
    sumX += ((el.x1 as number) + (el.x2 as number)) / 2;
    sumY += ((el.y1 as number) + (el.y2 as number)) / 2;
  }
  return { cx: sumX / lines.length, cz: sumY / lines.length };
}

self.onmessage = (e: MessageEvent<WorkerInput>) => {
  const { type, elements, cx, cz, defaultWallThickness } = e.data;

  if (type === "computeWalls") {
    // If cx/cz are zero (initial state), compute centroid first
    let finalCx = cx;
    let finalCz = cz;
    if (cx === 0 && cz === 0 && elements.length > 0) {
      const centroid = computeCentroid(elements);
      finalCx = centroid.cx;
      finalCz = centroid.cz;
    }

    const wallSegments = computeWallSegments(elements, finalCx, finalCz, defaultWallThickness);
    const output: WorkerOutput = {
      type:         "wallsComputed",
      wallSegments,
      centroid:     { cx: finalCx, cz: finalCz },
    };
    self.postMessage(output);
  }
};
