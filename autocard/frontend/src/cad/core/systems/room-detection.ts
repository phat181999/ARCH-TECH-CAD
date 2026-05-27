import type { CadDocument, RoomGraphCache, DerivedDocumentState } from '../../contracts/document'
import type { WallNode, RoomNode } from '../../contracts/nodes'
import type { Point } from '../../contracts/document'
import { isWallNode, isRoomNode } from '../../contracts/nodes'
import { distance, polygonArea } from '../geometry/math'

const CONNECT_TOLERANCE = 5

function wallsAreConnected(a: WallNode, b: WallNode): boolean {
  return (
    distance(a.end, b.start) < CONNECT_TOLERANCE ||
    distance(a.end, b.end) < CONNECT_TOLERANCE ||
    distance(a.start, b.start) < CONNECT_TOLERANCE ||
    distance(a.start, b.end) < CONNECT_TOLERANCE
  )
}

function findCycles(walls: WallNode[]): WallNode[][] {
  const cycles: WallNode[][] = []
  const usedIds = new Set<string>()

  for (const w1 of walls) {
    if (usedIds.has(w1.id)) continue
    const w2 = walls.find(w => w.id !== w1.id && !usedIds.has(w.id) && wallsAreConnected(w1, w))
    if (!w2) continue
    const w3 = walls.find(w => w.id !== w1.id && w.id !== w2.id && !usedIds.has(w.id) && wallsAreConnected(w2, w))
    if (!w3) continue
    const w4 = walls.find(w => w.id !== w1.id && w.id !== w2.id && w.id !== w3.id && !usedIds.has(w.id) && wallsAreConnected(w3, w))
    if (!w4) continue

    const closes = wallsAreConnected(w4, w1)
    if (closes) {
      cycles.push([w1, w2, w3, w4])
      usedIds.add(w1.id); usedIds.add(w2.id); usedIds.add(w3.id); usedIds.add(w4.id)
    }
  }

  return cycles
}

function cycleToRoomGraph(cycle: WallNode[], existingRoom?: RoomNode): Omit<RoomGraphCache, 'nodeId'> {
  const allPoints: Point[] = cycle.flatMap(w => [w.start, w.end])
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of allPoints) {
    if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y
  }
  const boundary: Point[] = [
    { x: minX, y: minY }, { x: maxX, y: minY },
    { x: maxX, y: maxY }, { x: minX, y: maxY },
  ]
  const areaPx2 = (maxX - minX) * (maxY - minY)
  const areaM2 = areaPx2 / 10000

  return {
    boundary,
    area: areaM2,
    perimeter: polygonArea(boundary) > 0 ? 2 * ((maxX - minX) + (maxY - minY)) / 100 : 0,
    wallIds: cycle.map(w => w.id),
    openingIds: cycle.flatMap(w => w.openingIds ?? []),
    roomType: existingRoom?.roomType,
  }
}

export function recomputeRoomGraphs(
  dirtyIds: string[],
  doc: CadDocument,
  current: DerivedDocumentState['roomGraphs']
): DerivedDocumentState['roomGraphs'] {
  const allWalls = Object.values(doc.nodes).filter(isWallNode)
  const allRooms = Object.values(doc.nodes).filter(isRoomNode)
  const cycles = findCycles(allWalls)

  const updated: DerivedDocumentState['roomGraphs'] = {}

  for (const cycle of cycles) {
    const cycleWallIds = new Set(cycle.map(w => w.id))
    const matchingRoom = allRooms.find(r => r.boundaryWallIds.every(id => cycleWallIds.has(id)))

    const nodeId = matchingRoom?.id ?? `room-detected-${cycle.map(w => w.id).join('-')}`
    updated[nodeId] = { nodeId, ...cycleToRoomGraph(cycle, matchingRoom) }
  }

  for (const room of allRooms) {
    if (!(room.id in updated)) {
      const existingCache = current[room.id]
      if (existingCache) updated[room.id] = existingCache
    }
  }

  return updated
}
