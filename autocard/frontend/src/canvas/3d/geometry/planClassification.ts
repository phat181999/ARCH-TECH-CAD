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

export function heuristicClassifyWalls(elements: DrawingElement[]): { walls: DrawingElement[]; loose: DrawingElement[] } {
  const walls: DrawingElement[] = [];
  const loose: DrawingElement[] = [];
  for (const el of elements) {
    if (el.type === "line") walls.push(el);
    else loose.push(el);
  }
  return { walls, loose };
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
