/**
 * QuantityEngine — computes BIM-grade (net) quantities from DrawingElement geometry.
 *
 * "Net" means openings (doors, windows) are subtracted from wall areas.
 * All output in SI units: mm for length, m² for area, m³ for volume.
 */
import type { DrawingElement, BimQuantities } from "../../types";

// ── Constants ────────────────────────────────────────────────
const MM_TO_M    = 1 / 1000;
const MM2_TO_M2  = 1 / 1_000_000;
const MM3_TO_M3  = 1 / 1_000_000_000;

const DEFAULT_WALL_THICKNESS = 200;   // mm
const DEFAULT_WALL_HEIGHT    = 3000;  // mm
const DEFAULT_SLAB_THICKNESS = 150;   // mm
const DEFAULT_DOOR_HEIGHT    = 2100;  // mm
const DEFAULT_WINDOW_HEIGHT  = 1200;  // mm
const DEFAULT_COLUMN_SIZE    = 250;   // mm
const DEFAULT_PILE_RADIUS    = 250;   // mm (radius)
const DEFAULT_PILE_LENGTH    = 6000;  // mm
const DEFAULT_PIPE_DIAMETER  = 50;    // mm
const DEFAULT_OPENING_WIDTH  = 900;   // mm

// ── Geometry helpers ─────────────────────────────────────────

function polygonArea(points: { x: number; y: number }[]): number {
  // Shoelace formula — returns area in drawing units² (mm²)
  let area = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area) / 2;
}

function polygonPerimeter(points: { x: number; y: number }[]): number {
  let p = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const dx = points[j].x - points[i].x;
    const dy = points[j].y - points[i].y;
    p += Math.sqrt(dx * dx + dy * dy);
  }
  return p;
}

function lineLength(el: DrawingElement): number {
  const dx = (el.x2 ?? 0) - (el.x1 ?? 0);
  const dz = (el.y2 ?? 0) - (el.y1 ?? 0);
  return Math.sqrt(dx * dx + dz * dz);
}

// ── Wall quantities ───────────────────────────────────────────

function wallQuantities(
  wall: DrawingElement,
  openings: DrawingElement[],
): BimQuantities {
  const length    = lineLength(wall);                                                              // mm
  const thickness = (wall.wallThickness as number | undefined) ?? DEFAULT_WALL_THICKNESS;         // mm
  const height    = (wall.wallHeightOverride as number | undefined) ?? DEFAULT_WALL_HEIGHT;        // mm

  const grossArea   = length * height * MM2_TO_M2;
  const grossVolume = length * height * thickness * MM3_TO_M3;

  // Sum opening areas hosted on this wall
  const openingArea = openings
    .filter((o) => {
      const hostId = (o.hostWallId ?? o.hostWall) as string | undefined;
      return hostId === wall.id;
    })
    .reduce((sum, o) => {
      const w = ((o.openingWidth ?? o.width ?? DEFAULT_OPENING_WIDTH)) as number;
      const h = ((o as Record<string, unknown>)["height"] ?? (o.archType === "door" ? DEFAULT_DOOR_HEIGHT : DEFAULT_WINDOW_HEIGHT)) as number;
      return sum + w * h * MM2_TO_M2;
    }, 0);

  const netArea   = Math.max(0, grossArea   - openingArea);
  const netVolume = Math.max(0, grossVolume - openingArea * (thickness * MM_TO_M));

  return {
    length:      Math.round(length),
    width:       thickness,
    height,
    grossArea:   +grossArea.toFixed(4),
    netArea:     +netArea.toFixed(4),
    grossVolume: +grossVolume.toFixed(5),
    netVolume:   +netVolume.toFixed(5),
  };
}

// ── Slab / Floor quantities ───────────────────────────────────

function slabQuantities(el: DrawingElement): BimQuantities {
  const elRecord  = el as Record<string, unknown>;
  const thickness = ((elRecord["slabThickness"] as number | undefined) ?? DEFAULT_SLAB_THICKNESS); // mm

  if (el.points && el.points.length >= 3) {
    const areaMm2    = polygonArea(el.points);
    const grossArea  = areaMm2 * MM2_TO_M2;
    const grossVol   = areaMm2 * thickness * MM3_TO_M3;
    const perim      = polygonPerimeter(el.points) * MM_TO_M;
    return {
      grossArea:   +grossArea.toFixed(4),
      netArea:     +grossArea.toFixed(4),
      grossVolume: +grossVol.toFixed(5),
      netVolume:   +grossVol.toFixed(5),
      perimeter:   +perim.toFixed(3),
    };
  }

  // Rectangular slab fallback
  const w = (el.width  ?? 0) as number;
  const h = (el.height ?? 0) as number;
  if (w > 0 && h > 0) {
    const areaMm2   = w * h;
    const grossArea = areaMm2 * MM2_TO_M2;
    const grossVol  = areaMm2 * thickness * MM3_TO_M3;
    return {
      grossArea:   +grossArea.toFixed(4),
      netArea:     +grossArea.toFixed(4),
      grossVolume: +grossVol.toFixed(5),
      netVolume:   +grossVol.toFixed(5),
      perimeter:   +((2 * (w + h)) * MM_TO_M).toFixed(3),
    };
  }

  return {};
}

// ── Column quantities ─────────────────────────────────────────

function columnQuantities(el: DrawingElement, wallHeight: number): BimQuantities {
  const w   = (el.width  ?? DEFAULT_COLUMN_SIZE) as number;  // mm
  const d   = (el.height ?? el.width ?? DEFAULT_COLUMN_SIZE) as number;  // mm
  const h   = wallHeight;
  const vol = w * d * h * MM3_TO_M3;
  return {
    width:       w,
    height:      h,
    length:      d,
    grossVolume: +vol.toFixed(5),
    netVolume:   +vol.toFixed(5),
    grossArea:   +(w * d * MM2_TO_M2).toFixed(4),
    netArea:     +(w * d * MM2_TO_M2).toFixed(4),
  };
}

// ── Pile / Foundation quantities ──────────────────────────────

function pileQuantities(el: DrawingElement): BimQuantities {
  const elRecord = el as Record<string, unknown>;
  const r        = (el.radius ?? DEFAULT_PILE_RADIUS) as number;                       // mm radius
  const len      = ((elRecord["pileLength"] as number | undefined) ?? DEFAULT_PILE_LENGTH); // mm
  const vol      = Math.PI * r * r * len * MM3_TO_M3;
  return {
    length:      len,
    width:       r * 2,
    grossVolume: +vol.toFixed(5),
    netVolume:   +vol.toFixed(5),
    grossArea:   +(Math.PI * r * r * MM2_TO_M2).toFixed(4),
    netArea:     +(Math.PI * r * r * MM2_TO_M2).toFixed(4),
  };
}

// ── Pipe quantities ───────────────────────────────────────────

function pipeQuantities(el: DrawingElement): BimQuantities {
  const elRecord = el as Record<string, unknown>;
  const length   = lineLength(el);
  const diam     = ((elRecord["pipeDiameter"] as number | undefined) ?? DEFAULT_PIPE_DIAMETER); // mm
  const r        = diam / 2;
  const vol      = Math.PI * r * r * length * MM3_TO_M3;
  return {
    length:      Math.round(length),
    width:       diam,
    grossVolume: +vol.toFixed(6),
    netVolume:   +vol.toFixed(6),
  };
}

// ── Room quantities ───────────────────────────────────────────

function roomQuantities(el: DrawingElement): BimQuantities {
  if (el.points && el.points.length >= 3) {
    const areaMm2 = polygonArea(el.points);
    const perim   = polygonPerimeter(el.points);
    return {
      grossArea: +(areaMm2 * MM2_TO_M2).toFixed(4),
      netArea:   +(areaMm2 * MM2_TO_M2).toFixed(4),
      perimeter: +(perim   * MM_TO_M).toFixed(3),
    };
  }
  if (el.width && el.height) {
    const area = el.width * el.height * MM2_TO_M2;
    return {
      grossArea: +area.toFixed(4),
      netArea:   +area.toFixed(4),
      perimeter: +(2 * ((el.width + el.height) * MM_TO_M)).toFixed(3),
    };
  }
  return {};
}

// ── Public API ────────────────────────────────────────────────

export type QuantityMap = Record<string, BimQuantities>;

/** Compute quantities for all elements. Returns a map elementId → BimQuantities. */
export function computeAllQuantities(
  elements: DrawingElement[],
  defaultWallHeight = DEFAULT_WALL_HEIGHT,
): QuantityMap {
  const openings = elements.filter(
    (e) => e.archType === "door" || e.archType === "window",
  );

  const result: QuantityMap = {};

  for (const el of elements) {
    const arch = el.archType as string | undefined;

    if (arch === "wall" || (el.type === "line" && !arch)) {
      if (el.x1 !== undefined && el.x2 !== undefined) {
        result[el.id] = wallQuantities(el, openings);
      }
    } else if (arch === "floor" || arch === "foundation-raft") {
      result[el.id] = slabQuantities(el);
    } else if (arch === "column") {
      result[el.id] = columnQuantities(el, defaultWallHeight);
    } else if (arch === "foundation-pile") {
      result[el.id] = pileQuantities(el);
    } else if (arch === "pipe") {
      result[el.id] = pipeQuantities(el);
    } else if (arch === "room") {
      result[el.id] = roomQuantities(el);
    }
  }

  return result;
}

/** Aggregate quantities into a summary by category. */
export interface QuantitySummary {
  totalWallNetArea:    number;  // m²
  totalWallGrossArea:  number;  // m²
  totalFloorNetArea:   number;  // m²
  totalConcreteVolume: number;  // m³ (walls + columns + slabs)
  totalPipeLength:     number;  // mm
  wallCount:           number;
  doorCount:           number;
  windowCount:         number;
  columnCount:         number;
  stairCount:          number;
  roomCount:           number;
  roomTotalArea:       number;  // m²
}

export function summarizeQuantities(
  elements: DrawingElement[],
  quantities: QuantityMap,
): QuantitySummary {
  let totalWallNetArea    = 0;
  let totalWallGrossArea  = 0;
  let totalFloorNetArea   = 0;
  let totalConcreteVolume = 0;
  let totalPipeLength     = 0;
  let roomTotalArea       = 0;

  const counts = { wall: 0, door: 0, window: 0, column: 0, stair: 0, room: 0 };

  for (const el of elements) {
    const arch = el.archType as string | undefined;
    const q    = quantities[el.id];

    if (arch === "wall" || (el.type === "line" && !arch)) {
      counts.wall++;
      totalWallGrossArea  += q?.grossArea  ?? 0;
      totalWallNetArea    += q?.netArea    ?? 0;
      totalConcreteVolume += q?.netVolume  ?? 0;
    } else if (arch === "floor") {
      totalFloorNetArea   += q?.netArea    ?? 0;
      totalConcreteVolume += q?.netVolume  ?? 0;
    } else if (arch === "column") {
      counts.column++;
      totalConcreteVolume += q?.netVolume  ?? 0;
    } else if (arch === "door") {
      counts.door++;
    } else if (arch === "window") {
      counts.window++;
    } else if (arch === "stair") {
      counts.stair++;
    } else if (arch === "room") {
      counts.room++;
      roomTotalArea += q?.netArea ?? 0;
    } else if (arch === "pipe") {
      totalPipeLength += q?.length ?? 0;
    }
  }

  return {
    totalWallNetArea:    +totalWallNetArea.toFixed(2),
    totalWallGrossArea:  +totalWallGrossArea.toFixed(2),
    totalFloorNetArea:   +totalFloorNetArea.toFixed(2),
    totalConcreteVolume: +totalConcreteVolume.toFixed(3),
    totalPipeLength:     Math.round(totalPipeLength),
    wallCount:           counts.wall,
    doorCount:           counts.door,
    windowCount:         counts.window,
    columnCount:         counts.column,
    stairCount:          counts.stair,
    roomCount:           counts.room,
    roomTotalArea:       +roomTotalArea.toFixed(2),
  };
}
