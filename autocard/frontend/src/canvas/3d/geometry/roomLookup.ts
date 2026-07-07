// Point-in-room lookup for the avatar walkthrough — reuses detectRooms'
// polygon output (drawing-space coords) to answer "which room is pt in?".
export interface RoomPolygon { id: string; polygon: { x: number; y: number }[] }

export function pointInRoom(pt: { x: number; y: number }, rooms: RoomPolygon[]): RoomPolygon | null {
  for (const room of rooms) {
    if (pointInPolygon(pt, room.polygon)) return room;
  }
  return null;
}

function pointInPolygon(p: { x: number; y: number }, poly: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
    const intersect = yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi + 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
