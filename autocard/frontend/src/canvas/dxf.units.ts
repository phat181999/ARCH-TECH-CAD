// Internal scene unit is millimetres (matches src/canvas/3d/geometry/bimGeometry.ts).
export type DxfUnit = "mm" | "cm" | "m" | "in" | "ft";

export const DXF_UNIT_MM: DxfUnit = "mm";

const TO_MM: Record<DxfUnit, number> = {
  mm: 1,
  cm: 10,
  m: 1000,
  in: 25.4,
  ft: 304.8,
};

export function unitFactorToMm(unit: DxfUnit): number {
  return TO_MM[unit];
}

// DXF header $INSUNITS integer codes → our DxfUnit (null when absent/unsupported).
// 1=in 2=ft 4=mm 5=cm 6=m (others: unitless or rare, treat as unknown).
export function insUnitsToUnit(code: number): DxfUnit | null {
  switch (code) {
    case 1: return "in";
    case 2: return "ft";
    case 4: return "mm";
    case 5: return "cm";
    case 6: return "m";
    default: return null;
  }
}

export const DXF_UNIT_OPTIONS: DxfUnit[] = ["mm", "cm", "m", "in", "ft"];
