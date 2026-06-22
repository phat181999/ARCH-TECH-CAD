import type { DrawingElement, Point } from "../../../types";
import type { BIMResult, BIMLevel, BIMWall, BIMOpening, BIMRoom, BIMColumn } from "../../../api/client";

/**
 * Pure function to map 2D smart drawing elements to a client-side BIMResult.
 * This result can be passed directly to BimModelRenderer for instant 3D sync.
 */
export function elementsToBimResult(elements: DrawingElement[]): BIMResult {
  const defaultLevelId = "level-1";

  const levels: BIMLevel[] = [
    {
      id: defaultLevelId,
      name: "Level 1",
      elevation: 0,
      height: 300, // default height
    },
  ];

  const walls: BIMWall[] = [];
  const openings: BIMOpening[] = [];
  const columns: BIMColumn[] = [];
  const rooms: BIMRoom[] = [];

  // Filter elements to process
  for (const el of elements) {
    const layerId = el.layerId || "0";

    // 1. Process Walls
    const isWall = el.type === "wall" || el.archType === "wall";
    if (isWall) {
      // Find start and end coordinates
      let x1 = 0, y1 = 0, x2 = 0, y2 = 0;
      if ((el as any).start && (el as any).end) {
        x1 = (el as any).start.x;
        y1 = (el as any).start.y;
        x2 = (el as any).end.x;
        y2 = (el as any).end.y;
      } else if (el.x1 !== undefined && el.y1 !== undefined && el.x2 !== undefined && el.y2 !== undefined) {
        x1 = el.x1;
        y1 = el.y1;
        x2 = el.x2;
        y2 = el.y2;
      } else {
        continue; // skip invalid wall geometry
      }

      const thickness = (el as any).thickness ?? el.wallThickness ?? 20;
      const height = (el as any).height ?? 300;
      const material = (el as any).material ?? "concrete";

      walls.push({
        id: el.id,
        level_id: defaultLevelId,
        role: "interior", // default role
        x1,
        y1,
        x2,
        y2,
        thickness,
        height,
        material,
      });
    }

    // 2. Process Openings (Doors / Windows)
    const isOpening = el.type === "opening" || el.archType === "door" || el.archType === "window";
    if (isOpening && !isWall) {
      const type = el.openingType || el.archType === "window" ? "window" : "door";
      const hostWallId = (el.hostWallId ?? el.hostWall ?? "") as string;

      let x = 0, y = 0;
      if ((el as any).position) {
        x = (el as any).position.x;
        y = (el as any).position.y;
      } else if (el.x !== undefined && el.y !== undefined) {
        x = el.x;
        y = el.y;
      } else if (el.cx !== undefined && el.cy !== undefined) {
        x = el.cx;
        y = el.cy;
      }

      const width = el.width ?? el.openingWidth ?? (type === "door" ? 90 : 120);
      const height = (el as any).height ?? (type === "door" ? 210 : 120);
      const sill = (el as any).sill ?? (type === "door" ? 0 : 90);

      openings.push({
        id: el.id,
        type,
        host_wall_id: hostWallId,
        x,
        y,
        width,
        height,
        sill,
      });
    }

    // 3. Process Columns (fallback mapping if any exist in elements)
    if (el.type === "column" || el.archType === "grid") {
      let x = el.x ?? el.cx ?? 0;
      let y = el.y ?? el.cy ?? 0;
      const width = el.width ?? 40;
      const depth = (el as any).depth ?? 40;
      const height = (el as any).height ?? 300;

      columns.push({
        id: el.id,
        level_id: defaultLevelId,
        x,
        y,
        width,
        depth,
        height,
        material: (el as any).material ?? "concrete",
      });
    }
  }

  return {
    job_id: `local-${Date.now()}`,
    analyzed: new Date().toISOString(),
    units: "mm", // mm maps to scale 1 (scene units)
    levels,
    walls,
    openings,
    rooms,
    columns,
  };
}
