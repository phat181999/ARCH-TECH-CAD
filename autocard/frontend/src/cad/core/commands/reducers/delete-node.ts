import type { CadDocument } from '../../../contracts/document'
import type { DeleteNodeCommand } from '../../../contracts/commands'
import type { ValidationResult } from '../../../contracts/validation'

export function validateDeleteNode(cmd: DeleteNodeCommand, doc: CadDocument): ValidationResult {
  if (!doc.nodes[cmd.nodeId]) {
    return { ok: false, errors: [{ stage: 'structural', code: 'NODE_NOT_FOUND', message: `node ${cmd.nodeId} does not exist` }] }
  }
  return { ok: true }
}

export function applyDeleteNode(cmd: DeleteNodeCommand, doc: CadDocument): CadDocument {
  const nodes = { ...doc.nodes }
  delete nodes[cmd.nodeId]
  return {
    ...doc,
    nodes,
    roots: doc.roots.filter(id => id !== cmd.nodeId),
  }
}
