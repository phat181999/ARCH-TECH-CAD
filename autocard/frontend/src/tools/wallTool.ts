import type { DrawingElement, Point } from "../types";

/**
 * Constrains a point to Ortho (0°, 90°, 180°, 270°) or snap-to-angle (multiples of polarAngleDeg, e.g., 45°).
 */
export function getConstrainedWallPoint(
  start: Point,
  current: Point,
  orthoEnabled: boolean,
  polarAngleDeg: number = 45
): Point {
  const dx = current.x - start.x;
  const dy = current.y - start.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.1) return current;

  if (orthoEnabled) {
    if (Math.abs(dx) > Math.abs(dy)) {
      return { x: current.x, y: start.y };
    } else {
      return { x: start.x, y: current.y };
    }
  }

  // Polar snapping (e.g. 45 degrees)
  const angleRad = Math.atan2(dy, dx);
  const angleStepRad = (polarAngleDeg * Math.PI) / 180;
  const snappedAngle = Math.round(angleRad / angleStepRad) * angleStepRad;

  return {
    x: start.x + dist * Math.cos(snappedAngle),
    y: start.y + dist * Math.sin(snappedAngle),
  };
}

/**
 * Creates a dual-format wall drawing element that renders in both 2D and 3D.
 */
export function createWallElement(
  start: Point,
  end: Point,
  opts: {
    id?: string;
    layerId?: string;
    thickness?: number;
    height?: number;
  } = {}
): DrawingElement {
  const thickness = opts.thickness ?? 20; // 200mm equivalent in typical units (or 20px)
  const height = opts.height ?? 300;     // 3000mm equivalent in typical units (or 300px)
  const layerId = opts.layerId ?? "A-WALL";
  const id = opts.id ?? `wall-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  return {
    id,
    type: "wall",          // For 2D filled polygon rendering (CadEngine)
    archType: "wall",      // For 3D classification / PlanModel
    start: { x: start.x, y: start.y }, // For 2D CadEngine
    end: { x: end.x, y: end.y },     // For 2D CadEngine
    x1: start.x,
    y1: start.y,
    x2: end.x,
    y2: end.y,
    thickness,             // For 2D CadEngine
    wallThickness: thickness, // For 3D
    height,                // For 3D
    layerId,
    strokeColor: "#1f2937",
    strokeWidth: 2,
  };
}
