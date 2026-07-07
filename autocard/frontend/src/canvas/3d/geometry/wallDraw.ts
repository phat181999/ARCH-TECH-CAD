import type { DrawingElement } from "../../../types";

// Re-export from the canonical coordinate bridge so callers can import from either file.
export { worldToDrawing as worldToDrawingXY } from "./coordBridge";

let wallSeq = 0;

// Builds a wall as a line element on the active drawing path, tagged
// archType:"wall" so it renders as an extruded wall in 3D (PlanModel fallback)
// and as a normal line in 2D (CadEngine) — i.e. it round-trips and persists.
export function makeWallElement(
  start: { x: number; y: number },
  end: { x: number; y: number },
  opts: { layerId: string; strokeColor?: string; strokeWidth?: number; idSeed?: number; wallLayers?: { material: string; thicknessMm: number }[] },
): DrawingElement {
  const seed = opts.idSeed ?? ++wallSeq;
  return {
    id: `wall3d-${seed}`,
    type: "line",
    x1: start.x, y1: start.y,
    x2: end.x, y2: end.y,
    archType: "wall",
    layerId: opts.layerId,
    strokeColor: opts.strokeColor ?? "#1f2937",
    strokeWidth: opts.strokeWidth ?? 2,
    ...(opts.wallLayers ? { wallLayers: opts.wallLayers } : {}),
  };
}

// A wall must have non-zero length to be meaningful (avoids degenerate clicks).
export function isValidWall(start: { x: number; y: number }, end: { x: number; y: number }, minLen = 1): boolean {
  return Math.hypot(end.x - start.x, end.y - start.y) >= minLen;
}
