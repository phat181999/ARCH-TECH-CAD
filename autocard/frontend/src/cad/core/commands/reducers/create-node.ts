import type { CadDocument } from '../../../contracts/document'
import type { CreateNodeCommand } from '../../../contracts/commands'
import type { ValidationResult, ValidationError } from '../../../contracts/validation'

export function validateCreateNode(cmd: CreateNodeCommand, doc: CadDocument): ValidationResult {
  const errs: ValidationError[] = []
  if (!cmd.node.id) errs.push({ stage: 'schema', code: 'MISSING_NODE_ID', message: 'node.id is required' })
  if (!cmd.node.type) errs.push({ stage: 'schema', code: 'MISSING_NODE_TYPE', message: 'node.type is required' })
  if (!cmd.node.layerId) errs.push({ stage: 'schema', code: 'MISSING_LAYER_ID', message: 'node.layerId is required' })
  if (doc.nodes[cmd.node.id]) errs.push({ stage: 'structural', code: 'DUPLICATE_NODE_ID', message: `node ${cmd.node.id} already exists` })
  if (cmd.node.layerId && !doc.layers[cmd.node.layerId]) errs.push({ stage: 'structural', code: 'INVALID_LAYER_REF', message: `layer ${cmd.node.layerId} does not exist` })
  if (errs.length > 0) return { ok: false, errors: errs }
  return { ok: true }
}

export function applyCreateNode(cmd: CreateNodeCommand, doc: CadDocument): CadDocument {
  return {
    ...doc,
    nodes: { ...doc.nodes, [cmd.node.id]: cmd.node },
    roots: cmd.node.parentId === null
      ? [...doc.roots, cmd.node.id]
      : doc.roots,
  }
}
