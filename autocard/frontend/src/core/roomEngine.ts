import { Point } from "../types";
import { WallEntity, RoomEntity } from "./entities";
import { distance, polygonArea } from "./geometry";

// Generates a simple unique ID
const genId = () => `room-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

export class RoomEngine {
  /**
   * Extremely simplified cycle detection for 4-wall rooms (rectangles).
   * A full implementation requires planar graph minimum cycle basis extraction.
   */
  static detectRooms(walls: WallEntity[]): RoomEntity[] {
    const rooms: RoomEntity[] = [];
    const usedWalls = new Set<string>();

    for (const w1 of walls) {
      if (usedWalls.has(w1.id)) continue;
      
      // Find a connected wall
      const w2 = walls.find(w => w.id !== w1.id && !usedWalls.has(w.id) && 
        (distance(w.start, w1.end) < 5 || distance(w.start, w1.start) < 5 || distance(w.end, w1.end) < 5 || distance(w.end, w1.start) < 5));
      if (!w2) continue;

      const w3 = walls.find(w => w.id !== w1.id && w.id !== w2.id && !usedWalls.has(w.id) &&
        (distance(w.start, w2.end) < 5 || distance(w.start, w2.start) < 5 || distance(w.end, w2.end) < 5 || distance(w.end, w2.start) < 5));
      if (!w3) continue;

      const w4 = walls.find(w => w.id !== w1.id && w.id !== w2.id && w.id !== w3.id && !usedWalls.has(w.id) &&
        (distance(w.start, w3.end) < 5 || distance(w.start, w3.start) < 5 || distance(w.end, w3.end) < 5 || distance(w.end, w3.start) < 5));
      if (!w4) continue;

      // Does w4 close the loop back to w1?
      const closesLoop = distance(w4.end, w1.start) < 5 || distance(w4.start, w1.start) < 5 || distance(w4.end, w1.end) < 5 || distance(w4.start, w1.end) < 5;
      
      if (closesLoop) {
        // Collect vertices of the 4 walls
        const boundary: Point[] = [w1.start, w1.end, w2.start, w2.end, w3.start, w3.end, w4.start, w4.end];
        // In a real implementation we would sort these radially to form a non-intersecting polygon
        // For area, we can approximate the bounding box
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        boundary.forEach(p => {
          minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
          maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
        });

        const width = maxX - minX;
        const height = maxY - minY;
        const areaPx2 = width * height;
        // Assuming 100px = 1m (based on typical cad setups here)
        const areaM2 = areaPx2 / 10000;

        rooms.push({
          id: genId(),
          type: "room",
          layerId: "A-ROOM",
          visible: true,
          wallIds: [w1.id, w2.id, w3.id, w4.id],
          boundary: [{x: minX, y: minY}, {x: maxX, y: minY}, {x: maxX, y: maxY}, {x: minX, y: maxY}],
          area: areaM2,
          label: `Room (${areaM2.toFixed(1)} m²)`,
          labelX: (minX + maxX) / 2,
          labelY: (minY + maxY) / 2
        });

        usedWalls.add(w1.id); usedWalls.add(w2.id); usedWalls.add(w3.id); usedWalls.add(w4.id);
      }
    }

    return rooms;
  }
}
