import type { CadDocument } from '../../../contracts/document'
import type { UpdateNodeCommand } from '../../../contracts/commands'
import type { CadNode } from '../../../contracts/nodes'
import type { ValidationResult } from '../../../contracts/validation'

export function validateUpdateNode(cmd: UpdateNodeCommand, doc: CadDocument): ValidationResult {
  if (!doc.nodes[cmd.nodeId]) {
    return { ok: false, errors: [{ stage: 'structural', code: 'NODE_NOT_FOUND', message: `node ${cmd.nodeId} does not exist` }] }
  }
  const node = doc.nodes[cmd.nodeId]
  if (node.type !== cmd.nodeType) {
    return { ok: false, errors: [{ stage: 'structural', code: 'TYPE_MISMATCH', message: `expected type ${cmd.nodeType}, got ${node.type}` }] }
  }
  return { ok: true }
}

export function applyUpdateNode(cmd: UpdateNodeCommand, doc: CadDocument): CadDocument {
  const existing = doc.nodes[cmd.nodeId]
  return {
    ...doc,
    nodes: {
      ...doc.nodes,
      [cmd.nodeId]: { ...existing, ...cmd.changes } as CadNode,
    },
  }
}
