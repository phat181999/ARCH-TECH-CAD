import type { DrawingElement } from "../../../types";
import type { Bounds, HousePlan } from "../types";

export function isRectangle(el: DrawingElement): el is DrawingElement & { x: number; y: number; width: number; height: number } {
  return el.type === "rectangle" && typeof el.x === "number" && typeof el.y === "number" && typeof el.width === "number" && typeof el.height === "number";
}

export function labelOf(el: DrawingElement): string {
  return typeof el.label === "string" ? el.label.toLowerCase() : "";
}

export function classifyPlan(elements: DrawingElement[]): HousePlan {
  const shell = elements.find((el) => isRectangle(el) && (el.archType === "meta" || labelOf(el).startsWith("house"))) ?? null;

  return elements.reduce<HousePlan>((acc, el) => {
    const label = labelOf(el);
    if (shell && el.id === shell.id) {
      return acc;
    }
    // Walls: lines OR polylines with archType="wall"
    if (el.archType === "wall" && (el.type === "line" || el.type === "polyline")) {
      acc.walls.push(el);
      return acc;
    }
    if (el.archType === "door") {
      acc.doors.push(el);
      return acc;
    }
    if (el.archType === "window") {
      acc.windows.push(el);
      return acc;
    }
    if ((el.archType === "room" && (el.type === "text" || el.type === "hatch")) || (isRectangle(el) && (label.includes("bedroom") || label.includes("room") || label.includes("kitchen") || label.includes("bath")))) {
      acc.rooms.push(el);
      return acc;
    }
    acc.loose.push(el);
    return acc;
  }, { shell, rooms: [], doors: [], windows: [], walls: [], loose: [] });
}

export function getPlanBounds(elements: DrawingElement[]): Bounds | null {
  let minX = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxZ = -Infinity;

  for (const el of elements) {
    if (isRectangle(el)) {
      minX = Math.min(minX, el.x);
      minZ = Math.min(minZ, el.y);
      maxX = Math.max(maxX, el.x + el.width);
      maxZ = Math.max(maxZ, el.y + el.height);
    } else if (el.type === "circle" && typeof el.cx === "number" && typeof el.cy === "number") {
      const radius = typeof el.r === "number" ? el.r : (typeof el.radius === "number" ? el.radius : 0);
      minX = Math.min(minX, el.cx - radius);
      minZ = Math.min(minZ, el.cy - radius);
      maxX = Math.max(maxX, el.cx + radius);
      maxZ = Math.max(maxZ, el.cy + radius);
    } else if (el.type === "line" && typeof el.x1 === "number" && typeof el.y1 === "number" && typeof el.x2 === "number" && typeof el.y2 === "number") {
      minX = Math.min(minX, el.x1, el.x2);
      minZ = Math.min(minZ, el.y1, el.y2);
      maxX = Math.max(maxX, el.x1, el.x2);
      maxZ = Math.max(maxZ, el.y1, el.y2);
    } else if ((el.type === "polyline" || el.type === "spline" || el.type === "leader" || el.type === "hatch") && Array.isArray(el.points)) {
      for (const p of el.points) {
        if (p && typeof p.x === "number" && typeof p.y === "number") {
          minX = Math.min(minX, p.x);
          minZ = Math.min(minZ, p.y);
          maxX = Math.max(maxX, p.x);
          maxZ = Math.max(maxZ, p.y);
        }
      }
    } else if ((el.type === "text" || el.type === "block" || el.type === "mark") && typeof el.x === "number" && typeof el.y === "number") {
      minX = Math.min(minX, el.x);
      minZ = Math.min(minZ, el.y);
      maxX = Math.max(maxX, el.x);
      maxZ = Math.max(maxZ, el.y);
    } else if (el.type === "arc" && typeof el.cx === "number" && typeof el.cy === "number") {
      const radius = typeof el.r === "number" ? el.r : (typeof el.radius === "number" ? el.radius : 0);
      minX = Math.min(minX, el.cx - radius);
      minZ = Math.min(minZ, el.cy - radius);
      maxX = Math.max(maxX, el.cx + radius);
      maxZ = Math.max(maxZ, el.cy + radius);
    }
  }

  if (!Number.isFinite(minX)) {
    return null;
  }

  return { minX, minZ, maxX, maxZ };
}

// Returns the archType inferred from an AIA/NCS layer name, "skip" for annotation
// layers that should never be extruded, or undefined when the name gives no signal.
// Estimates a reasonable wall extrusion height from the median line length.
// For architectural drawings, a typical wall segment is 2-6m long and wall
// height is ~90% of that. Falls back to userWallHeight for hand-drawn plans.
export function computeAutoWallHeight(elements: DrawingElement[], userWallHeight: number): number {
  const lengths: number[] = [];
  for (const el of elements) {
    if (el.type === "line" &&
      typeof el.x1 === "number" && typeof el.y1 === "number" &&
      typeof el.x2 === "number" && typeof el.y2 === "number") {
      const l = Math.hypot(el.x2 - el.x1, el.y2 - el.y1);
      if (l > 0) lengths.push(l);
    }
  }
  if (lengths.length === 0) return userWallHeight;
  lengths.sort((a, b) => a - b);
  const median = lengths[Math.floor(lengths.length / 2)];
  return Math.max(userWallHeight, Math.min(median * 0.9, 50000));
}

export function inferArchTypeFromLayer(layerId: string | undefined): DrawingElement["archType"] | "skip" | undefined {
  if (!layerId) return undefined;
  const id = layerId.toUpperCase();
  if (/WALL/.test(id)) return "wall";
  if (/DOOR/.test(id)) return "door";
  if (/WIND|GLAZ|CURT/.test(id)) return "window";
  if (/ROOM|AREA|SPCE/.test(id)) return "room";
  if (/FLOR|SLAB/.test(id)) return "floor";
  if (/GRID|COLS|BEAM/.test(id)) return "grid";
  if (/ANNO|DIM|TEXT|NOTE|SYMB|LABL|MARK|HATCH|PATT|STAIR|EQPM|FURN/.test(id)) return "skip";
  return undefined;
}

// Classifies elements using layer names (AIA/NCS). Falls back to treating all
// lines as walls when the layer name gives no signal (handles non-standard DXF).
export function layerClassify(elements: DrawingElement[]): {
  walls: DrawingElement[];
  doors: DrawingElement[];
  windows: DrawingElement[];
  loose: DrawingElement[];
} {
  const walls: DrawingElement[] = [];
  const doors: DrawingElement[] = [];
  const windows: DrawingElement[] = [];
  const loose: DrawingElement[] = [];

  for (const el of elements) {
    const inferred = inferArchTypeFromLayer(el.layerId);
    if (inferred === "skip") { loose.push(el); continue; }
    if (inferred === "wall" && el.type === "line") { walls.push(el); continue; }
    if (inferred === "door") { doors.push(el); continue; }
    if (inferred === "window") { windows.push(el); continue; }
    // No layer signal — lines become walls, everything else renders flat
    if (el.type === "line") walls.push(el);
    else loose.push(el);
  }

  return { walls, doors, windows, loose };
}

export function roomBoundsFromBoundary(room: import("../../../types").ArchitecturalPlan["rooms"][number]) {
  if (!room.boundary.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  room.boundary.forEach((p) => {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  });
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
