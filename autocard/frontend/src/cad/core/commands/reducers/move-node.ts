import type { CadDocument } from '../../../contracts/document'
import type { MoveNodeCommand } from '../../../contracts/commands'
import type { CadNode } from '../../../contracts/nodes'
import type { ValidationResult } from '../../../contracts/validation'
import type { Point } from '../../../contracts/document'

function translatePoint(p: Point, delta: Point): Point {
  return { x: p.x + delta.x, y: p.y + delta.y }
}

export function validateMoveNode(cmd: MoveNodeCommand, doc: CadDocument): ValidationResult {
  if (!doc.nodes[cmd.nodeId]) {
    return { ok: false, errors: [{ stage: 'structural', code: 'NODE_NOT_FOUND', message: `node ${cmd.nodeId} does not exist` }] }
  }
  return { ok: true }
}

export function applyMoveNode(cmd: MoveNodeCommand, doc: CadDocument): CadDocument {
  const node = doc.nodes[cmd.nodeId]
  const delta = cmd.delta
  let moved: CadNode = node

  const n = node as any
  switch (node.type) {
    case 'line':
    case 'wall':
      moved = { ...n, start: translatePoint(n.start, delta), end: translatePoint(n.end, delta) } as CadNode
      break
    case 'circle':
    case 'arc':
      moved = { ...n, center: translatePoint(n.center, delta) } as CadNode
      break
    case 'text':
    case 'leader':
      moved = { ...n, position: translatePoint(n.position, delta) } as CadNode
      break
    case 'dimension':
      moved = { ...n, anchorPoints: n.anchorPoints?.map((p: Point) => translatePoint(p, delta)) } as CadNode
      break
    case 'polyline':
      moved = { ...n, points: n.points?.map((p: Point) => translatePoint(p, delta)) } as CadNode
      break
    case 'hatch':
      moved = { ...n, boundary: n.boundary?.map((p: Point) => translatePoint(p, delta)) } as CadNode
      break
    case 'rectangle':
      moved = { ...n, origin: translatePoint(n.origin, delta) } as CadNode
      break
    case 'block-instance':
    case 'furniture':
    case 'column':
      moved = { ...n, position: translatePoint(n.position, delta) } as CadNode
      break
    default:
      if (n.position) moved = { ...n, position: translatePoint(n.position, delta) } as CadNode
      else if (n.start) moved = { ...n, start: translatePoint(n.start, delta), end: translatePoint(n.end, delta) } as CadNode
  }

  return { ...doc, nodes: { ...doc.nodes, [cmd.nodeId]: moved } }
}
