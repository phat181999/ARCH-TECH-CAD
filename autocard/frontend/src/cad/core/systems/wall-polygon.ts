import type { CadDocument, WallPolygonCache, WallJoinCache, DerivedDocumentState } from '../../contracts/document'
import type { WallNode } from '../../contracts/nodes'
import type { Point } from '../../contracts/document'
import { offsetLine, getLineIntersection, distance } from '../geometry/math'
import { isWallNode } from '../../contracts/nodes'

export type WallPolygonResult = {
  wallId: string
  points: Point[]
}

function computeWallPolygons(walls: WallNode[]): WallPolygonResult[] {
  const results: WallPolygonResult[] = []

  for (const wall of walls) {
    const hw = wall.thickness / 2
    const leftLine  = offsetLine(wall.start, wall.end,  hw)
    const rightLine = offsetLine(wall.start, wall.end, -hw)

    let p1 = leftLine.start
    let p2 = leftLine.end
    let p3 = rightLine.end
    let p4 = rightLine.start

    for (const other of walls) {
      if (other.id === wall.id) continue
      const ohw = other.thickness / 2
      const otherLeft  = offsetLine(other.start, other.end,  ohw)
      const otherRight = offsetLine(other.start, other.end, -ohw)

      const touchesStart = distance(wall.start, other.end) < 1 || distance(wall.start, other.start) < 1
      const touchesEnd   = distance(wall.end, other.start) < 1 || distance(wall.end, other.end) < 1

      if (touchesStart) {
        const candidatesL = [
          getLineIntersection(leftLine.start, leftLine.end, otherLeft.start, otherLeft.end, true, true),
          getLineIntersection(leftLine.start, leftLine.end, otherRight.start, otherRight.end, true, true),
        ].filter((p): p is Point => p !== null)
        candidatesL.sort((a, b) => distance(a, wall.start) - distance(b, wall.start))
        if (candidatesL.length > 0 && distance(candidatesL[0], wall.start) < wall.thickness * 3) p1 = candidatesL[0]

        const candidatesR = [
          getLineIntersection(rightLine.start, rightLine.end, otherRight.start, otherRight.end, true, true),
          getLineIntersection(rightLine.start, rightLine.end, otherLeft.start, otherLeft.end, true, true),
        ].filter((p): p is Point => p !== null)
        candidatesR.sort((a, b) => distance(a, wall.start) - distance(b, wall.start))
        if (candidatesR.length > 0 && distance(candidatesR[0], wall.start) < wall.thickness * 3) p4 = candidatesR[0]
      }

      if (touchesEnd) {
        const candidatesL = [
          getLineIntersection(leftLine.start, leftLine.end, otherLeft.start, otherLeft.end, true, true),
          getLineIntersection(leftLine.start, leftLine.end, otherRight.start, otherRight.end, true, true),
        ].filter((p): p is Point => p !== null)
        candidatesL.sort((a, b) => distance(a, wall.end) - distance(b, wall.end))
        if (candidatesL.length > 0 && distance(candidatesL[0], wall.end) < wall.thickness * 3) p2 = candidatesL[0]

        const candidatesR = [
          getLineIntersection(rightLine.start, rightLine.end, otherRight.start, otherRight.end, true, true),
          getLineIntersection(rightLine.start, rightLine.end, otherLeft.start, otherLeft.end, true, true),
        ].filter((p): p is Point => p !== null)
        candidatesR.sort((a, b) => distance(a, wall.end) - distance(b, wall.end))
        if (candidatesR.length > 0 && distance(candidatesR[0], wall.end) < wall.thickness * 3) p3 = candidatesR[0]
      }
    }

    results.push({ wallId: wall.id, points: [p1, p2, p3, p4] })
  }

  return results
}

export function recomputeWallPolygons(
  dirtyIds: string[],
  doc: CadDocument,
  current: DerivedDocumentState['wallPolygons']
): DerivedDocumentState['wallPolygons'] {
  const allWalls = Object.values(doc.nodes).filter(isWallNode)
  const dirtySet = new Set(dirtyIds)

  const wallsToRecompute = dirtySet.size > 0
    ? allWalls.filter(w => dirtySet.has(w.id) || allWalls.some(ow => ow.id !== w.id && (dirtySet.has(ow.id)) && (distance(w.start, ow.start) < 1 || distance(w.start, ow.end) < 1 || distance(w.end, ow.start) < 1 || distance(w.end, ow.end) < 1)))
    : allWalls

  const results = computeWallPolygons(wallsToRecompute)
  const updated = { ...current }

  for (const r of results) {
    const wall = doc.nodes[r.wallId] as WallNode
    updated[r.wallId] = {
      nodeId: r.wallId,
      outline: r.points,
      centerLine: [wall.start, wall.end],
      thickness: wall.thickness,
      joinsWith: allWalls
        .filter(ow => ow.id !== r.wallId && (distance(wall.start, ow.start) < 1 || distance(wall.start, ow.end) < 1 || distance(wall.end, ow.start) < 1 || distance(wall.end, ow.end) < 1))
        .map(ow => ow.id),
    }
  }

  for (const id of dirtyIds) {
    if (!(id in doc.nodes)) delete updated[id]
  }

  return updated
}
