import type { DrawingElement } from "../../../types";

export interface DetectedRoom {
  id: string;
  polygon: { x: number; y: number }[];
  area: number;   // m²
  centroid: { x: number; y: number };
  wallIds: string[];
}

const EPS = 8;

function snapKey(x: number, y: number): string {
  return `${Math.round(x / EPS) * EPS},${Math.round(y / EPS) * EPS}`;
}

function polygonArea(pts: {x:number,y:number}[]): number {
  let s = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++)
    s += (pts[j].x + pts[i].x) * (pts[j].y - pts[i].y);
  return Math.abs(s / 2);
}

function centroid(pts: {x:number,y:number}[]): {x:number,y:number} {
  return { x: pts.reduce((s,p) => s+p.x, 0)/pts.length, y: pts.reduce((s,p) => s+p.y, 0)/pts.length };
}

export function detectRooms(elements: DrawingElement[]): DetectedRoom[] {
  const walls = elements.filter(el =>
    (el.archType === "wall" || el.type === "wall") &&
    el.x1 != null && el.y1 != null && el.x2 != null && el.y2 != null
  );
  if (walls.length < 3) return [];

  interface HE {
    id: string; from: {x:number,y:number}; to: {x:number,y:number};
    wallId: string; twin?: HE; next?: HE; visited: boolean;
  }

  const hes: HE[] = [];
  for (const w of walls) {
    const a = {x: w.x1!, y: w.y1!}, b = {x: w.x2!, y: w.y2!};
    const h1: HE = {id:`${w.id}-ab`, from:a, to:b, wallId:String(w.id), visited:false};
    const h2: HE = {id:`${w.id}-ba`, from:b, to:a, wallId:String(w.id), visited:false};
    h1.twin = h2; h2.twin = h1;
    hes.push(h1, h2);
  }

  const nodeMap = new Map<string, HE[]>();
  for (const he of hes) {
    const k = snapKey(he.from.x, he.from.y);
    if (!nodeMap.has(k)) nodeMap.set(k, []);
    nodeMap.get(k)!.push(he);
  }

  for (const he of hes) {
    const k = snapKey(he.to.x, he.to.y);
    const outgoing = nodeMap.get(k) ?? [];
    const arrAngle = Math.atan2(he.to.y - he.from.y, he.to.x - he.from.x);
    let bestHe: HE | null = null, bestDelta = Infinity;
    for (const out of outgoing) {
      if (he.twin && out.id === he.twin.id) continue;
      const outAngle = Math.atan2(out.to.y - out.from.y, out.to.x - out.from.x);
      let delta = arrAngle - outAngle;
      if (delta <= 0) delta += 2 * Math.PI;
      if (delta < bestDelta) { bestDelta = delta; bestHe = out; }
    }
    he.next = bestHe ?? he.twin;
  }

  const rooms: DetectedRoom[] = [];
  let seq = 0;
  for (const startHe of hes) {
    if (startHe.visited || !startHe.next) continue;
    const face: HE[] = [];
    let cur: HE = startHe, safety = 0;
    while (!cur.visited && safety++ < hes.length) {
      cur.visited = true; face.push(cur);
      if (!cur.next) break; cur = cur.next;
    }
    if (face.length < 3) continue;
    const polygon = face.map(he => ({x: he.from.x, y: he.from.y}));
    const areaPx2 = polygonArea(polygon);
    if (areaPx2 < 100) continue;
    rooms.push({ id:`detected-room-${seq++}`, polygon, area: areaPx2/10000, centroid: centroid(polygon), wallIds: [...new Set(face.map(he => he.wallId))] });
  }

  if (rooms.length > 1) {
    const maxArea = Math.max(...rooms.map(r => r.area));
    return rooms.filter(r => r.area < maxArea * 0.95);
  }
  return rooms;
}
