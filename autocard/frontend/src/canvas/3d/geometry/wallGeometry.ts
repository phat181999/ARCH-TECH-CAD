import type { DrawingElement, ArchitecturalPlan } from "../../../types";
import type { WallSegment } from "../types";
import { isRectangle } from "./planClassification";

export const WALL_THICKNESS = 6;
export const FLOOR_THICKNESS = 1.5;

export function buildOuterWalls(shell: DrawingElement & { x: number; y: number; width: number; height: number }, doors: DrawingElement[]): WallSegment[] {
  const left = shell.x;
  const right = shell.x + shell.width;
  const top = shell.y;
  const bottom = shell.y + shell.height;

  const bottomDoors = doors
    .filter((door) => isRectangle(door))
    .filter((door) => Math.abs((door.y ?? 0) - bottom) <= WALL_THICKNESS * 2)
    .sort((a, b) => (a.x ?? 0) - (b.x ?? 0));

  const segments: WallSegment[] = [
    {
      id: `${shell.id}-w-left`,
      centerX: left,
      centerZ: top + shell.height / 2,
      width: WALL_THICKNESS,
      depth: shell.height,
    },
    {
      id: `${shell.id}-w-right`,
      centerX: right,
      centerZ: top + shell.height / 2,
      width: WALL_THICKNESS,
      depth: shell.height,
    },
    {
      id: `${shell.id}-w-top`,
      centerX: left + shell.width / 2,
      centerZ: top,
      width: shell.width,
      depth: WALL_THICKNESS,
    },
  ];

  let cursor = left;
  for (const door of bottomDoors) {
    const doorX = door.x ?? cursor;
    const doorWidth = door.width ?? 0;
    const leftWidth = Math.max(0, doorX-cursor);
    if (leftWidth > 0) {
      segments.push({
        id: `${shell.id}-w-bottom-left-${cursor}`,
        centerX: cursor + leftWidth / 2,
        centerZ: bottom,
        width: leftWidth,
        depth: WALL_THICKNESS,
      });
    }
    cursor = doorX + doorWidth;
  }

  const trailingWidth = Math.max(0, right-cursor);
  if (trailingWidth > 0) {
    segments.push({
      id: `${shell.id}-w-bottom-right`,
      centerX: cursor + trailingWidth / 2,
      centerZ: bottom,
      width: trailingWidth,
      depth: WALL_THICKNESS,
    });
  }

  return segments;
}

export function buildWallSegmentsFromSemanticWalls(walls: DrawingElement[]): WallSegment[] {
  const segments: WallSegment[] = [];

  for (const wall of walls) {
    const layers = wall.wallLayers?.length
      ? wall.wallLayers.map((l) => ({ materialName: l.material, thicknessUnits: l.thicknessMm / 10 }))
      : undefined;
    const thickness = layers
      ? layers.reduce((s, l) => s + l.thicknessUnits, 0)
      : typeof wall.wallThickness === "number" ? Math.max(4, wall.wallThickness * 0.18) : WALL_THICKNESS;

    // Handle line walls
    if (wall.type === "line" && typeof wall.x1 === "number" && typeof wall.y1 === "number" && typeof wall.x2 === "number" && typeof wall.y2 === "number") {
      const dx = (wall.x2 ?? 0) - (wall.x1 ?? 0);
      const dy = (wall.y2 ?? 0) - (wall.y1 ?? 0);
      const length = Math.hypot(dx, dy);
      const cx = ((wall.x1 ?? 0) + (wall.x2 ?? 0)) / 2;
      const cz = ((wall.y1 ?? 0) + (wall.y2 ?? 0)) / 2;
      const heightOverride = (wall as any).wallHeightOverride as number | undefined;
      if (Math.abs(dx) >= Math.abs(dy)) {
        segments.push({ id: wall.id, centerX: cx, centerZ: cz, width: Math.max(length, 1), depth: thickness, heightOverride, layers });
      } else {
        segments.push({ id: wall.id, centerX: cx, centerZ: cz, width: thickness, depth: Math.max(length, 1), heightOverride, layers });
      }
      continue;
    }

    // Handle polyline walls — split into per-segment boxes
    if (wall.type === "polyline" && Array.isArray(wall.points) && wall.points.length >= 2) {
      const pts = wall.points as { x: number; y: number }[];
      for (let i = 0; i < pts.length - 1; i++) {
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const length = Math.hypot(dx, dy);
        if (length < 1) continue;
        const cx = (p1.x + p2.x) / 2;
        const cz = (p1.y + p2.y) / 2;
        if (Math.abs(dx) >= Math.abs(dy)) {
          segments.push({ id: `${wall.id}-seg${i}`, centerX: cx, centerZ: cz, width: Math.max(length, 1), depth: thickness });
        } else {
          segments.push({ id: `${wall.id}-seg${i}`, centerX: cx, centerZ: cz, width: thickness, depth: Math.max(length, 1) });
        }
      }
    }
  }

  return segments;
}

export function wallSegmentsFromPlan(plan: ArchitecturalPlan): WallSegment[] {
  return (plan.walls || []).map((wall) => {
    const dx = wall.x2 - wall.x1;
    const dy = wall.y2 - wall.y1;
    const length = Math.hypot(dx, dy);
    const thickness = Math.max(4, wall.thickness * 0.18);
    return Math.abs(dx) >= Math.abs(dy)
      ? { id: wall.id, centerX: (wall.x1 + wall.x2) / 2, centerZ: (wall.y1 + wall.y2) / 2, width: Math.max(length, 1), depth: thickness }
      : { id: wall.id, centerX: (wall.x1 + wall.x2) / 2, centerZ: (wall.y1 + wall.y2) / 2, width: thickness, depth: Math.max(length, 1) };
  });
}
