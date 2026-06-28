/**
 * Coordinate bridge between 2D drawing space and 3D scene space.
 *
 * Conventions:
 *   - 2D drawing: pixels, origin top-left, X right, Y down
 *   - 3D scene:   Three.js units, 100 units = 1 m
 *                 X maps to 2D X, Z maps to 2D Y (Y = elevation)
 *   - The 3D scene renders inside a group translated by (-cx, 0, -cz)
 *     so that the plan centroid sits at the world origin.
 *     Adding cx/cz back converts world coords → drawing coords.
 */

export interface Center {
  cx: number;
  cz: number;
}

/** 3D world position → 2D drawing pixel coords */
export function worldToDrawing(world: { x: number; z: number }, center: Center): { x: number; y: number } {
  return { x: world.x + center.cx, y: world.z + center.cz };
}

/** 2D drawing pixel coords → 3D world position (ground plane, y = 0) */
export function drawingToWorld(pt: { x: number; y: number }, center: Center): { x: number; y: number; z: number } {
  return { x: pt.x - center.cx, y: 0, z: pt.y - center.cz };
}

/** Array of 3D ground-plane points → array of 2D drawing points */
export function worldPointsToPolygon(
  pts: { x: number; z: number }[],
  center: Center,
): { x: number; y: number }[] {
  return pts.map((p) => worldToDrawing(p, center));
}
