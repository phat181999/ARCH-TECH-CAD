// Orthographic camera frusta for exporting 2D sheets (mặt bằng / mặt đứng)
// from the 3D model. Bounds are the origin-centered local bounds the Scene
// renders in (drawing units, 100 = 1 m).
//
// "N/S/E/W" here are axis-aligned labels only (+Z/-Z/+X/-X) — the data model
// has no true geographic orientation, so these are just four fixed viewing
// directions, not a compass reference.
export type SheetView = "plan" | "front" | "side" | "elevation-N" | "elevation-S" | "elevation-E" | "elevation-W" | "section";
export interface SheetFrustum {
  left: number; right: number; top: number; bottom: number;
  position: [number, number, number];
  up: [number, number, number];
  target: [number, number, number];
}
export interface SectionLine { x1: number; z1: number; x2: number; z2: number }

export function sheetFrustum(
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
  view: SheetView,
  wallHeight: number,
  roofAllowance = 400,
  margin = 100,
  sectionLine?: SectionLine,
): SheetFrustum {
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;
  const halfX = (bounds.maxX - bounds.minX) / 2 + margin;
  const halfZ = (bounds.maxZ - bounds.minZ) / 2 + margin;
  const halfH = (wallHeight + roofAllowance) / 2 + margin;
  const midY = (wallHeight + roofAllowance) / 2;

  if (view === "plan") {
    return {
      left: -halfX, right: halfX, top: halfZ, bottom: -halfZ,
      position: [cx, 5000, cz], up: [0, 0, -1], target: [cx, 0, cz],
    };
  }
  if (view === "front" || view === "elevation-N") {
    return {
      left: -halfX, right: halfX, top: halfH, bottom: -halfH,
      position: [cx, midY, bounds.maxZ + 2000], up: [0, 1, 0], target: [cx, midY, cz],
    };
  }
  if (view === "elevation-S") {
    return {
      left: -halfX, right: halfX, top: halfH, bottom: -halfH,
      position: [cx, midY, bounds.minZ - 2000], up: [0, 1, 0], target: [cx, midY, cz],
    };
  }
  if (view === "side" || view === "elevation-E") {
    return {
      left: -halfZ, right: halfZ, top: halfH, bottom: -halfH,
      position: [bounds.maxX + 2000, midY, cz], up: [0, 1, 0], target: [cx, midY, cz],
    };
  }
  if (view === "elevation-W") {
    return {
      left: -halfZ, right: halfZ, top: halfH, bottom: -halfH,
      position: [bounds.minX - 2000, midY, cz], up: [0, 1, 0], target: [cx, midY, cz],
    };
  }
  // view === "section"
  if (!sectionLine) throw new Error("sheetFrustum: sectionLine is required for view 'section'");
  const dx = sectionLine.x2 - sectionLine.x1, dz = sectionLine.z2 - sectionLine.z1;
  const len = Math.hypot(dx, dz);
  const midX = (sectionLine.x1 + sectionLine.x2) / 2, midZ = (sectionLine.z1 + sectionLine.z2) / 2;
  const nx = -dz / len, nz = dx / len; // unit normal, perpendicular to the cut line
  const halfLen = len / 2 + margin;
  return {
    left: -halfLen, right: halfLen, top: halfH, bottom: -halfH,
    position: [midX + nx * 2000, midY, midZ + nz * 2000],
    up: [0, 1, 0],
    target: [midX, midY, midZ],
  };
}
