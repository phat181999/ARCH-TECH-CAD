import type { BIMResult, BIMWall, BIMOpening, BIMColumn, BIMLevel } from "../../../api/client";

// All BIM spatial values are normalized to millimetres for the 3D scene.
// Claude reports a `units` field; provided values are scaled to mm, while our
// fallback defaults below are already expressed in mm.
const MM = {
  wallHeight: 3000,
  wallThickness: 200,
  doorHeight: 2100,
  windowHeight: 1200,
  windowSill: 900,
  slabThickness: 200,
  columnSize: 400,
} as const;

export interface BoxDesc {
  cx: number; cy: number; cz: number; // center (scene coords: x, y-up, z)
  sx: number; sy: number; sz: number; // dimensions
  ry: number;                          // rotation about Y
}

export function unitScaleFor(units: string | undefined): number {
  switch ((units || "mm").toLowerCase()) {
    case "m":
    case "meter":
    case "meters":
      return 1000;
    case "ft":
    case "feet":
      return 304.8;
    case "cm":
      return 10;
    case "in":
    case "inch":
      return 25.4;
    default:
      return 1; // mm
  }
}

// Maps level id → base elevation (mm). Falls back to 0 for unknown ids.
export function levelBaseMap(levels: BIMLevel[], scale: number): Map<string, number> {
  const m = new Map<string, number>();
  for (const l of levels) m.set(l.id, (l.elevation || 0) * scale);
  return m;
}

interface Interval { a: number; b: number }

// Merge overlapping [a,b] intervals, clipped to [0, len].
function mergeIntervals(raw: Interval[], len: number): Interval[] {
  const clipped = raw
    .map((i) => ({ a: Math.max(0, Math.min(i.a, i.b)), b: Math.min(len, Math.max(i.a, i.b)) }))
    .filter((i) => i.b > i.a)
    .sort((x, y) => x.a - y.a);
  const out: Interval[] = [];
  for (const it of clipped) {
    const last = out[out.length - 1];
    if (last && it.a <= last.b) last.b = Math.max(last.b, it.b);
    else out.push({ ...it });
  }
  return out;
}

// Builds the solid box pieces for one wall, leaving real gaps for openings:
// solid piers between openings, a header (lintel) above each opening, and a
// sill below each window. Doors run to the floor (no sill piece).
function wallPieces(
  wall: BIMWall,
  openings: BIMOpening[],
  scale: number,
  baseY: number,
): BoxDesc[] {
  const x1 = wall.x1 * scale, y1 = wall.y1 * scale;
  const x2 = wall.x2 * scale, y2 = wall.y2 * scale;
  const dx = x2 - x1, dz = y2 - y1;
  const len = Math.hypot(dx, dz);
  if (len === 0) return [];
  const ux = dx / len, uz = dz / len;
  const ry = -Math.atan2(dz, dx);
  const thickness = (wall.thickness > 0 ? wall.thickness * scale : MM.wallThickness);
  const height = (wall.height > 0 ? wall.height * scale : MM.wallHeight);

  // Project each hosted opening onto the wall axis → [a,b] span + its vertical data.
  const spans: Array<Interval & { op: BIMOpening; w: number }> = [];
  for (const o of openings) {
    const ox = o.x * scale, oy = o.y * scale;
    const s = (ox - x1) * ux + (oy - y1) * uz; // distance along axis
    const w = (o.width > 0 ? o.width * scale : 900);
    spans.push({ a: s - w / 2, b: s + w / 2, op: o, w });
  }

  const pieces: BoxDesc[] = [];
  const pushAlong = (center: number, pieceLen: number, bottom: number, h: number) => {
    if (pieceLen <= 0 || h <= 0) return;
    const px = x1 + ux * center;
    const pz = y1 + uz * center;
    pieces.push({
      cx: px, cy: baseY + bottom + h / 2, cz: pz,
      sx: pieceLen, sy: h, sz: thickness, ry,
    });
  };

  // Solid piers = complement of the opening spans along [0, len].
  const blocked = mergeIntervals(spans, len);
  let cursor = 0;
  for (const span of blocked) {
    if (span.a > cursor) pushAlong((cursor + span.a) / 2, span.a - cursor, 0, height);
    cursor = span.b;
  }
  if (cursor < len) pushAlong((cursor + len) / 2, len - cursor, 0, height);

  // Header above each opening (+ sill below windows).
  for (const span of spans) {
    const clampedA = Math.max(0, span.a);
    const clampedB = Math.min(len, span.b);
    if (clampedB <= clampedA) continue;
    const center = (clampedA + clampedB) / 2;
    const w = clampedB - clampedA;
    const isWindow = span.op.type === "window";
    const sill = isWindow ? (span.op.sill && span.op.sill > 0 ? span.op.sill * scale : MM.windowSill) : 0;
    const openH = (span.op.height > 0 ? span.op.height * scale : isWindow ? MM.windowHeight : MM.doorHeight);
    const headBottom = sill + openH;
    pushAlong(center, w, headBottom, Math.max(0, height - headBottom)); // lintel
    if (isWindow && sill > 0) pushAlong(center, w, 0, sill);            // sill
  }

  return pieces;
}

// All wall box pieces across the model, openings cut out, stacked by level.
export function buildWallBoxes(result: BIMResult, scale: number, levelBase: Map<string, number>): BoxDesc[] {
  const byWall = new Map<string, BIMOpening[]>();
  for (const o of result.openings) {
    const arr = byWall.get(o.host_wall_id) || [];
    arr.push(o);
    byWall.set(o.host_wall_id, arr);
  }
  const boxes: BoxDesc[] = [];
  for (const wall of result.walls) {
    const baseY = levelBase.get(wall.level_id) ?? 0;
    boxes.push(...wallPieces(wall, byWall.get(wall.id) || [], scale, baseY));
  }
  return boxes;
}

// Column boxes, stacked by level.
export function buildColumnBoxes(columns: BIMColumn[], scale: number, levelBase: Map<string, number>): BoxDesc[] {
  return columns.map((c) => {
    const baseY = levelBase.get(c.level_id) ?? 0;
    const h = (c.height > 0 ? c.height * scale : MM.wallHeight);
    return {
      cx: c.x * scale, cy: baseY + h / 2, cz: c.y * scale,
      sx: (c.width > 0 ? c.width * scale : MM.columnSize), sy: h,
      sz: (c.depth > 0 ? c.depth * scale : MM.columnSize), ry: 0,
    };
  });
}

// One floor slab per level, sized to the bounding box of that level's walls.
export function buildSlabBoxes(result: BIMResult, scale: number, levelBase: Map<string, number>): BoxDesc[] {
  const slabs: BoxDesc[] = [];
  const levels = result.levels.length > 0 ? result.levels : [{ id: "", name: "", elevation: 0, height: 0 }];
  for (const level of levels) {
    const walls = result.walls.filter((w) => (w.level_id ?? "") === (level.id ?? ""));
    if (walls.length === 0) continue;
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    for (const w of walls) {
      minX = Math.min(minX, w.x1 * scale, w.x2 * scale);
      maxX = Math.max(maxX, w.x1 * scale, w.x2 * scale);
      minZ = Math.min(minZ, w.y1 * scale, w.y2 * scale);
      maxZ = Math.max(maxZ, w.y1 * scale, w.y2 * scale);
    }
    if (!Number.isFinite(minX)) continue;
    const baseY = levelBase.get(level.id) ?? 0;
    slabs.push({
      cx: (minX + maxX) / 2, cy: baseY - MM.slabThickness / 2, cz: (minZ + maxZ) / 2,
      sx: Math.max(1, maxX - minX), sy: MM.slabThickness, sz: Math.max(1, maxZ - minZ), ry: 0,
    });
  }
  return slabs;
}

// Opening panels (door leaf / glazing) sitting inside the cut gap.
export interface OpeningPanel { id: string; type: "door" | "window"; cx: number; cy: number; cz: number; sx: number; sz: number; sy: number; ry: number }

export function buildOpeningPanels(result: BIMResult, scale: number, levelBase: Map<string, number>): OpeningPanel[] {
  const wallById = new Map(result.walls.map((w) => [w.id, w]));
  const panels: OpeningPanel[] = [];
  for (const o of result.openings) {
    const wall = wallById.get(o.host_wall_id);
    const baseY = wall ? (levelBase.get(wall.level_id) ?? 0) : 0;
    const isWindow = o.type === "window";
    const ry = wall ? -Math.atan2((wall.y2 - wall.y1), (wall.x2 - wall.x1)) : 0;
    const sill = isWindow ? (o.sill && o.sill > 0 ? o.sill * scale : MM.windowSill) : 0;
    const h = (o.height > 0 ? o.height * scale : isWindow ? MM.windowHeight : MM.doorHeight);
    panels.push({
      id: o.id, type: o.type,
      cx: o.x * scale, cy: baseY + sill + h / 2, cz: o.y * scale,
      sx: (o.width > 0 ? o.width * scale : 900), sy: h, sz: 60, ry,
    });
  }
  return panels;
}
