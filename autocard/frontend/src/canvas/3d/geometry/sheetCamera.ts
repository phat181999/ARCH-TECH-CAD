// Orthographic camera frusta for exporting 2D sheets (mặt bằng / mặt đứng)
// from the 3D model. Bounds are the origin-centered local bounds the Scene
// renders in (drawing units, 100 = 1 m).
export type SheetView = "plan" | "front" | "side";
export interface SheetFrustum {
  left: number; right: number; top: number; bottom: number;
  position: [number, number, number];
  up: [number, number, number];
  target: [number, number, number];
}

export function sheetFrustum(
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
  view: SheetView,
  wallHeight: number,
  roofAllowance = 400,
  margin = 100,
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
  if (view === "front") {
    return {
      left: -halfX, right: halfX, top: halfH, bottom: -halfH,
      position: [cx, midY, bounds.maxZ + 2000], up: [0, 1, 0], target: [cx, midY, cz],
    };
  }
  return {
    left: -halfZ, right: halfZ, top: halfH, bottom: -halfH,
    position: [bounds.maxX + 2000, midY, cz], up: [0, 1, 0], target: [cx, midY, cz],
  };
}
