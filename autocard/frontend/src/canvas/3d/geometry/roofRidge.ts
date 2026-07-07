// Interprets the user-drawn ridge line (mặt bằng, drawing coords) as roof
// parameters: which axis the ridge runs along, its length (drives the hip
// ridge — 0 → pyramid), and which side of the footprint is "high" (drives
// the shed roof's tall edge). Mirrors house_planner_demo.html's generateRoof.
export interface RidgeLine { x1: number; y1: number; x2: number; y2: number }
export interface RidgeParams { alongX: boolean; ridgeLen: number; highSide: 1 | -1 }

export function deriveRidgeParams(
  ridge: RidgeLine,
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
): RidgeParams {
  const dx = ridge.x2 - ridge.x1;
  const dy = ridge.y2 - ridge.y1;
  const alongX = Math.abs(dx) >= Math.abs(dy);
  const ridgeLen = Math.hypot(dx, dy);
  // Cross-axis midpoint of the ridge vs footprint center decides the high side.
  const mid = alongX ? (ridge.y1 + ridge.y2) / 2 : (ridge.x1 + ridge.x2) / 2;
  const center = alongX ? (bounds.minZ + bounds.maxZ) / 2 : (bounds.minX + bounds.maxX) / 2;
  return { alongX, ridgeLen, highSide: mid >= center ? 1 : -1 };
}
